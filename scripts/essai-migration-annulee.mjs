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
  '20261113120000_sprint13_droits_anon.sql',
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
-- 0. CONTRÔLES = ASSERTIONS, PAS DES \`select\`.
--
-- ⚠️ L'éditeur SQL n'affiche QUE LE DERNIER résultat. Une batterie de
-- \`select\` y est donc invisible : on croit avoir vérifié, on n'a rien vu.
-- Chaque contrôle écrit ici son verdict dans une table, et le bloc final
-- LÈVE UNE ERREUR en listant tout ce qui a échoué. Pas d'erreur = tout est
-- vérifié, et c'est le dernier résultat affiché qui le dit.
-- -----------------------------------------------------------------------
create temporary table essai_controles (
  n serial, controle text, ok boolean, detail text
);

create or replace function essai_verifie(p_controle text, p_ok boolean, p_detail text default null)
returns void language sql as $fn$
  insert into essai_controles (controle, ok, detail)
  values (p_controle, coalesce(p_ok, false), p_detail);
$fn$;

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
select essai_verifie(
  'get_prix_segments rend la MEME chose qu avant (hors nouveau champ)',
  ( select coalesce(jsonb_agg(e - 'part_api_excessive'::text order by ord), '[]'::jsonb)
      from jsonb_array_elements((select res from essai_apres)) with ordinality t(e, ord) )
  = ( select coalesce(jsonb_agg(e order by ord), '[]'::jsonb)
        from jsonb_array_elements((select res from essai_avant)) with ordinality t(e, ord) )
);
select essai_verifie(
  'aucun segment rendu non publiable par le verrou des 20 %',
  ( select count(*) from jsonb_array_elements((select res from essai_apres)) e
     where (e->>'part_api_excessive')::boolean ) = 0
);

-- Les deux histogrammes, côte à côte, pour lecture à l'œil si besoin.
select 'AVANT ' as phase, (select res from essai_avant) as histogrammes
union all
select 'APRES ' as phase, (select res from essai_apres);

-- -----------------------------------------------------------------------
-- 4. LES NOUVEAUX OBJETS FONCTIONNENT-ILS SUR LES DONNÉES RÉELLES ?
-- -----------------------------------------------------------------------
-- Seuil partagé base / TypeScript.
select essai_verifie('part_api_max() = 0.20', public.part_api_max() = 0.20, public.part_api_max()::text);

-- L'appel à UN seul argument doit encore résoudre (p_client_id a un défaut) :
-- c'est ce qui rend l'ordre migration → déploiement de \`score\` sans danger.
select essai_verifie('agreger_marche accepte encore 1 argument (defaut)', public.agreger_marche('[]'::jsonb) = 0);
select essai_verifie('agreger_marche accepte 2 arguments',
  public.agreger_marche('[]'::jsonb, '00000000-0000-4000-8000-000000000000') = 0);

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
-- Les purges doivent S EXECUTER sans erreur ; le nombre importe peu ici.
select essai_verifie('purger_textes_api s execute', public.purger_textes_api() >= 0);
select essai_verifie('purger_preuves_api s execute', public.purger_preuves_api() >= 0);

-- Après la passe 1, aucun texte d'API encore présent ne doit être sans empreinte.
select essai_verifie('aucun texte d API encore present sans empreinte',
  (select count(*) from public.analyses
    where via_api and input_text is not null
      and input_text not like '[texte effacé%' and texte_sha256 is null) = 0);
select essai_verifie('aucun texte efface sans empreinte conservee',
  (select count(*) from public.analyses
    where via_api and input_text like '[texte effacé%' and texte_sha256 is null) = 0);

-- -----------------------------------------------------------------------
-- 4 bis. LES NOUVEAUX OBJETS DU SPRINT 13.
-- -----------------------------------------------------------------------
-- Le drapeau doit être ÉTEINT à la création : une fonction nouvelle ne
-- s'ouvre pas parce qu'on a oublié de la fermer.
select essai_verifie('drapeau lecture_histovec existe et est ETEINT',
  (select etat from public.drapeaux where cle = 'lecture_histovec') = 'eteint',
  (select etat from public.drapeaux where cle = 'lecture_histovec'));

select essai_verifie('drapeau_actif rend false sur un drapeau eteint',
  public.drapeau_actif('lecture_histovec') is false);
select essai_verifie('drapeau_actif rend false sur une cle inconnue',
  public.drapeau_actif('cle_qui_n_existe_pas') is false);

-- Masquage HistoVec : le signal « toujours visible » passe, l'autre non.
select essai_verifie('masquage histovec : 1 signal rendu, 1 masque',
  (m.m -> 'signaux') is not null
  and jsonb_array_length(m.m -> 'signaux') = 1
  and (m.m ->> 'nb_masques')::int = 1
  and (m.m ->> 'masque') = 'true',
  m.m::text)
from (select public._histovec_publique(jsonb_build_object(
  'lu_le', '2026-11-04',
  'concordance', jsonb_build_object('concorde', true),
  'signaux', jsonb_build_array(
    jsonb_build_object('cle','opposition','niveau','rouge','toujours_visible',true,'texte','gage'),
    jsonb_build_object('cle','location','niveau','orange','toujours_visible',false,'texte','location')
  )
)) as m) m;

select essai_verifie('le signal rouge rendu est bien l opposition',
  (m.m -> 'signaux' -> 0 ->> 'cle') = 'opposition')
from (select public._histovec_publique(jsonb_build_object(
  'signaux', jsonb_build_array(
    jsonb_build_object('cle','location','niveau','orange','toujours_visible',false),
    jsonb_build_object('cle','opposition','niveau','rouge','toujours_visible',true)
  )
)) as m) m;

-- get_public_analysis doit masquer les DEUX : la négociation ET HistoVec.
select essai_verifie('get_public_analysis masque la negociation',
  position('_negociation_publique' in pg_get_functiondef(p.oid)) > 0)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'get_public_analysis';

select essai_verifie('get_public_analysis masque histovec',
  position('_histovec_publique' in pg_get_functiondef(p.oid)) > 0)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'get_public_analysis';

-- Heure de grâce : la colonne existe ET l'annulation la lit.
select essai_verifie('colonne inspections.confirmee_le presente',
  exists (select 1 from information_schema.columns
           where table_schema='public' and table_name='inspections'
             and column_name='confirmee_le'));

select essai_verifie('inspection_annuler lit confirmee_le (heure de grace)',
  position('confirmee_le' in pg_get_functiondef(p.oid)) > 0)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'inspection_annuler';

-- Échéance de confirmation à deux bornes (creneau - 2 h, ou autorisation + 48 h).
select essai_verifie('inspections_a_expirer applique les DEUX bornes',
  position('least(' in pg_get_functiondef(p.oid)) > 0
  and position('2 hours' in pg_get_functiondef(p.oid)) > 0
  and position('48 hours' in pg_get_functiondef(p.oid)) > 0)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'inspections_a_expirer';

-- La retenue ne peut jamais depasser l encaisse.
select essai_verifie('inspection_annuler borne la retenue par le prix',
  position('least(4000' in pg_get_functiondef(p.oid)) > 0)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'inspection_annuler';

-- ⚠️ DROITS : plus de liste figée. Une liste de cinq tables avait laissé
-- passer les neuf qui n'avaient pas de \`revoke\` — dont \`inspections\`. On
-- assère donc sur TOUT le schéma public, tables et vues comprises, pour les
-- DEUX rôles. Une table ajoutée demain sans révocation fera échouer l'essai.
select essai_verifie(
  'anon ne peut lire AUCUN objet de public',
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p','v','m')
      and has_table_privilege('anon', c.oid, 'SELECT')) = 0,
  (select string_agg(c.relname, ', ') from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p','v','m')
      and has_table_privilege('anon', c.oid, 'SELECT')));

select essai_verifie(
  'authenticated ne peut lire AUCUN objet de public',
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p','v','m')
      and has_table_privilege('authenticated', c.oid, 'SELECT')) = 0,
  (select string_agg(c.relname, ', ') from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p','v','m')
      and has_table_privilege('authenticated', c.oid, 'SELECT')));

-- Et aucun droit d'ÉCRITURE non plus.
select essai_verifie(
  'ni anon ni authenticated ne peuvent ecrire dans public',
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    cross join (values ('anon'),('authenticated')) as r(nom)
    where n.nspname = 'public' and c.relkind in ('r','p')
      and (has_table_privilege(r.nom, c.oid, 'INSERT')
        or has_table_privilege(r.nom, c.oid, 'UPDATE')
        or has_table_privilege(r.nom, c.oid, 'DELETE'))) = 0);

-- RLS active sur TOUTES les tables de public, pas seulement les nouvelles.
select essai_verifie(
  'RLS active sur toutes les tables de public',
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity) = 0,
  (select string_agg(c.relname, ', ') from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity));

-- Les droits PAR DÉFAUT aussi : c'est la cause racine du défaut trouvé.
select essai_verifie(
  'les droits par defaut de public n accordent plus rien a anon/authenticated',
  (select count(*) from pg_default_acl d
    where d.defaclnamespace = 'public'::regnamespace and d.defaclobjtype = 'r'
      and (array_to_string(d.defaclacl, ',') like '%anon=%'
        or array_to_string(d.defaclacl, ',') like '%authenticated=%')) = 0,
  (select array_to_string(d.defaclacl, ' ') from pg_default_acl d
    where d.defaclnamespace = 'public'::regnamespace and d.defaclobjtype = 'r' limit 1));

-- -----------------------------------------------------------------------
-- 4 ter. LE VERDICT. C'est le SEUL résultat que l'éditeur affichera, et il
--        lève une erreur si quoi que ce soit a échoué.
-- -----------------------------------------------------------------------
do $verdict$
declare
  v_echecs text;
  v_total integer;
  v_ko integer;
begin
  select count(*), count(*) filter (where not ok) into v_total, v_ko from essai_controles;
  if v_total = 0 then
    raise exception 'ESSAI INVALIDE : aucun controle n a ete enregistre';
  end if;
  if v_ko > 0 then
    select string_agg(format('  - %s%s', controle, coalesce(' [' || detail || ']', '')), E'\n' order by n)
      into v_echecs from essai_controles where not ok;
    raise exception E'ESSAI ECHOUE : %/% controles en echec\n%', v_ko, v_total, v_echecs;
  end if;
  raise notice 'ESSAI CONCLUANT : %/% controles passes', v_total, v_total;
end
$verdict$;

-- Dernier résultat affiché : le décompte, et la liste pour relecture.
select count(*) filter (where ok) as controles_passes,
       count(*) filter (where not ok) as controles_en_echec,
       'si cette ligne s affiche, AUCUN controle n a echoue' as lecture
  from essai_controles;

select n, controle, ok from essai_controles order by n;

-- -----------------------------------------------------------------------
-- 5. ON N'APPLIQUE RIEN.
-- -----------------------------------------------------------------------
rollback;
`)
