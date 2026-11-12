-- SPRINT 23, LOT 3 (point 3) — « Être prévenu d'un rappel sur ce modèle »,
-- SANS compte, en DOUBLE OPT-IN (décision d'Utku du 12 nov. 2026).
--
--   - une inscription ne vaut rien tant que le lien de confirmation n'a pas
--     été suivi : sans cela, n'importe qui pourrait inscrire l'adresse d'un
--     tiers ;
--   - marque, modèle et année sont relus SERVEUR dans l'analyse (le client
--     n'envoie qu'un identifiant) ;
--   - seule l'EMPREINTE du jeton de confirmation est stockée ;
--   - désinscription en un clic par le lien signé existant
--     (`desinscription?e=…&t=…` → table `desinscriptions`), que le cron
--     respecte ;
--   - une inscription non confirmée sous 7 jours est effacée par le cron.
--
-- RLS active, ZÉRO policy, aucun droit pour anon ni authenticated : seule la
-- fonction edge `alerte-modele` (service role) y accède.
create table if not exists public.alertes_modele (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) between 5 and 254),
  email_hash text not null,
  marque text not null,
  modele text not null,
  annee integer check (annee is null or annee between 1950 and 2100),
  analysis_id uuid references public.analyses(id) on delete set null,
  jeton_hash text not null,
  jeton_envoye_le timestamptz not null default now(),
  confirme_le timestamptz,
  rappels_vus integer,
  cree_le timestamptz not null default now()
);

-- Une alerte par adresse et par véhicule (marque, modèle, année).
create unique index if not exists alertes_modele_unique
  on public.alertes_modele (email_hash, lower(marque), lower(modele), coalesce(annee, 0));

create index if not exists alertes_modele_confirmees
  on public.alertes_modele (confirme_le) where confirme_le is not null;

alter table public.alertes_modele enable row level security;
revoke all on table public.alertes_modele from anon, authenticated;
