-- ===========================================================================
-- SPRINT 13 — Révocation des droits d'anon et d'authenticated sur TOUTES les
-- tables publiques. Migration corrective.
--
-- CE QUI A ÉTÉ TROUVÉ, ET CE QUI NE S'EST PAS PRODUIT.
--
-- L'essai en transaction annulée a signalé qu'`anon` détient le droit SELECT
-- sur `inspections`. Vérification faite par un appel REST réel avec la clé
-- anon : **HTTP 200, ZÉRO ligne rendue**. Aucune donnée n'a été exposée — la
-- RLS, active sur la table et sans aucune policy, bloque chaque ligne. Le
-- défaut est donc une absence de défense en profondeur, pas une fuite : il
-- suffirait qu'une policy soit ajoutée un jour, ou que la RLS soit désactivée
-- le temps d'une maintenance, pour que le droit devienne effectif.
--
-- ORIGINE. Les tables du sprint 1 (`analyses`, `events`, `leads`,
-- `rappels_cache`), du sprint 7 (`passes`) et du sprint 8 (`inspecteurs`,
-- `inspections`, `inspection_photos`, `inspection_refus`) activent la RLS mais
-- ne révoquent rien. Elles ont donc hérité des **droits par défaut** que
-- Supabase accorde à `anon` et `authenticated` sur le schéma `public`. Les
-- tables plus récentes portent toutes un `revoke all` explicite — l'habitude
-- a été prise en route, après que ces neuf-là ont été créées.
--
-- POURQUOI RÉVOQUER AUSSI `authenticated` : parce que **rien, dans le front,
-- ne lit une table en direct**. Mesuré : 29 appels `.rpc(...)` et zéro
-- `.from('table')` — les quatre occurrences de `.from(` sont des `Array.from`
-- JavaScript. Tout passe par des RPC SECURITY DEFINER et des fonctions edge en
-- service role. Aucun écran ne perd donc quoi que ce soit.
--
-- ⚠️ ON BOUCLE au lieu d'énumérer. Une liste oublierait les tables héritées du
-- dashboard (`experts`, `missions`, `profiles`, `reviews`, `messages`,
-- `chat_files`, `expert_applications`, `price_data`), qu'aucune migration ne
-- crée et qui existent pourtant en base. Et elle oublierait la prochaine.
-- ===========================================================================

do $$
declare
  r record;
  v_n integer := 0;
begin
  for r in
    select c.relname, c.relkind
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v', 'm')  -- tables, partitions, vues, vues matérialisées
  loop
    execute format('revoke all on %s public.%I from anon, authenticated',
      case when r.relkind in ('v', 'm') then '' else 'table' end, r.relname);
    v_n := v_n + 1;
  end loop;
  raise notice 'droits anon/authenticated revoques sur % objets du schema public', v_n;
end $$;

-- ---------------------------------------------------------------------------
-- LA CAUSE RACINE : les droits PAR DÉFAUT.
--
-- Révoquer sur l'existant ne suffit pas : la prochaine table créée dans
-- `public` héritera à nouveau des mêmes droits, et personne ne le verra. On
-- change donc le défaut lui-même, pour le rôle qui applique les migrations.
--
-- C'est réversible d'un `grant` si un besoin apparaît — alors qu'un oubli, lui,
-- ne se voit pas.
-- ---------------------------------------------------------------------------
alter default privileges in schema public revoke all on tables from anon, authenticated;

do $$
begin
  -- Le rôle qui applique les migrations n'est pas forcément celui qui exécute
  -- ce bloc : on pose aussi le défaut pour `postgres` quand il existe.
  if exists (select 1 from pg_roles where rolname = 'postgres') then
    execute 'alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Et on vérifie, dans la migration elle-même, que l'état visé est atteint.
-- Une migration qui se contente d'émettre des ordres ne prouve rien.
-- ---------------------------------------------------------------------------
do $$
declare
  v_restants text;
