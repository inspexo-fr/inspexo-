// Test hors ligne de la déduplication des défauts du catalogue.
// Cas réels rencontrés le 28/10/2026 :
//  - À FUSIONNER : les deux descriptions de la courroie en bain d'huile du
//    1.2 PureTech (atlas « majeure » / fiche « sécurité ») — tant qu'elles
//    coexistaient, le verdict de la 308 valait 48 ou 55 selon le tirage.
//  - À NE PAS FUSIONNER : « fuite de carburant » et « fuite de liquide de
//    refroidissement » sur l'Audi EA824 — deux défauts distincts qu'une règle
//    trop large confondait (mots communs « fuite » et « durite »).
// Usage : node tests/dedup-pannes.test.mjs
import {
  dedupliquerCatalogue,
  memeDefaut,
  motsSpecifiques,
  plusGrave,
} from '../supabase/functions/_shared/dedupPannes.ts'

let ko = 0
const verifie = (titre, ok, detail = '') => {
  if (!ok) ko++
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${titre}${ok || !detail ? '' : ` (${detail})`}`)
}

/* ---------- 1. Même défaut : doit fusionner ---------- */

verifie(
  'CAS 308 — les deux descriptions de la courroie en bain d\'huile sont le même défaut',
  memeDefaut(
    'Courroie de distribution 1.2 PureTech dans le bain d\'huile',
    'Courroie de distribution en bain d\'huile (wet belt) qui se désagrège',
  ),
)
verifie(
  'même défaut malgré une formulation différente (turbo + crépine)',
  memeDefaut(
    'Défaillance des turbocompresseurs par colmatage de la crépine d\'huile',
    'Colmatage de la crépine alimentant les turbocompresseurs',
  ),
)

/* ---------- 2. Défauts distincts : ne doivent JAMAIS fusionner ---------- */

verifie(
  'CAS S7 — « fuite de carburant » ≠ « fuite de liquide de refroidissement »',
  !memeDefaut(
    'Fuite de carburant par durite défectueuse',
    'Fuite de liquide de refroidissement sur la durite du turbo droit',
  ),
)
verifie(
  'CAS S7 — « défaillance des turbos » ≠ « défaillance du séparateur d\'huile »',
  !memeDefaut(
    'Défaillance des turbocompresseurs par colmatage de la crépine d\'huile',
    'Défaillance du séparateur d\'huile / PCV',
  ),
)
verifie(
  '« usure prématurée des bougies » ≠ « usure prématurée de l\'embrayage »',
  !memeDefaut(
    'Usure prématurée des bougies d\'allumage',
    'Usure prématurée de l\'embrayage',
  ),
)
verifie(
  '« surconsommation d\'huile » ≠ « fuite d\'huile par le joint de cache-culbuteurs »',
  !memeDefaut(
    'Surconsommation d\'huile moteur',
    'Fuite d\'huile par le joint de cache-culbuteurs',
  ),
)
verifie(
  'deux pannes sans rapport ne fusionnent pas',
  !memeDefaut('BSI capricieux — bugs électroniques', 'Vanne EGR encrassée'),
)

/* ---------- 3. Mots génériques ignorés ---------- */

verifie(
  'les mots génériques sortent de la signature',
  !motsSpecifiques('Fuite d\'huile moteur par durite défectueuse').has('fuite') &&
    !motsSpecifiques('Fuite d\'huile moteur par durite défectueuse').has('huile') &&
    !motsSpecifiques('Fuite d\'huile moteur par durite défectueuse').has('durite'),
)
verifie(
  'les organes restent dans la signature',
  motsSpecifiques('Courroie de distribution et pompe à eau').has('courroie') &&
    motsSpecifiques('Courroie de distribution et pompe à eau').has('distribution'),
)
verifie(
  'les mots courts sont ignorés (bruit de fond du titre)',
  !motsSpecifiques('Jeu de la vanne EGR').has('jeu') && !motsSpecifiques('Jeu de la vanne EGR').has('egr'),
)

/* ---------- 4. La plus grave gagne ---------- */

verifie(
  'sécurité l\'emporte sur majeure',
  plusGrave({ titre: 'a', gravite: 'majeure' }, { titre: 'b', gravite: 'securite' }).gravite === 'securite',
)
verifie(
  'casse l\'emporte sur mineure',
  plusGrave({ titre: 'a', gravite: 'mineure' }, { titre: 'b', gravite: 'casse' }).gravite === 'casse',
)
verifie(
  'à gravité égale, la première entrée est conservée',
  plusGrave({ titre: 'premier', gravite: 'majeure' }, { titre: 'second', gravite: 'majeure' }).titre === 'premier',
)

/* ---------- 5. Fusion complète d'un catalogue ---------- */

const fusionner = (garde, autre) => ({
  ...garde,
  cout_min_eur: garde.cout_min_eur ?? autre.cout_min_eur,
  km_typique: garde.km_typique ?? autre.km_typique,
  rappel_code: garde.rappel_code ?? autre.rappel_code,
})

const catalogue = [
  { titre: 'Courroie de distribution 1.2 PureTech dans le bain d\'huile', gravite: 'majeure', cout_min_eur: 1200, km_typique: null, rappel_code: null },
  { titre: 'Fuite de carburant par durite défectueuse', gravite: 'securite', cout_min_eur: null, km_typique: null, rappel_code: null },
  { titre: 'Courroie de distribution en bain d\'huile (wet belt) qui se désagrège', gravite: 'securite', cout_min_eur: null, km_typique: 100000, rappel_code: 'KGH' },
  { titre: 'Fuite de liquide de refroidissement sur la durite du turbo droit', gravite: 'majeure', cout_min_eur: 400, km_typique: null, rappel_code: null },
]
const { gardees, fusions } = dedupliquerCatalogue(catalogue, fusionner)

verifie('une seule fusion sur ce catalogue', fusions === 1, `reçu ${fusions}`)
verifie('trois défauts distincts restent', gardees.length === 3, `reçu ${gardees.length}`)

const courroie = gardees.find((e) => /courroie/i.test(e.titre))
verifie('la courroie fusionnée porte la gravité la plus sévère', courroie.gravite === 'securite')
verifie('elle hérite du coût que seule l\'autre entrée portait', courroie.cout_min_eur === 1200)
verifie('elle hérite du seuil kilométrique de la fiche', courroie.km_typique === 100000)
verifie('elle conserve le rappel officiel', courroie.rappel_code === 'KGH')
verifie(
  'les deux fuites distinctes sont toutes les deux conservées',
  gardees.filter((e) => /fuite/i.test(e.titre)).length === 2,
)
verifie(
  'l\'ordre d\'origine est préservé',
  gardees[0].titre.startsWith('Courroie') && gardees[1].titre.startsWith('Fuite de carburant'),
)

/* ---------- 6. Déterminisme ---------- */

const refs = new Set(
  Array.from({ length: 50 }, () =>
    JSON.stringify(dedupliquerCatalogue(catalogue, fusionner).gardees.map((e) => `${e.titre}|${e.gravite}`)),
  ),
)
verifie('50 passages identiques → 1 résultat', refs.size === 1, `${refs.size} résultats`)
verifie('catalogue vide → aucun plantage', dedupliquerCatalogue([], fusionner).gardees.length === 0)

console.log(ko === 0 ? '\n✓ déduplication conforme' : `\n✗ ${ko} test(s) en échec`)
process.exit(ko === 0 ? 0 : 1)
