// Extracteur La Centrale. JSON-LD (Vehicle/Car) → dataLayer → null.
'use strict'

globalThis.INSPEXO_SITES.push({
  nom: 'lacentrale',
  match (loc) {
    return /(^|\.)lacentrale\.fr$/.test(loc.hostname) &&
      /^\/(auto-occasion-annonce|occasion-voiture-annonce)/.test(loc.pathname)
  },
  extract (doc) {
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
          photos: globalThis.inspexoImages(o.image ?? [], 6),
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
          photos: [],
          url: doc.location.href.split('?')[0],
        }
      }
    } catch (_) { /* rien */ }
    return null
  },
})
