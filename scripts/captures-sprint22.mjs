// Captures 390 px du sprint 22 : coût sur 3 ans (gratuit / Pass) et comparateur.
//
// ⚠️ LES DONNÉES SONT RÉELLES, lues sur la production par des chemins publics :
//   - l'analyse : `get_public_analysis` en anonyme (p_track = false) ;
//   - le coût « gratuit » : la fonction `cout-3ans` en anonyme ;
//   - le coût « Pass » et le comparateur : calculés ICI par les MÊMES modules
//     serveur, sur ces mêmes analyses. Seule différence avec la production :
//     les fourchettes `repair_costs` (service role) ne sont pas lues, donc une
//     ligne que seule une fourchette chiffrerait apparaît « à chiffrer ».
// Seule la SESSION (Pass) est simulée. Rien n'est inventé dans les données.
//
// Usage : node scripts/captures-sprint22.mjs   (après `npx react-scripts build`)
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { chromium } from 'playwright'
import { calculerCout3Ans } from '../supabase/functions/_shared/cout3ansSources.ts'
import { ficheDepuisAnalyse, recommander } from '../supabase/functions/_shared/comparateur.ts'

const RACINE = new URL('..', import.meta.url).pathname
const SORTIE = join(RACINE, 'captures-sprint22')
mkdirSync(SORTIE, { recursive: true })
const env = {}
for (const l of readFileSync(join(RACINE, '.env.local'), 'utf8').split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim() }
const U = env.REACT_APP_SUPABASE_URL, K = env.REACT_APP_SUPABASE_ANON_KEY
const H = { Authorization: `Bearer ${K}`, apikey: K, 'Content-Type': 'application/json' }
const post = async (chemin, corps) => (await fetch(`${U}${chemin}`, { method: 'POST', headers: H, body: JSON.stringify(corps) })).json()

const DOSSIERS = {
  '308': '1d6183af-77c1-4c07-8850-8958c9fa53c9',
  'Mercedes': '2da0f74d-d722-4ed7-b4af-5c361eca28df',
  'Clio II': '21068946-ac40-4a41-a0c6-e5ce995756be',
}
const PREFS = { km_an: 15000, region: 'Occitanie', cv: 5 }

