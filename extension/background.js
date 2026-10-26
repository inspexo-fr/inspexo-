// Service worker Inspexo (MV3).
// Rôle : au clic utilisateur uniquement — télécharger les photos de l'annonce
// (hôtes autorisés par host_permissions), les redimensionner à 1 600 px et les
// ré-encoder en JPEG (ce qui supprime les métadonnées EXIF), puis envoyer le
// tout à https://www.inspexo.io/api/intake. AUCUNE autre requête, aucune
// collecte, aucun stockage : les photos ne quittent la mémoire que vers Inspexo
// et n'y sont jamais conservées.
'use strict'

const INTAKE_URL = 'https://www.inspexo.io/api/intake'
const RESULT_BASE = 'https://www.inspexo.io/a/'
const MAX_DIM = 1600
const MAX_PHOTOS = 6

async function downloadAndResize (url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) throw new Error(`photo ${res.status}`)
  const blob = await res.blob()
  if (!/^image\//.test(blob.type) || blob.size > 15_000_000) throw new Error('type/poids')
  const bitmap = await createImageBitmap(blob)
  const ratio = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * ratio))
  const h = Math.max(1, Math.round(bitmap.height * ratio))
  const canvas = new OffscreenCanvas(w, h)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  // Ré-encodage JPEG : seuls les pixels survivent — l'EXIF (GPS…) disparaît.
  const out = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 })
  const buf = new Uint8Array(await out.arrayBuffer())
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < buf.length; i += CHUNK) {
    bin += String.fromCharCode(...buf.subarray(i, i + CHUNK))
  }
  return `data:image/jpeg;base64,${btoa(bin)}`
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Comparables relevés sur une page de résultats : stockés localement
  // (24 h max), joints à la prochaine analyse puis effacés.
  if (message && message.type === 'inspexo_comparables') {
    chrome.storage.local.set({
      inspexo_comparables: { items: (message.comparables || []).slice(0, 40), savedAt: Date.now() },
    }).then(() => sendResponse({ ok: true }))
    return true
  }
  if (!message || message.type !== 'inspexo_analyser') return false
  ;(async () => {
    const d = message.data || {}
    const photos = []
    for (const url of (d.photos || []).slice(0, MAX_PHOTOS)) {
      try {
        photos.push(await downloadAndResize(url))
      } catch (_) { /* photo inaccessible : on continue sans elle */ }
    }
    // Comparables enregistrés depuis une page de résultats (< 24 h) : joints
    // à cette analyse puis effacés.
    let comparables = []
    try {
      const stored = (await chrome.storage.local.get('inspexo_comparables')).inspexo_comparables
      if (stored && Date.now() - stored.savedAt < 24 * 3600 * 1000) comparables = stored.items || []
      await chrome.storage.local.remove('inspexo_comparables')
    } catch (_) { /* stockage indisponible */ }
    const res = await fetch(INTAKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titre: d.titre, prix: d.prix, annee: d.annee, kilometrage: d.kilometrage,
        carburant: d.carburant, boite: d.boite, description: d.description,
        type_vendeur: d.type_vendeur, url: d.url, images: photos,
        comparables_structures: comparables,
      }),
      signal: AbortSignal.timeout(150000),
    })
    const body = await res.json().catch(() => null)
    if (res.ok && body && body.id) {
      await chrome.tabs.create({ url: `${RESULT_BASE}${body.id}` })
      sendResponse({ ok: true, id: body.id })
    } else {
      sendResponse({ ok: false, error: body && body.error ? body.error : `http_${res.status}` })
    }
  })().catch((e) => sendResponse({ ok: false, error: String(e && e.message || e) }))
  return true // réponse asynchrone
})
