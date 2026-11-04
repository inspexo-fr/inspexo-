-- ===========================================================================
-- SPRINT 13 — Lecture du certificat de situation administrative HistoVec.
-- Migration ADDITIVE.
--
-- Un seul objet à ajouter côté base : le MASQUAGE. Le reste vit dans le code
-- (module pur `_shared/histovec.ts`, fonction `lecture-histovec`), et aucune
-- table n'est créée : les faits retenus tiennent dans `analyses.result_json`,
-- et le PDF n'est jamais stocké.
--
-- ⚠️ LE MASQUAGE DOIT ÊTRE SERVEUR. `get_public_analysis` est la porte par
-- laquelle tout visiteur lit une analyse : si elle rend le détail HistoVec, un
-- flou CSS côté client ne masque rien (leçon du sprint 7, où la vraie marge de
-- négociation partait au navigateur derrière un flou).
--
-- RÈGLE PRODUIT : un signal ROUGE passe TOUJOURS, même sans Pass. On ne cache
-- pas un vol, un gage ou une procédure non levée derrière un paiement. Seul le
-- détail (ancienne location, nombre de détenteurs, procédure levée,
-- avertissement de validité) est réservé au Pass.
-- ===========================================================================

create or replace function public._histovec_publique(h jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select case
    when h is null or jsonb_typeof(h) <> 'object' then h
    else jsonb_build_object(
      'lu_le', h -> 'lu_le',
      -- Seuls les signaux marqués « toujours visibles » sortent.
      'signaux', coalesce(
        (select jsonb_agg(s)
           from jsonb_array_elements(coalesce(h -> 'signaux', '[]'::jsonb)) s
          where (s ->> 'toujours_visible')::boolean is true),
        '[]'::jsonb),
      'masque', true,
      'nb_masques', (
        select count(*)
          from jsonb_array_elements(coalesce(h -> 'signaux', '[]'::jsonb)) s
         where coalesce((s ->> 'toujours_visible')::boolean, false) is false
      ),
      -- La concordance se résume à son verdict : les discordances nomment des
      -- éléments du véhicule, elles relèvent du détail.
      'concorde', h -> 'concordance' -> 'concorde'
    )
  end;
$$;

comment on function public._histovec_publique(jsonb) is
  'Projection publique de la lecture HistoVec : les signaux ROUGES passent '
  'toujours (on ne cache pas un danger derrière un paiement), le détail est '
  'réservé au Pass. Miroir de `histovecPublique` dans _shared/histovec.ts.';

-- ---------------------------------------------------------------------------
-- `get_public_analysis` REDÉCLARÉE à l'identique, avec le seul ajout du
-- masquage HistoVec.
--
-- Le corps est repris MOT POUR MOT de la migration 20261030120000 (dernière à
-- l'avoir définie) et seul le bloc ci-dessous est ajouté. On redéclare plutôt
-- que de réécrire la fonction en place par chirurgie de chaîne : une
-- substitution sur `pg_get_functiondef` peut s'appliquer à moitié sans que
-- personne ne le voie, alors qu'une déclaration complète se relit et se
-- compare.
-- ---------------------------------------------------------------------------
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
  v_pass boolean := false;
  v_result jsonb;
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

  if auth.uid() is not null then
    v_pass := public._pass_actif(auth.uid());
  end if;

  v_result := v_row.result_json;
  if not v_pass and v_result is not null and v_result ? 'negociation' then
    v_result := jsonb_set(
      v_result, '{negociation}',
      coalesce(public._negociation_publique(v_result->'negociation'), 'null'::jsonb)
    );
  end if;

  -- SPRINT 13 — Masquage de la lecture HistoVec, au MÊME endroit et selon la
  -- MÊME logique que la négociation : un masquage côté client ne masque rien.
  -- Un signal ROUGE passe toujours (cf. _histovec_publique) : on ne cache pas
  -- un vol, un gage ou une procédure non levée derrière un paiement.
  if not v_pass and v_result is not null and v_result ? 'histovec' then
    v_result := jsonb_set(
      v_result, '{histovec}',
      coalesce(public._histovec_publique(v_result->'histovec'), 'null'::jsonb)
    );
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'created_at', v_row.created_at,
    'ref_num', v_row.ref_num,
    'verdict', v_row.verdict,
    'score', v_row.score,
    'result_json', v_result,
    'marque', v_row.marque,
    'modele', v_row.modele,
    'motorisation', v_row.motorisation,
    'annee', v_row.annee,
    'famille_moteur', v_row.famille_moteur,
    'images_count', v_row.images_count,
    'share_views', v_row.share_views,
    'claims_dropped_count', v_dropped_count,
    'claims_dropped', v_dropped,
    'pass', v_pass
  );
end;
$$;

revoke all on function public._histovec_publique(jsonb) from public, anon, authenticated;
grant execute on function public._histovec_publique(jsonb) to service_role;
grant execute on function public.get_public_analysis(uuid, boolean) to anon, authenticated;
