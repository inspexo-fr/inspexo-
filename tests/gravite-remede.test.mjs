// Test hors ligne du garde-fou « gravité jugée sur le remède ».
// Cas réels relevés le 29/10/2026 en campagne de couverture : des pannes de
// chaîne, de courroie ou de tendeur revenaient classées « casse » parce que
// leur CONSÉQUENCE est une casse moteur — alors que leur remède est le
// remplacement de l'organe.
// Usage : node tests/gravite-remede.test.mjs
import {
  appliquerGraviteRemede,
  casseJustifiee,
  SEUIL_CASSE_EUR,
} from '../supabase/functions/_shared/graviteRemede.ts'

let ko = 0
const verifie = (titre, ok, detail = '') => {
  if (!ok) ko++
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${titre}${ok || !detail ? '' : ` (${detail})`}`)
}

const panne = (titre, gravite = 'casse', max = null, organe = null) =>
  ({ titre, gravite, cout_indicatif_eur_max: max, organe })

/* ---------- 1. Organes remplaçables : « casse » injustifiée ---------- */

const ORGANES = [
  'Casse de la chaîne interne d\'entraînement des arbres à cames',
  'Usure et rupture de la chaîne de distribution arrière',
  'Usure / étirement de la chaîne de distribution',
  'Rupture de guide/chaîne de distribution (moteur à calage interférent)',
  'Tendeur / courroie d\'entraînement de la pompe à huile défaillant',
  'Dégradation de la courroie de distribution immergée dans l\'huile',
  'Crépine d\'huile de turbo bouchée',
  'Défaillance de la pompe à eau',
  'Injecteurs défaillants',
]
for (const t of ORGANES) {
  verifie(`remède = organe, donc pas « casse » — « ${t.slice(0, 52)} »`, casseJustifiee(panne(t)) === false)
}

/* ---------- 2. Le remède EST le moteur ou la boîte : « casse » tenue ---------- */

const MOTEURS = [
  'Surconsommation d\'huile liée à la segmentation des pistons',
  'Casse de piston (détérioration moteur documentée)',
  'Usure/rayures des parois de cylindre',
  'Usure prématurée des cylindres liée à un catalyseur dégradé',
  'Coussinets de bielle fragiles (bas moteur)',
  'Fuite/défaillance de la boîte hybride multimode',
  'Jeu axial du vilebrequin',
]
for (const t of MOTEURS) {
  verifie(`remède = moteur ou boîte, « casse » justifiée — « ${t.slice(0, 48)} »`, casseJustifiee(panne(t)) === true)
}

/* ---------- 3. Le coût sourcé peut justifier « casse » ---------- */

verifie(
  'un turbo chiffré au-delà du seuil reste « casse »',
  casseJustifiee(panne('Défaillance des turbocompresseurs', 'casse', 4000)) === true,
)
verifie(
  'le même turbo sous le seuil ne l\'est plus',
  casseJustifiee(panne('Défaillance des turbocompresseurs', 'casse', 2300)) === false,
)
verifie(
  `le seuil est bien de ${SEUIL_CASSE_EUR} € et il est strict`,
  casseJustifiee(panne('Chaîne de distribution', 'casse', SEUIL_CASSE_EUR)) === false &&
    casseJustifiee(panne('Chaîne de distribution', 'casse', SEUIL_CASSE_EUR + 1)) === true,
)

/* ---------- 4. Un arbitrage humain prime sur l'heuristique ---------- */

verifie(
  'CAS EA824 — une gravité arbitrée à la main n\'est jamais rétrogradée',
  casseJustifiee({
    titre: 'Défaillance des turbocompresseurs par colmatage de la crépine d\'huile',
    gravite: 'casse',
    cout_indicatif_eur_max: null,
    gravite_arbitree: true,
  }) === true,
)
verifie(
  'la même panne sans marque d\'arbitrage redescend',
  casseJustifiee({
    titre: 'Défaillance des turbocompresseurs par colmatage de la crépine d\'huile',
    gravite: 'casse',
    cout_indicatif_eur_max: null,
  }) === false,
)

/* ---------- 5. Ce qui n'est pas identifiable n'est pas touché ---------- */

verifie(
  'un libellé sans organe ni mention moteur garde sa gravité',
  casseJustifiee(panne('Défaillance majeure non documentée')) === true,
)

/* ---------- 5. Application en lot ---------- */

const liste = [
  panne('Casse de la chaîne interne d\'entraînement des arbres à cames', 'casse', 8000),
  panne('Surconsommation d\'huile liée à la segmentation des pistons', 'casse'),
  panne('Crépine d\'huile de turbo bouchée', 'majeure', 2300),
  panne('Pompe haute pression CP4 : contamination du circuit', 'casse', 4500),
]
const { pannes, retrogradees } = appliquerGraviteRemede(liste)

verifie(
  'CAS DV5 — la chaîne chiffrée à 8 000 € reste « casse » : ce montant dépasse le seuil',
  pannes[0].gravite === 'casse',
  'le garde-fou ne sait pas que 8 000 € est la conséquence — c\'est au coût d\'être juste',
)
verifie('la segmentation reste « casse »', pannes[1].gravite === 'casse')
verifie('une panne déjà « majeure » n\'est jamais touchée', pannes[2].gravite === 'majeure')
verifie('la pompe CP4 chiffrée au-dessus du seuil reste « casse »', pannes[3].gravite === 'casse')

const { pannes: p2, retrogradees: r2 } = appliquerGraviteRemede([
  panne('Casse de la chaîne interne d\'entraînement des arbres à cames'), // sans coût
  panne('Usure / étirement de la chaîne de distribution'),
])
verifie('CAS DV5 sans coût — la chaîne redescend en « majeure »', p2[0].gravite === 'majeure')
verifie('CAS B47 — la chaîne redescend en « majeure »', p2[1].gravite === 'majeure')
verifie('les rétrogradations sont listées pour le journal', r2.length === 2, JSON.stringify(r2))

verifie(
  'le garde-fou ne promeut JAMAIS une gravité',
  appliquerGraviteRemede([panne('Chaîne de distribution', 'mineure')])
    .pannes[0].gravite === 'mineure',
)

/* ---------- 6. Déterminisme ---------- */

const refs = new Set(
  Array.from({ length: 50 }, () => JSON.stringify(appliquerGraviteRemede(liste).pannes.map((p) => p.gravite))),
)
verifie('50 passages identiques → 1 résultat', refs.size === 1)
verifie('liste vide → aucun plantage', appliquerGraviteRemede([]).pannes.length === 0)

console.log(ko === 0 ? '\n✓ gravité par le remède conforme' : `\n✗ ${ko} test(s) en échec`)
process.exit(ko === 0 ? 0 : 1)
