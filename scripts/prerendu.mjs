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
import { FAMILLES_MOTEUR } from '../src/data/famillesMoteur.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BUILD = join(ROOT, 'build')
const SITE = 'https://www.inspexo.io'
const PORT = 4123

if (!existsSync(join(BUILD, 'index.html'))) {
  console.error('build/ absent : lancez `npm run build` avant le pré-rendu.')
  process.exit(1)
}

// build/index.html n'est JAMAIS écrit par ce script : il reste la sortie CRA
// intacte, qui sert de repli à toutes les routes (vercel.json). C'est ce qui
// rend le pré-rendu sans danger — s'il ne tourne pas, ou s'il échoue, chaque
// page est simplement rendue par React comme avant, jamais une erreur 404.
// Corollaire : l'accueil n'est pas pré-rendu. Mesuré, il y perdait de toute
// façon (FCP 3,2 s contre 1,8 s) pour un contenu que Google rend déjà.

// En local les identifiants sont dans .env.local ; sur Vercel ce sont les
// variables du projet (les mêmes que CRA utilise pour le build).
const fichierEnv = join(ROOT, '.env.local')
const env = existsSync(fichierEnv)
  ? Object.fromEntries(
      readFileSync(fichierEnv, 'utf8')
        .split('\n').filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
        .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
    )
  : process.env

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
      // Toute route sans extension est servie par la coquille : on veut rendre
      // la page depuis React, jamais resservir un pré-rendu antérieur.
      if (!existsSync(fichier) || !extname(fichier)) fichier = join(BUILD, 'index.html')
      res.writeHead(200, { 'Content-Type': TYPES[extname(fichier)] || 'application/octet-stream' })
      res.end(readFileSync(fichier))
    })
    serveur.listen(PORT, () => resolve(serveur))
  })
}

// Le pré-rendu est la raison d'être des pages publiques : sans lui, Google
// reçoit une page vide. Il ne doit donc JAMAIS être sauté en silence — un
// build qui s'arrête se voit, une page sans contenu se découvre des semaines
// plus tard dans la Search Console.

// Drapeaux indispensables en conteneur : pas de bac à sable utilisable, et
// /dev/shm y est trop petit pour Chromium.
const DRAPEAUX_CONTENEUR = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']

/**
 * Drapeaux de @sparticuz/chromium que Playwright ne supporte PAS.
 * `--single-process` est taillé pour une fonction Lambda qui rend une page et
 * s'arrête ; Playwright a besoin de plusieurs processus et le navigateur meurt
 * au démarrage s'il est posé (« Target page, context or browser has been
 * closed »). `--headless` est posé par Playwright lui-même, et le doublon
 * — qui plus est avec des guillemets dans la valeur — le fait échouer.
 * `--disable-web-security` n'a aucune raison d'être ici : on rend nos pages.
 */
const DRAPEAUX_INCOMPATIBLES = /^--(single-process|no-zygote|headless|disable-web-security)/

/**
 * Démarre un navigateur, en essayant d'abord Playwright tel quel (poste de
 * travail), puis un Chromium empaqueté pour conteneur serverless.
 *
 * Pourquoi ce second essai : l'image de build de Vercel est une Amazon Linux.
 * `npx playwright install chromium` y télécharge bien un binaire, mais c'est
 * une build Ubuntu de repli (« your OS is not officially supported ») à
 * laquelle il manque les bibliothèques système — elle meurt au démarrage
 * (« Target page, context or browser has been closed », constaté le 29/10).
 * `@sparticuz/chromium` embarque les siennes et ne dépend pas de l'image.
 */
