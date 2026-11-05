-- SPRINT 20.1 — Correctifs de l'audit du 5 novembre 2026 (mineurs 7 et 8).
--
-- Aucune de ces trois révocations ne corrige une fuite : la RLS, active et
-- sans policy, bloquait déjà chaque ligne, et les deux fonctions visées sont
-- des fonctions de TRIGGER qui lèvent si on les appelle hors contexte. C'est
-- de la défense en profondeur — exactement la même correction que la migration
-- 20261113120000, qui avait traité `update_updated_at`, `_departement`,
-- `charte_version_courante` et `part_api_max` mais LAISSÉ ces deux-là.
--
-- Pourquoi elles avaient échappé : elles n'appartiennent à aucune migration.
-- `handle_new_user` est le trigger de création de profil posé depuis le
-- dashboard aux premières sessions, et `rls_auto_enable` est un trigger
-- d'événement qui active la RLS sur toute table nouvelle — c'est d'ailleurs
-- lui qui explique qu'aucune table du schéma n'en soit dépourvue. Un objet
-- créé à la main échappe aux migrations ET aux droits par défaut qu'elles
-- posent (règle 0 ter du CLAUDE.md).

-- ---------------------------------------------------------------------------
-- 1. handle_new_user et rls_auto_enable : plus exécutables par anon
-- ---------------------------------------------------------------------------
-- ⚠️ PostgreSQL ne vérifie PAS le droit EXECUTE au déclenchement d'un trigger :
-- révoquer ici ne casse donc ni la création de profil, ni l'activation
-- automatique de la RLS. Vérifié dans les deux cas par l'essai local, qui
-- rejoue l'intégralité des migrations sur une base vide — si le trigger de
-- création de profil cassait, `supabase db reset` échouerait.
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'handle_new_user') then
    revoke all on function public.handle_new_user() from public, anon, authenticated;
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    revoke all on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 2. visio_disponible : SUPPRIMÉE, personne ne l'appelle
-- ---------------------------------------------------------------------------
-- Posée au sprint 14, ouverte à anon, et jamais appelée : vérifié sur
-- l'ensemble du dépôt (front, extension, proxys Vercel, fonctions edge,
-- scripts) — elle n'apparaît que dans la migration qui l'a créée. Elle rendait
-- publiquement l'état de notre réseau d'inspecteurs (« existe-t-il quelqu'un
-- qui puisse faire une visio ? »), sans qu'aucun écran n'en ait besoin.
--
-- On la SUPPRIME plutôt que de seulement révoquer son droit : une fonction que
-- personne n'appelle et qui n'est plus exécutable n'est pas un garde-fou,
-- c'est du code mort qui donne l'illusion d'une fonctionnalité. L'ouverture de
-- la visio est décidée par `drapeau_actif('visio_guidee')` et par
-- `inspection-checkout`, qui vérifient le vrai verrou côté serveur.
drop function if exists public.visio_disponible();

-- ---------------------------------------------------------------------------
-- 3. Contrôle d'arrivée
-- ---------------------------------------------------------------------------
-- La migration vérifie elle-même l'état atteint et lève si quoi que ce soit
-- subsiste : un correctif de droits qui ne constate pas son effet n'en est pas
-- un (leçon de la migration 20261113120000).
do $$
declare
  v_restant text;
begin
  select string_agg(p.proname, ', ') into v_restant
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
  cross join (values ('anon'), ('authenticated')) as r(nom)
  where p.proname in ('handle_new_user', 'rls_auto_enable', 'visio_disponible')
    and has_function_privilege(r.nom, p.oid, 'EXECUTE');
  if v_restant is not null then
    raise exception 'EXECUTE subsiste pour anon ou authenticated sur : %', v_restant;
  end if;

  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'visio_disponible') then
    raise exception 'visio_disponible existe encore';
  end if;
end
$$;