const analyses = {}
for (const [nom, id] of Object.entries(DOSSIERS)) analyses[id] = await post('/rest/v1/rpc/get_public_analysis', { p_id: id, p_track: false })
const config = await post('/rest/v1/rpc/get_config_publique', {})
const migration = readFileSync(join(RACINE, 'supabase/migrations/20261125120000_sprint22_juge_cout.sql'), 'utf8')
const releve = JSON.parse(migration.match(/\('ct_prix', '(\{[\s\S]*?\})'::jsonb/)[1])
const ctx = { candidats: [], releve, bareme: config.carte_grise_tarifs ?? null }

// Petit serveur du build, avec le repli SPA de Vercel.
const BUILD = join(RACINE, 'build')
if (!existsSync(join(BUILD, 'index.html'))) { console.error('build/ absent : lancer npx react-scripts build'); process.exit(1) }
const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' }
const serveur = createServer((req, res) => {
  const p = join(BUILD, decodeURIComponent(req.url.split('?')[0]))
  const f = existsSync(p) && !p.endsWith('/') && extname(p) ? p : join(BUILD, 'index.html')
  res.writeHead(200, { 'Content-Type': TYPES[extname(f)] ?? 'application/octet-stream' })
  res.end(readFileSync(f))
}).listen(4179)

const navigateur = await chromium.launch()
const nouvellePage = async () => {
  const c = await navigateur.newContext({ viewport: { width: 390, height: 1600 }, deviceScaleFactor: 2, colorScheme: 'light' })
  await c.addInitScript((p) => {
    localStorage.setItem('inspexo_region', p.region); localStorage.setItem('inspexo_cv', String(p.cv))
    localStorage.setItem('inspexo_km_an', String(p.km_an))
  }, PREFS)
  const page = await c.newPage()
  const erreurs = []
  page.on('pageerror', (e) => erreurs.push(String(e)))
  // ⚠️ La dernière route enregistrée gagne (leçon du sprint 14).
  await page.route('**/rest/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route('**/functions/v1/**', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  await page.route('**/rest/v1/rpc/get_config_publique', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(config) }))
  return { c, page, erreurs }
}
const nettoyer = (page) => page.evaluate(() => {
  for (const b of document.querySelectorAll('button')) if (/j.ai compris|refuser|accepter/i.test(b.textContent || '')) b.click()
  for (const el of document.querySelectorAll('nav, header, [class*="cookie"]')) {
    const pos = getComputedStyle(el).position
    if (pos === 'fixed' || pos === 'sticky') el.style.display = 'none'
  }
})
const debord = (page) => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)

// 1) Coût sur 3 ans, 308 : gratuit (réponse réelle) puis Pass (calcul local).
const id308 = DOSSIERS['308']
const gratuit = await post('/functions/v1/cout-3ans', { analysis_id: id308, ...PREFS })
const rj308 = analyses[id308].result_json
const { cout, entree } = calculerCout3Ans(rj308, ctx, PREFS)
for (const [nom, reponse] of [['gratuit', gratuit], ['pass', { pass: true, cout, entree }]]) {
  const { c, page, erreurs } = await nouvellePage()
  await page.route('**/rest/v1/rpc/get_public_analysis', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(analyses[id308]) }))
  await page.route('**/functions/v1/cout-3ans', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reponse) }))
  await page.goto(`http://127.0.0.1:4179/a/${id308}`, { waitUntil: 'networkidle' })
  await nettoyer(page)
  const bloc = page.locator('#cout-3ans')
  await bloc.waitFor({ timeout: 20000 })
  await bloc.scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  await bloc.screenshot({ path: join(SORTIE, `cout-3ans-${nom}-390.png`) })
  console.log(`cout-3ans ${nom.padEnd(8)} → ${(await bloc.locator('dd').first().textContent())} · débordement : ${(await debord(page)) ? 'OUI ⚠️' : 'non'} · erreurs JS : ${erreurs.length}`)
  await c.close()
}

// 2) Comparateur, 3 dossiers réels.
const ids = Object.values(DOSSIERS)
const fiches = ids.map((id) => {
  const a = analyses[id]
  const { cout: co } = calculerCout3Ans(a.result_json, ctx, PREFS)
  return ficheDepuisAnalyse(id, a.result_json, { verdict: a.verdict ?? a.result_json?.verdict, score: a.score ?? a.result_json?.score }, co)
})
const reco = recommander(fiches)
console.log('recommandation :', JSON.stringify(reco).slice(0, 600))
{
  const { c, page, erreurs } = await nouvellePage()
  await page.route('**/functions/v1/comparer', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ fiches, recommandation: reco }) }))
  await page.goto(`http://127.0.0.1:4179/comparer?ids=${ids.join(',')}`, { waitUntil: 'networkidle' })
  await nettoyer(page)
  await page.waitForTimeout(500)
  await page.screenshot({ path: join(SORTIE, 'comparer-390.png'), fullPage: true })
  console.log(`comparer → débordement : ${(await debord(page)) ? 'OUI ⚠️' : 'non'} · erreurs JS : ${erreurs.length}`)
  await c.close()
}
// 3) Comparateur sans Pass : le refus annoncé.
{
  const { c, page, erreurs } = await nouvellePage()
  await page.route('**/functions/v1/comparer', (r) => r.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'pass_requis' }) }))
  await page.goto(`http://127.0.0.1:4179/comparer?ids=${ids.join(',')}`, { waitUntil: 'networkidle' })
  await nettoyer(page)
  await page.waitForTimeout(300)
  await page.screenshot({ path: join(SORTIE, 'comparer-sans-pass-390.png') })
  console.log(`comparer sans Pass → « ${(await page.locator('main').textContent()).match(/réservée au Pass[^.]*/)?.[0] ?? '?'} » · erreurs JS : ${erreurs.length}`)
  await c.close()
}
await navigateur.close()
serveur.close()
