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
import { ajouterNoindex, doublonsMeta, estIndexable, gardee, metaDe, pairesProches, SEUIL_SIMILARITE, SOURCE_RANG_PARC } from './seo.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BUILD = join(ROOT, 'build')
const SITE = 'https://www.inspexo.io'
const PORT = 4123

if (!existsSync(join(BUILD, 'index.html'))) {
  console.error('build/ absent : lancez `npm run build` avant le pré-rendu.')
  process.exit(1)
}

// ⚠️ CHANTIER DESIGN (nov. 2026, décision d'Utku) — L'ACCUEIL EST PRÉ-RENDU.
// Avant, build/index.html restait la coquille CRA et servait de repli à toutes
// les routes ; l'accueil n'était donc PAS pré-rendu, et un lecteur sans
// JavaScript, Facebook ou WhatsApp n'en recevaient que « Vous devez activer
// JavaScript » — ni h1, ni lien, ni description, ni og:image.
// Désormais la coquille CRA est COPIÉE en build/app.html AVANT tout pré-rendu,
// et c'est elle le repli (vercel.json et le serveur local ci-dessous) : une
// route inconnue reçoit toujours la coquille, jamais le HTML de l'accueil.
// build/index.html devient l'accueil pré-rendu.
const COQUILLE = join(BUILD, 'app.html')
{
  const index = readFileSync(join(BUILD, 'index.html'), 'utf8')
  if (!index.includes('data-prerendu')) writeFileSync(COQUILLE, index)
  if (!existsSync(COQUILLE)) {
    console.error('build/app.html absent et build/index.html déjà pré-rendu : relancez `npm run build`.')
    process.exit(1)
  }
}

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
      if (!existsSync(fichier) || !extname(fichier)) fichier = COQUILLE
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

/** Pages modèle publiables (sprint 23, lot 3), d'après la fonction serveur
 *  qui applique le classement des sources. Un échec ARRÊTE le build : une
 *  liste vide servie en silence retirerait les pages du sitemap. */
