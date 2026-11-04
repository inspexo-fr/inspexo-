-- SPRINT 15 — Liste d'attente « Abonnement pro » et fiabilité mesurée.
--
-- Deux ajouts sans rapport l'un avec l'autre, réunis dans une seule migration
-- parce qu'ils arrivent ensemble.
--
-- 1. `leads_pro` accueillait déjà les demandes de l'API. Elle accueille
--    maintenant aussi les acheteurs professionnels qui veulent un abonnement :
--    une colonne `type` sépare les deux, plutôt qu'une seconde table dont la
--    moitié des colonnes serait identique.
--
-- 2. `verifications` : le relevé d'une vérification INDÉPENDANTE de chaque
--    affirmation contre la source qu'elle cite. Rien à voir avec `audits`,
--    qui reste la relecture humaine du sprint 3 — et qui, au 4 novembre 2026,
--    compte **zéro ligne** : le dispositif existait mais n'avait jamais servi.

-- ---------------------------------------------------------------------------
-- 1. LISTE D'ATTENTE PRO
-- ---------------------------------------------------------------------------

-- `api` pour les lignes déjà présentes : elles viennent toutes du formulaire
-- de /pro/api. Valeur par défaut volontairement NON nulle — un lead sans type
-- ne doit pas exister.
alter table public.leads_pro
  add column if not exists type text not null default 'api',
  add column if not exists activite text,
  add column if not exists annonces_par_mois text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'leads_pro_type_check'
  ) then
    alter table public.leads_pro
      add constraint leads_pro_type_check check (type in ('api', 'abonnement'));
  end if;
end $$;

create index if not exists leads_pro_type_idx on public.leads_pro (type, created_at desc);

-- ⚠️ DROP puis CREATE, jamais une surcharge. Ajouter des paramètres à valeur
-- par défaut créerait une SECONDE fonction : les deux signatures coexisteraient
-- et un appel à quatre arguments resterait résoluble, donc une ligne pourrait
-- encore entrer sans que l'appelant ait choisi son type. Même raisonnement
-- qu'au sprint 12 pour `agreger_marche` : un verrou contournable par
-- l'ancienne porte n'est pas un verrou.
drop function if exists public.submit_lead_pro(text, text, text, text);

