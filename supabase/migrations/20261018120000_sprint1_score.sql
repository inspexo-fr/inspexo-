-- SPRINT 1 — Score d'annonce gratuit + check Takata
-- Migration ADDITIVE : aucune table existante n'est modifiée.
-- RLS activée sur toutes les nouvelles tables, aucune policy anon :
-- l'accès public passe exclusivement par les RPC SECURITY DEFINER ci-dessous,
-- les edge functions écrivent via la service role (bypass RLS).

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  input_text text not null,
  images_count integer not null default 0,
  verdict text not null check (verdict in ('vert', 'orange', 'rouge')),
  score integer not null check (score >= 0 and score <= 100),
  result_json jsonb not null,
  marque text,
  modele text,
  motorisation text,
  annee integer,
  famille_moteur text,
  ip_hash text,
  user_id uuid references auth.users (id) on delete set null,
  share_views integer not null default 0
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null,
  analysis_id uuid references public.analyses (id) on delete set null,
  source text not null check (source in ('pass_waitlist', 'expert_waitlist', 'rapport'))
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  analysis_id uuid references public.analyses (id) on delete set null,
  ip_hash text,
  props_json jsonb
);

-- Index pour le rate limit (comptage par ip_hash sur 24 h)
create index if not exists events_name_iphash_created_idx
  on public.events (name, ip_hash, created_at desc);

-- Cache 24 h des réponses RappelConso (clé = marque|modele normalisés)
create table if not exists public.rappels_cache (
  cache_key text primary key,
  fetched_at timestamptz not null default now(),
  payload jsonb not null
);

-- ============================================================
-- RLS
-- ============================================================

alter table public.analyses enable row level security;
alter table public.leads enable row level security;
alter table public.events enable row level security;
alter table public.rappels_cache enable row level security;

-- Ceinture + bretelles : retirer les droits directs hérités des default privileges.
revoke all on public.analyses, public.leads, public.events, public.rappels_cache
  from anon, authenticated;

-- ============================================================
-- RPC — seuls points d'entrée publics
-- ============================================================

-- Lecture publique d'une analyse par son id UNIQUEMENT (pas de listing possible).
-- Incrémente share_views et logge result_viewed, sauf p_track = false
-- (utilisé par le rendu Open Graph pour les crawlers).
create or replace function public.get_public_analysis(p_id uuid, p_track boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.analyses%rowtype;
begin
  select * into v_row from public.analyses where id = p_id;
  if not found then
    return null;
  end if;

  if p_track then
    update public.analyses set share_views = share_views + 1 where id = p_id;
    insert into public.events (name, analysis_id) values ('result_viewed', p_id);
  end if;

  -- Champs publics uniquement : jamais input_text, ip_hash ni user_id.
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
    'share_views', v_row.share_views + (case when p_track then 1 else 0 end)
  );
end;
$$;

-- Enregistre un lead email + event lead_submitted.
create or replace function public.submit_lead(p_email text, p_source text, p_analysis_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_source not in ('pass_waitlist', 'expert_waitlist', 'rapport') then
    raise exception 'source invalide';
  end if;
  if p_email is null
     or length(p_email) > 320
     or p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'email invalide';
  end if;

  insert into public.leads (email, analysis_id, source)
  values (lower(trim(p_email)), p_analysis_id, p_source);

  insert into public.events (name, analysis_id, props_json)
  values ('lead_submitted', p_analysis_id, jsonb_build_object('source', p_source));
end;
$$;

-- Event côté client, whitelist stricte des noms autorisés.
create or replace function public.track_event(p_name text, p_analysis_id uuid default null, p_props jsonb default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_name not in ('share_clicked') then
    raise exception 'event non autorisé';
  end if;
  insert into public.events (name, analysis_id, props_json)
  values (p_name, p_analysis_id, p_props);
end;
$$;

grant execute on function public.get_public_analysis(uuid, boolean) to anon, authenticated;
grant execute on function public.submit_lead(text, text, uuid) to anon, authenticated;
grant execute on function public.track_event(text, uuid, jsonb) to anon, authenticated;
