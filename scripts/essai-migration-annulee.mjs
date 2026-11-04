// Génère l'essai EN TRANSACTION ANNULÉE de la migration du sprint 12.
//
// Pourquoi un générateur plutôt qu'un fichier SQL écrit à la main : le corps
// de la migration est INSÉRÉ depuis le fichier réel. Un essai recopié à la
// main prouverait que la copie passe, pas que la migration passe.
//
// Usage : node scripts/essai-migration-annulee.mjs > /tmp/essai.sql
// Puis : coller dans l'éditeur SQL du dashboard Supabase (UNE seule session).
// Rien n'est conservé — la transaction finit par ROLLBACK.
import { readFileSync } from 'node:fs'

const MIGRATION = 'supabase/migrations/20261108120000_sprint12_cua_api.sql'
const corps = readFileSync(new URL(`../${MIGRATION}`, import.meta.url), 'utf8')

if (/^\s*(begin|commit|rollback)\s*;/im.test(corps)) {
  console.error('La migration contient son propre contrôle de transaction : à vérifier avant.')
  process.exit(1)
}

process.stdout.write(`-- =======================================================================
-- ESSAI EN TRANSACTION ANNULÉE — migration ${MIGRATION.split('/').pop()}
--
-- Généré par scripts/essai-migration-annulee.mjs (ne pas éditer à la main).
-- À coller dans l'éditeur SQL du dashboard Supabase : il exécute tout dans
-- UNE session, ce qui est la condition pour que le ROLLBACK final emporte
-- l'ensemble.
--
-- CE SCRIPT NE CONSERVE RIEN. Dernière instruction : rollback.
-- =======================================================================
begin;

-- -----------------------------------------------------------------------
-- 1. ÉTAT AVANT. On fige la liste des segments interrogés, pour que l'avant
--    et l'après portent sur EXACTEMENT la même question.
-- -----------------------------------------------------------------------
create temporary table essai_segments as
select coalesce(
         jsonb_agg(jsonb_build_object('marque', marque_norm, 'modele', modele_norm)),
         '[]'::jsonb) as q
from (select distinct marque_norm, modele_norm
        from public.marche_agregats
       order by marque_norm, modele_norm
       limit 30) s;

create temporary table essai_avant as
select public.get_prix_segments((select q from essai_segments)) as res;

-- Pour mémoire : volumétrie réelle touchée par la migration.
select 'AVANT' as phase,
       (select count(*) from public.marche_agregats)                     as lignes_marche,
       (select count(*) from essai_segments s, jsonb_array_elements(s.q)) as segments_interroges,
       (select count(*) from public.analyses where via_api)              as analyses_via_api,
       (select count(*) from public.analyses
         where via_api and input_text is not null
           and input_text not like '[texte effacé%')                     as textes_api_encore_presents;

-- -----------------------------------------------------------------------
-- 2. LA MIGRATION, insérée telle quelle depuis le fichier.
-- -----------------------------------------------------------------------
${corps}
-- -----------------------------------------------------------------------
-- 3. ÉTAT APRÈS, même question.
-- -----------------------------------------------------------------------
create temporary table essai_apres as
select public.get_prix_segments((select q from essai_segments)) as res;

-- get_prix_segments doit rendre LA MÊME CHOSE qu'avant. La seule différence
-- attendue est le champ \`part_api_excessive\`, ajouté par la migration : on
-- le retire avant de comparer. Toute autre différence est une régression.
select 'COMPARAISON' as phase,
  ( select coalesce(jsonb_agg(e - 'part_api_excessive'::text order by ord), '[]'::jsonb)
      from jsonb_array_elements((select res from essai_apres)) with ordinality t(e, ord) )
  = ( select coalesce(jsonb_agg(e order by ord), '[]'::jsonb)
        from jsonb_array_elements((select res from essai_avant)) with ordinality t(e, ord) )
    as get_prix_segments_identique,
  -- Et aucun segment ne doit avoir été rendu non publiable : \`parts_api\` est
  -- vide partout au départ, donc le verrou des 20 % ne peut pas se déclencher.
  ( select count(*) from jsonb_array_elements((select res from essai_apres)) e
     where (e->>'part_api_excessive')::boolean ) as segments_bloques_par_le_verrou;

-- Les deux histogrammes, côte à côte, pour lecture à l'œil si besoin.
select 'AVANT ' as phase, (select res from essai_avant) as histogrammes
union all
select 'APRES ' as phase, (select res from essai_apres);

-- -----------------------------------------------------------------------
-- 4. LES NOUVEAUX OBJETS FONCTIONNENT-ILS SUR LES DONNÉES RÉELLES ?
-- -----------------------------------------------------------------------
-- Seuil partagé base / TypeScript.
select 'part_api_max' as objet, public.part_api_max() as valeur;

-- L'appel à UN seul argument doit encore résoudre (p_client_id a un défaut) :
-- c'est ce qui rend l'ordre migration → déploiement de \`score\` sans danger.
select 'agreger_marche 1 argument' as objet, public.agreger_marche('[]'::jsonb) as lignes_traitees;
select 'agreger_marche 2 arguments' as objet,
       public.agreger_marche('[]'::jsonb, '00000000-0000-4000-8000-000000000000') as lignes_traitees;

-- Un identifiant de client invalide doit ÉCHOUER, pas basculer en « public ».
do $essai$
begin
  perform public.agreger_marche('[]'::jsonb, 'pas-un-uuid');
  raise exception 'ESSAI ÉCHOUÉ : un identifiant invalide a été accepté';
exception
  when others then
    if sqlerrm = 'ESSAI ÉCHOUÉ : un identifiant invalide a été accepté' then raise;
    end if;
    raise notice 'OK — identifiant invalide refusé (%)', sqlerrm;
end
$essai$;

-- Les deux purges, sur les données réelles. Les comptages renvoyés sont ce
-- qui SERAIT fait ; le rollback final les annule.
select 'purger_textes_api'  as objet, public.purger_textes_api()  as textes_effaces;
select 'purger_preuves_api' as objet, public.purger_preuves_api() as preuves_expirees;

-- Après la passe 1, aucun texte d'API encore présent ne doit être sans empreinte.
select 'INVARIANT' as phase,
       (select count(*) from public.analyses
         where via_api and input_text is not null
           and input_text not like '[texte effacé%'
           and texte_sha256 is null) as textes_sans_empreinte_doit_etre_0,
       (select count(*) from public.analyses
         where via_api and input_text like '[texte effacé%'
           and texte_sha256 is null) as textes_effaces_sans_empreinte_doit_etre_0;

-- -----------------------------------------------------------------------
-- 5. ON N'APPLIQUE RIEN.
-- -----------------------------------------------------------------------
rollback;
`)
