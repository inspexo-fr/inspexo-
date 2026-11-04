-- SPRINT 17 — Surveillance : seuils configurables, coût du jour, bilan quotidien.
--
-- Jusqu'ici une seule alerte existait (service d'analyse indisponible) et son
-- seuil était écrit dans le code. Un seuil dans le code se change par un
-- déploiement : autant dire qu'il ne se change pas. Il vit maintenant en base.

-- ---------------------------------------------------------------------------
-- 1. CONFIGURATION D'EXPLOITATION
-- ---------------------------------------------------------------------------
-- Réglages d'exploitation modifiables sans redéploiement. ⚠️ JAMAIS de secret
-- ici : les secrets restent dans les variables d'environnement Supabase. Cette
-- table ne porte que des seuils et des interrupteurs, et elle est lisible par
-- le seul service role.
create table if not exists public.config (
  cle text primary key,
  valeur jsonb not null,
  description text,
  maj_le timestamptz not null default now()
);

alter table public.config enable row level security;
revoke all on public.config from anon, authenticated;

insert into public.config (cle, valeur, description) values
  ('cout_ia_seuil_jour_eur', '5'::jsonb,
   'Au-delà de ce coût IA cumulé sur la journée, une alerte part vers l''exploitant.'),
  ('echecs_fenetre_minutes', '15'::jsonb,
   'Fenêtre glissante de surveillance des échecs d''analyse.'),
  ('echecs_seuil', '3'::jsonb,
   'Nombre d''échecs dans la fenêtre au-delà duquel une alerte part.')
on conflict (cle) do nothing;

