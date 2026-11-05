// Test hors ligne des PRIX PAYÉS déclarés (aucun appel, aucune base).
// Usage : node tests/prix-payes.test.mjs
//
// ⚠️ CE QUE CE TEST PROTÈGE, et c'est tout l'enjeu du sprint 21 :
//  1. les prix PAYÉS et les prix DEMANDÉS ne se mélangent JAMAIS — ni dans un
//     calcul, ni dans un affichage, ni dans le barème ;
//  2. rien n'est publié sous six déclarations ;
//  3. une déclaration à moins de 50 % ou plus de 150 % du prix de l'annonce
//     est écartée, et une annonce sans prix l'est aussi ;
//  4. le contrôle SQL et le contrôle TS disent la MÊME chose.
import { readFileSync } from 'node:fs'
import {
  BORNE_BASSE, BORNE_HAUTE, declarationAcceptable, fourchettePayes, SEUIL_PRIX_PAYES,
} from '../supabase/functions/_shared/prixPayes.ts'

const lire = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const MIGRATION = lire('../supabase/migrations/20261123120000_sprint21_prix_payes.sql')
const SCORE = lire('../supabase/functions/score/index.ts')
const BAREME = lire('../supabase/functions/_shared/bareme.ts')
const NEGOCIATION = lire('../supabase/functions/_shared/negociation.ts')
const MARCHE = lire('../supabase/functions/_shared/marche.ts')
const PAGE = lire('../src/pages/ResultPage.jsx')

let ko = 0
let total = 0
const ok = (cond, label, detail = '') => {
  total++
  if (!cond) { ko++; console.log(`FAIL — ${label}${detail ? ` (${detail})` : ''}`) }
}
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), label, `obtenu ${JSON.stringify(a)}, attendu ${JSON.stringify(b)}`)
const titre = (t) => console.log(`\n▶ ${t}`)

// ---------------------------------------------------------------------------
titre('Contrôle de cohérence : 50 % à 150 % du prix de l’annonce')
eq(BORNE_BASSE, 0.5, 'borne basse à 50 %')
eq(BORNE_HAUTE, 1.5, 'borne haute à 150 %')
ok(declarationAcceptable(5000, 10000), 'exactement 50 % : accepté (borne incluse)')
ok(declarationAcceptable(15000, 10000), 'exactement 150 % : accepté (borne incluse)')
ok(!declarationAcceptable(4999, 10000), 'un euro sous 50 % : écarté')
ok(!declarationAcceptable(15001, 10000), 'un euro au-dessus de 150 % : écarté')
ok(declarationAcceptable(9000, 10000), 'une négociation de 10 % : acceptée')
ok(declarationAcceptable(10500, 10000), 'un prix payé au-dessus de l’annonce : accepté (frais, options)')
// Les fautes de saisie que le contrôle doit attraper.
ok(!declarationAcceptable(900, 10000), 'un zéro manquant : écarté')
ok(!declarationAcceptable(100000, 10000), 'un zéro de trop : écarté')
ok(!declarationAcceptable(250, 10000), 'une mensualité de crédit prise pour un prix : écartée')
// ⚠️ PRIX DE L'ANNONCE INCONNU : écarté aussi. Le contrôle est DÉFINI par
// rapport à ce prix ; sans lui il n'y a pas de contrôle.
ok(!declarationAcceptable(9000, null), 'prix d’annonce inconnu : écarté')
ok(!declarationAcceptable(9000, 0), 'prix d’annonce à zéro : écarté')
ok(!declarationAcceptable(null, 10000), 'aucun prix payé : écarté')
ok(!declarationAcceptable(-500, 10000), 'un prix négatif : écarté')

titre('⚠️ Le contrôle SQL dit la MÊME chose que le contrôle TS')
// Le versement se fait en SQL : c'est LUI qui fait foi. S'ils divergeaient, le
// test TS validerait une règle que la base n'applique pas.
ok(/p_prix_paye >= \(p_prix_annonce \* 0\.5\)/.test(MIGRATION), 'SQL : borne basse à 0.5')
ok(/p_prix_paye <= \(p_prix_annonce \* 1\.5\)/.test(MIGRATION), 'SQL : borne haute à 1.5')
ok(/p_prix_annonce is not null/.test(MIGRATION), 'SQL : prix d’annonce inconnu écarté')
ok(/select 6 \$\$/.test(MIGRATION) || /select 6\s*\$\$/.test(MIGRATION), 'SQL : seuil à 6')
eq(SEUIL_PRIX_PAYES, 6, 'TS : seuil à 6')

