// Dresse la liste des photos réellement présentes dans public/photos/.
//
// Les emplacements photo de l'accueil sont hachurés tant que le fichier n'est
// pas livré. Sans cette liste, le composant demandait quand même l'image : en
// production le repli renvoyait du HTML en 200 (8 Ko par emplacement, image
// cassée), et une fois ce repli corrigé, trois 404 dans la console.
//
// Lancé automatiquement avant chaque build (script `prebuild`). Déposer un
// fichier dans public/photos/ suffit : il apparaît au build suivant.
import { readdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DOSSIER = join(ROOT, 'public', 'photos')
const SORTIE = join(ROOT, 'src', 'data', 'photosDisponibles.js')

const photos = existsSync(DOSSIER)
  ? readdirSync(DOSSIER).filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f)).sort()
  : []

const contenu = `// Fichier GÉNÉRÉ par scripts/photos-disponibles.mjs — ne pas modifier à la main.
// Photos effectivement présentes dans public/photos/ au moment du build.
export const PHOTOS_DISPONIBLES = ${JSON.stringify(photos, null, 2)}
`

// N'écrire que si le contenu change, pour ne pas invalider le cache de build.
if (!existsSync(SORTIE) || readFileSync(SORTIE, 'utf8') !== contenu) {
  writeFileSync(SORTIE, contenu)
}
console.log(`photos disponibles : ${photos.length}${photos.length ? ` (${photos.join(', ')})` : ' — emplacements hachurés'}`)