async function modelesPublies() {
  const res = await fetch(`${env.REACT_APP_SUPABASE_URL}/functions/v1/modele-public?liste=1`, {
    headers: { apikey: env.REACT_APP_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.REACT_APP_SUPABASE_ANON_KEY}` },
  }).catch((e) => ({ ok: false, status: String(e) }))
  const json = res.ok ? await res.json().catch(() => null) : null
  if (!Array.isArray(json?.pages)) {
    console.error(`\n✗ modele-public?liste=1 injoignable (${res.status}) : pré-rendu des pages modèle impossible.`)
    process.exit(1)
  }
  return json.pages
}
const modeles = await modelesPublies()
console.log(`Pré-rendu — ${modeles.length} page(s) modèle publiable(s)\n`)

// Les routes privées (dossier, visite, admin, résultat) ne sont PAS pré-rendues :
// elles portent des données personnelles ou changent à chaque visite.
const ROUTES = [
  // L'accueil : l'extrait du dossier réel est au premier écran, ses données
  // sont donc figées (elles SONT le contenu visible).
  { url: '/', attendre: '.extrait-haut', priorite: '1.0', figer: true },
  { url: '/score', attendre: '.formcard', priorite: '0.9' },
  { url: '/pass', attendre: '.plans', priorite: '0.8' },
  { url: '/airbags-takata', attendre: '.faq details', priorite: '0.9' },
  { url: '/moteur', attendre: '.rows', priorite: '0.8', figer: true },
  { url: '/extension', attendre: '.channels', priorite: '0.6' },
  { url: '/pro', attendre: '.channels', priorite: '0.7' },
  { url: '/pro/api', attendre: '.doc-sec', priorite: '0.6' },
  { url: '/fiabilite', attendre: 'h1', priorite: '0.6' },
  { url: '/cgu', attendre: '.legal-h1', priorite: '0.3' },
  { url: '/cgv-pass', attendre: '.legal-h1', priorite: '0.3' },
  { url: '/cgv-inspection', attendre: '.legal-h1', priorite: '0.3' },
  { url: '/cgv-visio', attendre: '.legal-h1', priorite: '0.3' },
  { url: '/mentions-legales', attendre: '.legal-h1', priorite: '0.3' },
  { url: '/politique-de-confidentialite', attendre: '.legal-h1', priorite: '0.3' },
  { url: '/extension/confidentialite', attendre: '.rows', priorite: '0.3' },
  ...moteurs.map((f) => ({ url: `/moteur/${f.slug}`, attendre: '#pannes .row', priorite: '0.8', figer: true })),
  { url: '/modele', attendre: '#modeles li', priorite: '0.7', figer: true },
  { url: '/methode', attendre: '.legal-h1', priorite: '0.6' },
  { url: '/qui-sommes-nous', attendre: '.legal-h1', priorite: '0.4' },
  ...modeles.map((m) => ({ url: `/modele/${m.slug_marque}/${m.slug}`, attendre: '#pannes .row', priorite: '0.7', figer: true })),
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
// Le bandeau cookies n'a pas sa place dans le HTML statique : sans JavaScript
// il ne fonctionne pas, et React l'affiche à l'ouverture si le choix n'est pas
// fait. On simule donc un choix déjà fait, le temps du pré-rendu seulement.
await ctx.addInitScript(() => { try { localStorage.setItem('inspexo_cookies_accepted', 'true') } catch (_) { /* rien */ } })
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
    // Sur l'accueil, l'extrait du dossier réel est désormais au PREMIER écran
    // (chantier design, nov. 2026) : ses données sont figées elles aussi.
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

// ---- SPRINT 24 (SEO) : anti-doublon, indexabilité, unicité des balises ----
const lireHtml = (url) => readFileSync(join(BUILD, url, 'index.html'), 'utf8')
const infosModele = Object.fromEntries(modeles.map((m) => [`/modele/${m.slug_marque}/${m.slug}`, m]))
const candidatesModele = faits
  .filter((r) => r.url.startsWith('/modele/'))
  .map((r) => ({ url: r.url, html: lireHtml(r.url) }))
  .filter((p) => estIndexable(p.html, `${SITE}${p.url}`))
const paires = pairesProches(candidatesModele, SEUIL_SIMILARITE)
const ecartees = new Map()
for (const pr of paires) {
  if (ecartees.has(pr.a) || ecartees.has(pr.b)) continue
  const g = gardee(pr.a, pr.b, infosModele)
  const perdante = g.garde === pr.a ? pr.b : pr.a
  ecartees.set(perdante, { ...pr, gardee: g.garde, motif: g.motif })
}
for (const url of ecartees.keys()) {
  const chemin = join(BUILD, url, 'index.html')
  writeFileSync(chemin, ajouterNoindex(readFileSync(chemin, 'utf8')))
}
const indexables = faits.filter((r) => estIndexable(lireHtml(r.url === '/' ? '' : r.url), `${SITE}${r.url === '/' ? '/' : r.url}`))
const nonIndexees = faits.filter((r) => !indexables.includes(r)).map((r) => {
  const m = metaDe(lireHtml(r.url === '/' ? '' : r.url))
  const e = ecartees.get(r.url)
  return { url: r.url, raison: e ? `trop proche de ${e.gardee} (${e.similarite}) — ${e.motif}` : m.canonique && m.canonique !== `${SITE}${r.url}` ? `vrai doublon : canonique vers ${m.canonique}` : 'sous le seuil d\'indexation' }
})
const doublons = doublonsMeta(indexables.map((r) => ({ url: r.url, meta: metaDe(lireHtml(r.url === '/' ? '' : r.url)) })))
writeFileSync(join(BUILD, 'seo-rapport.json'), JSON.stringify({
  genere_le: new Date().toISOString(),
  pages_pre_rendues: faits.length,
  pages_indexables: indexables.length,
  non_indexees: nonIndexees,
  paires_trop_proches: paires,
  seuil_similarite: SEUIL_SIMILARITE,
  source_rang_parc: SOURCE_RANG_PARC,
  doublons_balises: doublons,
  sitemap: `${SITE}/sitemap.xml`,
}, null, 1))
console.log(`\n— SEO : ${indexables.length} page(s) indexable(s) sur ${faits.length} · ${nonIndexees.length} en noindex ou canonisée(s) · ${paires.length} paire(s) ≥ ${SEUIL_SIMILARITE}`)
if (doublons.titres.length || doublons.descriptions.length || doublons.sans_description.length) {
  console.error('\n✗ Titres ou descriptions en double (ou absents) parmi les pages indexables :')
  console.error(JSON.stringify(doublons, null, 1).slice(0, 2000))
  process.exit(1)
}

// ---- sitemap.xml : uniquement les pages réellement produites ----
const aujourdhui = new Date().toISOString().slice(0, 10)
// Le sitemap ne liste que les pages INDEXABLES (ni noindex, ni canonique ailleurs).
const urls = indexables.some((r) => r.url === '/') ? indexables : [{ url: '/', priorite: '1.0' }, ...indexables]
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
