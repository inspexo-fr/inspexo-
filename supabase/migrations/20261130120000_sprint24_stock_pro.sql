-- SPRINT 24 lot 3 — Contrôle d'entrée en stock et formule pro (préparée, éteinte).
--
-- Décisions d'Utku du 13 nov. 2026 :
--   - l'outil est réservé à une FORMULE PRO distincte du Pass ; pour l'instant
--     le drapeau `stock_revendeur` est réservé à l'admin ;
--   - la formule pro (abonnement Stripe mensuel) est préparée SANS être
--     activée : drapeau `formule_pro` éteint, aucun prix posé.
-- Additive. Aucune donnée existante touchée.

insert into public.drapeaux (cle, etat, description) values (
  'stock_revendeur',
  'admin_uniquement',
  'Contrôle d''entrée en stock (mode revendeur, sans annonce) : VIN ou carte grise, défauts confirmés, risque de retour, plafond, tri de lot. Réservé à la formule pro.'
) on conflict (cle) do nothing;

insert into public.drapeaux (cle, etat, description) values (
  'formule_pro',
  'eteint',
  'Vente de la formule pro (abonnement mensuel Stripe). À ouvrir après relecture des CGV pro et pose du prix (secret PRO_PRICE_ID).'
) on conflict (cle) do nothing;

create table if not exists public.abonnements_pro (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  siret text not null,
  stripe_customer text,
  stripe_subscription text not null unique,
  stripe_session text unique,
  statut text not null default 'actif' check (statut in ('actif', 'impaye', 'resilie')),
  periode_fin timestamptz,
  cgv_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists abonnements_pro_user on public.abonnements_pro (user_id);

-- Accès UNIQUEMENT par le service role (fonctions edge) : RLS active, aucune
-- policy, aucun droit public.
alter table public.abonnements_pro enable row level security;
revoke all on public.abonnements_pro from anon, authenticated;

do $$
begin
  if has_table_privilege('anon', 'public.abonnements_pro', 'select')
     or has_table_privilege('authenticated', 'public.abonnements_pro', 'select') then
    raise exception 'abonnements_pro lisible par anon ou authenticated';
  end if;
end $$;
