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

// ⚠️ DEUX USAGES, DEUX FORMES.
//
//  - sans drapeau : le script COMPLET, migrations incluses, encadré par
//    BEGIN/ROLLBACK. C'est la forme pour éprouver des migrations NON encore
//    appliquées — typiquement sur la prod, depuis l'éditeur SQL.
//
//  - `--assertions` : les assertions SEULES. C'est la forme locale, après un
//    `supabase db reset` qui a déjà rejoué toute l'histoire des migrations sur
//    une base vide. Rejouer les corps une seconde fois échouerait, et à juste
//    titre : une migration n'est pas idempotente (`drop function` puis
//    `create function` ne se rejoue pas).
//
// Le reset local est d'ailleurs la vérification la PLUS forte : il exige que
// l'intégralité des 33 migrations passe depuis zéro, pas seulement les
// dernières.
const ASSERTIONS_SEULES = process.argv.includes('--assertions')

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

-- ⚠️ DANS pg_temp, PAS DANS public. Créée dans \`public\`, cette aide
-- apparaissait elle-même dans l'assertion « toute fonction exécutable par anon
-- est SECURITY DEFINER » — l'outil de mesure faussait la mesure.
create or replace function pg_temp.essai_verifie(p_controle text, p_ok boolean, p_detail text default null)
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
${ASSERTIONS_SEULES
  ? `-- MODE ASSERTIONS : les migrations ne sont PAS rejouees ici. Elles l'ont
