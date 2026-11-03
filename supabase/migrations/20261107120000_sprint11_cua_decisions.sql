-- ===========================================================================
-- SPRINT 11 (suite) — Mise en conformité du code avec les décisions prises
-- sur les conditions d'utilisation de l'API. Migration ADDITIVE.
--
-- Écrire dans les CUA une règle que le code n'applique pas serait un
-- engagement faux. Les trois décisions qui touchent au comportement sont donc
-- implémentées ici, pas seulement rédigées :
--   1. un même client qui redemande la même annonce sous 7 jours n'est pas
--      refacturé ;
--   2. les prix reçus par API n'alimentent PAS le relevé agrégé par défaut ;
--   5. le texte des annonces reçues par API est effacé à 30 jours, l'usage
--      (date, clé, nombre) étant conservé pour la comptabilité.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Historique des appels facturés, par client et par annonce.
--    C'est lui qui permet de savoir si un client a DÉJÀ payé pour cette
--    annonce-là : sans cet historique, « ne pas refacturer » serait
--    invérifiable.
-- ---------------------------------------------------------------------------
create table if not exists public.api_appels (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_id uuid not null references public.api_clients (id) on delete cascade,
  analysis_id uuid references public.analyses (id) on delete set null,
  facture boolean not null default true
);

create index if not exists api_appels_client_analyse_idx
  on public.api_appels (client_id, analysis_id, created_at desc);

alter table public.api_appels enable row level security;
revoke all on public.api_appels from anon, authenticated;

comment on table public.api_appels is
  'Appels d''API par client et par annonce. Sert à ne pas refacturer un '
  'même client qui redemande la même annonce sous 7 jours (CUA art. 5.5).';

-- Le client a-t-il DÉJÀ été facturé pour cette annonce dans les 7 jours ?
create or replace function public.api_deja_facture(
  p_client_id uuid,
  p_analysis_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.api_appels
    where client_id = p_client_id
      and analysis_id = p_analysis_id
      and facture
      and created_at > now() - interval '7 days'
  );
$$;

create or replace function public.api_noter_appel(
  p_client_id uuid,
  p_analysis_id uuid,
  p_facture boolean
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.api_appels (client_id, analysis_id, facture)
  values (p_client_id, p_analysis_id, coalesce(p_facture, true));
$$;

revoke all on function public.api_deja_facture(uuid, uuid) from public, anon, authenticated;
revoke all on function public.api_noter_appel(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.api_deja_facture(uuid, uuid) to service_role;
grant execute on function public.api_noter_appel(uuid, uuid, boolean) to service_role;

-- ---------------------------------------------------------------------------
-- 2. Partage des prix : EXCLU PAR DÉFAUT.
--    Un prix reçu par API n'alimente le relevé agrégé que si le contrat du
--    client le prévoit explicitement. Le défaut est l'exclusion : on ne
--    récupère pas, par commodité, une donnée qu'on n'a pas négociée.
-- ---------------------------------------------------------------------------
alter table public.api_clients
  add column if not exists prix_partages boolean not null default false;

comment on column public.api_clients.prix_partages is
  'Le contrat autorise-t-il l''usage des prix reçus dans le relevé agrégé ? '
  'FAUX par défaut (CUA art. 6.3).';

-- ---------------------------------------------------------------------------
-- 5. Effacement du texte des annonces reçues par API, à 30 jours.
--    L'usage (date, clé, nombre) reste : il sert à la facturation. Le texte,
--    lui, n'a plus aucune raison d'être conservé.
-- ---------------------------------------------------------------------------
alter table public.analyses add column if not exists via_api boolean not null default false;

create index if not exists analyses_via_api_idx
  on public.analyses (created_at) where via_api;

create or replace function public.purger_textes_api()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  with purgees as (
    update public.analyses
    set input_text = '[texte effacé — conservation 30 jours pour les analyses reçues par API]'
    where via_api
      and created_at < now() - interval '30 days'
      and input_text not like '[texte effacé%'
    returning 1
  )
  select count(*)::integer into v_n from purgees;
  if v_n > 0 then
    insert into public.events (name, props_json)
    values ('api_textes_purges', jsonb_build_object('analyses', v_n));
  end if;
  return v_n;
end;
$$;

revoke all on function public.purger_textes_api() from public, anon, authenticated;
grant execute on function public.purger_textes_api() to service_role;
