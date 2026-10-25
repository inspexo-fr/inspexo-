-- SPRINT 2A — Rendre la rigueur visible.
-- Migration ADDITIVE : aucune table modifiée, seules deux RPC existantes sont
-- remplacées pour enrichir leur payload public.
--
-- 1. get_public_analysis expose désormais :
--    - claims_dropped_count : nombre total d'events claim_dropped de l'analyse
--      (le « N » du bandeau de rigueur) ;
--    - claims_dropped : liste publique des affirmations écartées
--      {texte, justification}, SANS celles liées à une injection de prompt
--      (leur texte reproduirait l'instruction injectée), tronquées et
--      plafonnées à 20 entrées.
-- 2. get_defect_sheet expose en plus updated_at (date de vérification des
--    sources affichée au pied du bloc pannes).

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

create or replace function public.get_defect_sheet(p_marque text, p_famille text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_row public.defect_sheets%rowtype;
begin
  if p_marque is null or p_famille is null then
    return null;
  end if;

  select * into v_row
  from public.defect_sheets
  where marque_norm = regexp_replace(lower(extensions.unaccent(p_marque)), '\s+', ' ', 'g')
    and famille_norm = upper(regexp_replace(p_famille, '[^A-Za-z0-9]', '', 'g'))
  order by (statut = 'validee') desc, updated_at desc
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'statut', v_row.statut,
    'pannes', v_row.pannes,
    'updated_at', v_row.updated_at
  );
end;
$$;
grant execute on function public.get_defect_sheet(text, text) to anon, authenticated;
