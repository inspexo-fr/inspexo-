// SPRINT 19 — Comparables relevés sur la page de recherche de l'utilisateur,
// gardés LOCALEMENT en attendant la prochaine analyse.
//
// Exact équivalent du `chrome.storage.local` de l'extension (background.js) :
// l'utilisateur partage sa page de résultats, les annonces affichées
// attendent sur SON appareil, et la prochaine annonce analysée les emporte.
//
// ⚠️ Rien ne part vers nos serveurs à cette étape. C'est ce qui rend la
// promesse « aucune collecte sans votre action » littéralement vraie : le
// relevé est un geste, pas une tâche de fond.
//
// ⚠️ Et rien ne survit 24 h : des comparables d'avant-hier ne décrivent plus
// la recherche en cours, et les garder par commodité serait garder des données
// dont personne n'a plus l'usage.

const CLE = 'inspexo_comparables'
const DUREE_MS = 24 * 3600 * 1000

export function enregistrerComparables(annonces) {
  const items = (Array.isArray(annonces) ? annonces : []).slice(0, 40)
  if (!items.length) return 0
  try {
    window.localStorage.setItem(CLE, JSON.stringify({ savedAt: Date.now(), items }))
    return items.length
  } catch (_) {
    return 0 // navigation privée, quota : on n'insiste pas
  }
}

/** Les comparables en attente, puis EFFACÉS : ils servent une analyse, pas
 *  toutes les suivantes. */
export function consommerComparables() {
  try {
    const brut = window.localStorage.getItem(CLE)
    window.localStorage.removeItem(CLE)
    if (!brut) return []
    const d = JSON.parse(brut)
    if (!d || typeof d.savedAt !== 'number' || Date.now() - d.savedAt > DUREE_MS) return []
    return Array.isArray(d.items) ? d.items : []
  } catch (_) {
    return []
  }
}

/** Combien sont en attente, SANS les consommer (affichage). */
export function comparablesEnAttente() {
  try {
    const d = JSON.parse(window.localStorage.getItem(CLE) || 'null')
    if (!d || typeof d.savedAt !== 'number' || Date.now() - d.savedAt > DUREE_MS) return 0
    return Array.isArray(d.items) ? d.items.length : 0
  } catch (_) {
    return 0
  }
}
