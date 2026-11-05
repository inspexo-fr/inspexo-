-- SPRINT 19 — Mode revendeur : paramètres, tarifs de carte grise, région.
--
-- Tout ce qui chiffre vit en base, pas dans le code : les tarifs de carte
-- grise changent chaque année par délibération régionale, et un tarif figé
-- dans un déploiement devient faux en silence le 1er janvier.

-- ---------------------------------------------------------------------------
-- 1. PARAMÈTRES DU CALCUL
-- ---------------------------------------------------------------------------
-- Valeurs par défaut décidées avec Utku. Chacune est modifiable à l'écran par
-- l'utilisateur pour SON calcul ; celles-ci ne sont que le point de départ.
insert into public.config (cle, valeur, description) values
  ('revendeur_marge_negociation_pct', '8'::jsonb,
   'Marge que l''acheteur final négociera sur le prix affiché, en %.'),
  ('revendeur_marge_voulue_eur', '500'::jsonb,
   'Marge visée par le revendeur, en euros.'),
  ('revendeur_imprevus_pct_travaux', '15'::jsonb,
   'Imprévus : pourcentage des travaux chiffrés.'),
  ('revendeur_imprevus_vehicule_ancien_eur', '150'::jsonb,
   'Imprévus : forfait ajouté au-delà de 10 ans.'),
  ('revendeur_decote_zfe_pct', '10'::jsonb,
   'Décote appliquée au prix de revente si le véhicule est interdit dans la ZFE de revente.'),
  ('revendeur_offre_retrait_pct', '15'::jsonb,
   'Retrait appliqué au prix d''achat maximum pour composer l''offre d''ouverture.')
on conflict (cle) do nothing;

-- ---------------------------------------------------------------------------
-- 2. TARIFS DE CARTE GRISE — DATÉS, SOURCÉS, MODIFIABLES SANS DÉPLOIEMENT
-- ---------------------------------------------------------------------------
-- ⚠️ LE PRIX DU CHEVAL FISCAL EST VOTÉ CHAQUE ANNÉE PAR CHAQUE RÉGION.
-- Figé dans le code, il serait faux dès la première délibération et personne
-- ne le verrait. Il vit donc ici, avec sa date de relevé — que l'écran
-- affiche, pour que le lecteur sache de quand datent les chiffres.
--
-- ⚠️ CE QUI N'EST PAS DÉCIDÉ ICI : les exonérations pour véhicules propres.
-- Elles varient d'une région à l'autre (0 %, 50 % ou 100 %) et plusieurs les
-- ont supprimées depuis 2025. Les appliquer d'office donnerait un coût faux
-- dans un sens, les ignorer dans l'autre. La ligne « carte grise » reste donc
-- MODIFIABLE à l'écran, et la mention invite à vérifier au simulateur
-- officiel. Mieux vaut un chiffre que l'utilisateur corrige qu'un chiffre
-- qu'il croit exact.
insert into public.config (cle, valeur, description) values
  ('carte_grise_tarifs', jsonb_build_object(
    'maj', '2026-11-05',
    'source', 'Tarifs régionaux du cheval fiscal 2026, relevés le 05/11/2026. Montant exact à confirmer au simulateur officiel ANTS.',
    'frais_fixes_eur', 13.76,
    'regions', jsonb_build_object(
      'Auvergne-Rhône-Alpes', 43,
      'Bourgogne-Franche-Comté', 60,
      'Bretagne', 60,
      'Centre-Val de Loire', 60,
      'Corse', 53,
      'Grand Est', 60,
      'Hauts-de-France', 43,
      'Île-de-France', 68.95,
      'Normandie', 60,
      'Nouvelle-Aquitaine', 58,
      'Occitanie', 59.5,
      'Pays de la Loire', 51,
      'Provence-Alpes-Côte d''Azur', 60,
      'Guadeloupe', 41,
      'Guyane', 42.5,
      'La Réunion', 60,
      'Martinique', 53,
      'Mayotte', 30
    )
  ), 'Prix du cheval fiscal par région + frais fixes. Datés : à revoir chaque janvier.')
on conflict (cle) do nothing;

-- Lecture publique de CE réglage uniquement : le calcul se fait dans le
-- navigateur de l'utilisateur, il lui faut donc la table.
-- ⚠️ Rien d'autre de `config` n'est exposé — les seuils d'alerte et le
-- plafond de coût IA restent au service role.
create or replace function public.get_config_publique()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(cle, valeur), '{}'::jsonb)
  from public.config
  where cle = 'carte_grise_tarifs' or cle like 'revendeur\_%';
$$;

revoke all on function public.get_config_publique() from public;
grant execute on function public.get_config_publique() to anon, authenticated, service_role;

comment on function public.get_config_publique() is
  'Réglages du mode revendeur, lisibles par le navigateur. Liste fermée : rien d''autre de `config` ne sort.';

-- ---------------------------------------------------------------------------
-- 3. RÉGION DE L'UTILISATEUR — demandée une fois, mémorisée
-- ---------------------------------------------------------------------------
-- ⚠️ Pour un visiteur SANS COMPTE, la région reste dans son navigateur
-- (localStorage) : elle n'a pas à être envoyée, et une préférence
-- d'affichage ne justifie pas de créer une ligne en base pour un anonyme.
-- Pour un utilisateur connecté, elle suit son compte d'un appareil à
-- l'autre — c'est le seul cas où elle est stockée.
create table if not exists public.preferences_revendeur (
  user_id uuid primary key references auth.users (id) on delete cascade,
  region text,
  parametres jsonb not null default '{}'::jsonb,
  maj_le timestamptz not null default now()
);

alter table public.preferences_revendeur enable row level security;
revoke all on public.preferences_revendeur from anon, authenticated;

create or replace function public.preferences_revendeur_lire()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select jsonb_build_object('region', region, 'parametres', parametres)
       from public.preferences_revendeur where user_id = auth.uid()),
    '{}'::jsonb);
$$;

create or replace function public.preferences_revendeur_ecrire(
  p_region text default null,
  p_parametres jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'connexion requise';
  end if;
  insert into public.preferences_revendeur (user_id, region, parametres, maj_le)
  values (
    auth.uid(),
    left(nullif(btrim(coalesce(p_region, '')), ''), 60),
    coalesce(p_parametres, '{}'::jsonb),
    now()
  )
  on conflict (user_id) do update
    set region = coalesce(excluded.region, public.preferences_revendeur.region),
        parametres = case when p_parametres is null
                          then public.preferences_revendeur.parametres
                          else excluded.parametres end,
        maj_le = now();
end;
$$;

revoke all on function public.preferences_revendeur_lire() from public, anon;
grant execute on function public.preferences_revendeur_lire() to authenticated;
revoke all on function public.preferences_revendeur_ecrire(text, jsonb) from public, anon;
grant execute on function public.preferences_revendeur_ecrire(text, jsonb) to authenticated;
