// Extracteur La Centrale. JSON-LD (Vehicle/Car) → dataLayer → null.
'use strict'

globalThis.INSPEXO_SITES.push({
  nom: 'lacentrale',
  match (loc) {
    return /(^|\.)lacentrale\.fr$/.test(loc.hostname) &&
      /^\/(auto-occasion-annonce|occasion-voiture-annonce)/.test(loc.pathname)
  },
  matchSerp (loc) {
    return /(^|\.)lacentrale\.fr$/.test(loc.hostname) && /^\/listing/.test(loc.pathname)
  },
  extractSerp (doc) {
    const fromLd = globalThis.inspexoSerpFromJsonLd(doc)
    if (fromLd.length) return fromLd
    // Secours : cartes d'annonce du DOM (titre + prix + specs année/km)
    try {
      const out = []
      for (const a of doc.querySelectorAll('a[href*="annonce"]')) {
        const txt = (a.textContent || '').replace(/\s+/g, ' ')
        const prixM = txt.match(/(\d[\d\s]{2,8})\s?€/)
        const anneeM = txt.match(/\b(20[0-2]\d|19[89]\d)\b/)
        const kmM = txt.match(/([\d\s]{4,9})\s?km/i)
        if (!prixM) continue
        const titre = txt.slice(0, 120).trim()
        out.push({
          titre,
          annee: anneeM ? parseInt(anneeM[1], 10) : null,
          km: kmM ? parseInt(kmM[1].replace(/\s/g, ''), 10) : null,
          prix: parseInt(prixM[1].replace(/\s/g, ''), 10),
        })
        if (out.length >= 40) break
      }
      return out
    } catch (_) { return [] }
  },
  extract (doc) {
    // Photos pleine taille : pictures.lacentrale.fr/classifieds/<id>_STANDARD_<n>.jpg
    // (on retire les paramètres de redimensionnement ; dédoublonnage par index).
    const photosPleineTaille = () => {
      // Les URLs pictures.lacentrale.fr sont SIGNÉES (signature obligatoire) :
      // on garde, pour chaque index, la variante signée de plus grande taille.
      const meilleures = new Map() // idx → { url, aire }
      const re = /https:\/\/pictures\.lacentrale\.fr\/classifieds\/[A-Z0-9]+_STANDARD_(\d+)\.(?:jpg|jpeg|webp)[^"'\s\\<>]*/gi
      const html = (doc.documentElement ? doc.documentElement.innerHTML : '')
      let m
      while ((m = re.exec(html)) !== null) {
        const url = m[0].replace(/&amp;/g, '&')
        if (!/[?&]signature=/.test(url)) continue
        const idx = parseInt(m[1], 10)
        const t = url.match(/[?&]size=(\d+)x(\d+)/)
        const aire = t ? parseInt(t[1], 10) * parseInt(t[2], 10) : 0
        const cur = meilleures.get(idx)
        if (!cur || aire > cur.aire) meilleures.set(idx, { url, aire })
      }
      return [...meilleures.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v.url).slice(0, 6)
    }

    // --- Voie 1 : JSON-LD ---
    try {
      const o = globalThis.inspexoJsonLdByType(doc, ['Car', 'Vehicle', 'Product'])
      if (o && (o.name || o.description)) {
        const offer = Array.isArray(o.offers) ? o.offers[0] : o.offers
        const vendeur = offer?.seller?.['@type'] || o.seller?.['@type'] || null
        return {
          titre: o.name ?? null,
          prix: globalThis.inspexoNum(offer?.price, '€'),
          annee: o.vehicleModelDate ?? o.productionDate ?? o.dateVehicleFirstRegistered ?? null,
          kilometrage: globalThis.inspexoNum(o.mileageFromOdometer, 'km'),
          carburant: o.fuelType ?? null,
          boite: o.vehicleTransmission ?? null,
          description: o.description ?? null,
          type_vendeur: vendeur === 'Organization' || vendeur === 'AutoDealer'
            ? 'professionnel'
            : vendeur === 'Person' ? 'particulier' : null,
          photos: (() => { const p = photosPleineTaille(); return p.length ? p : globalThis.inspexoImages(o.image ?? [], 6) })(),
          url: doc.location.href.split('?')[0],
        }
      }
    } catch (_) { /* voie suivante */ }

    // --- Voie 2 : dataLayer (classifiedInfos) ---
    try {
      // La Centrale pousse l'annonce dans window.dataLayer ; inaccessible depuis
      // le monde isolé → on relit le script inline qui le définit.
      for (const script of doc.querySelectorAll('script:not([src])')) {
        const t = script.textContent || ''
        const m = t.match(/"classified"\s*:\s*({.*?"price".*?})\s*[,}]/s)
        if (!m) continue
        const c = JSON.parse(m[1])
        if (!c.makeModel && !c.model) continue
        return {
          titre: [c.make, c.model, c.version].filter(Boolean).join(' ') || null,
          prix: c.price != null ? `${c.price} €` : null,
          annee: c.year ?? null,
          kilometrage: c.mileage != null ? `${c.mileage} km` : null,
          carburant: c.energy ?? null,
          boite: c.gearbox ?? null,
          description: null,
          type_vendeur: c.customerType === 'PRO' ? 'professionnel' : c.customerType ? 'particulier' : null,
          photos: photosPleineTaille(),
          url: doc.location.href.split('?')[0],
        }
      }
    } catch (_) { /* rien */ }
    return null
  },
})
