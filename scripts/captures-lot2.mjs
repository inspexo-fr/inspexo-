// Captures du sprint 23, lot 2 (blocs « Sécurité de la transaction » et « Réponses du vendeur ») à 390 px, sur le build local.
// Usage : npm run build puis node scripts/captures-lot2.mjs
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'
import { chromium } from 'playwright'
const B = path.resolve('build')
const srv = http.createServer((q, r) => {
  let p = path.join(B, decodeURIComponent(q.url.split('?')[0]))
  if (!p.startsWith(B) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(B, 'app.html')
  const ext = path.extname(p); r.setHeader('Content-Type', { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' }[ext] || 'application/octet-stream')
  fs.createReadStream(p).pipe(r)
}).listen(5077)
const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 390, height: 844 } })
const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await pg.goto('http://localhost:5077/a/35005dc6-edfb-432c-9095-dbb48d354b1e', { waitUntil: 'networkidle' })
await pg.waitForSelector('#transaction', { timeout: 30000 })
for (const sel of ['#transaction', '#vendeur']) { const el = await pg.$(sel); await el.screenshot({ path: `captures-sprint23/lot2${sel.replace('#', '-')}.png` }) }
const over = await pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
console.log(JSON.stringify({ debordement: over, erreurs: errs }))
await b.close(); srv.close()
