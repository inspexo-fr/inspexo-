-- SPRINT 2 corrections de fond — plan d'entretien sourcé + base de comparables prix.
-- Migration ADDITIVE : une colonne + une table, aucune modification existante.

-- Plan d'entretien par famille moteur/boîte, chaque intervalle sourcé :
-- [{operation, intervalle_km, intervalle_annees, critique, lie_a_panne,
--   cout_min_eur, cout_max_eur, url_source[], a_verifier_carnet}]
alter table public.defect_sheets
  add column if not exists plan_entretien jsonb not null default '[]'::jsonb;

-- Base interne de comparables prix, alimentée par chaque analyse réussie
-- (données véhicule uniquement, AUCUNE donnée personnelle).
create table if not exists public.comparables_prix (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  marque text not null,
  modele text not null,
  generation text,
  motorisation text,
  titre text,
  annee integer,
  km integer,
  prix integer not null,
  source text not null check (source in ('score', 'intake', 'extension')),
  analysis_id uuid references public.analyses (id) on delete set null
);

create index if not exists comparables_prix_lookup_idx
  on public.comparables_prix (marque, modele, annee, created_at desc);

alter table public.comparables_prix enable row level security;
revoke all on public.comparables_prix from anon, authenticated;
-- Aucune policy : lecture/écriture exclusivement via les edge functions (service role).
