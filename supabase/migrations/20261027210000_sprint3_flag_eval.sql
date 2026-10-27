-- SPRINT 3 pré-merge — marquage des analyses d'éval/de test et exclusions.
-- Migration ADDITIVE : une colonne + backfill + index, nettoyage des
-- comparables issus de tests, et remplacement de get_fiabilite pour exclure
-- les analyses de test de la mesure publique de justesse.

alter table public.analyses
  add column if not exists is_eval boolean not null default false;

-- Backfill : une analyse de test se reconnaît à son ip_hash NULL (le bypass
-- d'éval ne logge jamais d'IP) ou à un event score_partial/score_done flagué
-- eval:true. Couvre TOUTES les analyses créées par les évals et les tests
-- (sprints 1.5 → 3), y compris les tests du verdict progressif et du mode visite.
update public.analyses a
set is_eval = true
where a.is_eval = false
  and (
    a.ip_hash is null
    or exists (
      select 1 from public.events e
      where e.analysis_id = a.id
        and e.name in ('score_partial', 'score_done')
        and e.props_json->>'eval' = 'true'
    )
  );

create index if not exists analyses_is_eval_idx on public.analyses (is_eval) where is_eval;

-- Les analyses de test n'alimentent pas la base de comparables de prix.
delete from public.comparables_prix
where analysis_id in (select id from public.analyses where is_eval);

-- …ni la mesure publique de justesse : les audits éventuels portant sur une
-- analyse de test sont ignorés par get_fiabilite (l'écran /admin/audit ne
-- tire de son côté plus que des analyses réelles).
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
  select count(distinct au.analysis_id), max(au.created_at)
    into v_analyses, v_maj
  from public.audits au
  join public.analyses an on an.id = au.analysis_id and an.is_eval = false;

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

grant execute on function public.get_fiabilite() to anon, authenticated;
