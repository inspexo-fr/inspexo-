-- SPRINT 3 — Négociation chiffrée, dossier d'achat, justesse prouvée.
-- Migration STRICTEMENT ADDITIVE : aucune table existante modifiée (seule la
-- RPC track_event est remplacée pour élargir sa whitelist, comme aux sprints
-- précédents). RLS activée partout, aucune policy anon : l'accès public passe
-- exclusivement par les RPC SECURITY DEFINER ci-dessous, les edge functions
-- écrivent via la service role.

-- ============================================================
-- 1. repair_costs — coûts de réparation sourcés (négociation)
-- ============================================================
-- Une ligne = opération × famille (moteur OU boîte ; '' = générique toutes
-- familles). Alimentée par : (a) la génération des fiches moteur (coûts déjà
-- sourcés), (b) un seed de fourchettes publiées vérifiées, (c) l'admin qui
-- passe une ligne en « validé par devis » avec la photo du devis jointe.
-- AUCUN montant inventé : chaque ligne porte ses URLs sources.

create table if not exists public.repair_costs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  marque text,
  marque_norm text not null default '',
  famille text,
  famille_norm text not null default '',
  operation text not null,
  operation_norm text not null,
  cout_min_eur integer,
  cout_max_eur integer,
  url_source jsonb not null default '[]'::jsonb,
  extrait_source text,
  source_date date,
  statut text not null default 'source' check (statut in ('source', 'valide_devis')),
  devis_path text,
  valide_par text,
  valide_at timestamptz,
  constraint repair_costs_cout_present check (cout_min_eur is not null or cout_max_eur is not null)
);

create unique index if not exists repair_costs_key_uidx
  on public.repair_costs (marque_norm, famille_norm, operation_norm);

alter table public.repair_costs enable row level security;
revoke all on public.repair_costs from anon, authenticated;

-- ---- Backfill depuis les fiches moteur existantes (coûts déjà sourcés) ----
insert into public.repair_costs
  (marque, marque_norm, famille, famille_norm, operation, operation_norm,
   cout_min_eur, cout_max_eur, url_source, source_date, statut)
select
  ds.marque, ds.marque_norm, ds.famille_moteur, ds.famille_norm,
  p->>'titre',
  btrim(regexp_replace(lower(extensions.unaccent(p->>'titre')), '\s+', ' ', 'g')),
  case when jsonb_typeof(p->'cout_indicatif_eur_min') = 'number'
       then round((p->>'cout_indicatif_eur_min')::numeric)::integer end,
  case when jsonb_typeof(p->'cout_indicatif_eur_max') = 'number'
       then round((p->>'cout_indicatif_eur_max')::numeric)::integer end,
  coalesce(p->'url_source', '[]'::jsonb),
  case when p->>'date_consultee' ~ '^\d{4}-\d{2}-\d{2}' then (p->>'date_consultee')::date end,
  'source'
from public.defect_sheets ds, jsonb_array_elements(ds.pannes) p
where coalesce(p->>'titre', '') <> ''
  and (jsonb_typeof(p->'cout_indicatif_eur_min') = 'number'
       or jsonb_typeof(p->'cout_indicatif_eur_max') = 'number')
on conflict (marque_norm, famille_norm, operation_norm) do nothing;

insert into public.repair_costs
  (marque, marque_norm, famille, famille_norm, operation, operation_norm,
   cout_min_eur, cout_max_eur, url_source, source_date, statut)
select
  ds.marque, ds.marque_norm, ds.famille_moteur, ds.famille_norm,
  op->>'operation',
  btrim(regexp_replace(lower(extensions.unaccent(op->>'operation')), '\s+', ' ', 'g')),
  case when jsonb_typeof(op->'cout_min_eur') = 'number'
       then round((op->>'cout_min_eur')::numeric)::integer end,
  case when jsonb_typeof(op->'cout_max_eur') = 'number'
       then round((op->>'cout_max_eur')::numeric)::integer end,
  coalesce(op->'url_source', '[]'::jsonb),
  ds.updated_at::date,
  'source'
from public.defect_sheets ds, jsonb_array_elements(ds.plan_entretien) op
where coalesce(op->>'operation', '') <> ''
  and (jsonb_typeof(op->'cout_min_eur') = 'number'
       or jsonb_typeof(op->'cout_max_eur') = 'number')
on conflict (marque_norm, famille_norm, operation_norm) do nothing;

-- ---- Seed générique : fourchettes publiées, VÉRIFIÉES le 27/10/2026 ----
-- (chaque montant figure littéralement sur la page citée ; extrait conservé)
insert into public.repair_costs
  (marque_norm, famille_norm, operation, operation_norm, cout_min_eur, cout_max_eur, url_source, extrait_source, source_date, statut)
