// Extracteur Leboncoin. Ordre de robustesse : __NEXT_DATA__ (données brutes du
// site) → JSON-LD → null (le bouton bascule alors en fallback /score).
'use strict'

globalThis.INSPEXO_SITES.push({
  nom: 'leboncoin',
  match (loc) {
    return /(^|\.)leboncoin\.fr$/.test(loc.hostname) && /^\/ad\//.test(loc.pathname)
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
