-- SPRINT 21.1 — PUBLIER LE NOMBRE DE PANNES PORTÉES PAR UNE SOURCE
--
-- Décision d'Utku du 6 nov. 2026 : « le nombre de pannes portées par une
-- source indépendante, publié tel quel. »
--
-- Depuis le sprint 21.1, une panne ne pèse sur le score que si au moins une de
-- ses sources est officielle, de presse ou éditoriale. Au 8 nov. 2026 :
-- 54 pannes sur 231. C'est un chiffre humiliant, et c'est précisément pour
-- cela qu'il doit être public — il dit à l'acheteur ce que nos affirmations
-- valent, et à nous où est le travail.
--
-- ⚠️ LE CHIFFRE N'EST PAS CALCULÉ ICI, ET CE N'EST PAS UNE FACILITÉ.
--
-- `rangSource` — la fonction qui décide si un hôte porte une affirmation —
-- n'existe qu'en TypeScript (`_shared/atlasSource.ts`), avec sa liste d'hôtes
-- et ses motifs d'URL. La réécrire en SQL créerait une SECONDE liste : deux
-- implémentations qui divergent au premier hôte ajouté, et un chiffre public
-- qui cesserait de décrire la règle réellement appliquée au score. Le projet
-- n'a qu'une implémentation des quantiles pour la même raison (sprint 9).
--
-- Le comptage est donc fait par la passe 8 du cron `alertes`, qui ÉCRIT le
-- résultat dans `config`. La base le sert ; elle ne le calcule pas.
--
-- ⚠️ Et il est RECALCULÉ CHAQUE JOUR, jamais écrit à la main. La ligne
-- « publié dès 50 dossiers relus à la main » de l'accueil a menti pendant un
-- mois parce qu'elle était figée dans un fichier (sprint 15.1). Toute phrase
-- qui annonce un état doit lire cet état — et celui-ci bouge à chaque fiche
-- générée et à chaque lot de la campagne de re-sourcing.

-- ---------------------------------------------------------------------------
-- 1. La clé entre dans la liste FERMÉE des réglages publics
-- ---------------------------------------------------------------------------
-- ⚠️ Corps repris de sa DERNIÈRE définition (20261121120000), à l'identique,
-- avec la seule clé ajoutée (règle 0 quinquies, enfreinte trois fois).
create or replace function public.get_config_publique()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(cle, valeur), '{}'::jsonb)
  from public.config
  where cle in ('carte_grise_tarifs', 'zfe', 'pannes_portees') or cle like 'revendeur\_%';
$$;

revoke all on function public.get_config_publique() from public;
grant execute on function public.get_config_publique() to anon, authenticated, service_role;

comment on function public.get_config_publique() is
  'Réglages du mode revendeur, liste des ZFE et nombre de pannes portées par une source indépendante, lisibles par le navigateur. Liste fermée : rien d''autre de `config` ne sort.';

-- ---------------------------------------------------------------------------
-- 2. Une valeur de départ HONNÊTE, qui dit qu'elle n'a pas encore été mesurée
-- ---------------------------------------------------------------------------
-- ⚠️ On ne sème PAS 54/231 en dur : ce serait exactement le défaut qu'on
-- corrige — un chiffre figé par une migration, qui aurait l'air d'une mesure.
-- La ligne existe pour que la clé soit lisible dès le déploiement, et elle
-- porte `maj: null`, que l'écran lit comme « pas encore mesuré » et affiche
-- comme tel. La première exécution du cron la remplace.
insert into public.config (cle, valeur)
values ('pannes_portees', jsonb_build_object(
  'portees', 0, 'total', 0, 'fiches_a_terre', 0, 'fiches_total', 0, 'maj', null
))
on conflict (cle) do nothing;
