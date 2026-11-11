-- SPRINT 23 (f) — Prises en charge connues d'un moteur (garanties étendues,
-- campagnes, rappels) relevées dans les sources confirmées par le juge.
--
-- ⚠️ AFFICHAGE SEULEMENT (décision d'Utku du 11 nov. 2026) : aucun fichier du
-- chemin de notation ne lit cette colonne (tests/independance-score.test.mjs).
-- Le verdict conditionnel continue de venir de `programmes` (liste curée).
--
-- ADDITIVE : '[]' par défaut, aucun score ne change.
alter table public.defect_sheets
  add column if not exists prises_en_charge jsonb not null default '[]'::jsonb;

alter table public.defect_sheets
  add constraint defect_sheets_prises_en_charge_tableau check (jsonb_typeof(prises_en_charge) = 'array');
