-- SPRINT 2 — File d'attente des analyses en cas d'indisponibilité de l'IA.
-- Migration ADDITIVE : une table + une RPC, aucune modification existante.
-- Quand un appel Anthropic échoue (crédit, surcharge, timeout), l'acheteur peut
-- laisser son email : la demande est enregistrée ici et rejouée automatiquement
-- dès que le service est rétabli, puis le verdict lui est envoyé par email.

create table if not exists public.pending_analyses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null,
  input_text text not null,
  usage_vehicule text,
  statut text not null default 'en_attente'
    check (statut in ('en_attente', 'traitee', 'echec_definitif')),
  tentatives integer not null default 0,
  derniere_tentative timestamptz,
  analysis_id uuid references public.analyses (id) on delete set null,
  ip_hash text
);

create index if not exists pending_analyses_statut_idx
  on public.pending_analyses (statut, created_at);

alter table public.pending_analyses enable row level security;
revoke all on public.pending_analyses from anon, authenticated;
-- Aucune policy : accès exclusivement par les edge functions (service role)
-- et par la RPC SECURITY DEFINER ci-dessous.

-- Dépôt public d'une demande en attente (mêmes garde-fous que submit_lead).
create or replace function public.submit_pending_analysis(
  p_email text,
  p_text text,
  p_usage text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip_hash text := public._request_ip_hash('pending:');
  v_count integer;
  v_id uuid;
begin
  if p_email is null
     or length(p_email) > 320
     or p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'email invalide';
  end if;
  if p_text is null or length(btrim(p_text)) < 20 or length(p_text) > 6000 then
    raise exception 'texte invalide';
  end if;

  select count(*) into v_count
  from public.pending_analyses
  where ip_hash = v_ip_hash and created_at > now() - interval '24 hours';
  if v_count >= 5 then
    raise exception 'limite atteinte';
  end if;

  insert into public.pending_analyses (email, input_text, usage_vehicule, ip_hash)
  values (lower(btrim(p_email)), p_text, nullif(p_usage, ''), v_ip_hash)
  returning id into v_id;

  insert into public.events (name, props_json)
  values ('pending_analysis_queued', jsonb_build_object('pending_id', v_id));

  return v_id;
end;
$$;

grant execute on function public.submit_pending_analysis(text, text, text) to anon, authenticated;
