-- ===========================================================================
-- SPRINT 14 — Visio guidée. DEUX PRESTATIONS, UN SEUL CIRCUIT.
--
-- Choix d'architecture (validé le 4 nov. 2026) : une COLONNE `type` sur
-- `inspections`, pas une table `visios`. Tout le circuit est réutilisé sans
-- duplication — autorisation puis capture, échéance à deux bornes, annulation,
-- arbitrage, transferts, consentement photos, purges, admin. Une seconde table
-- aurait voulu dire une seconde copie de chacune de ces mécaniques, et donc
-- deux endroits où corriger le prochain défaut.
--
-- ⚠️ Le prix, la part de l'inspecteur, la zone, le délai d'annulation gratuite
-- et la retenue ne sont PAS en base : ils vivent dans `PRESTATIONS`
-- (`_shared/inspection.ts`), et sont FIGÉS sur la ligne à la commande
-- (`prix_cents`, `part_inspecteur_cents` existent déjà). Une évolution de
-- tarif ne doit jamais réécrire le passé.
-- ===========================================================================

alter table public.inspections
  add column if not exists type text not null default 'inspection';

alter table public.inspections
  drop constraint if exists inspections_type_check;
alter table public.inspections
  add constraint inspections_type_check check (type in ('inspection', 'visio'));

comment on column public.inspections.type is
  'Type de prestation : inspection sur place, ou visio guidée. Le défaut est '
  '« inspection » pour que les lignes antérieures au sprint 14 restent exactes.';

create index if not exists inspections_type_statut_idx on public.inspections (type, statut);

-- ---------------------------------------------------------------------------
-- Vidéo. Le lien est créé À LA CONFIRMATION, pas à la commande : une mission
-- que personne n'a prise n'a pas de salle.
--
-- ⚠️ `visio_url` n'est PAS un secret suffisant à lui seul. La fenêtre
-- d'ouverture est vérifiée SERVEUR à chaque demande d'accès : une URL qui
-- circule hors de sa fenêtre ne donne rien.
-- ---------------------------------------------------------------------------
alter table public.inspections
  add column if not exists visio_salle text,
  add column if not exists visio_url_acheteur text,
  add column if not exists visio_url_inspecteur text,
  add column if not exists visio_ouverte_le timestamptz,
  add column if not exists visio_terminee_le timestamptz,
  -- Consentement de l'ACHETEUR aux captures d'écran pendant l'appel. Sans lui,
  -- aucune capture n'est déposée — même règle que les photos d'inspection.
  add column if not exists captures_consentement_le timestamptz;

comment on column public.inspections.captures_consentement_le is
  'Consentement horodaté de l''acheteur aux captures pendant la visio. Sans '
  'lui, aucune capture n''est acceptée (mêmes règles que les photos '
  'd''inspection : aucune personne reconnaissable, conservation 2 ans).';

-- ---------------------------------------------------------------------------
-- Inspecteurs : l'option visio, activable par inspecteur dans l'admin.
--
-- Éteinte par défaut : guider un acheteur au téléphone n'est pas le même
-- métier que de se déplacer, et tout inspecteur validé n'est pas d'office
-- disponible pour ça.
-- ---------------------------------------------------------------------------
alter table public.inspecteurs
  add column if not exists visio boolean not null default false;

comment on column public.inspecteurs.visio is
  'L''inspecteur accepte-t-il les visios guidées ? FAUX par défaut.';

create index if not exists inspecteurs_visio_idx on public.inspecteurs (visio) where visio;

-- ---------------------------------------------------------------------------
-- Drapeau de la fonctionnalité, ÉTEINT.
-- ---------------------------------------------------------------------------
insert into public.drapeaux (cle, etat, description) values (
  'visio_guidee',
  'eteint',
  'Visio guidée avec un inspecteur (59 €). À ouvrir après un appel réel de bout en bout et la souscription du plan vidéo.'
) on conflict (cle) do nothing;

-- ---------------------------------------------------------------------------
-- Les RPC existantes deviennent conscientes du type.
-- ---------------------------------------------------------------------------

-- Zone : la visio couvre la France entière, mais exige un inspecteur qui a
-- ACTIVÉ l'option. Sans cela, on ouvrirait un service que personne ne peut
-- rendre — exactement le défaut du drapeau `stripe_paiements_actifs` du
-- sprint 8, qu'on ne refait pas.
create or replace function public.visio_disponible()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.inspecteurs
     where statut = 'valide' and visio and stripe_paiements_actifs
  );
$$;

revoke all on function public.visio_disponible() from public;
grant execute on function public.visio_disponible() to anon, authenticated, service_role;

-- ⚠️ LES DEUX FONCTIONS CI-DESSOUS FILTRAIENT SUR LE DÉPARTEMENT.
--
-- `i.departement = any(v.departements)` apparaît dans `inspecteur_missions`
-- ET dans `inspection_accepter`. Une visio, qui n'a pas de zone, n'aurait
-- donc jamais été ni VISIBLE ni ACCEPTABLE : l'inspecteur aurait vu une liste
-- vide et le service aurait paru cassé sans qu'aucune erreur ne se produise.
--
-- Les corps sont repris MOT POUR MOT de la migration 20261101120000 ; la
-- seule chose qui change est la condition de zone, rendue dépendante du type.
-- Les champs rendus sont inchangés : `a_moi`, `verdict`, `score`,
-- `rapport_rendu_le`, `created_at` et le tri en font partie, et l'écran
-- inspecteur s'en sert.
-- ---------------------------------------------------------------------------
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
        'type', i.type,
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
        -- Le lien vidéo suit la même règle : jamais avant acceptation.
        'visio_url_inspecteur', case when i.inspecteur_id = v.id then i.visio_url_inspecteur end,
        'rapport_rendu_le', i.rapport_rendu_le,
        'created_at', i.created_at
      ) as x
      from public.inspections i
      join public.analyses a on a.id = i.analysis_id
      where (
        (i.statut in ('a_attribuer', 'refusee')
         and (
           -- Inspection : la zone s'applique. Visio : il faut avoir activé
           -- l'option, mais aucune contrainte géographique.
           (i.type = 'inspection' and i.departement = any (v.departements))
           or (i.type = 'visio' and v.visio)
         )
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
    and (
      (i.type = 'inspection' and i.departement = any (v.departements))
      or (i.type = 'visio' and v.visio)
    );
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

-- Consentement de l'ACHETEUR aux captures pendant la visio. Symétrique du
-- consentement de l'inspecteur aux photos d'inspection : sans lui, la fonction
-- de dépôt refuse. C'est l'acheteur qui filme, c'est donc lui qui consent.
create or replace function public.visio_consentement_captures(p_inspection_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_ok boolean;
begin
  update public.inspections
     set captures_consentement_le = coalesce(captures_consentement_le, now()), maj_le = now()
   where id = p_inspection_id
     and acheteur_id = auth.uid()
     and type = 'visio'
  returning true into v_ok;
  if not coalesce(v_ok, false) then
    return jsonb_build_object('ok', false, 'raison', 'introuvable');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.visio_consentement_captures(uuid) from public, anon;
grant execute on function public.visio_consentement_captures(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Vérification intégrée : les lignes existantes restent des inspections.
-- ---------------------------------------------------------------------------
do $$
declare v_autres integer;
begin
  select count(*) into v_autres from public.inspections where type <> 'inspection';
  if v_autres > 0 then
    raise exception 'des lignes existantes ont un type inattendu : %', v_autres;
  end if;
end $$;
