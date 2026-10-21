-- SPRINT 1.5 — Durcissement post-audit sécurité (migration additive).
-- Constats corrigés ici :
--  - submit_lead : spam illimité + aucune déduplication + pas d'ip_hash
--  - track_event : props non bornés + pas de plafond + pas d'ip_hash
--  - get_public_analysis : share_views/result_viewed gonflables sans limite
-- L'ip est lue depuis les headers PostgREST (cf-connecting-ip, vérifié stable
-- et non spoofable sur cette infra) et stockée UNIQUEMENT hachée (pgcrypto).

create extension if not exists pgcrypto with schema extensions;

-- Déduplication des leads (anti-spam) : un email ne compte qu'une fois par source.
create unique index if not exists leads_email_source_uidx
  on public.leads (lower(email), source);

-- Hash d'IP côté SQL (préfixé par usage pour ne pas croiser les espaces de noms).
create or replace function public._request_ip_hash(p_prefix text)
returns text
language sql
stable
security definer
set search_path = public, extensions
as $$
  select encode(
    extensions.digest(
      p_prefix || coalesce(
        current_setting('request.headers', true)::json->>'cf-connecting-ip',
        split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1)
      ),
      'sha256'
    ),
    'hex'
  );
$$;
revoke all on function public._request_ip_hash(text) from public, anon, authenticated;

-- ============================================================
-- submit_lead : dédup + plafond 10 leads / ip / 24 h + ip_hash loggé
-- ============================================================
create or replace function public.submit_lead(p_email text, p_source text, p_analysis_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip_hash text := public._request_ip_hash('lead:');
  v_inserted boolean;
begin
  if p_source not in ('pass_waitlist', 'expert_waitlist', 'rapport') then
    raise exception 'source invalide';
  end if;
  if p_email is null
     or length(p_email) > 320
     or p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'email invalide';
  end if;

  if (select count(*) from public.events
      where name = 'lead_submitted'
        and ip_hash = v_ip_hash
        and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'trop de demandes, réessayez plus tard';
  end if;

  insert into public.leads (email, analysis_id, source)
  values (lower(trim(p_email)), p_analysis_id, p_source)
  on conflict (lower(email), source) do nothing;
  get diagnostics v_inserted = row_count;

  insert into public.events (name, analysis_id, ip_hash, props_json)
  values ('lead_submitted', p_analysis_id, v_ip_hash,
          jsonb_build_object('source', p_source, 'deduplique', not v_inserted));
end;
$$;
grant execute on function public.submit_lead(text, text, uuid) to anon, authenticated;

-- ============================================================
-- track_event : props ≤ 2 Ko + schéma par event + plafond 120 / ip / 24 h
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
  if p_name not in ('share_clicked', 'verdict_feedback') then
    raise exception 'event non autorisé';
  end if;
  if p_props is not null and pg_column_size(p_props) > 2048 then
    raise exception 'props trop volumineux';
  end if;
  if p_name = 'verdict_feedback' then
    -- Schéma strict : uniquement {helpful: boolean}
    if p_props is null
       or jsonb_typeof(p_props->'helpful') <> 'boolean'
       or (select count(*) from jsonb_object_keys(p_props)) > 1 then
      raise exception 'props invalides pour verdict_feedback';
    end if;
  end if;

  if (select count(*) from public.events
      where name in ('share_clicked', 'verdict_feedback')
        and ip_hash = v_ip_hash
        and created_at > now() - interval '24 hours') >= 120 then
    raise exception 'trop de demandes, réessayez plus tard';
  end if;

  insert into public.events (name, analysis_id, ip_hash, props_json)
  values (p_name, p_analysis_id, v_ip_hash, p_props);
end;
$$;
grant execute on function public.track_event(text, uuid, jsonb) to anon, authenticated;

-- ============================================================
-- get_public_analysis : incrément share_views + result_viewed dédupliqués
-- (1 par ip et par heure et par analyse)
-- ============================================================
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
    'share_views', v_row.share_views
  );
end;
$$;
grant execute on function public.get_public_analysis(uuid, boolean) to anon, authenticated;
