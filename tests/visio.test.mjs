// Test HORS LIGNE des règles de la visio guidée. Aucun appel réseau.
// Usage : node tests/visio.test.mjs
import {
  OUVERTURE_APRES_MINUTES, OUVERTURE_AVANT_MINUTES, compteRenduConforme,
  fenetreVisio, pointsNonVerifiables, suiteConseillee,
} from '../supabase/functions/_shared/visio.ts'

let ko = 0
let total = 0
const ok = (cond, label, detail = '') => {
  total++
  if (!cond) { ko++; console.log(`FAIL — ${label}${detail ? ` (${detail})` : ''}`) }
}
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), label,
  `obtenu ${JSON.stringify(a)}, attendu ${JSON.stringify(b)}`)
const titre = (t) => console.log(`\n▶ ${t}`)

// ---------------------------------------------------------------------------
titre('Fenêtre du lien vidéo : le lien seul n’est pas un droit d’entrée')
// ---------------------------------------------------------------------------
const C = new Date('2026-11-20T14:00:00Z')
const a = (min) => fenetreVisio(C, new Date(C.getTime() + min * 60_000))
eq(OUVERTURE_AVANT_MINUTES, 15, 'ouverture 15 minutes avant')
eq(OUVERTURE_APRES_MINUTES, 90, 'fermeture 90 minutes après')
ok(!a(-60).ouverte && a(-60).raison === 'trop_tot', 'une heure avant : fermé')
eq(a(-60).minutes_restantes, 45, 'et il reste 45 minutes avant ouverture')
ok(a(-15).ouverte, 'quinze minutes avant : ouvert')
ok(a(0).ouverte, 'à l’heure : ouvert')
ok(a(89).ouverte, 'à 89 minutes : encore ouvert')
ok(!a(91).ouverte && a(91).raison === 'trop_tard', 'à 91 minutes : fermé')
ok(!fenetreVisio(null, new Date()).ouverte, 'créneau inconnu : fermé — on n’ouvre pas sur une donnée absente')

// ---------------------------------------------------------------------------
titre('Points non vérifiables à distance, déduits de la checklist')
// ---------------------------------------------------------------------------
// La liste n'est pas rédigée à la main : elle vient de la checklist du
// véhicule, la même que celle du mode visite.
{
  const checklist = [
    { quoi: 'Démarrage à froid', comment: 'moteur froid depuis 6 h', signal_rouge: 'fumée bleue' },
    { quoi: 'État des pneus', comment: 'témoins d’usure', signal_rouge: 'usure irrégulière' },
    { quoi: 'Corrosion du châssis', comment: 'passer sous la voiture', signal_rouge: 'tôle percée' },
    { quoi: 'Essai routier', comment: 'rouler 10 minutes', signal_rouge: 'vibrations à 110 km/h' },
    { quoi: 'Codes défaut', comment: 'valise de diagnostic branchée', signal_rouge: 'défauts mémorisés' },
    { quoi: 'Intérieur', comment: 'usure des sièges', signal_rouge: 'odeur d’humidité' },
  ]
  const nv = pointsNonVerifiables(checklist)
  eq(nv.map((p) => p.famille).sort(),
    ['demontage', 'essai_routier', 'sous_le_vehicule'],
    'les trois familles sont reconnues')
  eq(nv.length, 3, 'trois points sur six sont hors de portée')
  ok(nv.every((p) => p.raison.length > 10), 'chacun porte sa raison, lisible')
  // Et ce qui SE vérifie en visio n'est pas écarté : l'acheteur est devant la
  // voiture, c'est lui qui agit.
  const noms = nv.map((p) => p.quoi)
  ok(!noms.includes('Démarrage à froid'), 'le démarrage à froid se fait très bien en visio')
  ok(!noms.includes('État des pneus'), 'les pneus se montrent à la caméra')
  ok(!noms.includes('Intérieur'), 'l’intérieur se montre à la caméra')
}
eq(pointsNonVerifiables([]), [], 'checklist vide → aucun point')
eq(pointsNonVerifiables(null), [], 'checklist absente → aucun point, pas d’erreur')
eq(pointsNonVerifiables([{ quoi: '   ' }]), [], 'point vide ignoré')

// ---------------------------------------------------------------------------
titre('Suite conseillée : jamais une valeur, jamais « expertise »')
// ---------------------------------------------------------------------------
{
  const sousPont = [{ quoi: 'Châssis', famille: 'sous_le_vehicule', raison: 'pont' }]
  const diag = [{ quoi: 'Codes', famille: 'demontage', raison: 'valise' }]

  const rouge = suiteConseillee(sousPont, 2)
  ok(/chiffrer par un garage/.test(rouge), 'signaux rouges → faire chiffrer')
  const pont = suiteConseillee(sousPont, 0)
  ok(/inspection sur place/.test(pont), 'points sous le véhicule → inspection sur place conseillée')
  const outil = suiteConseillee(diag, 0)
  ok(/garage peut les reprendre/.test(outil), 'points de diagnostic → passage au garage')
  const rien = suiteConseillee([], 0)
  ok(/en entier/.test(rien), 'checklist entièrement parcourue → c’est dit')

  // Aucune des quatre formulations ne doit contenir un mot interdit.
  for (const [nom, t] of [['rouge', rouge], ['pont', pont], ['outil', outil], ['rien', rien]]) {
    const c = compteRenduConforme(t)
    ok(c.ok, `la suite « ${nom} » ne contient aucun mot interdit`, c.trouves.join(', '))
  }
}

// ---------------------------------------------------------------------------
titre('Le contrôle de vocabulaire MORD')
// ---------------------------------------------------------------------------
// Sans cette contre-épreuve, les assertions ci-dessus seraient vraies le jour
// où la liste de mots deviendrait vide.
for (const [t, attendu] of [
  ['Une expertise complète du véhicule', 'expertise'],
  ['La valeur du véhicule est de 9 000 €', 'valeur du véhicule'],
  ['Selon la cote actuelle', 'cote'],
  ['Notre expert automobile a vu', 'expert automobile'],
  ['estimation de valeur à confirmer', 'estimation de valeur'],
]) {
  const c = compteRenduConforme(t)
  ok(!c.ok && c.trouves.includes(attendu), `« ${attendu} » est refusé`, c.trouves.join(','))
}
ok(compteRenduConforme('Le compteur affiche 78 500 km, les pneus avant sont neufs.').ok,
  'un compte rendu factuel passe')
// Les accents ne doivent pas servir de contournement.
ok(!compteRenduConforme('une EXPERTISE du vehicule').ok, 'casse ignorée')

console.log(`\n${ko === 0 ? 'OK' : 'ÉCHEC'} — ${total - ko}/${total} contrôles passés`)
if (ko > 0) process.exit(1)