titre('Rien n’est publié sous six déclarations')
eq(fourchettePayes({ prix_histo: { 9000: 2, 9250: 3 }, effectif: 5 }), null, '5 déclarations : rien')
ok(fourchettePayes({ prix_histo: { 9000: 3, 9250: 3 }, effectif: 6 }) !== null, '6 déclarations : publié')
eq(fourchettePayes(null), null, 'aucune ligne : rien')
eq(fourchettePayes({ prix_histo: {}, effectif: 0 }), null, 'histogramme vide : rien')
// ⚠️ L'EFFECTIF QUI COMPTE EST CELUI DE L'HISTOGRAMME, pas la colonne. Si les
// deux divergeaient, la colonne pourrait annoncer six ventes sur trois.
eq(fourchettePayes({ prix_histo: { 9000: 3 }, effectif: 99 }), null,
  'une colonne qui annonce 99 sur un histogramme de 3 : rien n’est publié')
{
  const f = fourchettePayes({ prix_histo: { 8750: 1, 9000: 2, 9250: 2, 9500: 1 }, annee_histo: { 2014: 2, 2017: 4 }, effectif: 6 })
  eq(f.n, 6, 'l’effectif publié est celui de l’histogramme')
  ok(f.p25 <= f.mediane && f.mediane <= f.p75, 'quantiles ordonnés')
  eq([f.annee_min, f.annee_max], [2014, 2017], 'la plage d’années est donnée comme contexte')
  ok(/payés déclarés/i.test(f.libelle), 'le libellé dit « payés déclarés »')
  ok(/non vérifiées/i.test(f.libelle), 'et rappelle que ce sont des déclarations non vérifiées')
  ok(/distinctes des prix demandés/i.test(f.libelle), 'et qu’elles sont distinctes des prix demandés')
}
{
  // Des années absurdes ne polluent pas la plage affichée.
  const f = fourchettePayes({ prix_histo: { 9000: 6 }, annee_histo: { 1800: 1, 2017: 5, inconnue: 2 }, effectif: 6 })
  eq([f.annee_min, f.annee_max], [2017, 2017], 'une année absurde et « inconnue » sont ignorées')
}

titre('⚠️ JAMAIS MÉLANGÉS — vérifié sur le code, pas sur l’intention')
// a) Le barème ne reçoit rien des prix payés.
ok(!/payes|paye/i.test(BAREME.match(/export type FaitsAxes = \{[\s\S]*?\n\};/)?.[0] ?? ''),
  'FaitsAxes ne porte aucun champ de prix payé')
ok(!/prixPayes|marche_payes|prixPaye/.test(BAREME), 'le barème ne mentionne jamais les prix payés')
// b) La négociation non plus : un écart au prix médian se discute sur des
//    annonces en ligne que le vendeur peut relire, pas sur des déclarations.
ok(!/prixPayes|marche_payes/.test(NEGOCIATION), 'la négociation ne mentionne jamais les prix payés')
// c) Le module des prix DEMANDÉS ne lit pas la table des prix payés.
ok(!/marche_payes/.test(MARCHE), '_shared/marche.ts ne connaît pas marche_payes')
// d) Dans `score`, la lecture des prix payés ne nourrit ni le barème ni la marge.
{
  const lignes = SCORE.split('\n')
  const fautives = lignes.filter((l) => /prixPayes/.test(l) && /faitsBareme|negEntrees|calculerAxes|calculerNegociation|fourchette\s*=|prixBruts/.test(l))
  ok(fautives.length === 0, '⚠️ aucune ligne ne verse les prix payés dans le barème ou la marge',
    fautives.join(' | ').slice(0, 160))
  // Et la clé exposée est DISTINCTE de `fourchette`.
  ok(/payes: prixPayes/.test(SCORE), 'les prix payés sont exposés sous leur propre clé `payes`')
  ok(!/fourchette:\s*prixPayes/.test(SCORE), 'ils ne sont jamais exposés sous `fourchette`')
}
// e) ⚠️ CONTRE-ÉPREUVE : les contrôles ci-dessus seraient vrais pour la
//    mauvaise raison si `prixPayes` n'existait pas dans `score`.
ok(/fourchettePayes\(/.test(SCORE), 'le test mord : score lit bien le relevé des prix payés')
ok(/from\("marche_payes"\)/.test(SCORE), 'et il lit bien la table séparée')

titre('L’écran les affiche à part')
ok(/Prix payés déclarés/.test(PAGE), 'l’écran porte le libellé « Prix payés déclarés »')
ok(/vente\{r\.prix\.payes\.n > 1 \? 's' : ''\}/.test(PAGE), 'et le nombre de VENTES, pas d’annonces')
ok(/borderTop/.test(PAGE.slice(PAGE.indexOf('Prix payés déclarés') - 600, PAGE.indexOf('Prix payés déclarés'))),
  'le bloc est séparé par un filet')
ok(/jamais additionnés/.test(PAGE), 'l’écran dit que les deux relevés ne sont jamais additionnés')
ok(/ne pèse pas sur le verdict/.test(PAGE), 'et qu’il ne pèse pas sur le verdict')

titre('⚠️ Aucune moyenne, nulle part')
// Règle du sprint 19.1 : le stockage doit INTERDIRE la moyenne, pas se
// contenter de ne pas l'afficher.
ok(!/_somme|_moyenne|avg\(/i.test(MIGRATION.split('-- 6. Contrôle')[0]),
  'la migration ne crée aucune colonne de somme ni de moyenne, et n’emploie pas avg()')
ok(/_fusionner_histogrammes/.test(MIGRATION),
  'les histogrammes sont fusionnés par la fonction partagée du sprint 19.1')
ok(/quantileHisto/.test(lire('../supabase/functions/_shared/prixPayes.ts')),
  'les quantiles passent par l’unique implémentation du projet')

titre('⚠️ Une analyse d’éval n’entre jamais dans le relevé')
ok(/coalesce\(a\.is_eval, false\) = false/.test(MIGRATION),
  'le versement exclut les analyses d’éval')
ok(/prix_paye_ecarte/.test(MIGRATION),
  'une déclaration écartée est TRACÉE, jamais effacée en silence')

console.log(`\n${ko === 0 ? 'OK' : 'ÉCHEC'} — ${total - ko}/${total} contrôles passés`)
process.exit(ko === 0 ? 0 : 1)