create or replace function public.submit_lead_pro(
  p_email text,
  p_societe text default null,
  p_volume text default null,
  p_message text default null,
  p_type text default 'api',
  p_activite text default null,
  p_annonces_par_mois text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip_hash text := public._request_ip_hash('pro:');
  v_type text := case when p_type = 'abonnement' then 'abonnement' else 'api' end;
begin
  if p_email is null or length(p_email) > 320
     or p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'email invalide';
  end if;
  if (select count(*) from public.events
      where name = 'lead_pro_submitted' and ip_hash = v_ip_hash
        and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'trop de demandes, réessayez plus tard';
  end if;
  insert into public.leads_pro (email, societe, volume_estime, message, type, activite, annonces_par_mois)
  values (lower(trim(p_email)), left(p_societe, 120), left(p_volume, 60), left(p_message, 2000),
          v_type, left(p_activite, 60), left(p_annonces_par_mois, 40));
  insert into public.events (name, ip_hash) values ('lead_pro_submitted', v_ip_hash);
end;
$$;

revoke all on function public.submit_lead_pro(text, text, text, text, text, text, text) from public;
grant execute on function public.submit_lead_pro(text, text, text, text, text, text, text) to anon, authenticated;

-- Compteur pour l'admin (onglet Parcours). Service role uniquement : il n'y a
-- aucune raison qu'un navigateur puisse compter les prospects.
create or replace function public.get_leads_pro_compteur()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'total', (select count(*) from public.leads_pro),
    'par_type', (
      select coalesce(jsonb_object_agg(t, n), '{}'::jsonb) from (
        select type as t, count(*) as n from public.leads_pro group by type
      ) s
    ),
    'par_activite', (
      select coalesce(jsonb_object_agg(a, n), '{}'::jsonb) from (
        select coalesce(nullif(btrim(activite), ''), 'non précisée') as a, count(*) as n
        from public.leads_pro where type = 'abonnement' group by 1
      ) s
    ),
    'par_volume', (
      select coalesce(jsonb_object_agg(v, n), '{}'::jsonb) from (
        select coalesce(nullif(btrim(annonces_par_mois), ''), 'non précisé') as v, count(*) as n
        from public.leads_pro where type = 'abonnement' group by 1
      ) s
    ),
    'sept_jours', (select count(*) from public.leads_pro where created_at > now() - interval '7 days'),
    'dernier', (select max(created_at) from public.leads_pro)
  );
$$;

revoke all on function public.get_leads_pro_compteur() from public, anon, authenticated;
grant execute on function public.get_leads_pro_compteur() to service_role;

-- ---------------------------------------------------------------------------
-- 2. VÉRIFICATION INDÉPENDANTE DES AFFIRMATIONS
-- ---------------------------------------------------------------------------
--
-- Une ligne = une affirmation d'une analyse, confrontée à LA source qu'elle
-- cite, par un passage qui n'a pas vu l'analyse ni sa génération.
--
-- `mauvais_moteur` est un verdict à part et non un cas de `non_soutenue` :
-- c'est le mode d'échec propre à ce produit. Une panne peut être parfaitement
-- attestée par sa source et ne pas concerner le véhicule analysé — c'est
-- exactement ce qui s'est produit au sprint 13 quand un filet a attribué à une
-- Mercedes de 2025 des défauts d'OM651. Fondre les deux dans un même taux
-- masquerait la différence entre « notre source ne dit pas ça » et « notre
-- source parle d'une autre voiture ».
create table if not exists public.verifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  analysis_id uuid not null references public.analyses (id) on delete cascade,
  claim_type text not null check (claim_type in
    ('panne', 'rappel', 'cout', 'entretien', 'prix', 'juridique')),
  claim_text text not null,
  claim_hash text not null,
  source_url text,
  source_titre text,
  -- `source_absente` : l'affirmation ne cite AUCUNE source publique. C'est le
  -- cas, par construction, des pannes venues du Defect Atlas — il ne porte
  -- aucune URL (vérifié : zéro dans `src/data/defectAtlas.js`), elles
  -- s'affichent « source : base Inspexo ».
  -- ⚠️ Elles sont comptées À PART, jamais fondues dans le taux de non
  -- soutenues. Les y verser serait injuste (elles ne sont pas réfutées, elles
  -- sont invérifiables) ; les taire laisserait croire que tout a été contrôlé.
  -- La page publie les deux nombres côte à côte.
  verdict text not null check (verdict in
    ('soutenue', 'non_soutenue', 'mauvais_moteur', 'source_absente', 'source_injoignable')),
  justification text,
  modele text,
  corrigee_le timestamptz,
  corrigee_note text,
  unique (analysis_id, claim_hash)
);

create index if not exists verifications_analysis_idx on public.verifications (analysis_id);
create index if not exists verifications_verdict_idx on public.verifications (verdict, created_at desc);

alter table public.verifications enable row level security;
revoke all on public.verifications from anon, authenticated;

comment on table public.verifications is
  'Vérification indépendante de chaque affirmation contre la source qu''elle cite. '
  'Le passage de vérification ne voit ni l''analyse ni sa génération.';

-- ---------------------------------------------------------------------------
-- 3. get_fiabilite — ce qui est publié change de méthode
-- ---------------------------------------------------------------------------
--
-- ⚠️ REDÉFINIE DEPUIS SA DERNIÈRE DÉFINITION (20261027210000). AUCUNE clé
-- n'est retirée : `analyses_auditees`, `global` et `par_type` restent rendues
-- et gardent leur sens — la relecture HUMAINE. Ce qui change, c'est ce que
-- `publie` et `seuil` gouvernent : la mesure publiée est désormais la
-- VÉRIFICATION des affirmations contre leurs sources, au seuil de 30 analyses.
--
-- Pourquoi changer de méthode : la relecture humaine demandait un geste
-- manuel par affirmation et comptait **zéro ligne** après une semaine. Une
-- mesure que personne n'a le temps de produire n'est pas une mesure.
create or replace function public.get_fiabilite()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_seuil constant integer := 30;
  v_analyses integer;
  v_maj timestamptz;
  v_humain integer;
