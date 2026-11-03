// L'INDÉPENDANCE DU VERDICT — test hors ligne, aucun appel API.
// Usage : node tests/independance-score.test.mjs
//
// Inspexo est payé par l'acheteur, jamais par un vendeur ni par un partenaire.
// Le jour où une mise en relation rapporte de l'argent, la tentation existe de
// laisser le verdict pencher — même involontairement, par une variable qui
// traîne. Ce test rend cette dérive IMPOSSIBLE À COMMETTRE SANS LE VOIR.
//
// Deux garanties, dans l'ordre d'importance :
//
//  1. STATIQUE (la vraie preuve) : aucun fichier du chemin de notation ne
//     mentionne les partenaires, ni la table des mises en relation, ni la
//     route de redirection. Le couplage est donc inexistant, pas seulement
//     inutilisé. Ce contrôle échoue à la première ligne qui l'introduirait.
//
//  2. FONCTIONNELLE : le barème rend exactement le même score, partenaires
//     éteints et partenaires allumés, sur une batterie de profils. Elle
//     documente l'invariant et attrape un état global caché.
import { readFileSync } from 'node:fs'
import { calculerAxes } from '../supabase/functions/_shared/bareme.ts'
import {
  partenairesAffichables, peutActiver, verifierTextePartenaire,
} from '../supabase/functions/_shared/partenaires.ts'

let ko = 0, total = 0
const ok = (cond, label) => { total++; if (!cond) { ko++; console.log(`FAIL — ${label}`) } }
const titre = (t) => console.log(`\n▶ ${t}`)

// ---------------------------------------------------------------------------
titre('1. Aucun couplage dans le code qui produit le verdict')

// Tout ce qui participe au score, au barème ou au verdict affiché.
const CHEMIN_NOTATION = [
  'supabase/functions/score/index.ts',
  'supabase/functions/visite/index.ts',
  'supabase/functions/lecture-ct/index.ts',
  'supabase/functions/_shared/bareme.ts',
  'supabase/functions/_shared/negociation.ts',
  'supabase/functions/_shared/marche.ts',
  'supabase/functions/_shared/dedupPannes.ts',
  'supabase/functions/_shared/entretienDeclare.ts',
  'supabase/functions/_shared/graviteRemede.ts',
  'supabase/functions/_shared/warrantyPrograms.ts',
  'supabase/functions/_shared/defectSheets.ts',
  'supabase/functions/_shared/photo.ts',
  'supabase/functions/_shared/lectureCt.ts',
]