values
  ('', '', 'Remplacement embrayage (kit, pièces + main d''œuvre)', 'remplacement embrayage (kit, pieces + main d''oeuvre)', 300, 1700,
   '["https://www.vroomly.com/blog/quel-est-le-prix-dun-changement-embrayage/"]'::jsonb,
   'Au total, votre budget s''élèvera donc entre 300€ et 1 700€', '2026-10-27', 'source'),
  ('', '', 'Remplacement kit de courroie de distribution (pièces + main d''œuvre)', 'remplacement kit de courroie de distribution (pieces + main d''oeuvre)', 600, 800,
   '["https://www.vroomly.com/blog/kit-de-courroie-de-distribution-contenu-utilisation-et-prix/"]'::jsonb,
   'En moyenne, un changement de kit de courroie de distribution coûte entre 600€ et 800€, pièces et main d''œuvre incluses.', '2026-10-27', 'source'),
  ('', '', 'Plaquettes de frein (remplacement, pièces + main d''œuvre)', 'plaquettes de frein (remplacement, pieces + main d''oeuvre)', 40, 400,
   '["https://www.vroomly.com/blog/quel-est-le-prix-dun-changement-de-plaquettes-de-frein/"]'::jsonb,
   'Au total, ce montant est compris entre 40 € et 400 €.', '2026-10-27', 'source'),
  ('', '', 'Plaquettes + disques de frein (remplacement, pièces + main d''œuvre)', 'plaquettes + disques de frein (remplacement, pieces + main d''oeuvre)', 95, 500,
   '["https://www.vroomly.com/blog/quel-est-le-prix-dun-changement-de-plaquettes-de-frein/"]'::jsonb,
   'Au total, cette opération vous coûtera donc entre 95 € et 500 € selon le modèle et la marque de votre véhicule.', '2026-10-27', 'source'),
  ('', '', 'Remplacement amortisseurs (la paire, pièces + main d''œuvre)', 'remplacement amortisseurs (la paire, pieces + main d''oeuvre)', 200, 350,
   '["https://www.vroomly.com/blog/combien-coute-un-changement-damortisseurs/"]'::jsonb,
   'comptez en moyenne entre 200 et 350 euros', '2026-10-27', 'source'),
  ('', '', 'Remplacement pare-brise (pièce + main d''œuvre)', 'remplacement pare-brise (piece + main d''oeuvre)', 150, 900,
   '["https://www.vroomly.com/blog/quel-est-le-prix-dun-pare-brise/"]'::jsonb,
   'le prix total d''un changement de pare-brise est compris entre 150€ et 900€', '2026-10-27', 'source'),
  ('', '', 'Nettoyage FAP (filtre à particules) chez un professionnel', 'nettoyage fap (filtre a particules) chez un professionnel', 200, 600,
   '["https://www.idgarages.com/fr-fr/prestations/nettoyage-filtre-a-particules-fap"]'::jsonb,
   'Le prix du nettoyage du FAP chez un professionnel se situe entre 200 et 600 €', '2026-10-27', 'source'),
  ('', '', 'Remplacement FAP (filtre à particules)', 'remplacement fap (filtre a particules)', 500, 2000,
   '["https://www.idgarages.com/fr-fr/prestations/nettoyage-filtre-a-particules-fap"]'::jsonb,
   'Le remplacement complet du FAP coûte entre 500 et 2 000€', '2026-10-27', 'source'),
  ('', '', 'Remplacement vanne EGR (pièce + main d''œuvre)', 'remplacement vanne egr (piece + main d''oeuvre)', 90, 400,
   '["https://www.vroomly.com/blog/quel-est-le-prix-dun-changement-de-vanne-egr/"]'::jsonb,
   'Le prix d''un changement de vanne EGR peut donc aller d''environ 90 € à 400 €', '2026-10-27', 'source'),
  ('', '', 'Vidange complète (huile + filtre, main d''œuvre comprise)', 'vidange complete (huile + filtre, main d''oeuvre comprise)', 50, 150,
   '["https://www.vroomly.com/blog/combien-coute-une-vidange/"]'::jsonb,
   'comptez entre 50 et 150 euros pour votre vidange d''huile moteur', '2026-10-27', 'source'),
  ('', '', 'Remplacement kit embrayage + volant moteur (bi-masse)', 'remplacement kit embrayage + volant moteur (bi-masse)', 600, 1500,
   '["https://www.vroomly.com/blog/kit-dembrayage-volant-moteur-changement-et-prix/"]'::jsonb,
   'En moyenne, comptez de 600 à 1500 €.', '2026-10-27', 'source')
on conflict (marque_norm, famille_norm, operation_norm) do nothing;

-- Bucket privé pour les photos de devis (admin uniquement, service role).
insert into storage.buckets (id, name, public)
values ('devis', 'devis', false)
on conflict (id) do nothing;