-- ete par \`supabase db reset\`, qui a replay l'histoire complete sur une base
-- vide — ce qui est une epreuve plus forte que ce bloc.
select 'migrations non rejouees (mode --assertions)' as etape;`
  : MIGRATIONS.map((f, i) => `
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
select pg_temp.essai_verifie(
  'get_prix_segments rend la MEME chose qu avant (hors nouveau champ)',
  ( select coalesce(jsonb_agg(e - 'part_api_excessive'::text order by ord), '[]'::jsonb)
      from jsonb_array_elements((select res from essai_apres)) with ordinality t(e, ord) )
  = ( select coalesce(jsonb_agg(e order by ord), '[]'::jsonb)
        from jsonb_array_elements((select res from essai_avant)) with ordinality t(e, ord) )
);
select pg_temp.essai_verifie(
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
select pg_temp.essai_verifie('part_api_max() = 0.20', public.part_api_max() = 0.20, public.part_api_max()::text);

-- L'appel à UN seul argument doit encore résoudre (p_client_id a un défaut) :
-- c'est ce qui rend l'ordre migration → déploiement de \`score\` sans danger.
select pg_temp.essai_verifie('agreger_marche accepte encore 1 argument (defaut)', public.agreger_marche('[]'::jsonb) = 0);
select pg_temp.essai_verifie('agreger_marche accepte 2 arguments',
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
select pg_temp.essai_verifie('purger_textes_api s execute', public.purger_textes_api() >= 0);
select pg_temp.essai_verifie('purger_preuves_api s execute', public.purger_preuves_api() >= 0);

-- Après la passe 1, aucun texte d'API encore présent ne doit être sans empreinte.
select pg_temp.essai_verifie('aucun texte d API encore present sans empreinte',
  (select count(*) from public.analyses
    where via_api and input_text is not null
      and input_text not like '[texte effacé%' and texte_sha256 is null) = 0);
select pg_temp.essai_verifie('aucun texte efface sans empreinte conservee',
  (select count(*) from public.analyses
    where via_api and input_text like '[texte effacé%' and texte_sha256 is null) = 0);

-- -----------------------------------------------------------------------
-- 4 bis. LES NOUVEAUX OBJETS DU SPRINT 13.
-- -----------------------------------------------------------------------
-- Le drapeau doit être ÉTEINT à la création : une fonction nouvelle ne
-- s'ouvre pas parce qu'on a oublié de la fermer.
select pg_temp.essai_verifie('drapeau lecture_histovec existe et est ETEINT',
  (select etat from public.drapeaux where cle = 'lecture_histovec') = 'eteint',
  (select etat from public.drapeaux where cle = 'lecture_histovec'));

select pg_temp.essai_verifie('drapeau_actif rend false sur un drapeau eteint',
  public.drapeau_actif('lecture_histovec') is false);
select pg_temp.essai_verifie('drapeau_actif rend false sur une cle inconnue',
  public.drapeau_actif('cle_qui_n_existe_pas') is false);

-- Masquage HistoVec : le signal « toujours visible » passe, l'autre non.
select pg_temp.essai_verifie('masquage histovec : 1 signal rendu, 1 masque',
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

select pg_temp.essai_verifie('le signal rouge rendu est bien l opposition',
  (m.m -> 'signaux' -> 0 ->> 'cle') = 'opposition')
from (select public._histovec_publique(jsonb_build_object(
  'signaux', jsonb_build_array(
    jsonb_build_object('cle','location','niveau','orange','toujours_visible',false),
    jsonb_build_object('cle','opposition','niveau','rouge','toujours_visible',true)
  )
)) as m) m;

-- get_public_analysis doit masquer les DEUX : la négociation ET HistoVec.
select pg_temp.essai_verifie('get_public_analysis masque la negociation',
  position('_negociation_publique' in pg_get_functiondef(p.oid)) > 0)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'get_public_analysis';

select pg_temp.essai_verifie('get_public_analysis masque histovec',
  position('_histovec_publique' in pg_get_functiondef(p.oid)) > 0)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'get_public_analysis';

-- Heure de grâce : la colonne existe ET l'annulation la lit.
select pg_temp.essai_verifie('colonne inspections.confirmee_le presente',
  exists (select 1 from information_schema.columns
           where table_schema='public' and table_name='inspections'
             and column_name='confirmee_le'));

select pg_temp.essai_verifie('inspection_annuler lit confirmee_le (heure de grace)',
  position('confirmee_le' in pg_get_functiondef(p.oid)) > 0)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'inspection_annuler';

-- Échéance de confirmation à deux bornes (creneau - 2 h, ou autorisation + 48 h).
select pg_temp.essai_verifie('inspections_a_expirer applique les DEUX bornes',
  position('least(' in pg_get_functiondef(p.oid)) > 0
  and position('2 hours' in pg_get_functiondef(p.oid)) > 0
  and position('48 hours' in pg_get_functiondef(p.oid)) > 0)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'inspections_a_expirer';

-- La retenue ne peut jamais depasser l encaisse, ET elle vient du bareme de la
-- PRESTATION. L assertion portait auparavant sur la chaine litterale
-- 'least(4000' : elle verifiait donc la presence de la constante de
-- l inspection, c est-a-dire exactement le defaut corrige par la migration
-- 20261115120000 (une visio annulee retenait 40 EUR au lieu de 0).
select pg_temp.essai_verifie(
  p.proname || ' borne la retenue par le prix et lit le bareme du type',
  position('least(' in pg_get_functiondef(p.oid)) > 0
  and position('prix_cents' in pg_get_functiondef(p.oid)) > 0
  and position('prestation_bareme' in pg_get_functiondef(p.oid)) > 0)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('inspection_annuler', 'inspection_constat_absence');

-- Le bareme SQL doit dire ce que dit PRESTATIONS cote TypeScript.
select pg_temp.essai_verifie('prestation_bareme : visio 2000 / 0 h, inspection 4000 / 24 h',
  (public.prestation_bareme('visio')->>'retenue_cents')::int = 2000
  and (public.prestation_bareme('visio')->>'annulation_gratuite_heures')::int = 0
  and (public.prestation_bareme('inspection')->>'retenue_cents')::int = 4000
  and (public.prestation_bareme('inspection')->>'annulation_gratuite_heures')::int = 24
  -- un type inconnu ne doit jamais tomber sur le bareme le moins cher
  and (public.prestation_bareme(null)->>'retenue_cents')::int = 4000);

-- ── SPRINT 15 : liste d attente pro et verification independante ──────────

-- La signature a QUATRE arguments doit avoir disparu : la laisser vivre
-- permettrait d inserer un lead sans que l appelant ait choisi son type.
select pg_temp.essai_verifie('submit_lead_pro : l ancienne signature a 4 arguments est supprimee',
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'submit_lead_pro' and p.pronargs = 4) = 0
  and (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'submit_lead_pro' and p.pronargs = 7) = 1);

-- Un lead sans type ne doit pas pouvoir exister.
select pg_temp.essai_verifie('leads_pro.type : defaut api, contrainte aux deux valeurs',
  (select column_default like '%api%' and is_nullable = 'NO'
     from information_schema.columns
    where table_schema = 'public' and table_name = 'leads_pro' and column_name = 'type')
  and (select count(*) from pg_constraint where conname = 'leads_pro_type_check') = 1);

-- Le seuil de publication est celui qui a ete decide : 30.
select pg_temp.essai_verifie('get_fiabilite : rien n est publie avant 30 analyses verifiees',
  (public.get_fiabilite()->>'publie')::boolean = false
  and (public.get_fiabilite()->>'seuil')::int = 30);

-- Les invérifiables ne gonflent pas le taux publie : le denominateur existe
-- et il est distinct du total.
select pg_temp.essai_verifie('get_fiabilite : le denominateur verifiable est declare',
  position('''verifiables''' in pg_get_functiondef(p.oid)) > 0
  and position('''sans_source''' in pg_get_functiondef(p.oid)) > 0)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'get_fiabilite';

-- Les outils de l exploitant ne sont pas des surfaces publiques.
select pg_temp.essai_verifie('verification : outils reserves au service role',
  not has_function_privilege('anon', 'public.get_leads_pro_compteur()', 'execute')
  and not has_function_privilege('authenticated', 'public.get_leads_pro_compteur()', 'execute')
  and not has_function_privilege('anon', 'public.analyses_a_verifier(integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.analyses_a_verifier(integer)', 'execute')
  and has_function_privilege('anon', 'public.get_fiabilite()', 'execute'));

-- Une affirmation ne peut etre verifiee deux fois pour la meme analyse.
select pg_temp.essai_verifie('verifications : unicite (analysis_id, claim_hash)',
  (select count(*) from pg_constraint c
     join pg_class t on t.oid = c.conrelid
    where t.relname = 'verifications' and c.contype = 'u') = 1);

-- ── SPRINT 17 : surveillance ──────────────────────────────────────────────

-- Le point de controle est PUBLIC : il doit repondre a anon, et ne rien dire
-- d autre que « la base repond ».
select pg_temp.essai_verifie('sante() est ouverte a anon et ne rend aucun chiffre d affaires',
  has_function_privilege('anon', 'public.sante()', 'execute')
  and (public.sante()->>'base') = 'ok'
  and (public.sante()->>'schema')::boolean = true
  -- Elle NOMME les tables attendues (c est son role : verifier le schema),
  -- mais elle n en LIT aucune : la seule source de donnees est
  -- information_schema, et elle ne rend que deux cles.
  and position('from public.' in pg_get_functiondef(p.oid)) = 0
  and (select count(*) from jsonb_object_keys(public.sante())) = 2)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'sante';

-- Tout le reste de la surveillance est reserve au service role : le cout du
-- jour et le bilan sont des donnees d exploitation.
select pg_temp.essai_verifie('surveillance : cout, bilan et config refuses a anon',
  not has_function_privilege('anon', 'public.cout_ia_jour(date)', 'execute')
  and not has_function_privilege('authenticated', 'public.cout_ia_jour(date)', 'execute')
  and not has_function_privilege('anon', 'public.bilan_quotidien(date)', 'execute')
  and not has_function_privilege('anon', 'public.config_lire(text, numeric)', 'execute')
  and not has_table_privilege('anon', 'public.config', 'select'));

-- Les seuils vivent en base, avec leurs valeurs par defaut.
select pg_temp.essai_verifie('config : les trois seuils sont semes',
  public.config_lire('cout_ia_seuil_jour_eur', -1) = 5
  and public.config_lire('echecs_fenetre_minutes', -1) = 15
  and public.config_lire('echecs_seuil', -1) = 3
  -- une cle inconnue rend le defaut, elle ne leve pas
  and public.config_lire('cle_qui_n_existe_pas', 42) = 42);

-- Sur une base vide, le bilan doit rendre une structure complete et des
-- zeros — jamais null : un bilan a trous ne se lit pas.
select pg_temp.essai_verifie('bilan_quotidien : structure complete meme a vide',
  (select bool_and(public.bilan_quotidien(current_date) ? cle)
     from unnest(array['jour','analyses','analyses_par_source','verdicts','clics',
                       'paiements','listes_attente','erreurs','cout_ia_eur']) as cle)
  and (public.bilan_quotidien(current_date)->>'analyses')::int = 0
  and (public.bilan_quotidien(current_date)->>'cout_ia_eur')::numeric = 0);

-- Le compteur d echecs lit bien les erreurs de pipeline, et borne sa fenetre.
select pg_temp.essai_verifie('echecs_recents : zero a vide, fenetre bornee',
  public.echecs_recents(15) = 0
  and public.echecs_recents(999999) = 0
  and public.echecs_recents(null) = 0);

-- ⚠️ DROITS : plus de liste figée. Une liste de cinq tables avait laissé
-- passer les neuf qui n'avaient pas de \`revoke\` — dont \`inspections\`. On
-- assère donc sur TOUT le schéma public, tables et vues comprises, pour les
-- DEUX rôles. Une table ajoutée demain sans révocation fera échouer l'essai.
select pg_temp.essai_verifie(
  'anon ne peut lire AUCUN objet de public',
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p','v','m')
      and has_table_privilege('anon', c.oid, 'SELECT')) = 0,
  (select string_agg(c.relname, ', ') from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p','v','m')
      and has_table_privilege('anon', c.oid, 'SELECT')));

select pg_temp.essai_verifie(
  'authenticated ne peut lire AUCUN objet de public',
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p','v','m')
      and has_table_privilege('authenticated', c.oid, 'SELECT')) = 0,
  (select string_agg(c.relname, ', ') from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p','v','m')
      and has_table_privilege('authenticated', c.oid, 'SELECT')));

-- Et aucun droit d'ÉCRITURE non plus.
select pg_temp.essai_verifie(
  'ni anon ni authenticated ne peuvent ecrire dans public',
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    cross join (values ('anon'),('authenticated')) as r(nom)
    where n.nspname = 'public' and c.relkind in ('r','p')
      and (has_table_privilege(r.nom, c.oid, 'INSERT')
        or has_table_privilege(r.nom, c.oid, 'UPDATE')
        or has_table_privilege(r.nom, c.oid, 'DELETE'))) = 0);

-- RLS active sur TOUTES les tables de public, pas seulement les nouvelles.
select pg_temp.essai_verifie(
  'RLS active sur toutes les tables de public',
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity) = 0,
  (select string_agg(c.relname, ', ') from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity));

-- Les droits PAR DÉFAUT aussi : c'est la cause racine du défaut trouvé.
-- ⚠️ RESTREINT AU RÔLE \`postgres\`, et c'est une nécessité, pas un
-- assouplissement. Il reste dans \`pg_default_acl\` une entrée appartenant à
-- \`supabase_admin\` (« anon=arwdDxtm/supabase_admin ») que nos migrations,
-- qui tournent en \`postgres\`, ne peuvent pas modifier. Ce qui est sous notre
-- contrôle, c'est le défaut de \`postgres\` — le rôle qui crée nos tables.
--
-- Le filet contre une table créée autrement reste l'assertion GLOBALE
-- ci-dessus (« anon ne peut lire AUCUN objet de public »), qui ne dépend
-- d'aucun propriétaire.
select pg_temp.essai_verifie(
  'les droits par defaut de postgres n accordent plus rien sur les TABLES',
  (select count(*) from pg_default_acl d
    where d.defaclnamespace = 'public'::regnamespace
      and d.defaclobjtype = 'r'
      and d.defaclrole = 'postgres'::regrole
      and (array_to_string(d.defaclacl, ',') ~ '(^|,)anon='
        or array_to_string(d.defaclacl, ',') ~ '(^|,)authenticated=')) = 0,
  (select array_to_string(d.defaclacl, ' ') from pg_default_acl d
    where d.defaclnamespace = 'public'::regnamespace
      and d.defaclobjtype = 'r' and d.defaclrole = 'postgres'::regrole));

select pg_temp.essai_verifie(
  'les droits par defaut de postgres n accordent plus EXECUTE sur les FONCTIONS',
  (select count(*) from pg_default_acl d
    where d.defaclnamespace = 'public'::regnamespace
      and d.defaclobjtype = 'f'
      and d.defaclrole = 'postgres'::regrole
      and (array_to_string(d.defaclacl, ',') ~ '(^|,)anon='
        or array_to_string(d.defaclacl, ',') ~ '(^|,)authenticated='
        or array_to_string(d.defaclacl, ',') ~ '(^|,)=X')) = 0,
  (select array_to_string(d.defaclacl, ' ') from pg_default_acl d
    where d.defaclnamespace = 'public'::regnamespace
      and d.defaclobjtype = 'f' and d.defaclrole = 'postgres'::regrole));

-- -----------------------------------------------------------------------
-- 4 quater. SECURITY DEFINER : LE POINT QUI CASSERAIT TOUT.
--
-- Apres la revocation, une fonction SECURITY INVOKER appelee avec la cle anon
-- ou un jeton utilisateur s'executerait avec les droits de l'appelant — donc
-- sans aucun droit sur les tables. Elle casserait immediatement, en
-- production. Une seule suffit.
--
-- Deux assertions, volontairement redondantes :
--   1. la liste NOMMEE, relevee sur les sites d'appel reels : 28 \`.rpc()\` du
--      front + 5 appelees par une fonction edge avec le jeton de l'utilisateur.
--      L'extension n'appelle aucune RPC, elle passe par les proxys en service
--      role ;
--   2. une regle GENERALE qui se maintient d'elle-meme : toute fonction dont
--      l'execution est accordee a anon ou authenticated doit etre DEFINER.
--      Elle attrapera celles que la liste oublierait.
-- -----------------------------------------------------------------------
create temporary table essai_rpc_publiques (nom text primary key);
insert into essai_rpc_publiques (nom) select unnest(array[
     'dossier_add','dossier_list','dossier_remove','dossier_set_alertes','dossier_set_statut',
     'drapeau_actif','get_analysis_etape','get_defect_sheet','get_fiabilite','get_kit_signature',
     'get_mon_pass','get_moteur_public','get_partenaires_actifs','get_prix_segments',
     'get_public_analysis','inspecteur_candidater','inspecteur_missions','inspecteur_signer_charte',
     'inspection_zone','list_moteurs_publies','mes_inspections','mon_profil_inspecteur',
     'submit_demande_zone','submit_lead','submit_lead_pro','submit_outcome',
     'submit_pending_analysis','track_event','inspection_accepter','inspection_annuler',
     'inspection_consentement_photos','inspection_constat_absence','inspection_refuser'
]);

select pg_temp.essai_verifie(
  'les 33 fonctions appelees avec la cle anon ou un jeton utilisateur existent',
  (select count(*) from essai_rpc_publiques f
    join pg_proc p on p.proname = f.nom
    join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public') >= 33,
  'trouvees : ' || (select count(distinct p.proname)::text from essai_rpc_publiques f
    join pg_proc p on p.proname = f.nom
    join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public')
  || ' / 33 attendues — manquantes : '
  || coalesce((select string_agg(f.nom, ', ') from essai_rpc_publiques f
      where not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = f.nom)), 'aucune'));

select pg_temp.essai_verifie(
  'ces 33 fonctions sont toutes SECURITY DEFINER',
  (select count(*) from essai_rpc_publiques f
    join pg_proc p on p.proname = f.nom
    join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
    where not p.prosecdef) = 0,
  (select string_agg(distinct p.proname, ', ') from essai_rpc_publiques f
    join pg_proc p on p.proname = f.nom
    join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
    where not p.prosecdef));

-- Révoquer les défauts ne doit RIEN retirer à l'existant : les 33 RPC
-- doivent conserver leur grant, sinon le front casse en silence.
select pg_temp.essai_verifie(
  'les 33 RPC gardent leur grant EXECUTE pour anon ou authenticated',
  (select count(*) from essai_rpc_publiques f
    join pg_proc p on p.proname = f.nom
    join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
    where not (has_function_privilege('anon', p.oid, 'EXECUTE')
            or has_function_privilege('authenticated', p.oid, 'EXECUTE'))) = 0,
  (select string_agg(distinct p.proname, ', ') from essai_rpc_publiques f
    join pg_proc p on p.proname = f.nom
    join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
    where not (has_function_privilege('anon', p.oid, 'EXECUTE')
            or has_function_privilege('authenticated', p.oid, 'EXECUTE'))));

select pg_temp.essai_verifie(
  'toute fonction executable par anon ou authenticated est SECURITY DEFINER',
  (select count(*) from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join (values ('anon'),('authenticated')) as r(nom)
    where n.nspname = 'public' and not p.prosecdef
      and has_function_privilege(r.nom, p.oid, 'EXECUTE')) = 0,
  (select string_agg(distinct p.proname, ', ') from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join (values ('anon'),('authenticated')) as r(nom)
    where n.nspname = 'public' and not p.prosecdef
      and has_function_privilege(r.nom, p.oid, 'EXECUTE')));

-- -----------------------------------------------------------------------
-- 4 quinquies. ESSAI REEL SOUS LE ROLE ANON.
--
-- La preuve qui compte : apres la revocation, une RPC publique repond-elle
-- encore ? On prend le role anon pour de vrai, on appelle deux RPC de lecture,
-- et on rend le role. L'identifiant est capture AVANT le changement de role
-- (anon ne peut plus lire la table) et garde dans une variable, qui survit au
-- changement de role.
--
-- p_track => false : un essai n'incremente pas un compteur de vues et n'ecrit
-- pas d'event.
-- -----------------------------------------------------------------------
do $anon$
declare
  v_id uuid;
  v_res jsonb;
  v_seg jsonb;
  v_erreur text;
  v_lecture_directe boolean := null;
begin
  select id into v_id from public.analyses
   where result_json is not null order by created_at desc limit 1;

  begin
    set local role anon;
    if v_id is not null then
      v_res := public.get_public_analysis(v_id, false);
    end if;
    v_seg := public.get_prix_segments('[{"marque":"peugeot","modele":"308"}]'::jsonb);
    reset role;
  exception when others then
    v_erreur := sqlerrm;
    reset role;
  end;

  perform pg_temp.essai_verifie(
    'sous le role anon, get_public_analysis repond encore',
    v_erreur is null and (v_id is null or (v_res is not null and v_res ? 'id')),
    coalesce(v_erreur, case when v_id is null then 'aucune analyse en base' end));
  perform pg_temp.essai_verifie(
    'sous le role anon, get_prix_segments repond encore',
    v_erreur is null and v_seg is not null and jsonb_typeof(v_seg) = 'array',
    v_erreur);

  -- Contre-epreuve : sous anon, la lecture DIRECTE doit echouer. Si elle
  -- passait, la revocation n'aurait pas pris — et l'assertion precedente
  -- serait vraie pour la mauvaise raison.
  begin
    set local role anon;
    begin
      perform 1 from public.analyses limit 1;
      v_lecture_directe := true;
    exception when insufficient_privilege then
      v_lecture_directe := false;
    end;
    reset role;
  exception when others then
    reset role;
  end;
  perform pg_temp.essai_verifie(
    'sous le role anon, la lecture DIRECTE de analyses est refusee',
    v_lecture_directe is false,
    case when v_lecture_directe then 'la lecture directe a REUSSI : revocation non prise' end);
end
$anon$;

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
