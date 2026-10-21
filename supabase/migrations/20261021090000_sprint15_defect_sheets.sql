-- SPRINT 1.5 — Fiches famille moteur sourcées + feedback verdict
-- Migration ADDITIVE : aucune table existante modifiée (seule la RPC
-- track_event est remplacée pour élargir sa whitelist).

-- ============================================================
-- TABLE defect_sheets — fiche de défauts par famille moteur
-- ============================================================
-- Clé logique : marque + famille_moteur + plage d'années.
-- statut : 'generee' (web search, affichée « sources en ligne, à confirmer
-- sur place ») → 'validee' (relecture humaine, affichée « base Inspexo »).
-- pannes : [{titre, organe, symptomes, km_typique, gravite,
--            cout_indicatif_eur|null, url_source[], date_consultee}]
-- Toute panne sans URL source est rejetée AVANT insertion (edge function).

create table if not exists public.defect_sheets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  marque text not null,
  marque_norm text not null,
  famille_moteur text not null,
  famille_norm text not null,
  moteur_label text,
  annee_debut integer,
  annee_fin integer,
  statut text not null default 'generee' check (statut in ('generee', 'validee')),
  pannes jsonb not null default '[]'::jsonb,
  meta jsonb,
  validee_par text,
  validee_at timestamptz
);

create unique index if not exists defect_sheets_key_idx
  on public.defect_sheets (
    marque_norm,
    famille_norm,
    (coalesce(annee_debut, 0)),
    (coalesce(annee_fin, 9999))
  );

create index if not exists defect_sheets_lookup_idx
  on public.defect_sheets (marque_norm, famille_norm);

alter table public.defect_sheets enable row level security;
revoke all on public.defect_sheets from anon, authenticated;

-- ============================================================
-- RPC track_event — whitelist élargie (verdict_feedback)
-- ============================================================

create or replace function public.track_event(p_name text, p_analysis_id uuid default null, p_props jsonb default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_name not in ('share_clicked', 'verdict_feedback') then
    raise exception 'event non autorisé';
  end if;
  insert into public.events (name, analysis_id, props_json)
  values (p_name, p_analysis_id, p_props);
end;
$$;

grant execute on function public.track_event(text, uuid, jsonb) to anon, authenticated;
