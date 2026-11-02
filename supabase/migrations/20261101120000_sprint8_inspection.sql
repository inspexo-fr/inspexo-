-- SPRINT 8 — Inspection à la demande (Toulouse et Haute-Garonne au départ).
--
-- Migration ADDITIVE. On ne REPREND PAS les tables héritées `experts` et
-- `missions` : leur schéma décrit un autre produit (3 paliers, chat IA,
-- Cal.com, avis), elles portent les SEULES policies RLS anon/authenticated
-- directes du projet, et aucune migration ne les crée (elles datent du
-- dashboard, avant le workflow migrations). Elles restent en place, vides et
-- intactes ; le sprint 8 construit à côté, dans l'architecture actuelle :
-- RLS active, AUCUNE policy anon, accès public par RPC SECURITY DEFINER.
--
-- ⚠️ EXCEPTION ASSUMÉE AU PRINCIPE « photos jamais stockées » : les photos
-- prises par l'INSPECTEUR pendant une inspection payée sont conservées, parce
-- qu'elles SONT le rapport que l'acheteur a acheté. Elles vivent dans un
-- bucket privé, ne sont lisibles que par l'acheteur de cette inspection,
-- l'inspecteur qui l'a faite et les admins, et exigent le consentement
-- horodaté de l'inspecteur (vendeur informé). Les photos de l'ACHETEUR
-- (score, mode visite) restent, elles, jamais stockées.

-- ============================================================
-- 1. Inspecteurs
-- ============================================================
create table if not exists public.inspecteurs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  email text not null,
  nom text not null,
  telephone text,
  -- Indépendant : SIRET obligatoire (format validé côté serveur, clé de Luhn).
  siret text not null,
  raison_sociale text,
  -- Assurance responsabilité civile professionnelle : justificatif + échéance.
  rc_pro_assureur text,
  rc_pro_numero text,
  rc_pro_echeance date,
  rc_pro_document text, -- chemin dans le bucket privé `inspecteurs`
  -- Charte d'indépendance : jamais rémunéré par le vendeur. Version + preuve.
  charte_version text,
  charte_signee_le timestamptz,
  charte_ip_hash text,
  -- Zone couverte : codes de département ('31' au lancement).
  departements text[] not null default '{}',
  stripe_account_id text,
  stripe_paiements_actifs boolean not null default false,
  statut text not null default 'candidat'
    check (statut in ('candidat', 'valide', 'suspendu', 'refuse')),
  motif_refus text,
  valide_le timestamptz,
  valide_par uuid references auth.users (id),
  created_at timestamptz not null default now()
);
alter table public.inspecteurs enable row level security;
create index if not exists inspecteurs_statut_idx on public.inspecteurs (statut);
create index if not exists inspecteurs_departements_idx on public.inspecteurs using gin (departements);

