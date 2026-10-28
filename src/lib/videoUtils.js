// Mode enregistrement d'écran — extraction d'images CÔTÉ NAVIGATEUR uniquement.
// La vidéo ne quitte JAMAIS le téléphone : elle est lue localement (élément
// <video> + canvas), des images sont prélevées toutes les 0,5 s, dédupliquées
// par différence d'image, et 10 à 12 images max (1 600 px) sont conservées.
// iPhone : MOV/HEVC décodé nativement par Safari (c'est lui qui l'a filmé) ;
// Android : MP4/H.264 décodé par Chrome. Si le navigateur ne sait pas décoder
// (ex : HEVC sur un poste Windows), on lève { code: 'decode' } et l'interface
// bascule sur le mode captures avec un message clair.

const CIBLE_IMAGES = 12 // 10 à 12 images max
const INTERVALLE_S = 0.5 // une image toutes les 0,5 s
const MAX_CANDIDATES = 40 // au-delà (vidéo > 20 s), le pas s'élargit
const COTE_MAX = 1600 // même taille que le mode captures
const SEUIL_DIFF = 7 // différence moyenne (0-255) pour considérer l'image nouvelle
const SEUIL_VARIANCE = 4 // en dessous : image unie (noir/blanc) → ignorée
const MAX_TAILLE_FICHIER = 300 * 1024 * 1024 // 300 Mo
const MAX_DUREE_S = 120

function erreurVideo(code, message) {
  const e = new Error(message)
  e.code = code
  return e
}

/** Empreinte 24×48 en niveaux de gris pour la déduplication. */
function empreinte(ctx, video, w, h) {
  ctx.drawImage(video, 0, 0, 24, 48)
  const d = ctx.getImageData(0, 0, 24, 48).data
  const g = new Float32Array(24 * 48)
  for (let i = 0; i < g.length; i++) {
    g[i] = (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3
  }
  return g
}

function diffMoyenne(a, b) {
  let s = 0
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i])
  return s / a.length
}

function variance(a) {
  let m = 0
  for (let i = 0; i < a.length; i++) m += a[i]
  m /= a.length
  let v = 0
  for (let i = 0; i < a.length; i++) v += (a[i] - m) * (a[i] - m)
  return Math.sqrt(v / a.length)
}

function chercherPosition(video, t) {
  return new Promise((resolve, reject) => {
    const fini = () => { nettoie(); resolve() }
    const rate = () => { nettoie(); reject(erreurVideo('decode', 'seek impossible')) }
    const minuterie = setTimeout(rate, 8000)
    const nettoie = () => {
      clearTimeout(minuterie)
      video.removeEventListener('seeked', fini)
      video.removeEventListener('error', rate)
    }
    video.addEventListener('seeked', fini)
    video.addEventListener('error', rate)
    video.currentTime = t
  })
}

/**
 * Extrait les images d'un enregistrement d'écran, localement.
 * @returns {Promise<string[]>} dataURLs JPEG (10-12 max, 1 600 px)
 * @throws {Error & {code: 'decode'|'trop_long'|'trop_lourd'}}
 */
export async function extraireImagesVideo(file, surProgression = () => {}) {
  if (file.size > MAX_TAILLE_FICHIER) {
    throw erreurVideo('trop_lourd', 'Vidéo trop lourde — filmez 10 à 20 secondes.')
  }
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.src = url

  try {
    await new Promise((resolve, reject) => {
      const minuterie = setTimeout(
        () => reject(erreurVideo('decode', 'métadonnées illisibles')), 12000)
      video.addEventListener('loadedmetadata', () => { clearTimeout(minuterie); resolve() })
      video.addEventListener('error', () => { clearTimeout(minuterie); reject(erreurVideo('decode', 'format non décodable')) })
    })

    const duree = video.duration
    if (!Number.isFinite(duree) || duree <= 0 || !video.videoWidth || !video.videoHeight) {
      // Durée/dimensions inconnues : codec non supporté (HEVC hors Safari, etc.)
      throw erreurVideo('decode', 'format non décodable')
    }
    if (duree > MAX_DUREE_S) {
      throw erreurVideo('trop_long', 'Vidéo trop longue — filmez 10 à 20 secondes, le défilement complet suffit.')
    }

    // Pas d'échantillonnage : 0,5 s, élargi si la vidéo dépasse 20 s.
    const pas = Math.max(INTERVALLE_S, duree / MAX_CANDIDATES)
    const ratio = Math.min(1, COTE_MAX / Math.max(video.videoWidth, video.videoHeight))
    const w = Math.round(video.videoWidth * ratio)
    const h = Math.round(video.videoHeight * ratio)

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    const mini = document.createElement('canvas')
    mini.width = 24
    mini.height = 48
    const miniCtx = mini.getContext('2d', { willReadFrequently: true })

    const gardees = []
    let dernisEmpreinte = null
    let framesNonVides = 0
    const instants = []
    for (let t = 0.1; t < duree - 0.05; t += pas) instants.push(t)
    if (instants.length === 0) instants.push(0.1)

    for (let i = 0; i < instants.length; i++) {
      await chercherPosition(video, instants[i])
      const emp = empreinte(miniCtx, video, w, h)
      surProgression(i + 1, instants.length, gardees.length)
      if (variance(emp) < SEUIL_VARIANCE) continue // image unie (noir, blanc)
      framesNonVides += 1
      if (dernisEmpreinte && diffMoyenne(emp, dernisEmpreinte) < SEUIL_DIFF) continue // doublon
      dernisEmpreinte = emp
      ctx.drawImage(video, 0, 0, w, h)
      gardees.push(canvas.toDataURL('image/jpeg', 0.8))
    }

    if (framesNonVides === 0) {
      // Décodé « en apparence » mais images vides : codec non rendu par ce navigateur.
      throw erreurVideo('decode', 'images illisibles dans la vidéo')
    }
    if (gardees.length === 0) {
      throw erreurVideo('decode', 'aucune image exploitable')
    }

    // Plus de 12 images distinctes : échantillonnage régulier (début et fin inclus).
    if (gardees.length > CIBLE_IMAGES) {
      const choisies = []
      for (let i = 0; i < CIBLE_IMAGES; i++) {
        choisies.push(gardees[Math.round((i * (gardees.length - 1)) / (CIBLE_IMAGES - 1))])
      }
      return choisies
    }
    return gardees
  } finally {
    URL.revokeObjectURL(url)
    video.removeAttribute('src')
  }
}
