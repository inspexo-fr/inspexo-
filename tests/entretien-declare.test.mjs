// Test hors ligne du filet déterministe sur les déclarations d'entretien.
// 20 formulations réelles + les pièges qui ne doivent JAMAIS déclencher un
// « non fait » : « distribution faite », « pas de distribution à prévoir »,
// « jamais eu de problème de distribution ».
// Usage : node tests/entretien-declare.test.mjs
import {
  compterCritiquesNonFaites,
  dejaCouvert,
  detecterEntretienDeclare,
  extraitCourt,
  libelleDeclaration,
} from '../supabase/functions/_shared/entretienDeclare.ts'

let ko = 0
const verifie = (titre, ok, detail = '') => {
  if (!ok) ko++
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${titre}${ok || !detail ? '' : ` (${detail})`}`)
}

/** Statut détecté pour une opération donnée, ou null. */
const statut = (texte, operation) =>
  detecterEntretienDeclare(texte).find((f) => f.operation === operation)?.statut ?? null

/* ============ 1. Déclarations de NON-ENTRETIEN (doivent déclencher) ======= */

const NON_FAITS = [
  ['Distribution jamais faite.', 'Distribution'],
  ['distribution d\'origine', 'Distribution'],
  ['La distribution n\'a jamais été changée.', 'Distribution'],
  ['Courroie de distribution jamais remplacée', 'Distribution'],
  ['distribution pas faite', 'Distribution'],
  ['Distibution jamais faite (faute de frappe courante)', 'Distribution'],
  ['kit de distribution non remplacé', 'Distribution'],
  ['jamais changé la distribution', 'Distribution'],
  ['Embrayage d\'origine', 'Embrayage'],
  ['embraillage jamais fait', 'Embrayage'],
]
for (const [texte, operation] of NON_FAITS) {
  verifie(
    `non_fait détecté — « ${texte} »`,
    statut(texte, operation) === 'non_fait',
    `reçu ${statut(texte, operation)}`,
  )
}

/* ============ 2. Déclarations « à prévoir » (doivent déclencher) ========== */

const A_PREVOIR = [
  ['Distribution à prévoir', 'Distribution'],
  ['courroie à changer', 'Courroie d\'accessoires'],
  ['Embrayage à prévoir rapidement', 'Embrayage'],
  ['pneus à changer', 'Pneus'],
  ['CT à refaire', 'Contrôle technique'],
  ['vidange à faire', 'Vidange'],
  ['contrôle technique à repasser', 'Contrôle technique'],
  ['plaquettes à changer prochainement', 'Freins'],
  ['amortisseurs à prévoir', 'Amortisseurs'],
  ['vidange de boîte à faire', 'Vidange de boîte'],
]
for (const [texte, operation] of A_PREVOIR) {
  verifie(
    `a_prevoir détecté — « ${texte} »`,
    statut(texte, operation) === 'a_prevoir',
    `reçu ${statut(texte, operation)}`,
  )
}

/* ============ 3. PIÈGES : ne doivent JAMAIS donner « non_fait » ========== */

verifie(
  'PIÈGE — « distribution faite » n\'est pas un non_fait',
  statut('Distribution faite', 'Distribution') === 'fait',
  `reçu ${statut('Distribution faite', 'Distribution')}`,
)
verifie(
  'PIÈGE — « pas de distribution à prévoir » ne déclenche rien',
  statut('pas de distribution à prévoir', 'Distribution') === null,
  `reçu ${statut('pas de distribution à prévoir', 'Distribution')}`,
)
verifie(
  'PIÈGE — « jamais eu de problème de distribution » ne déclenche pas non_fait',
  statut('jamais eu de problème de distribution', 'Distribution') !== 'non_fait',
  `reçu ${statut('jamais eu de problème de distribution', 'Distribution')}`,
)
verifie(
  'PIÈGE — « aucun souci de distribution » ne déclenche pas non_fait',
  statut('aucun souci de distribution depuis l\'achat', 'Distribution') !== 'non_fait',
)
verifie(
  'PIÈGE — « sans vidange à faire » ne déclenche rien',
  statut('sans vidange à faire avant 2 ans', 'Vidange') === null,
  `reçu ${statut('sans vidange à faire avant 2 ans', 'Vidange')}`,
)
verifie(
  'PIÈGE — « jamais eu de panne, embrayage neuf » : embrayage reste « fait »',
  statut('Jamais eu de panne, embrayage neuf', 'Embrayage') === 'fait',
  `reçu ${statut('Jamais eu de panne, embrayage neuf', 'Embrayage')}`,
)
verifie(
  'PIÈGE — texte vide ou absent : aucun fait',
  detecterEntretienDeclare('').length === 0 &&
    detecterEntretienDeclare(null).length === 0 &&
    detecterEntretienDeclare(undefined).length === 0,
)

/* ============ 4. Déclarations POSITIVES datées (points rassurants) ======= */

verifie(
  'positif — « distribution faite à 95 000 km »',
  statut('Distribution faite à 95 000 km chez Peugeot', 'Distribution') === 'fait',
)
verifie(
  'positif — « vidange de boîte faite le 12/03/2025 »',
  statut('Vidange de boîte faite le 12/03/2025', 'Vidange de boîte') === 'fait',
)
verifie(
  'positif — « pneus avant neufs »',
  statut('Pneus avant neufs', 'Pneus') === 'fait',
)
verifie(
  'positif — « courroie remplacée en 2024 »',
  statut('Courroie remplacée en 2024', 'Courroie d\'accessoires') === 'fait' ||
    statut('Courroie remplacée en 2024', 'Distribution') === 'fait',
)

/* ============ 5. Priorité, dédup et extrait ============================== */

verifie(
  'le statut le plus engageant gagne (non_fait > fait sur la même opération)',
  statut('Distribution faite en 2019. Distribution jamais refaite depuis.', 'Distribution') === 'non_fait',
)
verifie(
  '« courroie de distribution jamais faite » ne produit qu\'un seul fait',
  detecterEntretienDeclare('Courroie de distribution jamais faite').length === 1,
  `reçu ${detecterEntretienDeclare('Courroie de distribution jamais faite').length}`,
)
verifie(
  'extrait limité à 15 mots, avec ellipse',
  extraitCourt('un deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze quinze seize') ===
    'un deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze quinze…',
)
verifie(
  'extrait court laissé intact',
  extraitCourt('Distribution jamais faite') === 'Distribution jamais faite',
)
verifie(
  'le fait porte l\'extrait de l\'annonce, pas une reformulation',
  detecterEntretienDeclare('Pneus avant neufs. Distribution jamais faite.')
    .find((f) => f.operation === 'Distribution')?.extrait === 'Distribution jamais faite',
)

/* ============ 6. Comptage pour le barème ================================= */

const faits308 = detecterEntretienDeclare(
  'Entretien à jour (dernière révision il y a 2 mois), carnet complet, CT OK de moins de 6 mois.\n' +
  'Pneus avant neufs. Distribution jamais faite. GPS, radar de recul, régulateur.',
)
verifie(
  'CAS 308 — la distribution jamais faite est retenue',
  faits308.some((f) => f.operation === 'Distribution' && f.statut === 'non_fait'),
  JSON.stringify(faits308),
)
verifie(
  'CAS 308 — elle compte comme opération critique non faite (plafond 55)',
  compterCritiquesNonFaites(faits308) === 1,
  `reçu ${compterCritiquesNonFaites(faits308)}`,
)
verifie(
  'CAS 308 — les pneus neufs sont un signal positif, pas un manque',
  faits308.some((f) => f.operation === 'Pneus' && f.statut === 'fait'),
)
verifie(
  'une opération non critique à prévoir ne plafonne pas',
  compterCritiquesNonFaites(detecterEntretienDeclare('pneus à changer, CT à refaire')) === 0,
)
verifie(
  'une opération critique « à prévoir » compte aussi (elle n\'est pas faite)',
  compterCritiquesNonFaites(detecterEntretienDeclare('Distribution à prévoir')) === 1,
)

/* ============ 7. Libellés et dédup avec le modèle ======================== */

verifie(
  'libellé d\'affichage explicite',
  libelleDeclaration({ operation: 'Distribution', statut: 'non_fait', extrait: '', critique: true }) ===
    'Distribution — déclarée non faite dans l\'annonce',
)
verifie(
  'un fait déjà dit par le modèle n\'est pas répété',
  dejaCouvert(
    { operation: 'Distribution', statut: 'non_fait', extrait: '', critique: true },
    ['La distribution n\'a jamais été remplacée selon l\'annonce'],
  ) === true,
)
verifie(
  'un fait absent des phrases du modèle est bien ajouté',
  dejaCouvert(
    { operation: 'Embrayage', statut: 'non_fait', extrait: '', critique: true },
    ['La distribution n\'a jamais été remplacée'],
  ) === false,
)

/* ============ 8. Déterminisme ============================================ */

const annonce = 'Distribution jamais faite. Pneus à changer. Vidange faite le 01/02/2026.'
const refs = new Set(
  Array.from({ length: 50 }, () => JSON.stringify(detecterEntretienDeclare(annonce))),
)
verifie('50 appels identiques → 1 résultat', refs.size === 1, `${refs.size} résultats distincts`)

console.log(ko === 0 ? '\n✓ filet entretien conforme' : `\n✗ ${ko} test(s) en échec`)
process.exit(ko === 0 ? 0 : 1)
