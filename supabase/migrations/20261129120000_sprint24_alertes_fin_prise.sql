-- SPRINT 24, LOT 2 — Alertes « fin de prise en charge constructeur » pour les
-- dossiers ACHETÉS : 6 mois puis 1 mois avant la date de fin calculée d'un
-- programme publié (durée depuis la 1re mise en circulation).
--
-- Cette table est la mémoire des envois : un palier n'est envoyé qu'UNE fois
-- par dossier et par programme (contrainte d'unicité, pas prudence du code).
-- RLS active, ZÉRO policy, aucun droit public : seul le cron `alertes`
-- (service role) y accède.
create table if not exists public.alertes_fin_prise (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossier(id) on delete cascade,
  programme text not null check (char_length(programme) between 3 and 200),
  palier text not null check (palier in ('6_mois', '1_mois')),
  fin date not null,
  envoye boolean not null default false,
  cree_le timestamptz not null default now(),
  unique (dossier_id, programme, palier)
);

alter table public.alertes_fin_prise enable row level security;
revoke all on table public.alertes_fin_prise from anon, authenticated;
