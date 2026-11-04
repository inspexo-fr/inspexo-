// SPRINT 9 — Copie CLIENT de la partie « lecture » du relevé de prix.
//
// Pourquoi une copie : la source de vérité est
// `supabase/functions/_shared/marche.ts`, hors du périmètre de build de CRA
// (ModuleScopePlugin interdit d'importer en dehors de src/). Même dispositif
// que `src/data/charte.js` pour la charte d'indépendance.
//
// GARDE-FOU : `tests/marche.test.mjs` rejoue des centaines d'histogrammes
// tirés au hasard dans LES DEUX implémentations et exige des résultats
// identiques. Une divergence fait échouer `npm run eval`. Ne modifier ce
// fichier qu'en miroir du module serveur.

export const TRANCHE_PRIX = 250
export const TRANCHE_KM = 20_000
export const KM_INCONNU = -1
export const ANNEE_INCONNUE = 0
export const PRIX_MIN = 200
export const PRIX_MAX = 1_000_000
/** Seuil de publication d'une fourchette : en dessous, « non évalué ». */
export const SEUIL_FOURCHETTE = 15

export const LIBELLES_REGION = {
  'auvergne-rhone-alpes': 'Auvergne-Rhône-Alpes',
  'bourgogne-franche-comte': 'Bourgogne-Franche-Comté',
  bretagne: 'Bretagne',
  'centre-val-de-loire': 'Centre-Val de Loire',
  corse: 'Corse',
  'grand-est': 'Grand Est',
  'hauts-de-france': 'Hauts-de-France',
  'ile-de-france': 'Île-de-France',
  normandie: 'Normandie',
  'nouvelle-aquitaine': 'Nouvelle-Aquitaine',
  occitanie: 'Occitanie',
  'pays-de-la-loire': 'Pays de la Loire',
  'provence-alpes-cote-d-azur': 'Provence-Alpes-Côte d\'Azur',
  guadeloupe: 'Guadeloupe',
  martinique: 'Martinique',
  guyane: 'Guyane',
  'la-reunion': 'La Réunion',
  mayotte: 'Mayotte',
}

export const tranchePrix = (prix) => Math.floor(prix / TRANCHE_PRIX) * TRANCHE_PRIX

/** Miroir de `ligneCompatible` (module serveur). */
export function ligneCompatible(l, v) {
  if (v.techno && l.techno && l.techno !== v.techno) return false
  if (v.techno && !l.techno) return false
  if (v.cyl && l.cyl && l.cyl !== v.cyl) return false
  if (v.boite && l.boite && l.boite !== v.boite) return false
  if (v.generation && l.generation_norm && l.generation_norm !== v.generation) return false
  if (v.annee != null && l.annee !== ANNEE_INCONNUE && Math.abs(l.annee - v.annee) > 2) return false
  if (v.km != null && l.km_tranche !== KM_INCONNU) {
    const min = Math.floor((v.km * 0.7) / TRANCHE_KM)
    const max = Math.floor((v.km * 1.3) / TRANCHE_KM)
    if (l.km_tranche < min || l.km_tranche > max) return false
  }
  return true
}

function histogramme(lignes, prixBruts) {
  const histo = new Map()
  let total = 0
  for (const l of lignes) {
    if (!Number.isFinite(l.effectif) || l.effectif <= 0) continue
    histo.set(l.prix_tranche, (histo.get(l.prix_tranche) ?? 0) + l.effectif)
    total += l.effectif
  }
  for (const prix of prixBruts) {
    if (!Number.isFinite(prix) || prix < PRIX_MIN || prix > PRIX_MAX) continue
    const t = tranchePrix(prix)
    histo.set(t, (histo.get(t) ?? 0) + 1)
    total += 1
  }
  return { histo, total }
}

function quantileHisto(histo, total, q) {
  const tranches = [...histo.entries()].sort((a, b) => a[0] - b[0])
  const cible = q * (total - 1) + 1
  let cumul = 0
  for (const [tranche, effectif] of tranches) {
    cumul += effectif
    if (cumul >= cible) return tranche + TRANCHE_PRIX / 2
  }
  return tranches[tranches.length - 1][0] + TRANCHE_PRIX / 2
}

/** Miroir de `PART_API_MAX` (module serveur) : part maximale qu'un seul
 *  client d'API peut peser dans un segment publié. */
export const PART_API_MAX = 0.20

/** Miroir de `partApiDominante` (module serveur). */
export function partApiDominante(lignes, total) {
  const parClient = new Map()
  for (const l of lignes) {
    if (!Number.isFinite(l.effectif) || l.effectif <= 0) continue
    for (const [client, n] of Object.entries(l.parts_api ?? {})) {
      if (!Number.isFinite(n) || n <= 0) continue
      parClient.set(client, (parClient.get(client) ?? 0) + n)
    }
  }
  let client = null
  let effectif = 0
  for (const [c, n] of parClient) {
    if (n > effectif) { client = c; effectif = n }
  }
  return { client, effectif, part: total > 0 ? effectif / total : 0 }
}

/** Miroir de `partApiAcceptable` (module serveur). */
export function partApiAcceptable(lignes, total) {
  return partApiDominante(lignes, total).part <= PART_API_MAX
}

/** Miroir de `fourchetteDepuisAgregats` (module serveur).
 *  null si moins de `minimum` relevés : le prix reste « non évalué ». */
export function fourchetteDepuisAgregats(lignes, vehicule, minimum = SEUIL_FOURCHETTE, prixBruts = []) {
  const retenues = lignes.filter((l) => ligneCompatible(l, vehicule))

  const construire = (sousEnsemble, portee, bruts) => {
    const { histo, total } = histogramme(sousEnsemble, bruts)
    if (total < minimum) return null
    // Second verrou, indépendant du premier : 15 relevés ne suffisent pas si
    // l'un d'eux pèse à lui seul plus d'un cinquième du segment.
    if (!partApiAcceptable(sousEnsemble, total)) return null
    return {
      p25: Math.round(quantileHisto(histo, total, 0.25)),
      mediane: Math.round(quantileHisto(histo, total, 0.5)),
      p75: Math.round(quantileHisto(histo, total, 0.75)),
      n: total,
      portee,
      region: portee === 'region' ? vehicule.region ?? null : null,
    }
  }

  if (vehicule.region) {
    const regionale = construire(retenues.filter((l) => l.region === vehicule.region), 'region', [])
    if (regionale) return regionale
  }
  return construire(retenues, 'national', prixBruts)
}

/** Cible neutre : situer un MODÈLE (page /moteur), pas un véhicule précis. */
export const CIBLE_MODELE = { techno: '', cyl: '', annee: null, km: null }
