// SPRINT 6 — Pré-rendu statique des pages publiques (le site est en CRA).
//
// Google lit de mieux en mieux le JavaScript, mais il ne faut pas en dépendre
// pour des pages dont tout l'intérêt est le contenu. Ce script sert le build,
// visite chaque route publique dans un vrai navigateur, attend que le contenu
// soit là, puis écrit le HTML rendu dans build/<route>/index.html. Vercel sert
// ce fichier avant le fallback SPA, et React reprend la main à l'hydratation.
//
// Il produit aussi sitemap.xml et robots.txt à partir des pages réellement
// publiées : une famille moteur sans fiche au seuil n'y figure pas.
//
// Usage : node scripts/prerendu.mjs   (après npm run build)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'
import { extname } from 'node:path'
import { chromium } from 'playwright'
import { FAMILLES_MOTEUR } from '../src/data/famillesMoteur.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BUILD = join(ROOT, 'build')
const SITE = 'https://www.inspexo.io'
const PORT = 4123

if (!existsSync(join(BUILD, 'index.html'))) {
  console.error('build/ absent : lancez `npm run build` avant le pré-rendu.')
  process.exit(1)
}

const env = Object.fromEntries(
  readFileSync(join(ROOT, '.env.local'), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)

/** Familles réellement publiables, d'après la base (jamais une liste en dur). */
async function famillesPubliees() {
  const res = await fetch(`${env.REACT_APP_SUPABASE_URL}/rest/v1/rpc/list_moteurs_publies`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: env.REACT_APP_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.REACT_APP_SUPABASE_ANON_KEY}`,
    },
    body: '{}',
  })
  const data = await res.json().catch(() => [])
  const cle = (m, f) => `${String(m).toLowerCase()}|${String(f).toUpperCase().replace(/[^A-Z0-9]/g, '')}`
  const publiees = new Set((Array.isArray(data) ? data : []).map((d) => cle(d.marque, d.famille_moteur)))
  return FAMILLES_MOTEUR.filter((f) => publiees.has(cle(f.marque, f.famille)))
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon', '.txt': 'text/plain', '.woff2': 'font/woff2', '.map': 'application/json' }
function servir() {
  return new Promise((resolve) => {
    const serveur = createServer((req, res) => {
      const chemin = decodeURIComponent(new URL(req.url, 'http://x').pathname)
      let fichier = join(BUILD, chemin)
      if (!existsSync(fichier) || !extname(fichier)) fichier = join(BUILD, 'index.html')
      res.writeHead(200, { 'Content-Type': TYPES[extname(fichier)] || 'application/octet-stream' })
      res.end(readFileSync(fichier))
    })
    serveur.listen(PORT, () => resolve(serveur))
  })
}

const moteurs = await famillesPubliees()
console.log(`Pré-rendu — ${moteurs.length} page(s) moteur publiable(s)\n`)

// Les routes privées (dossier, visite, admin, résultat) ne sont PAS pré-rendues :
// elles portent des données personnelles ou changent à chaque visite.
const ROUTES = [
  { url: '/', attendre: '.hero h1', priorite: '1.0' },
  { url: '/score', attendre: '.formcard', priorite: '0.9' },
  { url: '/pass', attendre: '.plans', priorite: '0.8' },
  { url: '/airbags-takata', attendre: '.faq details', priorite: '0.9' },
  { url: '/moteur', attendre: '.rows', priorite: '0.8' },
  { url: '/extension', attendre: '.channels', priorite: '0.6' },
  { url: '/fiabilite', attendre: 'h1', priorite: '0.6' },
  { url: '/cgu', attendre: '.legal-h1', priorite: '0.3' },
  { url: '/mentions-legales', attendre: '.legal-h1', priorite: '0.3' },
  { url: '/politique-de-confidentialite', attendre: '.legal-h1', priorite: '0.3' },
  { url: '/extension/confidentialite', attendre: '.rows', priorite: '0.3' },
  ...moteurs.map((f) => ({ url: `/moteur/${f.slug}`, attendre: '#pannes .row', priorite: '0.8' })),
]

const serveur = await servir()
const nav = await chromium.launch()
const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()
const faits = []
let echecs = 0

for (const route of ROUTES) {
  try {
    await page.goto(`http://localhost:${PORT}${route.url}`, { waitUntil: 'networkidle', timeout: 45_000 })
    await page.waitForSelector(route.attendre, { timeout: 20_000 })
    await page.waitForTimeout(350)
    let html = await page.content()
    // Les chemins restent absolus (le build CRA sert /static/...), on marque
    // seulement la page comme pré-rendue pour le diagnostic.
    html = html.replace('<html', '<html data-prerendu="1"')
    const dossier = route.url === '/' ? BUILD : join(BUILD, route.url)
    mkdirSync(dossier, { recursive: true })
    writeFileSync(join(dossier, 'index.html'), html)
    const texte = await page.evaluate(() => document.body.innerText.length)
    faits.push(route)
    console.log(`  ✓ ${route.url.padEnd(34)} ${Math.round(html.length / 1024)} Ko · ${texte} caractères lisibles`)
  } catch (e) {
    echecs++
    console.log(`  ✗ ${route.url.padEnd(34)} ${e.message.split('\n')[0]}`)
  }
}

await nav.close()
serveur.close()

// ---- sitemap.xml : uniquement les pages réellement produites ----
const aujourdhui = new Date().toISOString().slice(0, 10)
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemap.org/schemas/sitemap/0.9">
${faits.map((r) => `  <url>
    <loc>${SITE}${r.url === '/' ? '/' : r.url}</loc>
    <lastmod>${aujourdhui}</lastmod>
    <priority>${r.priorite}</priority>
  </url>`).join('\n')}
</urlset>
`.replace('http://www.sitemap.org', 'http://www.sitemaps.org')
writeFileSync(join(BUILD, 'sitemap.xml'), sitemap)

writeFileSync(join(BUILD, 'robots.txt'), `User-agent: *
Allow: /
# Pages personnelles ou propres à une analyse : inutiles dans l'index.
Disallow: /a/
Disallow: /dossier
Disallow: /admin
Disallow: /dashboard
Disallow: /expert

Sitemap: ${SITE}/sitemap.xml
`)

console.log(`\n— ${faits.length} page(s) pré-rendue(s), ${echecs} échec(s)`)
console.log(`— sitemap.xml : ${faits.length} URL · robots.txt écrit`)
if (echecs > 0) process.exit(1)