-- ============================================================
-- 2. dossier — suivi des analyses par un compte léger
-- ============================================================

create table if not exists public.dossier (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id) on delete cascade,
  analysis_id uuid not null references public.analyses (id) on delete cascade,
  statut text not null default 'a_voir'
    check (statut in ('a_voir', 'visite', 'achete', 'abandonne')),
  statut_depuis timestamptz not null default now(),
  alertes boolean not null default true,
  -- Nombre de rappels connus au dernier passage du cron (null = jamais vu) :
  -- seule une AUGMENTATION déclenche un email.
  rappels_vus integer,
  outcome_email_envoye boolean not null default false,
  unique (user_id, analysis_id)
);

create index if not exists dossier_user_idx on public.dossier (user_id, created_at desc);
create index if not exists dossier_alertes_idx on public.dossier (alertes) where alertes;

alter table public.dossier enable row level security;
revoke all on public.dossier from anon, authenticated;

-- ============================================================
-- 3. outcomes — retour d'issue J+30 après « acheté »
-- ============================================================

create table if not exists public.outcomes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  analysis_id uuid not null references public.analyses (id) on delete cascade,
  prix_paye_eur integer check (prix_paye_eur is null or (prix_paye_eur > 0 and prix_paye_eur < 1000000)),
  pannes_confirmees text,
  commentaire text,
  unique (user_id, analysis_id)
);

alter table public.outcomes enable row level security;
revoke all on public.outcomes from anon, authenticated;

-- ============================================================
-- 4. audits — justesse prouvée (relecture humaine d'affirmations)
-- ============================================================

create table if not exists public.audits (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  analysis_id uuid not null references public.analyses (id) on delete cascade,
  claim_type text not null check (claim_type in
    ('panne', 'rappel', 'incoherence', 'juridique', 'photo', 'prix', 'cout', 'raison', 'entretien', 'checklist')),
  claim_text text not null,
  verdict text not null check (verdict in ('juste', 'faux', 'discutable')),
  auditeur text
);

create index if not exists audits_analysis_idx on public.audits (analysis_id);
create index if not exists audits_type_idx on public.audits (claim_type, verdict);

alter table public.audits enable row level security;
revoke all on public.audits from anon, authenticated;

-- ============================================================
-- RPC dossier_* — réservées aux utilisateurs connectés (lien magique)
-- ============================================================

create or replace function public.dossier_add(p_analysis_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'non connecté'; end if;
  if not exists (select 1 from public.analyses where id = p_analysis_id) then
    raise exception 'analyse introuvable';
  end if;
  if (select count(*) from public.dossier where user_id = v_uid) >= 100 then
    raise exception 'dossier plein';
  end if;
  insert into public.dossier (user_id, analysis_id)
  values (v_uid, p_analysis_id)
  on conflict (user_id, analysis_id) do nothing;
  insert into public.events (name, analysis_id) values ('dossier_added', p_analysis_id);
end;
$$;

create or replace function public.dossier_list()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'analysis_id', d.analysis_id,
    'statut', d.statut,
    'statut_depuis', d.statut_depuis,
    'alertes', d.alertes,
    'ajoute_le', d.created_at,
    'verdict', a.verdict,
    'score', a.score,
    'marque', a.marque,
    'modele', a.modele,
    'motorisation', a.motorisation,
    'annee', a.annee,
    'prix_affiche', a.result_json->'vehicule'->'prix_affiche',
    'analyse_le', a.created_at,
    'retour_demande', (d.statut = 'achete' and d.statut_depuis <= now() - interval '30 days'),
    'retour_fait', exists (
      select 1 from public.outcomes o
      where o.user_id = d.user_id and o.analysis_id = d.analysis_id
    )
  ) order by d.created_at desc), '[]'::jsonb)
  from public.dossier d
  join public.analyses a on a.id = d.analysis_id
  where d.user_id = auth.uid();
$$;