async function lancerNavigateur() {
  const essais = []
  try {
    const { chromium } = await import('playwright')
    return await chromium.launch({ args: DRAPEAUX_CONTENEUR })
  } catch (e) {
    essais.push(`playwright : ${e.message.split('\n')[0]}`)
  }
  try {
    const { chromium } = await import('playwright-core')
    const empaquete = (await import('@sparticuz/chromium')).default
    const executablePath = await empaquete.executablePath()
    console.log(`  (navigateur empaqueté : ${executablePath})`)
    const args = [
      ...new Set([
        ...empaquete.args.filter((a) => !DRAPEAUX_INCOMPATIBLES.test(a)),
        ...DRAPEAUX_CONTENEUR,
      ]),
    ]
    return await chromium.launch({ executablePath, args })
  } catch (e) {
    essais.push(`@sparticuz/chromium : ${e.message.split('\n')[0]}`)
  }
  const erreur = new Error(essais.join(' | '))
  erreur.essais = essais
  throw erreur
}

const moteurs = await famillesPubliees()
console.log(`Pré-rendu — ${moteurs.length} page(s) moteur publiable(s)\n`)

// Les routes privées (dossier, visite, admin, résultat) ne sont PAS pré-rendues :
// elles portent des données personnelles ou changent à chaque visite.
const ROUTES = [
  { url: '/score', attendre: '.formcard', priorite: '0.9' },
  { url: '/pass', attendre: '.plans', priorite: '0.8' },
  { url: '/airbags-takata', attendre: '.faq details', priorite: '0.9' },
  { url: '/moteur', attendre: '.rows', priorite: '0.8', figer: true },
  { url: '/extension', attendre: '.channels', priorite: '0.6' },
  { url: '/fiabilite', attendre: 'h1', priorite: '0.6' },
  { url: '/cgu', attendre: '.legal-h1', priorite: '0.3' },
  { url: '/cgv-pass', attendre: '.legal-h1', priorite: '0.3' },
  { url: '/mentions-legales', attendre: '.legal-h1', priorite: '0.3' },
  { url: '/politique-de-confidentialite', attendre: '.legal-h1', priorite: '0.3' },
  { url: '/extension/confidentialite', attendre: '.rows', priorite: '0.3' },
  ...moteurs.map((f) => ({ url: `/moteur/${f.slug}`, attendre: '#pannes .row', priorite: '0.8', figer: true })),
]

const serveur = await servir()
let nav
try {
  nav = await lancerNavigateur()
} catch (e) {
  serveur.close()
  console.error('\n✗ PRÉ-RENDU IMPOSSIBLE — aucun navigateur n\'a démarré.')
  for (const essai of e.essais ?? [e.message]) console.error(`  · ${essai}`)
  console.error('\n  Sans pré-rendu, /moteur/* et /airbags-takata arrivent VIDES pour les')
  console.error('  moteurs de recherche. Le build s\'arrête plutôt que de livrer ça.')
  console.error('  Replis documentés : docs/prerendu.md\n')
  process.exit(1)
}
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
    const dossier = join(BUILD, route.url)
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
const urls = [{ url: '/', priorite: '1.0' }, ...faits]
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((r) => `  <url>
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

Sitemap: ${SITE}/sitemap.xml
`)

console.log(`\n— ${faits.length} page(s) pré-rendue(s), ${echecs} échec(s)`)
console.log(`— sitemap.xml : ${urls.length} URL · robots.txt écrit`)
if (echecs > 0) {
  console.error(`\n✗ ${echecs} route(s) non pré-rendue(s) : elles arriveraient vides pour`)
  console.error('  les moteurs de recherche. Le build s\'arrête.\n')
  process.exit(1)
}

// Garde-fou de dernier recours : un pré-rendu qui « réussit » en ne produisant
// presque rien est le scénario le plus dangereux, parce qu'il ne se voit pas.
const ATTENDU_MINIMUM = 10
if (faits.length < ATTENDU_MINIMUM) {
  console.error(`\n✗ ${faits.length} page(s) pré-rendue(s) seulement, moins que le minimum`)
  console.error(`  attendu (${ATTENDU_MINIMUM}). Quelque chose a échoué sans le dire.\n`)
  process.exit(1)
}
