// Appli mobile « Partager → Inspexo » (sprint 4B) — helpers natifs.
// Tout se passe SUR le téléphone : l'annonce partagée est ouverte dans une
// WebView visible (si une vérification anti-robot apparaît, c'est l'UTILISATEUR
// qui la passe — jamais contournée), les extracteurs de l'extension Chrome y
// sont exécutés, les photos sont téléchargées et ré-encodées localement (EXIF
// supprimé). Aucune requête de nos serveurs vers Leboncoin / La Centrale.
import { Capacitor, CapacitorHttp } from '@capacitor/core'
import { EXTRACTEUR_INJECTABLE } from './extracteurInjectable.gen'

export const estNatif = () => Capacitor.isNativePlatform()

export const SITES_PARTAGE = /(^|\.)((leboncoin|lacentrale|autoscout24)\.fr)$/

export function urlPartageValide(brut) {
  try {
    const u = new URL(brut)
    return u.protocol === 'https:' && SITES_PARTAGE.test(u.hostname) ? u.href : null
  } catch (_) {
    return null
  }
}

/** Ouvre l'annonce dans une WebView VISIBLE et exécute les extracteurs à chaque
 *  chargement de page (si l'utilisateur doit passer une vérification anti-robot,
 *  la page suivante relance l'extraction automatiquement).
 *  → résout avec les données extraites, rejette {code: 'ferme'|'timeout'}. */
export async function ouvrirEtExtraire(urlAnnonce, surEtat = () => {}) {
  const { InAppBrowser } = await import('@capgo/inappbrowser')
  return new Promise((resolve, reject) => {
    let fini = false
    const ecouteurs = []
    let minuterieInjection = null
    const terminer = async (action) => {
      if (fini) return
      fini = true
      clearTimeout(minuterieInjection)
      clearTimeout(gardeFou)
      for (const p of ecouteurs) {
        try { (await p).remove() } catch (_) { /* déjà retiré */ }
      }
      try { await InAppBrowser.close() } catch (_) { /* déjà fermée */ }
      action()
    }

    ecouteurs.push(InAppBrowser.addListener('messageFromWebview', (ev) => {
      const brut = ev?.detail?.inspexo_extraction
      if (!brut) return
      let r = null
      try { r = JSON.parse(brut) } catch (_) { return }
      if (r.ok && r.data && r.data.titre) {
        terminer(() => resolve(r.data))
      } else {
        // Page non exploitable (vérification anti-robot, page intermédiaire…) :
        // la WebView reste au premier plan, l'utilisateur agit, et le prochain
        // chargement relancera l'extraction.
        surEtat('verification_humaine')
      }
    }))

    const injecter = () => {
      clearTimeout(minuterieInjection)
      minuterieInjection = setTimeout(async () => {
        if (fini) return
        surEtat('extraction')
        try { await InAppBrowser.executeScript({ code: EXTRACTEUR_INJECTABLE }) } catch (_) { /* page pas prête */ }
      }, 1300) // laisser le rendu se poser (hydratation __NEXT_DATA__)
    }
    ecouteurs.push(InAppBrowser.addListener('browserPageLoaded', injecter))
    ecouteurs.push(InAppBrowser.addListener('urlChangeEvent', injecter))
    ecouteurs.push(InAppBrowser.addListener('closeEvent', () => {
      terminer(() => reject(Object.assign(new Error('WebView fermée'), { code: 'ferme' })))
    }))

    const gardeFou = setTimeout(() => {
      terminer(() => reject(Object.assign(new Error('délai dépassé'), { code: 'timeout' })))
    }, 120000)

    surEtat('chargement')
    InAppBrowser.openWebView({ url: urlAnnonce, title: 'Annonce — Inspexo' })
      .catch((e) => terminer(() => reject(e)))
  })
}

/** Télécharge une photo DEPUIS LE TÉLÉPHONE (requête native, IP de
 *  l'utilisateur), la redimensionne à 1 600 px et la ré-encode en JPEG :
 *  l'EXIF (GPS…) disparaît — même règle que l'extension Chrome. */
export async function telechargerPhoto(url) {
  const rep = await CapacitorHttp.get({
    url,
    responseType: 'blob',
    connectTimeout: 10000,
    readTimeout: 10000,
  })
  if (rep.status !== 200 || typeof rep.data !== 'string') throw new Error(`photo ${rep.status}`)
  const mime = String(rep.headers['Content-Type'] || rep.headers['content-type'] || 'image/jpeg').split(';')[0]
  if (!/^image\//.test(mime)) throw new Error('pas une image')
  return await redimensionnerDataUrl(`data:${mime};base64,${rep.data}`)
}

function redimensionnerDataUrl(dataUrl, maxDim = 1600) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const ratio = Math.min(1, maxDim / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.width * ratio))
      canvas.height = Math.max(1, Math.round(img.height * ratio))
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => reject(new Error('image illisible'))
    img.src = dataUrl
  })
}

/** Envoie les données extraites à l'intake Inspexo — exactement le même
 *  payload que l'extension Chrome. → { id } de l'analyse. */
export async function envoyerVersIntake(donnees, images) {
  const res = await fetch('https://www.inspexo.io/api/intake', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      titre: donnees.titre,
      prix: donnees.prix,
      annee: donnees.annee,
      kilometrage: donnees.kilometrage,
      carburant: donnees.carburant,
      boite: donnees.boite,
      description: donnees.description,
      type_vendeur: donnees.type_vendeur,
      url: donnees.url,
      images,
      comparables_structures: [],
    }),
    signal: AbortSignal.timeout(170000),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || !body?.id) {
    const err = new Error(body?.message || `intake ${res.status}`)
    err.code = body?.error || String(res.status)
    throw err
  }
  return body
}
