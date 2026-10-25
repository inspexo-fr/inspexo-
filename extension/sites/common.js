// Helpers partagés des extracteurs de sites. Chargé en PREMIER (manifest.json).
// Les content scripts partagent un monde isolé : les globales ci-dessous sont
// visibles par sites/*.js et content.js, et invisibles pour la page.
'use strict'

globalThis.INSPEXO_SITES = []

/** Tous les objets JSON-LD de la page, aplatis (@graph inclus). */
globalThis.inspexoJsonLd = function (doc) {
  const out = []
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(script.textContent)
      const list = Array.isArray(data) ? data : [data]
      for (const item of list) {
        out.push(item)
        if (Array.isArray(item['@graph'])) out.push(...item['@graph'])
      }
    } catch (_) { /* JSON-LD invalide : ignoré */ }
  }
  return out
}

/** Premier objet JSON-LD dont le @type correspond (Car, Vehicle, Product…). */
globalThis.inspexoJsonLdByType = function (doc, types) {
  const wanted = types.map(t => t.toLowerCase())
  return globalThis.inspexoJsonLd(doc).find(o => {
    const t = o && o['@type']
    const list = (Array.isArray(t) ? t : [t]).filter(Boolean).map(x => String(x).toLowerCase())
    return list.some(x => wanted.includes(x))
  }) || null
}

/** Nombre → chaîne propre ("128 000 km"), null si absent. */
globalThis.inspexoNum = function (v, suffix) {
  if (v == null) return null
  const n = typeof v === 'object' ? (v.value ?? v['@value'] ?? null) : v
  if (n == null || n === '') return null
  return `${n}${suffix ? ` ${suffix}` : ''}`
}

/** Jusqu'à n URLs d'images absolues et en https. */
globalThis.inspexoImages = function (list, n) {
  return (Array.isArray(list) ? list : [list])
    .map(i => (typeof i === 'string' ? i : i && (i.url || i.contentUrl)))
    .filter(u => typeof u === 'string' && /^https:\/\//.test(u))
    .slice(0, n)
}