-- ============================================================
-- 2. Inspections
-- ============================================================
create table if not exists public.inspections (
  id uuid primary key default gen_random_uuid(),
  ref_num bigint,
  analysis_id uuid not null references public.analyses (id) on delete cascade,
  acheteur_id uuid not null references auth.users (id) on delete cascade,
  inspecteur_id uuid references public.inspecteurs (id) on delete set null,
  -- Zone de la demande (code postal saisi par l'acheteur) + département déduit.
  code_postal text not null,
  departement text not null,
  -- Coordonnées du véhicule à inspecter : saisies par l'acheteur, révélées à
  -- l'inspecteur UNIQUEMENT après acceptation (get_ma_inspection_inspecteur).
  vendeur_nom text,
  vendeur_telephone text,
  vendeur_adresse text,
  creneau_souhaite timestamptz,
  creneau_confirme timestamptz,
  -- Argent : tout en centimes, part inspecteur figée à la commande.
  prix_cents integer not null,
  part_inspecteur_cents integer not null,
  stripe_session text unique,
  stripe_payment_intent text,
  stripe_charge text,
  transfer_group text,
  transfer_id text,
  verse_le timestamptz,
  rembourse_le timestamptz,
  statut text not null default 'a_payer' check (statut in (
    'a_payer',       -- session créée, paiement non confirmé
    'a_attribuer',   -- payée, en attente d'acceptation par un inspecteur
    'acceptee',      -- un inspecteur a pris la mission
    'refusee',       -- refusée par l'inspecteur sollicité, à réattribuer
    'faite',         -- rapport rendu
    'annulee'        -- annulée / remboursée
  )),
  -- Rapport : constats structurés (même forme que les constats photo) +
  -- synthèse de l'inspecteur. Aucune donnée personnelle du vendeur ici.
  rapport_json jsonb,
  rapport_rendu_le timestamptz,
  -- Consentement à la conservation des photos (obligatoire pour en déposer).
  photos_consentement_le timestamptz,
  created_at timestamptz not null default now(),
  maj_le timestamptz not null default now()
);
alter table public.inspections enable row level security;
create index if not exists inspections_acheteur_idx on public.inspections (acheteur_id);
create index if not exists inspections_inspecteur_idx on public.inspections (inspecteur_id);
create index if not exists inspections_statut_dept_idx on public.inspections (statut, departement);

create sequence if not exists public.inspections_ref_seq;
alter table public.inspections alter column ref_num set default nextval('public.inspections_ref_seq');

-- Refus nominatifs : un inspecteur qui refuse ne doit plus voir la mission.
create table if not exists public.inspection_refus (
  inspection_id uuid not null references public.inspections (id) on delete cascade,
  inspecteur_id uuid not null references public.inspecteurs (id) on delete cascade,
  motif text,
  created_at timestamptz not null default now(),
  primary key (inspection_id, inspecteur_id)
);
alter table public.inspection_refus enable row level security;

-- Photos du rapport (bucket privé `rapports`), déposées par l'inspecteur.
create table if not exists public.inspection_photos (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections (id) on delete cascade,
  chemin text not null,
  organe text,
  legende text,
  created_at timestamptz not null default now()
);
alter table public.inspection_photos enable row level security;
create index if not exists inspection_photos_idx on public.inspection_photos (inspection_id);

-- ============================================================
-- 3. Buckets privés
-- ============================================================
insert into storage.buckets (id, name, public)
values ('rapports', 'rapports', false), ('inspecteurs', 'inspecteurs', false)
on conflict (id) do nothing;

-- Lecture des photos de rapport : l'acheteur de CETTE inspection,
-- l'inspecteur qui l'a faite, et les admins. Écriture : service role seul.
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'rapports lecture parties'
  ) then
    create policy "rapports lecture parties"
      on storage.objects for select to authenticated
      using (
        bucket_id = 'rapports'
        and (
          exists (select 1 from public.admins a where a.user_id = auth.uid())
          or exists (
            select 1 from public.inspection_photos ip
            join public.inspections i on i.id = ip.inspection_id
            left join public.inspecteurs ins on ins.id = i.inspecteur_id
            where ip.chemin = storage.objects.name
              and (i.acheteur_id = auth.uid() or ins.user_id = auth.uid())
          )
        )
      );
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'inspecteurs lecture admins'
  ) then
    create policy "inspecteurs lecture admins"
      on storage.objects for select to authenticated
      using (
        bucket_id = 'inspecteurs'
        and exists (select 1 from public.admins a where a.user_id = auth.uid())
      );
  end if;
end $$;

-- ============================================================
-- 4. Helpers internes
-- ============================================================
-- Département d'un code postal français. Corse (2A/2B) ramenée à '20' comme
-- le fait l'INSEE pour les codes postaux ; DOM sur 3 chiffres (971-976).
create or replace function public._departement(p_cp text)
returns text
language sql
immutable
as $$
  select case
    when p_cp !~ '^[0-9]{5}$' then null
    when left(p_cp, 2) = '97' or left(p_cp, 2) = '98' then left(p_cp, 3)
    else left(p_cp, 2)
  end;
$$;

-- Un inspecteur VALIDÉ, avec Connect opérationnel, couvre-t-il ce département ?
create or replace function public._inspecteur_dispo(p_dept text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.inspecteurs
    where statut = 'valide'
      and stripe_paiements_actifs
      and p_dept = any (departements)
  );
$$;
revoke all on function public._inspecteur_dispo(text) from public, anon, authenticated;

-- L'inspecteur connecté (ligne complète), ou null.
create or replace function public._inspecteur_courant()
returns public.inspecteurs
language sql
stable
security definer
set search_path = public
as $$
  select * from public.inspecteurs where user_id = auth.uid() limit 1;