begin
  select string_agg(c.relname || ' (' || r.rolname || ')', ', ')
    into v_restants
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  cross join (values ('anon'), ('authenticated')) as r(rolname)
  where n.nspname = 'public'
    and c.relkind in ('r', 'p', 'v', 'm')
    and has_table_privilege(r.rolname, c.oid, 'SELECT');
  if v_restants is not null then
    raise exception 'droits SELECT encore presents apres revocation : %', v_restants;
  end if;

  select string_agg(c.relname, ', ') into v_restants
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  if v_restants is not null then
    raise exception 'RLS inactive sur : %', v_restants;
  end if;
end $$;

-- ===========================================================================
-- MÊME PROBLÈME SUR LES FONCTIONS.
--
-- L'essai a trouvé cinq fonctions SECURITY INVOKER exécutables par anon ou
-- authenticated. Après la révocation des tables, une telle fonction
-- s'exécuterait avec les droits de l'appelant — donc sans aucun droit.
--
-- Vérifié : AUCUNE des quatre ci-dessous n'est appelée par le front ni par
-- l'extension (`p_departements`, dans `inspectionApi.js`, est un nom de
-- paramètre, pas un appel). Elles sont toutes appelées DEPUIS d'autres
-- fonctions SQL, où `current_user` est le propriétaire : leur retirer EXECUTE
-- ne casse rien.
--   _departement            — helper de `marche`/`inspection`
--   charte_version_courante — lue par `inspecteur_signer_charte` (DEFINER)
--   part_api_max            — lue par `get_prix_segments` (DEFINER)
--   update_updated_at       — fonction de TRIGGER : PostgreSQL ne vérifie pas
--                             EXECUTE au déclenchement, la révoquer est sûr
-- ===========================================================================

do $$
declare
  r record;
  v_n integer := 0;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('_departement', 'charte_version_courante', 'part_api_max', 'update_updated_at')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    v_n := v_n + 1;
  end loop;
  raise notice 'EXECUTE revoque sur % fonctions internes', v_n;
end $$;

-- ---------------------------------------------------------------------------
-- CAUSE RACINE, côté fonctions.
--
-- Par défaut, PostgreSQL accorde EXECUTE à PUBLIC sur toute fonction nouvelle.
-- Résultat : chaque helper interne devient appelable par anon sans que
-- personne ne l'ait décidé. On inverse le défaut.
--
-- ⚠️ CONSÉQUENCE À CONNAÎTRE : désormais, **toute nouvelle RPC destinée au
-- front devra porter un `grant execute … to anon` ou `to authenticated`
-- explicite**. C'est le but : un accès public devient une décision écrite, pas
-- un héritage. Les fonctions existantes conservent leurs grants (un
-- `create or replace` préserve l'ACL).
-- ---------------------------------------------------------------------------
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'postgres') then
    execute 'alter default privileges for role postgres in schema public '
         || 'revoke execute on functions from public, anon, authenticated';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Et on vérifie que les RPC du front ont TOUJOURS leur grant : la révocation
-- des défauts ne doit rien retirer à l'existant.
-- ---------------------------------------------------------------------------
do $$
declare
  v_perdues text;
begin
  select string_agg(f.nom, ', ') into v_perdues
  from unnest(array[
    'dossier_add','dossier_list','dossier_remove','dossier_set_alertes','dossier_set_statut',
    'drapeau_actif','get_analysis_etape','get_defect_sheet','get_fiabilite','get_kit_signature',
    'get_mon_pass','get_moteur_public','get_partenaires_actifs','get_prix_segments',
    'get_public_analysis','inspecteur_candidater','inspecteur_missions','inspecteur_signer_charte',
    'inspection_zone','list_moteurs_publies','mes_inspections','mon_profil_inspecteur',
    'submit_demande_zone','submit_lead','submit_lead_pro','submit_outcome',
    'submit_pending_analysis','track_event','inspection_accepter','inspection_annuler',
    'inspection_consentement_photos','inspection_constat_absence','inspection_refuser'
  ]) as f(nom)
  where exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = f.nom)
    and not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = f.nom
         and (has_function_privilege('anon', p.oid, 'EXECUTE')
           or has_function_privilege('authenticated', p.oid, 'EXECUTE')));
  if v_perdues is not null then
    raise exception 'RPC du front sans grant EXECUTE apres revocation : %', v_perdues;
  end if;
end $$;
