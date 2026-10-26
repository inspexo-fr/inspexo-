-- SPRINT 2 corrections — programmes d'extension de garantie par famille moteur.
-- Migration ADDITIVE : une colonne jsonb sur defect_sheets, rien d'autre.
-- Contenu : [{titre, conditions, age_max_ans, km_max, entretien_exige,
--             date_vigueur, url_source[]}] — toujours sourcé (presse auto
-- reconnue ou communication officielle), sinon liste vide.

alter table public.defect_sheets
  add column if not exists programmes jsonb not null default '[]'::jsonb;
