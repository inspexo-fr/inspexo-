// SPRINT 11 — Attribution de source (?src=), sans cookie ni traceur.
//
// Ce que c'est : une ÉTIQUETTE DE CAMPAGNE, par exemple « tiktok-03 ». Rien
// d'autre. Pas d'identifiant, pas d'horodatage, pas de parcours — une chaîne
// de 40 caractères au plus, choisie par nous à l'avance pour un lien donné.
//
// Pourquoi un stockage de session : quelqu'un peut arriver par
// /pass?src=tiktok-03 puis aller analyser une annonce. Sans mémoire, le lien
// entre la vidéo et l'analyse serait perdu. `sessionStorage` n'est pas un
// cookie mais relève du même article 82 : l'exemption « mesure d'audience »
// s'applique — première partie, aucun recoupement, aucun identifiant.
//
// Trois règles qui rendent cette exemption vraie, et pas seulement invoquée :
//  1. UNE SEULE CLÉ, dont la valeur est l'étiquette seule ;
//  2. EFFACÉE dès qu'elle a été rattachée à une analyse ;
//  3. portée à la SESSION : elle ne survit pas à la fermeture de l'onglet.

const CLE = 'inspexo_src'
/** Format imposé, identique côté serveur : aucune donnée libre ne passe. */
const SRC_RE = /^[a-z0-9][a-z0-9-]{0,39}$/

export function sourceValide(valeur) {
  return SRC_RE.test(String(valeur ?? ''))
}

/** Relève `?src=` dans l'URL courante et la retient pour cette visite.
 *  Sans effet si le paramètre est absent ou mal formé. */
export function capterSource(recherche = window.location.search) {
  try {
    const brut = new URLSearchParams(recherche).get('src')
    if (!brut) return null
    const v = brut.trim().toLowerCase()
    if (!sourceValide(v)) return null
    // Première source gagnante : on ne réécrit pas l'origine d'une visite
    // parce que l'utilisateur a cliqué un second lien étiqueté.
    if (!window.sessionStorage.getItem(CLE)) window.sessionStorage.setItem(CLE, v)
    return v
  } catch (_) {
    return null // stockage refusé par le navigateur : on s'en passe
  }
}

/** L'étiquette de cette visite, ou null. */
export function lireSource() {
  try {
    const v = window.sessionStorage.getItem(CLE)
    return sourceValide(v) ? v : null
  } catch (_) {
    return null
  }
}

/** Efface l'étiquette : appelé DÈS QU'ELLE A ÉTÉ RATTACHÉE à une analyse.
 *  Elle a joué son rôle, elle n'a plus de raison de rester. */
export function oublierSource() {
  try { window.sessionStorage.removeItem(CLE) } catch (_) { /* rien à faire */ }
}
