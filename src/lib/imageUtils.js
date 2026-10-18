// Redimensionnement des captures côté client avant envoi à l'analyse.
// - 1600 px max sur le plus grand côté
// - réencodage JPEG via canvas : supprime TOUTES les métadonnées EXIF
//   (GPS, numéro de série de l'appareil, etc.) — seuls les pixels partent.
// Les images ne sont jamais stockées côté serveur.

const MAX_DIM = 1600
const JPEG_QUALITY = 0.85

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload  = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image illisible')) }
    img.src = url
  })
}

/**
 * @param {File} file
 * @returns {Promise<string>} data URL JPEG (data:image/jpeg;base64,...)
 */
export async function resizeImageToDataUrl(file) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Ce fichier n\'est pas une image.')
  }
  const img = await loadImage(file)
  const { naturalWidth: w, naturalHeight: h } = img
  const scale = Math.min(1, MAX_DIM / Math.max(w, h))
  const outW = Math.max(1, Math.round(w * scale))
  const outH = Math.max(1, Math.round(h * scale))

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, outW, outH)
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}
