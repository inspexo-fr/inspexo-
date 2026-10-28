#!/usr/bin/env node
// Éval du MODE ENREGISTREMENT D'ÉCRAN, de bout en bout et par le VRAI front :
// pour chaque cas tests/eval-video/<cas>/ (enregistrement.webm|mp4|mov +
// expected.json), le navigateur (chromium ; webkit pour les .mov HEVC d'iPhone)
// ouvre /score servi depuis build/, charge la vidéo dans l'input, laisse le
// NAVIGATEUR extraire les images, puis la fonction `extraction` lire le texte,
// vérifie le texte extrait, lance l'analyse et mesure le COÛT TOTAL
// (extraction + analyse) — objectif < 0,20 €.
// Le bypass d'éval est injecté au niveau réseau (x-eval-secret, no_cache) :
// la page reste strictement celle de prod.
// Usage : node tests/eval-video/run.mjs [nom-de-cas]
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium, webkit, devices } = require('playwright')

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const EVAL_DIR = join(ROOT, 'tests', 'eval-video')
const PORT = 4173

// ---------- env ----------
const env = {}
for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)="?([^"\n]*)"?$/)
  if (m) env[m[1]] = m[2]
}
if (!env.EVAL_BYPASS_SECRET) {
  console.error('EVAL_BYPASS_SECRET manquant dans .env.local')
  process.exit(2)
}

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// ---------- serveur statique du build ----------
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon', '.map': 'application/json' }
const BUILD = join(ROOT, 'build')
if (!existsSync(join(BUILD, 'index.html'))) {
  console.error('build/ absent — lancez `npx react-scripts build` d\'abord.')
  process.exit(2)
}
const serveur = createServer((req, res) => {
  const chemin = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  let fichier = join(BUILD, chemin)
  if (!existsSync(fichier) || statSync(fichier).isDirectory()) fichier = join(BUILD, 'index.html')
  res.writeHead(200, { 'Content-Type': TYPES[extname(fichier)] || 'application/octet-stream' })
  res.end(readFileSync(fichier))
}).listen(PORT)

// ---------- cas ----------
const seul = process.argv[2]
const cas = readdirSync(EVAL_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((n) => !seul || n === seul)
  .filter((n) => ['webm', 'mp4', 'mov'].some((ext) => existsSync(join(EVAL_DIR, n, `enregistrement.${ext}`))))
  .sort()

if (cas.length === 0) {
  console.log('Aucun cas vidéo (déposer tests/eval-video/<cas>/enregistrement.webm|mp4|mov + expected.json).')
  serveur.close()
  process.exit(0)
}

let echecs = 0
console.log(`Éval vidéo — ${cas.length} cas (coût cible < 0,20 €/analyse)\n`)

for (const nom of cas) {
  const dossier = join(EVAL_DIR, nom)
  const ext = ['webm', 'mp4', 'mov'].find((e) => existsSync(join(dossier, `enregistrement.${e}`)))
  const videoPath = join(dossier, `enregistrement.${ext}`)
  const expected = JSON.parse(readFileSync(join(dossier, 'expected.json'), 'utf8'))
  // Les .mov d'iPhone sont en HEVC : chromium ne les décode pas, webkit (macOS) oui.
  const moteur = ext === 'mov' ? webkit : chromium
  const t0 = Date.now()
  const erreurs = []
  const couts = { extraction: null, analyse: null }

  const browser = await moteur.launch()
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'fr-FR' })
  const page = await ctx.newPage()

  // Bypass d'éval injecté au niveau réseau — la page reste celle de prod.
  await page.route('**/functions/v1/extraction', (route) =>
    route.continue({ headers: { ...route.request().headers(), 'x-eval-secret': env.EVAL_BYPASS_SECRET } }))
  await page.route('**/functions/v1/score', (route) => {
    const corps = JSON.parse(route.request().postData() || '{}')
    corps.no_cache = true
    corps.progressive = false // réponse synchrone → cout_eur mesurable
    return route.continue({
      headers: { ...route.request().headers(), 'x-eval-secret': env.EVAL_BYPASS_SECRET },
      postData: JSON.stringify(corps),
    })
  })
  page.on('response', async (rep) => {
    try {
      if (rep.url().includes('/functions/v1/extraction') && rep.status() === 200) {
        couts.extraction = (await rep.json()).cout_eur ?? null
      }
      if (rep.url().includes('/functions/v1/score') && rep.status() === 200) {
        couts.analyse = (await rep.json()).cout_eur ?? null
      }
    } catch (_) { /* réponse non JSON */ }
  })

  try {
    await page.goto(`http://localhost:${PORT}/score`, { waitUntil: 'networkidle' })
    // La vidéo part dans l'input caché du mode enregistrement d'écran.
    await page.setInputFiles('input[accept="video/*"]', videoPath)

    // Extraction navigateur + lecture du texte (fonction extraction).
    await page.waitForSelector('text=Texte extrait de la vidéo', { timeout: 150000 })
    const texte = await page.locator('.score-textarea').inputValue()
    const nbPhotos = await page.locator('img[alt^="Capture"]').count()

    for (const attendu of expected.texte_must_include ?? []) {
      const alts = Array.isArray(attendu) ? attendu : [attendu]
      if (!alts.some((a) => norm(texte).includes(norm(a)))) {
        erreurs.push(`texte extrait : "${alts.join('|')}" manquant`)
      }
    }
    if (expected.images_vehicule_min != null && nbPhotos < expected.images_vehicule_min) {
      erreurs.push(`photos véhicule ${nbPhotos} < min ${expected.images_vehicule_min}`)
    }

    // Analyse complète (texte extrait + photos du véhicule).
    await page.locator('button[type="submit"]').click()
    await page.waitForURL('**/a/**', { timeout: 180000 })
    await page.waitForSelector('text=/ 100', { timeout: 30000 })

    const total = (couts.extraction ?? 0) + (couts.analyse ?? 0)
    const plafond = expected.cout_max_eur ?? 0.20
    if (couts.extraction == null || couts.analyse == null) {
      erreurs.push(`coût non mesuré (extraction=${couts.extraction}, analyse=${couts.analyse})`)
    } else if (total > plafond) {
      erreurs.push(`coût ${total.toFixed(3)} € > ${plafond.toFixed(2)} €`)
    }

    const duree = ((Date.now() - t0) / 1000).toFixed(1)
    if (erreurs.length === 0) {
      console.log(`▶ ${nom} (${ext}, ${moteur === webkit ? 'webkit' : 'chromium'})`)
      console.log(`  PASS (${duree}s) — texte ${texte.length} car. · ${nbPhotos} photo(s) véhicule · coût ${((couts.extraction ?? 0) + (couts.analyse ?? 0)).toFixed(3)} € (extraction ${couts.extraction?.toFixed(3)} + analyse ${couts.analyse?.toFixed(3)})\n`)
    } else {
      echecs++
      console.log(`▶ ${nom} (${ext})\n  FAIL (${duree}s)`)
      for (const e of erreurs) console.log(`    ✗ ${e}`)
      console.log('')
    }
  } catch (e) {
    echecs++
    console.log(`▶ ${nom}\n  FAIL — ${String(e.message).slice(0, 200)}\n`)
  } finally {
    await browser.close()
  }
}

serveur.close()
console.log(echecs === 0 ? `✓ ${cas.length}/${cas.length} cas vidéo passent` : `✗ ${echecs}/${cas.length} cas échouent`)
process.exit(echecs === 0 ? 0 : 1)
