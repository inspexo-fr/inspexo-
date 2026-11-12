// Captures du sprint 23, lot 3, à 390 px, sur le build local.
// Usage : npm run build puis node scripts/captures-lot3.mjs → captures-sprint23/
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'
import { chromium } from 'playwright'
const B = path.resolve('build'), OUT = 'captures-sprint23'
fs.mkdirSync(OUT, { recursive: true })
const srv = http.createServer((q, r) => {
  let p = path.join(B, decodeURIComponent(q.url.split('?')[0]))
  if (fs.existsSync(p) && fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'index.html'))) p = path.join(p, 'index.html')
  if (!p.startsWith(B) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(B, 'app.html')
  const ext = path.extname(p); r.setHeader('Content-Type', { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' }[ext] || 'application/octet-stream')
  fs.createReadStream(p).pipe(r)
}).listen(5078)
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
await ctx.addInitScript(() => { try { localStorage.setItem('inspexo_cookies_accepted', 'true') } catch (_) {} })
const bilan = {}
async function page (nom, url, fn) {
  const pg = await ctx.newPage(); const errs = []
  pg.on('pageerror', (e) => errs.push(e.message))
  if (fn) await fn(pg)
  await pg.goto(`http://localhost:5078${url}`, { waitUntil: 'networkidle' })
  await pg.waitForTimeout(800)
  return { pg, errs, fin: async (sel, complet = false) => {
    if (sel) { const el = await pg.$(sel); if (el) await el.screenshot({ path: `${OUT}/lot3-${nom}.png` }) }
    else await pg.screenshot({ path: `${OUT}/lot3-${nom}.png`, fullPage: complet })
    bilan[nom] = { debordement: await pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), erreurs: errs }
    await pg.close()
  } }
}
const ID = '35005dc6-edfb-432c-9095-dbb48d354b1e'
let p = await page('premier-ecran', `/a/${ID}`); await p.pg.waitForSelector('#prochaine-action', { timeout: 30000 }); await p.fin(null)
p = await page('alerte', `/a/${ID}`); await p.pg.waitForSelector('#alerte-rappel', { timeout: 30000 }); await p.fin('#alerte-rappel')
p = await page('batterie', `/a/${ID}`, async (pg) => {
  await pg.route('**/rest/v1/rpc/get_public_analysis', async (route) => {
    const res = await route.fetch(); const j = await res.json()
    const r = j.result_json || j.result || j
    r.vehicule = { ...r.vehicule, marque: 'Renault', modele: 'Zoe', motorisation: 'R110', carburant: 'Électrique' }
    if (j.marque !== undefined) { j.marque = 'Renault'; j.modele = 'Zoe' }
    await route.fulfill({ response: res, json: j })
  })
})
await p.pg.waitForSelector('#batterie', { timeout: 30000 }); await p.fin('#batterie')
p = await page('modele', '/modele/renault/clio-iv'); await p.fin(null, true)
p = await page('confirmer', '/alerte/confirmer?i=00000000-0000-0000-0000-000000000000&t=abc'); await p.fin(null)
// Panneau de l'extension, rendu par son propre code avec une réponse type.
p = await page('extension-prelecture', '/score', async (pg) => {
  await pg.addInitScript(() => { window.chrome = { runtime: { sendMessage: async () => ({}) }, storage: { local: { get: async () => ({}) } } }; window.INSPEXO_SITES = [] })
})
await p.pg.addScriptTag({ content: fs.readFileSync('extension/content.js', 'utf8') })
await p.pg.addStyleTag({ content: fs.readFileSync('extension/button.css', 'utf8') })
await p.pg.evaluate(() => afficherPrelecture({ // eslint-disable-line no-undef
  rappels: { n: 1, indisponible: false }, critair: { classe: '2', libelle: "Crit'Air 2" },
  prix: { evalue: true, p25: 7500, p75: 9250, n: 23, position: 'dans la moyenne' },
  signaux_arnaque: [{ libelle: 'Acompte ou réservation payante demandés avant d’avoir vu le véhicule.', extrait: 'Un acompte de 500 € est demandé pour réserver.' }],
  mention: "Pré-lecture sans intelligence artificielle. L'analyse complète suit.",
}))
await p.fin('#inspexo-prelecture')
console.log(JSON.stringify(bilan, null, 1))
await b.close(); srv.close()