begin
  select count(distinct v.analysis_id), max(v.created_at)
    into v_analyses, v_maj
  from public.verifications v
  join public.analyses an on an.id = v.analysis_id and an.is_eval = false;

  select count(distinct au.analysis_id) into v_humain
  from public.audits au
  join public.analyses an on an.id = au.analysis_id and an.is_eval = false;

  if coalesce(v_analyses, 0) < v_seuil then
    return jsonb_build_object(
      'publie', false,
      'seuil', v_seuil,
      'analyses_verifiees', coalesce(v_analyses, 0),
      'analyses_auditees', coalesce(v_humain, 0),
      'global', null,
      'par_type', null,
      'maj', v_maj
    );
  end if;

  return jsonb_build_object(
    'publie', true,
    'seuil', v_seuil,
    'analyses_verifiees', v_analyses,
    'analyses_auditees', coalesce(v_humain, 0),
    'maj', v_maj,
    'verification', (
      select jsonb_build_object(
        'total', count(*),
        'soutenues', count(*) filter (where v.verdict = 'soutenue'),
        'non_soutenues', count(*) filter (where v.verdict = 'non_soutenue'),
        'mauvais_moteur', count(*) filter (where v.verdict = 'mauvais_moteur'),
        'sans_source', count(*) filter (where v.verdict = 'source_absente'),
        'injoignables', count(*) filter (where v.verdict = 'source_injoignable'),
        -- Dénominateur du taux publié : ce qui était RÉELLEMENT vérifiable.
        'verifiables', count(*) filter (where v.verdict in ('soutenue', 'non_soutenue', 'mauvais_moteur')),
        'corrigees', count(*) filter (where v.corrigee_le is not null)
      )
      from public.verifications v
      join public.analyses an on an.id = v.analysis_id and an.is_eval = false
    ),
    'verification_par_type', (
      select coalesce(jsonb_object_agg(claim_type, stats), '{}'::jsonb)
      from (
        select v.claim_type, jsonb_build_object(
          'total', count(*),
          'soutenues', count(*) filter (where v.verdict = 'soutenue'),
          'non_soutenues', count(*) filter (where v.verdict = 'non_soutenue'),
          'mauvais_moteur', count(*) filter (where v.verdict = 'mauvais_moteur'),
          'sans_source', count(*) filter (where v.verdict = 'source_absente'),
          'verifiables', count(*) filter (where v.verdict in ('soutenue', 'non_soutenue', 'mauvais_moteur'))
        ) as stats
        from public.verifications v
        join public.analyses an on an.id = v.analysis_id and an.is_eval = false
        group by v.claim_type
      ) s
    ),
    -- Relecture humaine : conservée, jamais fondue dans la mesure publiée.
    -- Deux méthodes, deux chiffres — les additionner reviendrait à compter
    -- deux fois la même affirmation.
    'global', (
      select jsonb_build_object(
        'total', count(*),
        'justes', count(*) filter (where au.verdict = 'juste'),
        'fausses', count(*) filter (where au.verdict = 'faux'),
        'discutables', count(*) filter (where au.verdict = 'discutable')
      )
      from public.audits au
      join public.analyses an on an.id = au.analysis_id and an.is_eval = false
    ),
    'par_type', (
      select coalesce(jsonb_object_agg(claim_type, stats), '{}'::jsonb)
      from (
        select au.claim_type, jsonb_build_object(
          'total', count(*),
          'justes', count(*) filter (where au.verdict = 'juste'),
          'fausses', count(*) filter (where au.verdict = 'faux'),
          'discutables', count(*) filter (where au.verdict = 'discutable')
        ) as stats
        from public.audits au
        join public.analyses an on an.id = au.analysis_id and an.is_eval = false
        group by au.claim_type
      ) s
    )
  );
end;
$$;

revoke all on function public.get_fiabilite() from public;
grant execute on function public.get_fiabilite() to anon, authenticated, service_role;

-- Analyses RÉELLES pas encore vérifiées, les plus récentes d'abord.
-- Service role : c'est l'outil de l'exploitant, pas une surface publique.
create or replace function public.analyses_a_verifier(p_limite integer default 10)
returns table (id uuid, created_at timestamptz, marque text, modele text)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.created_at,
         a.result_json->'vehicule'->>'marque',
         a.result_json->'vehicule'->>'modele'
  from public.analyses a
  where a.is_eval = false
    and a.result_json is not null
    and coalesce(a.result_json->>'statut_analyse', 'fini') = 'fini'
    and not exists (select 1 from public.verifications v where v.analysis_id = a.id)
  order by a.created_at desc
  limit greatest(1, least(coalesce(p_limite, 10), 100));
$$;

revoke all on function public.analyses_a_verifier(integer) from public, anon, authenticated;
grant execute on function public.analyses_a_verifier(integer) to service_role;
