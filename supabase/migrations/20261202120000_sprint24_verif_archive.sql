-- SPRINT 24, campagne 2 — archive des verdicts du juge remplacés par une
-- revérification sans cache (décision d'Utku du 14 nov. 2026 : jamais écrasés
-- sans trace). Additive. Accès service role uniquement.
create table if not exists public.verif_cache_archive (
  id bigint generated always as identity primary key,
  cle text not null,
  url text,
  affirmation text,
  moteur text,
  verdict text,
  justification text,
  votes jsonb,
  modele text,
  juge_le timestamptz,
  motif text,
  archive_le timestamptz not null default now()
);
create index if not exists verif_cache_archive_cle on public.verif_cache_archive (cle);
alter table public.verif_cache_archive enable row level security;
revoke all on public.verif_cache_archive from anon, authenticated;
