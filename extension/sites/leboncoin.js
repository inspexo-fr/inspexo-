// Extracteur Leboncoin. Ordre de robustesse : __NEXT_DATA__ (données brutes du
// site) → JSON-LD → null (le bouton bascule alors en fallback /score).
'use strict'

globalThis.INSPEXO_SITES.push({
  nom: 'leboncoin',
  match (loc) {
    return /(^|\.)leboncoin\.fr$/.test(loc.hostname) && /^\/ad\//.test(loc.pathname)
  },
  matchSerp (loc) {
    return /(^|\.)leboncoin\.fr$/.test(loc.hostname) &&
      (/\/(voitures|recherche)/.test(loc.pathname) || /offres/.test(loc.pathname)) &&
      !/^\/ad\//.test(loc.pathname)
  },
  extractSerp (doc) {
    // __NEXT_DATA__ → liste des annonces de la page de résultats
    try {
      const raw = doc.getElementById('__NEXT_DATA__')
      if (raw) {
        const pp = JSON.parse(raw.textContent)?.props?.pageProps
        const ads = pp?.searchData?.ads || pp?.initialProps?.searchData?.ads || []
        const out = []
        for (const ad of ads) {
          const attrs = Object.fromEntries((ad.attributes || []).map(a => [a.key, a.value_label ?? a.value]))
          const prix = Array.isArray(ad.price) ? ad.price[0] : ad.price
          if (!ad.subject || !prix) continue
          const km = attrs.mileage ? parseInt(String(attrs.mileage).replace(/\D/g, ''), 10) : null
          out.push({
            titre: String(ad.subject).slice(0, 160),
            annee: attrs.regdate ? parseInt(String(attrs.regdate).slice(0, 4), 10) : null,
            km: Number.isFinite(km) ? km : null,
            prix: Number(prix),
          })
        }
        if (out.length) return out.slice(0, 40)
      }
    } catch (_) { /* voie suivante */ }
    return globalThis.inspexoSerpFromJsonLd(doc)
  },
  extract (doc) {
    // --- Voie 1 : __NEXT_DATA__ ---
    try {
      const raw = doc.getElementById('__NEXT_DATA__')
      if (raw) {
        const ad = JSON.parse(raw.textContent)?.props?.pageProps?.ad
        if (ad && ad.subject) {
          const attrs = Object.fromEntries(
            (ad.attributes || []).map(a => [a.key, a.value_label ?? a.value]),
          )
          return {
            titre: ad.subject,
            prix: ad.price != null ? `${Array.isArray(ad.price) ? ad.price[0] : ad.price} €` : null,
            annee: attrs.regdate ?? null,
            kilometrage: attrs.mileage ?? null,
            carburant: attrs.fuel ?? null,
            boite: attrs.gearbox ?? null,
            description: ad.body ?? null,
            type_vendeur: ad.owner?.type === 'pro' ? 'professionnel' : ad.owner?.type === 'private' ? 'particulier' : null,
            photos: globalThis.inspexoImages(ad.images?.urls_large ?? ad.images?.urls ?? [], 6),
            url: doc.location.href.split('?')[0],
          }
        }
      }
    } catch (_) { /* structure changée : voie suivante */ }

    // --- Voie 2 : JSON-LD ---
    try {
      const o = globalThis.inspexoJsonLdByType(doc, ['Car', 'Vehicle', 'Product'])
      if (o && (o.name || o.description)) {
        const offer = Array.isArray(o.offers) ? o.offers[0] : o.offers
        const vendeur = (offer?.seller && offer.seller['@type']) || (o.seller && o.seller['@type']) || null
        return {
          titre: o.name ?? null,
          prix: globalThis.inspexoNum(offer?.price, '€'),
          annee: o.vehicleModelDate ?? o.productionDate ?? o.dateVehicleFirstRegistered ?? null,
          kilometrage: globalThis.inspexoNum(o.mileageFromOdometer, 'km'),
          carburant: o.fuelType ?? null,
          boite: o.vehicleTransmission ?? null,
          description: o.description ?? null,
          type_vendeur: vendeur === 'Person' ? 'particulier'
            : (vendeur === 'Organization' || vendeur === 'AutoDealer') ? 'professionnel' : null,
          photos: globalThis.inspexoImages(o.image ?? [], 6),
          url: doc.location.href.split('?')[0],
        }
      }
    } catch (_) { /* voie suivante */ }
    return null
  },
})