$$;
revoke all on function public._inspecteur_courant() from public, anon, authenticated;

-- ============================================================
-- 5. RPC — côté acheteur
-- ============================================================
-- Disponibilité publique d'une zone : un booléen, jamais la liste des
-- inspecteurs. Sert au bloc « Faire inspecter cette voiture » de /a/:id.
create or replace function public.inspection_zone(p_code_postal text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dept text := public._departement(p_code_postal);
begin
  if v_dept is null then
    return jsonb_build_object('valide', false);
  end if;
  return jsonb_build_object(
    'valide', true,
    'departement', v_dept,
    'disponible', public._inspecteur_dispo(v_dept)
  );
end;
$$;
grant execute on function public.inspection_zone(text) to anon, authenticated;

-- Les inspections de l'acheteur connecté (dossier d'achat).
create or replace function public.mes_inspections()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id,
    'ref_num', i.ref_num,
    'analysis_id', i.analysis_id,
    'statut', i.statut,
    'code_postal', i.code_postal,
    'creneau_souhaite', i.creneau_souhaite,
    'creneau_confirme', i.creneau_confirme,
    'prix_cents', i.prix_cents,
    'inspecteur_nom', ins.nom,
    'inspecteur_telephone', case when i.statut in ('acceptee', 'faite') then ins.telephone end,
    'rapport', i.rapport_json,
    'rapport_rendu_le', i.rapport_rendu_le,
    'marque', a.marque,
    'modele', a.modele,
    'created_at', i.created_at
  ) order by i.created_at desc), '[]'::jsonb)
  from public.inspections i
  join public.analyses a on a.id = i.analysis_id
  left join public.inspecteurs ins on ins.id = i.inspecteur_id
  where i.acheteur_id = auth.uid()
    and i.statut <> 'a_payer';
$$;
revoke all on function public.mes_inspections() from public, anon;
grant execute on function public.mes_inspections() to authenticated;

-- Photos d'un rapport : chemins rendus à l'acheteur de CETTE inspection
-- (l'URL signée est délivrée par la fonction edge, jamais ici).
create or replace function public.inspection_photos_liste(p_inspection_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'chemin', ip.chemin, 'organe', ip.organe, 'legende', ip.legende
  ) order by ip.created_at), '[]'::jsonb)
  from public.inspection_photos ip
  join public.inspections i on i.id = ip.inspection_id
  left join public.inspecteurs ins on ins.id = i.inspecteur_id
  where ip.inspection_id = p_inspection_id
    and (i.acheteur_id = auth.uid() or ins.user_id = auth.uid());
$$;
revoke all on function public.inspection_photos_liste(uuid) from public, anon;
grant execute on function public.inspection_photos_liste(uuid) to authenticated;

-- ============================================================
-- 6. RPC — côté inspecteur
-- ============================================================
-- Fiche de l'inspecteur connecté (null s'il n'est pas inscrit).
create or replace function public.mon_profil_inspecteur()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v public.inspecteurs;
begin
  if auth.uid() is null then return null; end if;
  select * into v from public.inspecteurs where user_id = auth.uid();
  if not found then return null; end if;
  return jsonb_build_object(
    'id', v.id, 'nom', v.nom, 'email', v.email, 'telephone', v.telephone,
    'siret', v.siret, 'raison_sociale', v.raison_sociale,
    'rc_pro_assureur', v.rc_pro_assureur, 'rc_pro_echeance', v.rc_pro_echeance,
    'rc_pro_document', (v.rc_pro_document is not null),
    'charte_version', v.charte_version, 'charte_signee_le', v.charte_signee_le,
    'departements', v.departements,
    'stripe_connecte', (v.stripe_account_id is not null),
    'stripe_paiements_actifs', v.stripe_paiements_actifs,
    'statut', v.statut, 'motif_refus', v.motif_refus
  );
end;
$$;
revoke all on function public.mon_profil_inspecteur() from public, anon;
grant execute on function public.mon_profil_inspecteur() to authenticated;