create or replace function public.dossier_set_statut(p_analysis_id uuid, p_statut text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  if p_statut not in ('a_voir', 'visite', 'achete', 'abandonne') then
    raise exception 'statut invalide';
  end if;
  update public.dossier
  set statut = p_statut, statut_depuis = now()
  where user_id = auth.uid() and analysis_id = p_analysis_id and statut <> p_statut;
end;
$$;

create or replace function public.dossier_set_alertes(p_analysis_id uuid, p_actives boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  update public.dossier
  set alertes = coalesce(p_actives, false)
  where user_id = auth.uid() and analysis_id = p_analysis_id;
end;
$$;

create or replace function public.dossier_remove(p_analysis_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  delete from public.dossier
  where user_id = auth.uid() and analysis_id = p_analysis_id;
end;
$$;

create or replace function public.submit_outcome(
  p_analysis_id uuid,
  p_prix_paye integer default null,
  p_pannes_confirmees text default null,
  p_commentaire text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'non connecté'; end if;
  if not exists (
    select 1 from public.dossier where user_id = v_uid and analysis_id = p_analysis_id
  ) then
    raise exception 'analyse absente du dossier';
  end if;
  if p_prix_paye is not null and (p_prix_paye <= 0 or p_prix_paye >= 1000000) then
    raise exception 'prix invalide';
  end if;

  insert into public.outcomes (user_id, analysis_id, prix_paye_eur, pannes_confirmees, commentaire)
  values (v_uid, p_analysis_id, p_prix_paye, left(p_pannes_confirmees, 1000), left(p_commentaire, 1000))
  on conflict (user_id, analysis_id) do update
    set prix_paye_eur = excluded.prix_paye_eur,
        pannes_confirmees = excluded.pannes_confirmees,
        commentaire = excluded.commentaire;

  insert into public.events (name, analysis_id) values ('outcome_submitted', p_analysis_id);
end;
$$;

grant execute on function public.dossier_add(uuid) to authenticated;
grant execute on function public.dossier_list() to authenticated;
grant execute on function public.dossier_set_statut(uuid, text) to authenticated;
grant execute on function public.dossier_set_alertes(uuid, boolean) to authenticated;
grant execute on function public.dossier_remove(uuid) to authenticated;
grant execute on function public.submit_outcome(uuid, integer, text, text) to authenticated;

-- ============================================================
-- RPC get_fiabilite — page publique /fiabilite
-- ============================================================
-- Rien n'est publié avant 50 analyses auditées : en dessous du seuil, seule
-- l'avancée (n/50) est exposée, jamais les taux.

create or replace function public.get_fiabilite()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_analyses integer;
  v_maj timestamptz;
begin
  select count(distinct analysis_id), max(created_at) into v_analyses, v_maj from public.audits;
  if coalesce(v_analyses, 0) < 50 then
    return jsonb_build_object('publie', false, 'analyses_auditees', coalesce(v_analyses, 0), 'seuil', 50);
  end if;
  return jsonb_build_object(
    'publie', true,
    'analyses_auditees', v_analyses,
    'maj', v_maj,
    'seuil', 50,
    'global', (
      select jsonb_build_object(
        'total', count(*),
        'justes', count(*) filter (where verdict = 'juste'),
        'fausses', count(*) filter (where verdict = 'faux'),
        'discutables', count(*) filter (where verdict = 'discutable')
      ) from public.audits
    ),
    'par_type', (
      select coalesce(jsonb_object_agg(claim_type, stats), '{}'::jsonb)
      from (
        select claim_type, jsonb_build_object(
          'total', count(*),
          'justes', count(*) filter (where verdict = 'juste'),
          'fausses', count(*) filter (where verdict = 'faux'),
          'discutables', count(*) filter (where verdict = 'discutable')
        ) as stats
        from public.audits
        group by claim_type
      ) s
    )
  );
end;
$$;

grant execute on function public.get_fiabilite() to anon, authenticated;

-- ============================================================
-- RPC get_analysis_etape — polling léger du verdict progressif
-- ============================================================

create or replace function public.get_analysis_etape(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'etape', a.result_json->>'etape',
    'pret', coalesce(a.result_json->>'statut_analyse', 'terminee') <> 'en_cours'
  )
  from public.analyses a
  where a.id = p_id;
$$;

grant execute on function public.get_analysis_etape(uuid) to anon, authenticated;

-- ============================================================
-- track_event — whitelist élargie (mode visite)
-- ============================================================

create or replace function public.track_event(p_name text, p_analysis_id uuid default null, p_props jsonb default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip_hash text := public._request_ip_hash('evt:');
begin
  if p_name not in ('share_clicked', 'verdict_feedback', 'visite_started') then
    raise exception 'event non autorisé';
  end if;
  if p_props is not null and pg_column_size(p_props) > 2048 then
    raise exception 'props trop volumineux';
  end if;
  if p_name = 'verdict_feedback' then
    if p_props is null
       or jsonb_typeof(p_props->'helpful') <> 'boolean'
       or (select count(*) from jsonb_object_keys(p_props)) > 1 then
      raise exception 'props invalides pour verdict_feedback';
    end if;
  end if;
  if p_name = 'visite_started' and p_props is not null then
    raise exception 'props invalides pour visite_started';
  end if;

  if (select count(*) from public.events
      where name in ('share_clicked', 'verdict_feedback', 'visite_started')
        and ip_hash = v_ip_hash
        and created_at > now() - interval '24 hours') >= 120 then
    raise exception 'trop de demandes, réessayez plus tard';
  end if;

  insert into public.events (name, analysis_id, ip_hash, props_json)
  values (p_name, p_analysis_id, v_ip_hash, p_props);
end;
$$;

grant execute on function public.track_event(text, uuid, jsonb) to anon, authenticated;
