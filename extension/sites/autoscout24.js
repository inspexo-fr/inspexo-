// Extracteur AutoScout24 France. __NEXT_DATA__ (listingDetails) → JSON-LD → null.
'use strict'

globalThis.INSPEXO_SITES.push({
  nom: 'autoscout24',
  match (loc) {
    return /(^|\.)autoscout24\.fr$/.test(loc.hostname) && /^\/offres\//.test(loc.pathname)
  },
  matchSerp (loc) {
    return /(^|\.)autoscout24\.fr$/.test(loc.hostname) && /^\/lst/.test(loc.pathname)
  },
  extractSerp (doc) {
    try {
      const raw = doc.getElementById('__NEXT_DATA__')
      if (raw) {
        const pp = JSON.parse(raw.textContent)?.props?.pageProps
        const listings = pp?.listings || pp?.searchResults?.listings || []
        const out = []
        for (const l of listings) {
          const v = l.vehicle || {}
          const titre = [v.make, v.model, v.modelVersionInput].filter(Boolean).join(' ') ||
            (l.title ? String(l.title) : '')
          const prix = l.price?.priceFormatted ? parseInt(String(l.price.priceFormatted).replace(/\D/g, ''), 10)
            : (l.prices?.public?.priceRaw ?? l.price?.raw ?? null)
          if (!titre || !prix) continue
          const kmRaw = l.mileage ?? v.mileageInKmRaw ?? l.tracking?.mileage
          const km = kmRaw != null ? parseInt(String(kmRaw).replace(/\D/g, ''), 10) : null
          const annee = l.firstRegistration ?? v.firstRegistrationDateRaw ?? v.firstRegistrationDate ?? null
          out.push({
            titre: titre.slice(0, 160),
            annee: annee ? parseInt(String(annee).match(/(20[0-2]\d|19[89]\d)/)?.[1] ?? '', 10) || null : null,
            km: Number.isFinite(km) ? km : null,
            prix: Number(prix),
          })
          if (out.length >= 40) break
        }
        if (out.length) return out
      }
    } catch (_) { /* voie suivante */ }
    return globalThis.inspexoSerpFromJsonLd(doc)
  },
  extract (doc) {
    // --- Voie 1 : __NEXT_DATA__ (AS24 est en Next.js) ---
    try {
      const raw = doc.getElementById('__NEXT_DATA__')
      if (raw) {
        const d = JSON.parse(raw.textContent)?.props?.pageProps?.listingDetails
        if (d && (d.description || d.vehicle)) {
          const v = d.vehicle ?? {}
          return {
            titre: [v.make, v.model, v.modelVersionInput].filter(Boolean).join(' ') || null,
            prix: d.prices?.public?.priceRaw != null ? `${d.prices.public.priceRaw} €`
              : d.prices?.public?.price ?? null,
            annee: v.firstRegistrationDate ?? v.firstRegistrationDateRaw ?? null,
            kilometrage: v.mileageInKmRaw != null ? `${v.mileageInKmRaw} km` : v.mileageInKm ?? null,
            carburant: v.fuelCategory?.formatted ?? v.fuelCategory ?? null,
            boite: v.transmissionType ?? null,
            description: typeof d.description === 'string'
              ? d.description.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ')
              : null,
            type_vendeur: d.seller?.isDealer === true ? 'professionnel'
              : d.seller?.isDealer === false ? 'particulier' : null,
            photos: globalThis.inspexoImages((d.images ?? []).map(i => i?.url ?? i), 6),
            url: doc.location.href.split('?')[0],
          }
        }
      }
    } catch (_) { /* voie suivante */ }

    // --- Voie 2 : JSON-LD ---
    try {
      const o = globalThis.inspexoJsonLdByType(doc, ['Car', 'Vehicle', 'Product'])
      if (o && (o.name || o.description)) {
        const offer = Array.isArray(o.offers) ? o.offers[0] : o.offers
        return {
          titre: o.name ?? null,
          prix: globalThis.inspexoNum(offer?.price, '€'),
          annee: o.vehicleModelDate ?? o.dateVehicleFirstRegistered ?? null,
          kilometrage: globalThis.inspexoNum(o.mileageFromOdometer, 'km'),
          carburant: o.fuelType ?? null,
          boite: o.vehicleTransmission ?? null,
          description: o.description ?? null,
          type_vendeur: null,
          photos: globalThis.inspexoImages(o.image ?? [], 6),
          url: doc.location.href.split('?')[0],
        }
      }
    } catch (_) { /* rien */ }
    return null
  },
})