-- Missions visibles par l'inspecteur connecté :
--  - celles à attribuer dans SES départements qu'il n'a pas refusées
--    (coordonnées du vendeur MASQUÉES tant qu'il n'a pas accepté) ;
--  - celles qu'il a acceptées ou faites (coordonnées révélées).
create or replace function public.inspecteur_missions()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v public.inspecteurs;
begin
  select * into v from public.inspecteurs where user_id = auth.uid();
  if not found or v.statut <> 'valide' then return '[]'::jsonb; end if;

  return coalesce((
    select jsonb_agg(x order by x->>'created_at' desc) from (
      select jsonb_build_object(
        'id', i.id,
        'ref_num', i.ref_num,
        'statut', i.statut,
        'a_moi', (i.inspecteur_id = v.id),
        'code_postal', i.code_postal,
        'departement', i.departement,
        'creneau_souhaite', i.creneau_souhaite,
        'creneau_confirme', i.creneau_confirme,
        'part_inspecteur_cents', i.part_inspecteur_cents,
        'marque', a.marque, 'modele', a.modele, 'annee', a.annee,
        'analysis_id', i.analysis_id,
        'verdict', a.verdict, 'score', a.score,
        -- Coordonnées du vendeur : UNIQUEMENT après acceptation par CET
        -- inspecteur. Avant, il ne voit que la zone et le véhicule.
        'vendeur_nom', case when i.inspecteur_id = v.id then i.vendeur_nom end,
        'vendeur_telephone', case when i.inspecteur_id = v.id then i.vendeur_telephone end,
        'vendeur_adresse', case when i.inspecteur_id = v.id then i.vendeur_adresse end,
        'rapport_rendu_le', i.rapport_rendu_le,
        'created_at', i.created_at
      ) as x
      from public.inspections i
      join public.analyses a on a.id = i.analysis_id
      where (
        (i.statut in ('a_attribuer', 'refusee')
         and i.departement = any (v.departements)
         and not exists (
           select 1 from public.inspection_refus r
           where r.inspection_id = i.id and r.inspecteur_id = v.id
         ))
        or (i.inspecteur_id = v.id and i.statut in ('acceptee', 'faite'))
      )
    ) t
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.inspecteur_missions() from public, anon;
grant execute on function public.inspecteur_missions() to authenticated;

-- Acceptation : atomique (le premier qui accepte prend la mission).
create or replace function public.inspection_accepter(
  p_inspection_id uuid,
  p_creneau timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.inspecteurs;
  v_maj integer;
begin
  select * into v from public.inspecteurs where user_id = auth.uid();
  if not found or v.statut <> 'valide' then raise exception 'inspecteur non validé'; end if;

  -- La clause de statut fait l'exclusion mutuelle : deux acceptations
  -- simultanées, une seule passe.
  update public.inspections i
  set inspecteur_id = v.id,
      statut = 'acceptee',
      creneau_confirme = coalesce(p_creneau, i.creneau_souhaite),
      maj_le = now()
  where i.id = p_inspection_id
    and i.statut in ('a_attribuer', 'refusee')
    and i.departement = any (v.departements);
  get diagnostics v_maj = row_count;

  if v_maj = 0 then
    return jsonb_build_object('ok', false, 'raison', 'deja_prise');
  end if;
  insert into public.events (name, props_json)
  values ('inspection_acceptee', jsonb_build_object('inspection_id', p_inspection_id));
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.inspection_accepter(uuid, timestamptz) from public, anon;
grant execute on function public.inspection_accepter(uuid, timestamptz) to authenticated;

create or replace function public.inspection_refuser(p_inspection_id uuid, p_motif text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.inspecteurs;
begin
  select * into v from public.inspecteurs where user_id = auth.uid();
  if not found or v.statut <> 'valide' then raise exception 'inspecteur non validé'; end if;

  insert into public.inspection_refus (inspection_id, inspecteur_id, motif)
  values (p_inspection_id, v.id, left(coalesce(p_motif, ''), 300))
  on conflict do nothing;

  -- Si c'était SA mission, elle retourne au pot commun.
  update public.inspections
  set inspecteur_id = null, statut = 'refusee', creneau_confirme = null, maj_le = now()
  where id = p_inspection_id and inspecteur_id = v.id and statut = 'acceptee';

  insert into public.events (name, props_json)
  values ('inspection_refusee', jsonb_build_object('inspection_id', p_inspection_id));
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.inspection_refuser(uuid, text) from public, anon;
grant execute on function public.inspection_refuser(uuid, text) to authenticated;

-- Consentement à la conservation des photos : exigé AVANT tout dépôt.
create or replace function public.inspection_consentement_photos(p_inspection_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.inspecteurs;
  v_maj integer;
begin
  select * into v from public.inspecteurs where user_id = auth.uid();
  if not found then raise exception 'inspecteur inconnu'; end if;
  update public.inspections
  set photos_consentement_le = now(), maj_le = now()
  where id = p_inspection_id and inspecteur_id = v.id and statut = 'acceptee';
  get diagnostics v_maj = row_count;
  return jsonb_build_object('ok', v_maj > 0);
end;
$$;
revoke all on function public.inspection_consentement_photos(uuid) from public, anon;
grant execute on function public.inspection_consentement_photos(uuid) to authenticated;

-- ============================================================
-- 7. Candidature inspecteur (onboarding)
-- ============================================================
-- Crée ou met à jour SA fiche tant qu'elle n'est pas validée. Le statut,
-- la validation et les identifiants Stripe ne sont JAMAIS fixés ici.
create or replace function public.inspecteur_candidater(
  p_nom text,
  p_telephone text,
  p_siret text,
  p_raison_sociale text,
  p_rc_assureur text,
  p_rc_numero text,
  p_rc_echeance date,
  p_departements text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_depts text[];
  v_siret text := regexp_replace(coalesce(p_siret, ''), '\s', '', 'g');
begin
  if v_uid is null then raise exception 'non connecté'; end if;
  if v_siret !~ '^[0-9]{14}$' then raise exception 'SIRET invalide'; end if;
  select email into v_email from auth.users where id = v_uid;

  -- Départements : codes à 2-3 chiffres, 8 au maximum.
  select coalesce(array_agg(d), '{}') into v_depts
  from (
    select distinct substring(trim(x) from 1 for 3) d
    from unnest(coalesce(p_departements, '{}')) x
    where trim(x) ~ '^[0-9]{2,3}$'
    limit 8
  ) t;

  insert into public.inspecteurs (
    user_id, email, nom, telephone, siret, raison_sociale,
    rc_pro_assureur, rc_pro_numero, rc_pro_echeance, departements
  ) values (
    v_uid, v_email, left(p_nom, 120), left(p_telephone, 30), v_siret, left(p_raison_sociale, 160),
    left(p_rc_assureur, 120), left(p_rc_numero, 60), p_rc_echeance, v_depts
  )
  on conflict (user_id) do update set
    nom = excluded.nom,
    telephone = excluded.telephone,
    siret = excluded.siret,
    raison_sociale = excluded.raison_sociale,
    rc_pro_assureur = excluded.rc_pro_assureur,
    rc_pro_numero = excluded.rc_pro_numero,
    rc_pro_echeance = excluded.rc_pro_echeance,
    departements = excluded.departements
  where public.inspecteurs.statut in ('candidat', 'refuse');

  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.inspecteur_candidater(text, text, text, text, text, text, date, text[]) from public, anon;
grant execute on function public.inspecteur_candidater(text, text, text, text, text, text, date, text[]) to authenticated;

-- Signature de la charte d'indépendance. La VERSION du texte est imposée par
-- le serveur (constante de la fonction edge) : on enregistre ce qui a été
-- réellement affiché, horodaté, avec l'IP hachée comme partout ailleurs.
create or replace function public.inspecteur_signer_charte(p_version text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_maj integer;
begin
  if v_uid is null then raise exception 'non connecté'; end if;
  if coalesce(p_version, '') = '' then raise exception 'version de charte manquante'; end if;
  update public.inspecteurs
  set charte_version = left(p_version, 40),
      charte_signee_le = now(),
      charte_ip_hash = public._request_ip_hash('charte:')
  where user_id = v_uid;
  get diagnostics v_maj = row_count;
  if v_maj = 0 then raise exception 'candidature introuvable'; end if;
  insert into public.events (name, props_json)
  values ('charte_signee', jsonb_build_object('version', left(p_version, 40)));
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.inspecteur_signer_charte(text) from public, anon;
grant execute on function public.inspecteur_signer_charte(text) to authenticated;
