// SPRINT 24 (SEO) — module PUR utilisé par le pré-rendu (tests/seo.test.mjs).
//
//   - indexabilité d'une page d'après SON HTML : ni `noindex`, ni canonique
//     vers une autre adresse ⇒ elle va au sitemap ;
//   - anti-doublon : similarité du texte PROPRE (gabarit retiré) entre pages
//     modèle ; au-delà du seuil, la page la moins présente dans le parc passe
//     en `noindex`, SANS canonique vers l'autre — ce ne sont pas les mêmes
//     voitures (décision d'Utku du 13 nov. 2026). Le canonique est réservé
//     aux vrais doublons (même code moteur sous deux marques) ;
//   - titres et descriptions uniques parmi les pages indexables.

export const SEUIL_SIMILARITE = 0.8

/** Rang dans le parc d'occasion, d'après la SEULE source du projet : top 30
 *  L'Argus 2023 (données NGC-Data), page qui ne nomme que ces rangs. Un
 *  modèle absent n'a pas de rang : on ne l'invente pas. */
export const RANG_PARC = {
  'renault/clio': 1, 'citroen/c3': 2, 'peugeot/208': 3, 'volkswagen/golf': 4,
  'renault/twingo': 5, 'renault/scenic': 9, 'dacia/sandero': 15, 'toyota/yaris': 16,
}
export const SOURCE_RANG_PARC = 'https://www.largus.fr/actualite-automobile/voitures-d-occasion-le-top-30-des-modeles-les-plus-vendus-en-2023-30028302.html'

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

/** Laquelle des deux pages reste indexée ? Rang sourcé dans le parc d'abord ;
 *  à défaut, la page au contenu propre le plus riche (pannes portées + prises
 *  datées, puis nombre de sources), puis l'adresse (ordre stable). */
export function gardee(a, b, infos) {
  const cle = (u) => u.replace(/^\/modele\//, '').split('/').slice(0, 1).concat((u.split('/')[3] || '').split('-')[0]).join('/')
  const ra = RANG_PARC[cle(a)], rb = RANG_PARC[cle(b)]
  if (ra != null || rb != null) {
    if (ra != null && (rb == null || ra < rb)) return { garde: a, motif: `rang ${ra} du parc (L'Argus 2023)` }
    if (rb != null && (ra == null || rb < ra)) return { garde: b, motif: `rang ${rb} du parc (L'Argus 2023)` }
  }
  const ia = infos[a] || {}, ib = infos[b] || {}
  const va = (ia.n_portees || 0) + (ia.n_prises_datees || 0), vb = (ib.n_portees || 0) + (ib.n_prises_datees || 0)
  if (va !== vb) return { garde: va > vb ? a : b, motif: 'aucun rang sourcé : contenu propre le plus riche' }
  if ((ia.n_sources || 0) !== (ib.n_sources || 0)) return { garde: (ia.n_sources || 0) > (ib.n_sources || 0) ? a : b, motif: 'aucun rang sourcé : plus de sources' }
  return { garde: a < b ? a : b, motif: 'aucun rang sourcé, contenu égal : ordre des adresses' }
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
