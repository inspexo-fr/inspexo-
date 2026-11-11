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
import { BAREME_VERSION, calculerAxes } from '../supabase/functions/_shared/bareme.ts'
import { estAppelApi } from '../supabase/functions/_shared/apiClients.ts'
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
  // SPRINT 11 — un client d'API ne doit influencer NI le calcul, NI le
  // catalogue, NI la critique. Le drapeau de quota (`isApi`) est admis dans
  // score/index.ts, mais rien qui lise la table des clients ou leur quota.
  { terme: 'la table api_clients', re: /from\s*\(\s*["'`]api_clients|public\.api_clients/i },
  { terme: 'un quota d’API', re: /api_consommer|api_rembourser|quota_mensuel|api_usage/i },
  { terme: 'la table des contacts pro', re: /leads_pro/i },
  // SPRINT 22 — le comparateur et le coût sur 3 ans LISENT des verdicts
  // rendus ; ils ne doivent jamais en produire. Et le prix d'un comparateur
  // de garages (admis pour chiffrer une opération prévue au plan) ne doit
  // jamais atteindre le barème ni la gravité d'une panne.
  { terme: 'le comparateur de dossiers', re: /_shared\/comparateur|recommander\(/ },
  { terme: 'le coût sur 3 ans', re: /_shared\/cout3ans/ },
  { terme: 'le prix d’un comparateur de garages', re: /coutEntretienPrevu|comparateurDeGarages|COMPARATEURS_GARAGES/ },
]

// `score/index.ts` porte LÉGITIMEMENT le drapeau de quota API : il décide
// quel compteur s'applique, jamais ce que vaut le verdict. On l'exclut donc
// des deux motifs qui le viseraient à tort, et on vérifie séparément que ce
// drapeau exige bien les deux facteurs.
const TOLERE_DANS_SCORE = new Set(['le mot partenaire'])

for (const fichier of CHEMIN_NOTATION) {
  let source
  try {
    source = readFileSync(new URL(`../${fichier}`, import.meta.url), 'utf8')
  } catch (_) {
    ok(false, `${fichier} : fichier introuvable — la liste du test est périmée`)
    continue
  }
  const trouves = INTERDITS
    .filter((i) => i.re.test(source))
    .map((i) => i.terme)
    .filter((t) => !(fichier.endsWith('score/index.ts') && TOLERE_DANS_SCORE.has(t)))
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

// ---------------------------------------------------------------------------
titre('3. Le drapeau de quota API n’ouvre pas le service gratuit')
// Il décide QUEL COMPTEUR s'applique, jamais ce que vaut le verdict. Et il
// exige les deux facteurs : sans la clé de service role, un appelant qui
// ajoute l'en-tête depuis son navigateur reste plafonné à 5 analyses par
// 24 heures et passe par le captcha.
{
  const h = (o) => ({
    get: (n) => {
      const k = Object.keys(o).find(x => x.toLowerCase() === String(n).toLowerCase())
      return k ? o[k] : null
    },
  })
  const SRK = 'cle-de-service-role'
  ok(!estAppelApi(h({ 'x-api-client': 'c1' }), SRK),
    'en-tête seul : l’appel reste PUBLIC (plafond 5/24 h + captcha)')
  ok(!estAppelApi(h({ 'x-api-client': 'c1', authorization: 'Bearer cle-anon-publique' }), SRK),
    'en-tête + clé anon publique : l’appel reste PUBLIC')
  ok(estAppelApi(h({ 'x-api-client': 'c1', authorization: `Bearer ${SRK}` }), SRK),
    'les deux facteurs : appel API reconnu')

  const src = readFileSync(new URL('../supabase/functions/score/index.ts', import.meta.url), 'utf8')
  ok(/estAppelApi\(req\.headers,\s*SUPABASE_SERVICE_ROLE_KEY\)/.test(src),
    'score délègue la décision au prédicat testé, sans la réécrire sur place')
  // L'en-tête ne doit jamais être lu SANS que le drapeau ait déjà tranché :
  // toute ligne qui le mentionne doit aussi mentionner `isApi`.
  const lignesEntete = src.split('\n').filter((l) => l.includes('x-api-client'))
  ok(lignesEntete.length > 0 && lignesEntete.every((l) => /\bisApi\b/.test(l)),
    'l’en-tête n’est jamais lu hors du drapeau à deux facteurs',
  )
  ok(/!isEval && !passActif && !isApi/.test(src),
    'le drapeau n’agit que sur le plafond, à l’endroit du rate limit')
  // Le drapeau ne doit servir qu'à des usages ÉNUMÉRÉS. Un simple plafond
  // sur le nombre de lignes ne dirait rien : ce qui compte est à quoi elles
  // servent. Toute nouvelle utilisation hors de cette liste fait échouer le
  // test, et oblige à décider si elle est légitime.
  const USAGES_ADMIS = [
    { quoi: 'définition du drapeau', re: /const isApi = estAppelApi/ },
    { quoi: 'identifiant du client à débiter', re: /const apiClientId = isApi/ },
    { quoi: 'partage des prix (défaut : exclu)', re: /const partagerPrix = !isApi/ },
    { quoi: 'omission de l’empreinte d’IP', re: /ip_hash: isEval \|\| isApi \? null/ },
    { quoi: 'trace de provenance dans un event', re: /\.\.\.\(isApi \? \{ via: "api"/ },
    { quoi: 'porte du plafond de débit', re: /!isEval && !passActif && !isApi/ },
    { quoi: 'colonne de provenance de l’analyse', re: /^\s*via_api: isApi,$/ },
  ]
  const lignesIsApi = src.split('\n').filter((l) => /\bisApi\b/.test(l))
  const inconnues = lignesIsApi.filter((l) => !USAGES_ADMIS.some((u) => u.re.test(l)))
  ok(lignesIsApi.length > 0 && inconnues.length === 0,
    `les ${lignesIsApi.length} usages du drapeau sont tous énumérés${
      inconnues.length ? ` — inconnu : ${inconnues[0].trim().slice(0, 70)}` : ''}`)
  ok(!lignesIsApi.some((l) => /\bscore\b|verdict|axes|bareme|panne|gravite|catalogue|critique/i.test(l)),
    'aucune ligne portant le drapeau ne touche au score, au verdict ni aux pannes')
  // Et le contraire : score ne lit jamais le contrat du client.
  ok(!/prix_partages/.test(src),
    'score ne lit pas le contrat du client : il reçoit un booléen, c’est api-analyses qui lit')

  // ── SPRINT 15 — le drapeau ADMIN, même traitement ────────────────────────
  // Le compte admin échappe au plafond de 5 analyses / 24 h pour constituer
  // le jeu de test de /fiabilite. Un drapeau de plus sur le chemin de la
  // notation, c'est une occasion de plus de se tromper : il est énuméré comme
  // `isApi`, et pour la même raison.
  ok(/const adminIllimite = await estAdminUserId\(admin, appelantId\)/.test(src),
    'le rôle admin est lu EN BASE, pas déduit d’un email ni d’un en-tête')
  ok(!/ADMIN_EMAILS|email\s*===\s*["'][^"']*@/.test(src),
    'aucune liste d’emails admin codée en dur dans score')
  const USAGES_ADMIN = [
    { quoi: 'définition du drapeau', re: /const adminIllimite = await estAdminUserId/ },
    { quoi: 'trace dans les events', re: /\.\.\.\(adminIllimite \? \{ admin: true \}/ },
    { quoi: 'porte du plafond de débit', re: /!isEval && !passActif && !isApi && !adminIllimite/ },
  ]
  const lignesAdmin = src.split('\n').filter((l) => /\badminIllimite\b/.test(l))
  const inconnuesAdmin = lignesAdmin.filter((l) => !USAGES_ADMIN.some((u) => u.re.test(l)))
  ok(lignesAdmin.length > 0 && inconnuesAdmin.length === 0,
    `les ${lignesAdmin.length} usages du drapeau admin sont tous énumérés${
      inconnuesAdmin.length ? ` — inconnu : ${inconnuesAdmin[0].trim().slice(0, 70)}` : ''}`)
  ok(!lignesAdmin.some((l) => /\bscore\b|verdict|axes|bareme|panne|gravite|catalogue|critique/i.test(l)),
    'aucune ligne portant le drapeau admin ne touche au score, au verdict ni aux pannes')
  // Le captcha reste DANS la porte : un admin ne le voit pas non plus, mais
  // personne d'autre ne peut y échapper par ce chemin.
  ok(src.indexOf('captcha_required') > src.indexOf('!isApi && !adminIllimite'),
    'le captcha reste à l’intérieur de la porte du plafond')
}

titre('3 bis. Sprint 22 — les contre-épreuves mordent')
for (const [quoi, extrait] of [
  ['un import du comparateur', 'import { recommander } from "../_shared/comparateur.ts"'],
  ['un import du coût sur 3 ans', 'import { coutTroisAns } from "../_shared/cout3ans.ts"'],
  ['un prix de comparateur', 'if (coutEntretienPrevu(urls).admis) gravite = "casse"'],
]) {
  ok(INTERDITS.some((i) => i.re.test(extrait)), `le contrôle détecte ${quoi}`)
}

titre('4. Version du barème')
ok(/^\d+\.\d+$/.test(BAREME_VERSION), `BAREME_VERSION est une version lisible (${BAREME_VERSION})`)

titre('5. Prises en charge : affichage seulement (sprint 23 f, décision du 11 nov. 2026)')
{
  const PEC = /prises_en_charge|prisesEnCharge|prisesAffichables|PriseEnCharge/
  // Aucun fichier du chemin de notation ne les lit — sauf `score` (qui les
  // RECOPIE dans le résultat affiché) et `defectSheets` (qui les transporte
  // avec la fiche, sans jamais les mêler aux pannes).
  for (const f of CHEMIN_NOTATION.filter((x) => !/score\/index\.ts$|defectSheets\.ts$/.test(x))) {
    ok(!PEC.test(readFileSync(f, 'utf8')), `${f} ne lit pas les prises en charge`)
  }
  // Dans score : exactement l'import et la ligne du résultat affiché.
  const lignesCode = (src) => src.split('\n').filter((l) => PEC.test(l) && !/^\s*\/\//.test(l))
  const autorisee = (l) => /^import \{ prisesAffichables \} from "\.\.\/_shared\/prisesEnCharge\.ts";$/.test(l.trim()) ||
    /^prises_en_charge: prisesAffichables\(sheet\?\.prises_en_charge \?\? \[\], v\.annee_modele \?\? null\),$/.test(l.trim())
  const verifierScore = (src) => { const l = lignesCode(src); return l.length === 2 && l.every(autorisee) }
  ok(verifierScore(readFileSync('supabase/functions/score/index.ts', 'utf8')), 'score : seulement l’import et la ligne du résultat affiché')
  // Contre-épreuve : une lecture par la note serait détectée.
  ok(!verifierScore(readFileSync('supabase/functions/score/index.ts', 'utf8') + '\n    faits.prises = prisesAffichables(sheet.prises_en_charge, null);'),
    'le contrôle MORD : une lecture des prises en charge par les faits est détectée')
  // defectSheets : les prises ne touchent jamais les pannes.
  const ds = readFileSync('supabase/functions/_shared/defectSheets.ts', 'utf8')
  ok(lignesCode(ds).every((l) => !/pannes|gravite|fusionnees/.test(l) || /return \{ \.\.\.base, pannes: fusionnees, prises_en_charge: prises \}/.test(l)),
    'defectSheets : les prises en charge ne sont jamais mêlées aux pannes')
  // Le module est pur : aucun import, donc rien du barème.
  ok(!/^import /m.test(readFileSync('supabase/functions/_shared/prisesEnCharge.ts', 'utf8')), 'prisesEnCharge.ts est pur (aucun import)')
  // Et le barème rend le même score, qu'une fiche ait ou non des prises en charge.
  const faits = { statut_vendeur: 'particulier', annee: 2018, annee_courante: 2026, kilometrage: 90000, prix_affiche: 12000,
    pannes: [{ gravite: 'majeure', rappel_officiel: false, couverte_garantie: false, rappel_confirme_effectue: false }],
    incoherences: 0, signaux_entretien: 1, entretien_renseigne: true, operations_critiques_non_faites: 0, contradictions_entretien: 0,
    famille_identifiee: true, catalogue_vide: false, comparables_count: 0, fourchette: null, fourchette_n: 0, fourchette_decalage_km: 0,
    juridique_grave: false, fraude_suspectee: false, compteur_contredit: false, rappel_stop_drive: false, condition_garantie: null }
  ok(calculerAxes(faits).score === calculerAxes({ ...faits, prises_en_charge: [{ type: 'garantie', texte: 'Extension 10 ans', pays: ['FR'] }] }).score,
    'barème : même score avec ou sans prises en charge dans les faits')
}

console.log(`\n${ko === 0 ? 'OK' : 'ÉCHEC'} — ${total - ko}/${total} contrôles passés`)
process.exit(ko === 0 ? 0 : 1)
