#!/usr/bin/env node
// AUDIT de la chasse fixe (chantier design, nov. 2026) — lecture seule.
//
// Règle d'Utku : les capitales à chasse fixe sont réservées aux étiquettes de
// 3 mots au plus et aux valeurs chiffrées ; toute phrase passe dans la police
// de texte. Ce script sert le build local (repli SPA comme Vercel), ouvre
// chaque page et liste les éléments en Martian Mono dont le texte PROPRE
// dépasse 28 caractères.
//
//   node scripts/audit-chasse-fixe.mjs [--captures <dossier>] [--json <fichier>]
//
// Avec --captures : captures 1440×900 et 390×844 de l'accueil et du dossier réel.
import { createServer } from 'node:http'
import { readFileSync, existsSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, extname } from 'node:path'
import { chromium } from 'playwright'

const BUILD = new URL('../build/', import.meta.url).pathname
const args = process.argv.slice(2)
const val = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null }
const CAPTURES = val('--captures')
const SORTIE = val('--json')
const DOSSIER = '9a1c8c4d-0273-453e-a744-f0b2da0d69be' // DOSSIER_EXEMPLE_ID (DossierApercu.jsx)

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain' }
const serveur = createServer((req, res) => {
  const chemin = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  let f = join(BUILD, chemin)
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html')
  if (!existsSync(f)) f = join(BUILD, 'index.html') // repli SPA, comme vercel.json
  res.writeHead(200, { 'content-type': TYPES[extname(f)] ?? 'application/octet-stream' })
  res.end(readFileSync(f))
})
await new Promise((r) => serveur.listen(0, r))
const BASE = `http://127.0.0.1:${serveur.address().port}`

const sitemap = readFileSync(join(BUILD, 'sitemap.xml'), 'utf8')
const routes = [...new Set([...[...sitemap.matchAll(/<loc>https?:\/\/[^/]+(\/[^<]*)<\/loc>/g)].map((m) => m[1] || '/'),
  '/score', '/pass', '/dossier', '/comparer', `/a/${DOSSIER}`, '/extension', '/extension/confidentialite'])]

const navigateur = await chromium.launch()
const trouvailles = []
const page = await navigateur.newPage({ viewport: { width: 1440, height: 900 } })
for (const r of routes) {
  await page.goto(BASE + r, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => null)
  await page.waitForTimeout(400)
  const items = await page.evaluate(() => {
    const out = []
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el)
      if (!/martian mono/i.test(cs.fontFamily)) continue
      if (cs.display === 'none' || cs.visibility === 'hidden') continue
      const propre = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').replace(/\s+/g, ' ').trim()
      if (propre.length <= 28) continue
      out.push({ tag: el.tagName.toLowerCase(), classe: (el.className && String(el.className)) || '', majuscules: cs.textTransform === 'uppercase', texte: propre.slice(0, 160) })
    }
    return out
  })
  for (const it of items) trouvailles.push({ route: r, ...it })
}

if (CAPTURES) {
  mkdirSync(CAPTURES, { recursive: true })
  for (const [nom, w, h] of [['ordinateur', 1440, 900], ['telephone', 390, 844]]) {
    const p = await navigateur.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
    for (const [cle, r] of [['accueil', '/'], ['dossier-reel', `/a/${DOSSIER}`]]) {
      await p.goto(BASE + r, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => null)
      await p.waitForTimeout(800)
      await p.screenshot({ path: join(CAPTURES, `${cle}-${nom}.png`) })
    }
    await p.close()
  }
}
await navigateur.close()
serveur.close()

// Regroupement : un même texte répété sur plusieurs pages n'est listé qu'une fois.
const parTexte = new Map()
for (const t of trouvailles) {
  const k = `${t.texte}|${t.classe}`
  if (!parTexte.has(k)) parTexte.set(k, { ...t, routes: [t.route] })
  else parTexte.get(k).routes.push(t.route)
}
const liste = [...parTexte.values()].sort((a, b) => b.routes.length - a.routes.length)
console.log(`${routes.length} pages auditées · ${trouvailles.length} occurrences · ${liste.length} textes distincts en chasse fixe de plus de 28 caractères\n`)
for (const t of liste) console.log(`${t.majuscules ? 'MAJ' : '   '} ${t.tag}.${t.classe.split(' ')[0] || '-'} · ${t.routes.length > 3 ? `${t.routes.length} pages` : t.routes.join(', ')} · « ${t.texte} »`)
if (SORTIE) writeFileSync(SORTIE, JSON.stringify({ le: new Date().toISOString().slice(0, 10), pages: routes.length, textes: liste }, null, 1) + '\n')