// Motifs choisis pour viser le COUPLAGE RÉEL, pas le vocabulaire. Un
// couplage ne peut passer que par une table, une RPC, un import de module ou
// une route : ce sont ces quatre formes qui sont traquées.
//
// Volontairement ABSENTS de la liste, après vérification sur le code
// existant : « garantie » (le projet désigne ainsi les garanties
// CONSTRUCTEUR, une donnée technique du véhicule), « crédit » (score/index.ts
// parle du crédit d'API Anthropic en cas d'indisponibilité) et « retours »
// (entretienDeclare.ts parle des retours à la ligne). Les inclure produirait
// des alertes fausses, et un test qui crie à tort finit désactivé.
const INTERDITS = [
  { terme: 'le mot partenaire', re: /partenaire/i },
  { terme: 'la table mises_en_relation', re: /mises_en_relation/i },
  { terme: 'la table partenaires', re: /from\s*\(\s*["'`]partenaires|public\.partenaires|["'`]partenaires["'`]/i },
  { terme: 'une RPC partenaire', re: /get_partenaires|enregistrer_mise_en_relation|texte_valide/i },
  { terme: 'la route de redirection /go/', re: /["'`]\/go\/|inspexo\.io\/go/i },
  { terme: 'un import du module partenaires', re: /_shared\/partenaires/i },
  { terme: 'la table des retours d’issue', re: /from\s*\(\s*["'`]retours|public\.retours|retour_token|submit_retour/i },
]

for (const fichier of CHEMIN_NOTATION) {
  let source
  try {
    source = readFileSync(new URL(`../${fichier}`, import.meta.url), 'utf8')
  } catch (_) {
    ok(false, `${fichier} : fichier introuvable — la liste du test est périmée`)
    continue
  }
  const trouves = INTERDITS.filter((i) => i.re.test(source)).map((i) => i.terme)
  ok(trouves.length === 0, `${fichier} ne cite aucun partenaire${
    trouves.length ? ` (trouvé : ${trouves.join(', ')})` : ''}`)
}

// Réciproque : le module des partenaires ne doit rien importer du barème.
{
  const src = readFileSync(new URL('../supabase/functions/_shared/partenaires.ts', import.meta.url), 'utf8')
  ok(!/from\s+["'][^"']*(bareme|negociation|marche|defectSheets)/.test(src),
    'le module partenaires n’importe rien du chemin de notation')
  ok(!/import\s/.test(src),
    'le module partenaires n’importe RIEN du tout : il ne peut pas lire un score')
}

// Le contrôle n'a de valeur que s'il sait détecter une infraction.
for (const [forme, faux] of [
  ['une lecture de table', 'await admin.from("partenaires").select("*")'],
  ['une lecture de la table des mises en relation', 'select * from mises_en_relation'],
  ['un appel de RPC', 'await admin.rpc("get_partenaires_actifs")'],
  ['un import du module', 'import { peutActiver } from "../_shared/partenaires.ts"'],
  ['une route de redirection', 'const lien = "/go/" + slug'],
  ['une mention en prose', '// le partenaire assurance rapporte une commission'],
  ['une lecture des retours d’issue', 'await admin.from("retours").select("id")'],
]) {
  ok(INTERDITS.some((i) => i.re.test(faux)),
    `le contrôle détecte une infraction : ${forme}`)
}

// ---------------------------------------------------------------------------
titre('2. Même score, partenaires éteints et partenaires allumés')

const base = {
  annee_courante: 2026,
  statut_vendeur: 'particulier',
  annee: 2018, kilometrage: 120000, prix_affiche: null,
  fourchette: null, comparables_count: 0,
  entretien_renseigne: false, signaux_entretien: 0,
  contradictions_entretien: 0, operations_critiques_non_faites: 0,
  catalogue_vide: false, pannes: [], incoherences: 0,
}
const panne = (gravite, rappel = false) =>
  ({ gravite, rappel_officiel: rappel, rappel_confirme_effectue: false })

// Des profils qui couvrent les trois verdicts et les cas à plafond.
const PROFILS = [
  ['vert — récent, peu roulé, entretien prouvé',
    { annee: 2023, kilometrage: 28000, entretien_renseigne: true, signaux_entretien: 3 }],
  ['orange — défaut majeur',
    { annee: 2019, kilometrage: 95000, entretien_renseigne: true, signaux_entretien: 2, pannes: [panne('majeure')] }],
  ['rouge — sécurité + rappel',
    { annee: 2015, kilometrage: 159000, incoherences: 2, entretien_renseigne: true,
      signaux_entretien: 2, pannes: [panne('securite', true), panne('majeure')] }],
  ['rouge — compteur contredit',
    { annee: 2017, kilometrage: 90000, compteur_contredit: true, entretien_renseigne: true, signaux_entretien: 1 }],
  ['orange — avec fourchette de prix',
    { annee: 2019, kilometrage: 100000, prix_affiche: 15000, fourchette_n: 42,
      fourchette: { p25: 12250, mediane: 14125, p75: 16125 }, fourchette_decalage_km: -500,
      entretien_renseigne: true, signaux_entretien: 2, pannes: [panne('majeure')] }],
  ['non évalué — annonce muette',
    { annee: null, kilometrage: null, catalogue_vide: true }],
]

/** Rejoue le barème après avoir « allumé » les partenaires : on appelle
 *  réellement le module partenaires entre les deux mesures, pour qu'un état
 *  global caché, s'il existait, ait eu l'occasion de s'installer. */
function scoresAvecPartenaires(actifs) {
  if (actifs) {
    for (let i = 0; i < 50; i++) {
      verifierTextePartenaire('assurance', 'Notre partenaire propose des contrats pour véhicules d’occasion, vous traitez directement avec lui.')
      peutActiver('credit', '2027-01-01')
      partenairesAffichables('vert')
      partenairesAffichables('rouge')
    }
  }
  return PROFILS.map(([, faits]) => {
    const r = calculerAxes({ ...base, ...faits })
    return `${r.verdict}:${r.score}:${r.plafond_raison ?? ''}`
  })
}

const eteints = scoresAvecPartenaires(false)
const allumes = scoresAvecPartenaires(true)
const eteintsBis = scoresAvecPartenaires(false)

PROFILS.forEach(([nom], i) => {
  ok(eteints[i] === allumes[i],
    `${nom} : score identique flags OFF et ON (${eteints[i]} / ${allumes[i]})`)
})
ok(JSON.stringify(eteints) === JSON.stringify(eteintsBis),
  'retour à l’état éteint : scores inchangés (aucune rémanence)')
ok(new Set(eteints.map((s) => s.split(':')[0])).size >= 3,
  'la batterie couvre bien les trois verdicts')

// Le barème ne connaît aucun champ de partenaire : lui en passer un n'a
// strictement aucun effet.
{
  const normal = calculerAxes({ ...base, ...PROFILS[1][1] })
  const pollue = calculerAxes({
    ...base, ...PROFILS[1][1],
    partenaire_assurance_actif: true, partenaire_credit_actif: true,
    commission_partenaire_eur: 9999, mises_en_relation: 42,
  })
  ok(JSON.stringify(normal) === JSON.stringify(pollue),
    'des champs de partenaire injectés dans les faits ne changent rien au verdict')
}

console.log(`\n${ko === 0 ? 'OK' : 'ÉCHEC'} — ${total - ko}/${total} contrôles passés`)
process.exit(ko === 0 ? 0 : 1)
