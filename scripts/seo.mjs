// SPRINT 24 (SEO) — module PUR utilisé par le pré-rendu (tests/seo.test.mjs).
//
//   - indexabilité d'une page d'après SON HTML : ni `noindex`, ni canonique
//     vers une autre adresse ⇒ elle va au sitemap ;
//   - anti-doublon : similarité du texte PROPRE (gabarit retiré) entre pages
//     modèle ; au-delà du seuil, la génération la moins récente passe en
//     `noindex`, SANS canonique vers l'autre — ce ne sont pas les mêmes
//     voitures (décision d'Utku du 13 nov. 2026). Le canonique est réservé
//     aux vrais doublons (même code moteur sous deux marques) ;
//   - titres et descriptions uniques parmi les pages indexables.

export const SEUIL_SIMILARITE = 0.8

export function metaDe(html) {
  return {
    titre: (html.match(/<title[^>]*>([^<]*)<\/title>/) || [])[1]?.trim() ?? '',
    description: (html.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/) || [])[1]?.trim() ?? '',
    noindex: /<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(html),
    canonique: (html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]*)"/) || [])[1] ?? null,
  }
}

export function estIndexable(html, urlAbsolue) {
  const m = metaDe(html)
  return !m.noindex && (!m.canonique || m.canonique === urlAbsolue)
}

/** Une seule balise robots : celle que la page déclare (Helmet, `data-rh`)
 *  l'emporte sur la balise fixe du gabarit `public/index.html`. Deux balises
 *  contradictoires ne doivent jamais coexister. */
export function uneSeuleBaliseRobots(html) {
  const declaree = /<meta[^>]+name="robots"[^>]+data-rh="true"[^>]*>/i.test(html)
  return declaree ? html.replace(/<meta name="robots" content="[^"]*">(?![^<]*data-rh)/i, '') : html
}

/** Ajoute `noindex, follow` à une page (sans toucher à son canonique). */
export function ajouterNoindex(html) {
  if (/<meta[^>]+name="robots"/i.test(html)) {
    return html.replace(/(<meta[^>]+name="robots"[^>]+content=")[^"]*(")/i, '$1noindex, follow$2')
  }
  return html.replace('</head>', '<meta name="robots" content="noindex, follow"></head>')
}

const motsDe = (html) => (html.match(/<main[\s\S]*?<\/main>/)?.[0] ?? html)
  .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ')
  .toLowerCase().replace(/[^a-zà-ÿ0-9]+/g, ' ').split(' ').filter(Boolean)

const blocs = (mots) => { const s = new Set(); for (let i = 0; i + 5 <= mots.length; i++) s.add(mots.slice(i, i + 5).join(' ')); return s }

/** Paires de pages trop proches. Le gabarit (blocs présents sur plus de 30 %
 *  des pages comparées) est retiré avant la mesure. */
export function pairesProches(pages, seuil = SEUIL_SIMILARITE) {
  const S = pages.map((p) => blocs(motsDe(p.html)))
  const freq = new Map()
  for (const s of S) for (const x of s) freq.set(x, (freq.get(x) || 0) + 1)
  // Gabarit : présent sur plus de 30 % des pages ET sur plus de 2 pages (sans
  // ce plancher, sur un petit échantillon, tout le texte passerait pour du gabarit).
  const propres = S.map((s) => new Set([...s].filter((x) => freq.get(x) <= Math.max(2, pages.length * 0.3))))
  const out = []
  for (let i = 0; i < pages.length; i++) {
    for (let j = i + 1; j < pages.length; j++) {
      const A = propres[i], B = propres[j]
      if (!A.size || !B.size) continue
      let inter = 0
      for (const x of A) if (B.has(x)) inter++
      const sim = inter / (A.size + B.size - inter)
      if (sim >= seuil) out.push({ a: pages[i].url, b: pages[j].url, similarite: Math.round(sim * 100) / 100 })
    }
  }
  return out.sort((x, y) => y.similarite - x.similarite)
}

/** Laquelle des deux pages reste indexée ? Décision d'Utku du 13 nov. 2026 :
 *  APRÈS l'enrichissement des pages par des données propres au modèle, une
 *  paire encore au-dessus du seuil garde la GÉNÉRATION LA PLUS RÉCENTE
 *  (année d'apparition du plus récent moteur de la page). À année égale ou
 *  inconnue : null — les deux restent indexées et la paire est signalée.
 *  Jamais de choix au hasard. */
const ROMAINS = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8 }
/** Même modèle, générations en chiffres romains : « 508-i » / « 508-ii ». */
function memeModeleGenerations(a, b) {
  const m = (u) => u.match(/^\/modele\/([^/]+)\/(.+)-(i{1,3}|iv|v|vi{1,3})$/)
  const x = m(a), y = m(b)
  if (!x || !y || x[1] !== y[1] || x[2] !== y[2]) return null
  return { ga: ROMAINS[x[3]], gb: ROMAINS[y[3]] }
}

export function gardee(a, b, infos) {
  const ya = infos[a]?.annee_recente, yb = infos[b]?.annee_recente
  if (typeof ya !== 'number' || typeof yb !== 'number' || ya === yb) {
    // Même modèle, deux générations numérotées : la plus haute est la plus récente.
    const g = memeModeleGenerations(a, b)
    if (g && g.ga !== g.gb) return { garde: g.ga > g.gb ? a : b, motif: 'même modèle : génération la plus récente' }
    return null
  }
  return ya > yb
    ? { garde: a, motif: `génération la plus récente (moteur apparu en ${ya} contre ${yb})` }
    : { garde: b, motif: `génération la plus récente (moteur apparu en ${yb} contre ${ya})` }
}

/** Titres et descriptions en double parmi les pages indexables. */
export function doublonsMeta(pages) {
  const par = (cle) => {
    const m = new Map()
    for (const p of pages) { const v = p.meta[cle]; if (!v) continue; (m.get(v) || m.set(v, []).get(v)).push(p.url) }
    return [...m.entries()].filter(([, u]) => u.length > 1).map(([valeur, urls]) => ({ valeur, urls }))
  }
  const sansDescription = pages.filter((p) => !p.meta.description).map((p) => p.url)
  return { titres: par('titre'), descriptions: par('description'), sans_description: sansDescription }
}
