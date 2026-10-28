-- SPRINT 5 — Numéro de dossier public « IX-AAAA-NNNNN ».
-- Migration ADDITIVE : une séquence + une colonne ref_num sur analyses,
-- backfill des lignes existantes dans l'ordre de création, et
-- get_public_analysis expose ref_num (le format IX-année-numéro est composé
-- côté client à partir de ref_num + created_at). Aucune table modifiée par
-- ailleurs, aucune logique d'analyse touchée.

create sequence if not exists public.analyses_ref_seq;

alter table public.analyses add column if not exists ref_num bigint;

-- Backfill : les analyses existantes reçoivent leur numéro dans l'ordre de
-- création (stable grâce au départage par id).
with ordres as (
  select id, row_number() over (order by created_at, id) as rn
  from public.analyses
  where ref_num is null
)
update public.analyses a
set ref_num = o.rn
from ordres o
where a.id = o.id;

select setval(
  'public.analyses_ref_seq',
  coalesce((select max(ref_num) from public.analyses), 0) + 1,
  false
);

alter table public.analyses alter column ref_num set default nextval('public.analyses_ref_seq');

create unique index if not exists analyses_ref_num_idx on public.analyses (ref_num);

-- get_public_analysis : même corps qu'au sprint 2A, + ref_num dans le payload.
create or replace function public.get_public_analysis(p_id uuid, p_track boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.analyses%rowtype;
  v_ip_hash text := public._request_ip_hash('view:');
  v_deja_vu boolean;
  v_dropped_count integer;
  v_dropped jsonb;
begin
  select * into v_row from public.analyses where id = p_id;
  if not found then
    return null;
  end if;

  if p_track then
    select exists (
      select 1 from public.events
      where name = 'result_viewed'
        and analysis_id = p_id
        and ip_hash = v_ip_hash
        and created_at > now() - interval '1 hour'
    ) into v_deja_vu;

    if not v_deja_vu then
      update public.analyses set share_views = share_views + 1 where id = p_id;
      insert into public.events (name, analysis_id, ip_hash) values ('result_viewed', p_id, v_ip_hash);
      v_row.share_views := v_row.share_views + 1;
    end if;
  end if;

  select count(*) into v_dropped_count
  from public.events
  where name = 'claim_dropped' and analysis_id = p_id;

  -- Liste publique : jamais le contenu d'une injection de prompt.
  select coalesce(jsonb_agg(jsonb_build_object(
           'texte', left(coalesce(props_json->>'texte', ''), 300),
           'justification', left(coalesce(props_json->>'justification', ''), 300)
         ) order by created_at), '[]'::jsonb)
    into v_dropped
  from (
    select props_json, created_at
    from public.events
    where name = 'claim_dropped'
      and analysis_id = p_id
      and coalesce(props_json->>'texte', '') !~* '(injection|ignore.{0,30}(instruction|consigne)|prompt|note\s*(de\s*)?100)'
      and coalesce(props_json->>'justification', '') !~* '(injection|prompt)'
    order by created_at
    limit 20
  ) t;

  return jsonb_build_object(
    'id', v_row.id,
    'created_at', v_row.created_at,
    'ref_num', v_row.ref_num,
    'verdict', v_row.verdict,
    'score', v_row.score,
    'result_json', v_row.result_json,
    'marque', v_row.marque,
    'modele', v_row.modele,
    'motorisation', v_row.motorisation,
    'annee', v_row.annee,
    'famille_moteur', v_row.famille_moteur,
    'images_count', v_row.images_count,
    'share_views', v_row.share_views,
    'claims_dropped_count', v_dropped_count,
    'claims_dropped', v_dropped
  );
end;
$$;
grant execute on function public.get_public_analysis(uuid, boolean) to anon, authenticated;
