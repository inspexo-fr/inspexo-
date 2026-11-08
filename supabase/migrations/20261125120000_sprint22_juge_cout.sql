-- SPRINT 22 — Juge stable et coût réel sur 3 ans.
--
-- Migration ADDITIVE : une table, une clé de configuration. Aucune fonction
-- existante n'est redéfinie.

-- ---------------------------------------------------------------------------
-- 1. Cache des verdicts du juge de vérification
-- ---------------------------------------------------------------------------
-- Clé = sha256(URL, affirmation normalisée, moteur), calculée côté fonction
-- edge (`cleVerif` dans _shared/verifSource.ts). SANS empreinte du texte de
-- la page — décision d'Utku du 8 nov. 2026 : une page qui change ses
-- publicités ne serait jamais en cache. Durée de vie 180 jours, appliquée à la
-- LECTURE (`juge_le`), puis nouveau vote, qui remplace la ligne.
--
-- Une ligne n'est écrite que pour un verdict FIABLE (au moins deux passages
-- ont répondu) : une panne d'API ne se fige pas 180 jours.
create table if not exists public.verif_cache (
  cle           text primary key check (cle ~ '^[0-9a-f]{64}$'),
  url           text not null,
  affirmation   text not null,
  moteur        text not null default '',
  verdict       text not null check (verdict in ('soutenue', 'non_soutenue', 'mauvais_moteur')),
  justification text,
  votes         jsonb not null default '[]'::jsonb,
  modele        text,
  juge_le       timestamptz not null default now()
);
create index if not exists verif_cache_juge_le on public.verif_cache (juge_le);

alter table public.verif_cache enable row level security;
revoke all on public.verif_cache from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Relevé officiel des prix du contrôle technique
-- ---------------------------------------------------------------------------
-- Produit par `node scripts/releve-prix-ct.mjs` à partir du jeu de données de
-- la DGCCRF publié sur data.gouv.fr (prix déclarés par les centres eux-mêmes,
-- consultables sur prix.conso.gouv.fr/controle-technique). Voiture
-- particulière, visite seule, contre-visite exclue. Daté : un tarif figé
-- devient faux, la date dit depuis quand.
--
-- Lu par la fonction `cout-3ans` en service role. PAS dans la liste fermée
-- de `get_config_publique` : le navigateur reçoit la ligne déjà chiffrée.
insert into public.config (cle, valeur, description) values
  ('ct_prix', '{ "maj": "08/11/2026", "source": "https://www.data.gouv.fr/fr/datasets/prix-des-controles-techniques/", "energies": { "toutes": { "n": 28761, "p25": 79, "p50": 85, "p75": 90 }, "essence": { "n": 6123, "p25": 75, "p50": 80, "p75": 85 }, "diesel": { "n": 6118, "p25": 75, "p50": 80, "p75": 85 }, "gaz": { "n": 4399, "p25": 88, "p50": 95, "p75": 100 }, "hybride": { "n": 6053, "p25": 80, "p50": 85, "p75": 94 }, "electrique": { "n": 6068, "p25": 80, "p50": 85, "p75": 95 } }}'::jsonb,
   'Prix de la visite de contrôle technique (voiture particulière), P25 / médiane / P75 par énergie, relevé officiel DGCCRF.')
on conflict (cle) do update set valeur = excluded.valeur, description = excluded.description;