create or replace function public.config_lire(p_cle text, p_defaut numeric)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select (valeur #>> '{}')::numeric from public.config where cle = p_cle), p_defaut);
$$;

revoke all on function public.config_lire(text, numeric) from public, anon, authenticated;
grant execute on function public.config_lire(text, numeric) to service_role;

-- ---------------------------------------------------------------------------
-- 2. COÛT IA DU JOUR
-- ---------------------------------------------------------------------------
-- Reconstitué depuis les events `score_done`, qui portent l'usage RÉEL de
-- chaque appel (`props_json.calls`). Aucune nouvelle colonne, aucune double
-- comptabilité : la source est celle qui sert déjà au compteur d'éval.
--
-- ⚠️ Tarifs alignés sur `score/index.ts` : entrée 3 $/M, sortie 15 $/M,
-- lecture de cache 0,30 $/M, écriture de cache 3,75 $/M, puis × 0,92 pour
-- l'euro. Les changer ici sans les changer là-bas ferait diverger deux
-- comptes du même argent.
create or replace function public.cout_ia_jour(p_jour date default current_date)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select round(coalesce(sum(
    (coalesce((c.valeur->>'input_tokens')::numeric, 0) * 0.000003)
    + (coalesce((c.valeur->>'output_tokens')::numeric, 0) * 0.000015)
    + (coalesce((c.valeur->>'cache_read_input_tokens')::numeric, 0) * 0.0000003)
    + (coalesce((c.valeur->>'cache_creation_input_tokens')::numeric, 0) * 0.00000375)
  ), 0) * 0.92, 4)
  from public.events e
  cross join lateral jsonb_each(coalesce(e.props_json->'calls', '{}'::jsonb)) as c(cle, valeur)
  where e.name = 'score_done'
    and e.created_at >= p_jour::timestamptz
    and e.created_at < (p_jour + 1)::timestamptz
    and jsonb_typeof(c.valeur) = 'object';
$$;

revoke all on function public.cout_ia_jour(date) from public, anon, authenticated;
grant execute on function public.cout_ia_jour(date) to service_role;

-- ---------------------------------------------------------------------------
-- 3. ÉCHECS RÉCENTS
-- ---------------------------------------------------------------------------
create or replace function public.echecs_recents(p_minutes integer default 15)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.events
  where name = 'pipeline_error'
    and created_at > now() - make_interval(mins => greatest(1, least(coalesce(p_minutes, 15), 1440)));
$$;

revoke all on function public.echecs_recents(integer) from public, anon, authenticated;
grant execute on function public.echecs_recents(integer) to service_role;

-- ---------------------------------------------------------------------------
-- 4. BILAN QUOTIDIEN
-- ---------------------------------------------------------------------------
-- Tout ce que l'exploitant doit voir en une page, pour la journée écoulée.
-- ⚠️ Les analyses d'ÉVAL sont exclues partout : elles gonfleraient le volume
-- et le coût sans correspondre à un usage réel. Le coût IA, lui, les INCLUT —
-- c'est de l'argent réellement dépensé, et le taire serait mentir sur la note.
create or replace function public.bilan_quotidien(p_jour date default (current_date - 1))
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with bornes as (
    select p_jour::timestamptz as debut, (p_jour + 1)::timestamptz as fin
  ),
  ev as (
    select e.* from public.events e, bornes b
    where e.created_at >= b.debut and e.created_at < b.fin
  ),
  an as (
    select a.* from public.analyses a, bornes b
    where a.created_at >= b.debut and a.created_at < b.fin and a.is_eval = false
  )
  select jsonb_build_object(
    'jour', p_jour,
    'analyses', (select count(*) from an),
    'analyses_par_source', (
      select coalesce(jsonb_object_agg(src, n), '{}'::jsonb)
      from (select coalesce(nullif(btrim(src), ''), 'direct') as src, count(*) as n from an group by 1) s
    ),
    'verdicts', (
      select coalesce(jsonb_object_agg(verdict, n), '{}'::jsonb)
      from (select coalesce(verdict, 'inconnu') as verdict, count(*) as n from an group by 1) s
    ),
    'clics', jsonb_build_object(
      'pass', (select count(*) from ev where name = 'pass_clicked'),
      'inspection', (select count(*) from ev where name = 'inspection_clicked'),
      'partage', (select count(*) from ev where name = 'share_clicked')
    ),
    'paiements', jsonb_build_object(
      'pass', (select count(*) from public.passes p, bornes b
                where p.created_at >= b.debut and p.created_at < b.fin and p.statut = 'actif'),
      'inspections', (select count(*) from public.inspections i, bornes b
                       where i.created_at >= b.debut and i.created_at < b.fin
                         and i.statut not in ('a_payer', 'annulee'))
    ),
    'listes_attente', (
      select coalesce(jsonb_object_agg(source, n), '{}'::jsonb)
      from (select l.source, count(*) as n from public.leads l, bornes b
             where l.created_at >= b.debut and l.created_at < b.fin group by 1) s
    ),
    'leads_pro', (select count(*) from public.leads_pro lp, bornes b
                   where lp.created_at >= b.debut and lp.created_at < b.fin),
    'erreurs', jsonb_build_object(
      'total', (select count(*) from ev where name = 'pipeline_error'),
      'par_etape', (
        select coalesce(jsonb_object_agg(etape, n), '{}'::jsonb)
        from (select coalesce(props_json->>'stage', 'inconnue') as etape, count(*) as n
                from ev where name = 'pipeline_error' group by 1) s
      ),
      'service_indisponible', (select count(*) from ev where name = 'alerte_service_envoyee')
    ),
    -- Le coût INCLUT l'éval : c'est de l'argent réellement dépensé.
    'cout_ia_eur', public.cout_ia_jour(p_jour),
    'analyses_eval', (select count(*) from public.analyses a, bornes b
                       where a.created_at >= b.debut and a.created_at < b.fin and a.is_eval = true)
  );
$$;

revoke all on function public.bilan_quotidien(date) from public, anon, authenticated;
grant execute on function public.bilan_quotidien(date) to service_role;

-- ---------------------------------------------------------------------------
-- 5. POINT DE CONTRÔLE PUBLIC
-- ---------------------------------------------------------------------------
-- ⚠️ AUCUNE DONNÉE D'AFFAIRES. Ni volume, ni chiffre, ni date de dernière
-- analyse : un point de contrôle public est lu par n'importe qui, et le
-- trafic d'Inspexo n'a pas à y être déduit. Elle ne prouve qu'une chose, et
-- c'est tout ce qu'un service de surveillance a besoin de savoir : la base
-- répond et le schéma attendu est en place.
create or replace function public.sante()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'base', 'ok',
    'schema', (select count(*) >= 3 from information_schema.tables
                where table_schema = 'public' and table_name in ('analyses', 'events', 'drapeaux'))
  );
$$;

revoke all on function public.sante() from public;
grant execute on function public.sante() to anon, authenticated, service_role;

comment on function public.sante() is
  'Point de contrôle public : prouve que la base répond. Ne rend AUCUNE donnée d''affaires.';
