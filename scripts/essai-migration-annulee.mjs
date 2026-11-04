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

// Les migrations à éprouver, DANS L'ORDRE D'APPLICATION. L'ordre compte : la
// 20261110 redéfinit `inspection_annuler` créée par la 20261109, et la
// 20261111 redéclare `get_public_analysis`. Les jouer en vrac ne prouverait
// rien de ce qui se passera réellement.
const MIGRATIONS = [
  // sprint12-vocabulaire
  '20261108120000_sprint12_cua_api.sql',
  '20261109120000_sprint12_inspection_paiement.sql',
  '20261110120000_sprint12_cgv_consommateur.sql',
  // sprint13
  '20261111120000_sprint13_histovec.sql',
  '20261112120000_sprint13_drapeaux.sql',
]

const corpsDe = (f) => readFileSync(new URL(`../supabase/migrations/${f}`, import.meta.url), 'utf8')

for (const f of MIGRATIONS) {
  if (/^\s*(begin|commit|rollback)\s*;/im.test(corpsDe(f))) {
    console.error(`${f} contient son propre contrôle de transaction : à vérifier avant.`)
    process.exit(1)
  }
}

process.stdout.write(`-- =======================================================================
-- ESSAI EN TRANSACTION ANNULÉE — ${MIGRATIONS.length} migrations, dans l'ordre
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
-- 2. LES MIGRATIONS, insérées telles quelles, DANS L'ORDRE.
-- -----------------------------------------------------------------------
${MIGRATIONS.map((f, i) => `
-- ======================================================================
-- [${i + 1}/${MIGRATIONS.length}] ${f}
-- ======================================================================
${corpsDe(f)}
select '[${i + 1}/${MIGRATIONS.length}] ${f} : appliquee' as etape;
`).join('\n')}
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
-- 4 bis. LES NOUVEAUX OBJETS DU SPRINT 13.
-- -----------------------------------------------------------------------
-- Le drapeau doit être ÉTEINT à la création : une fonction nouvelle ne
-- s'ouvre pas parce qu'on a oublié de la fermer.
select 'drapeau lecture_histovec' as objet, etat,
       (etat = 'eteint') as eteint_comme_attendu
  from public.drapeaux where cle = 'lecture_histovec';

select 'drapeau_actif (eteint)' as objet,
       public.drapeau_actif('lecture_histovec') as doit_etre_false;
select 'drapeau_actif (cle inconnue)' as objet,
       public.drapeau_actif('cle_qui_n_existe_pas') as doit_etre_false;

-- Masquage HistoVec : un signal « toujours visible » passe, l'autre non.
select 'masquage histovec' as objet,
       jsonb_array_length(m -> 'signaux') as signaux_rendus_doit_etre_1,
       (m ->> 'nb_masques')::int as masques_doit_etre_1,
       (m ->> 'masque') as masque
from public._histovec_publique(jsonb_build_object(
  'lu_le', '2026-11-04',
  'concordance', jsonb_build_object('concorde', true),
  'signaux', jsonb_build_array(
    jsonb_build_object('cle','opposition','niveau','rouge','toujours_visible',true,'texte','gage'),
    jsonb_build_object('cle','location','niveau','orange','toujours_visible',false,'texte','location')
  )
)) m;

-- get_public_analysis doit masquer les DEUX : la négociation ET HistoVec.
select 'get_public_analysis' as objet,
       position('_negociation_publique' in pg_get_functiondef(p.oid)) > 0 as masque_negociation,
       position('_histovec_publique' in pg_get_functiondef(p.oid)) > 0 as masque_histovec
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'get_public_analysis';

-- Heure de grâce : la colonne existe et l'annulation la lit.
select 'confirmee_le' as objet,
       exists (select 1 from information_schema.columns
                where table_schema='public' and table_name='inspections'
                  and column_name='confirmee_le') as colonne_presente,
       position('confirmee_le' in pg_get_functiondef(p.oid)) > 0 as lue_par_inspection_annuler
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'inspection_annuler';

-- Échéance de confirmation à deux bornes.
select 'inspections_a_expirer' as objet,
       position('least(' in pg_get_functiondef(p.oid)) > 0 as deux_bornes
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'inspections_a_expirer';

-- Les tables sensibles restent fermées à anon.
select 'droits anon' as objet, c.relname,
       has_table_privilege('anon', c.oid, 'SELECT') as anon_peut_lire_doit_etre_false
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('drapeaux','api_appels','marche_agregats');

-- -----------------------------------------------------------------------
-- 5. ON N'APPLIQUE RIEN.
-- -----------------------------------------------------------------------
rollback;
`)
