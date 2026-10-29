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

// build/index.html finit par porter l'ACCUEIL pré-rendu. Il ne peut donc plus
// servir de coquille de repli : une route dynamique (/a/:id, /dossier) servie
// par ce fichier afficherait l'accueil le temps que React se reconstruise.
// On met donc de côté la coquille vierge du build, que Vercel sert en repli
// (voir vercel.json) et que ce script réutilise pour rendre chaque route —
// ce qui rend les passages successifs idempotents.
const COQUILLE = join(BUILD, 'coquille.html')
const indexBrut = readFileSync(join(BUILD, 'index.html'), 'utf8')
if (!indexBrut.includes('data-prerendu')) {
  writeFileSync(COQUILLE, indexBrut)
} else if (!existsSync(COQUILLE)) {
  console.error('build/index.html est déjà pré-rendu et build/coquille.html manque : relancez `npm run build`.')
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
      // Toute route sans extension est servie par la coquille VIERGE : on veut
      // rendre la page depuis React, jamais resservir un pré-rendu antérieur.
      if (!existsSync(fichier) || !extname(fichier) || chemin === '/index.html') fichier = COQUILLE
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
  { url: '/moteur', attendre: '.rows', priorite: '0.8', figer: true },
  { url: '/extension', attendre: '.channels', priorite: '0.6' },
  { url: '/fiabilite', attendre: 'h1', priorite: '0.6' },
  { url: '/cgu', attendre: '.legal-h1', priorite: '0.3' },
  { url: '/mentions-legales', attendre: '.legal-h1', priorite: '0.3' },
  { url: '/politique-de-confidentialite', attendre: '.legal-h1', priorite: '0.3' },
  { url: '/extension/confidentialite', attendre: '.rows', priorite: '0.3' },
  ...moteurs.map((f) => ({ url: `/moteur/${f.slug}`, attendre: '#pannes .row', priorite: '0.8', figer: true })),
]

const serveur = await servir()
const nav = await chromium.launch()
const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()
const faits = []
let echecs = 0

// Fragments JS réellement demandés par la route en cours : les routes sont
// chargées à la demande (React.lazy), donc le navigateur ne découvre le
// fragment de la page qu'après avoir exécuté le fragment principal. On relève
// ici lesquels, pour les précharger depuis le HTML et supprimer cet
// aller-retour en cascade.
let fragments = new Set()
page.on('request', (r) => {
  const u = new URL(r.url()).pathname
  if (/^\/static\/js\/.*\.js$/.test(u)) fragments.add(u)
})

for (const route of ROUTES) {
  try {
    fragments = new Set()
    await page.goto(`http://localhost:${PORT}${route.url}`, { waitUntil: 'networkidle', timeout: 45_000 })
    await page.waitForSelector(route.attendre, { timeout: 20_000 })
    await page.waitForTimeout(350)
    let html = await page.content()
    // Les chemins restent absolus (le build CRA sert /static/...), on marque
    // seulement la page comme pré-rendue pour le diagnostic.
    html = html.replace('<html', '<html data-prerendu="1"')
    // Les données déjà chargées sont figées dans le HTML : le premier rendu
    // client redevient identique au pré-rendu, donc React hydrate au lieu de
    // reconstruire (sans cela le contenu disparaît le temps que le bundle
    // s'exécute). Voir src/lib/prerendu.js.
    // Préchargement des fragments que le HTML ne référence pas encore : leur
    // téléchargement part en parallèle du fragment principal au lieu de
    // l'attendre.
    const aPrecharger = [...fragments].filter((f) => !html.includes(f)).sort()
    if (aPrecharger.length > 0) {
      html = html.replace(
        '</head>',
        `${aPrecharger.map((f) => `<link rel="preload" as="script" href="${f}">`).join('')}</head>`,
      )
    }
    // On ne fige les données que là où elles SONT le contenu de la page : sur
    // une fiche moteur, la lecture en base retarde l'affichage du texte utile.
    // Sur l'accueil, le dossier d'exemple est sous la ligne de flottaison et
    // ne retarde rien — l'y figer coûtait 18,6 Ko de HTML sur 54 (FCP 3,0 s
    // contre 2,4 s), pour aucun gain visible.
    const charge = route.figer ? await page.evaluate(() => window.__DONNEES_PAGE__ ?? null) : null
    if (charge) {
      // JSON.parse d'une chaîne : aucune interprétation de balise possible,
      // et « < » est échappé pour ne jamais fermer le <script>.
      const litteral = JSON.stringify(JSON.stringify(charge)).replace(/</g, '\\u003c')
      html = html.replace(
        '</head>',
        `<script>window.__PRERENDU__=JSON.parse(${litteral})</script></head>`,
      )
    }
    const dossier = route.url === '/' ? BUILD : join(BUILD, route.url)
    mkdirSync(dossier, { recursive: true })
    writeFileSync(join(dossier, 'index.html'), html)
    const texte = await page.evaluate(() => document.body.innerText.length)
    faits.push(route)
    console.log(`  ✓ ${route.url.padEnd(34)} ${Math.round(html.length / 1024)} Ko · ${texte} caractères lisibles · ${aPrecharger.length} fragment(s) préchargé(s)${charge ? ' · données figées' : ''}`)
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
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${faits.map((r) => `  <url>
    <loc>${SITE}${r.url === '/' ? '/' : r.url}</loc>
    <lastmod>${aujourdhui}</lastmod>
    <priority>${r.priorite}</priority>
  </url>`).join('\n')}
</urlset>
`
writeFileSync(join(BUILD, 'sitemap.xml'), sitemap)

writeFileSync(join(BUILD, 'robots.txt'), `User-agent: *
Allow: /
# Pages personnelles ou propres à une analyse : inutiles dans l'index.
Disallow: /a/
Disallow: /dossier
Disallow: /admin
Disallow: /dashboard
Disallow: /expert
# Coquille de repli des routes dynamiques : sans contenu, jamais liée.
Disallow: /coquille.html

Sitemap: ${SITE}/sitemap.xml
`)

console.log(`\n— ${faits.length} page(s) pré-rendue(s), ${echecs} échec(s)`)
console.log(`— sitemap.xml : ${faits.length} URL · robots.txt écrit`)
if (echecs > 0) process.exit(1)
