#!/usr/bin/env node
// Génère un enregistrement d'écran SYNTHÉTIQUE (webm) pour valider le harnais
// du mode vidéo : une fausse page d'annonce mobile (galerie photo + texte de
// l'annonce 308 de l'éval) est défilée pendant ~9 s et filmée par Playwright.
// Les cas RÉELS (iPhone .mov / Android .mp4) se déposent ensuite dans
// tests/eval-video/<cas>/enregistrement.<ext> avec leur expected.json.
// Usage : node tests/eval-video/generer-enregistrement.mjs
import { createRequire } from 'node:module'
import { readFileSync, mkdirSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CAS_DIR = join(ROOT, 'tests', 'eval-video', 'synthetique-308')
mkdirSync(CAS_DIR, { recursive: true })

const annonce = readFileSync(join(ROOT, 'tests', 'eval', '308-puretech-complete', 'annonce.txt'), 'utf8')
const img = (p) => `data:image/jpeg;base64,${readFileSync(p).toString('base64')}`
const photo1 = img(join(ROOT, 'tests', 'eval', 'photo-compteur', 'photos', '02-pneu.jpg'))
const photo2 = img(join(ROOT, 'tests', 'eval', 'photo-compteur', 'photos', '03-carrosserie.jpg'))

const lignes = annonce.trim().split('\n')
const titre = lignes[0]
const corps = lignes.slice(1).join('<br>')

const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>annonce</title></head>
<body style="margin:0;font-family:-apple-system,sans-serif;background:#fff">
<div style="background:#f56b2a;color:#fff;padding:12px 16px;font-weight:700">leboncoin · Voitures</div>
<img src="${photo1}" style="width:100%;height:46vh;object-fit:cover;display:block">
<img src="${photo2}" style="width:100%;height:46vh;object-fit:cover;display:block">
<div style="padding:16px">
<h1 style="font-size:1.25rem;margin:0 0 6px">${titre}</h1>
<div style="font-size:1.5rem;font-weight:800;margin-bottom:12px">9 400 €</div>
<p style="font-size:1rem;line-height:1.7;color:#222">${corps}</p>
<div style="color:#777;font-size:0.875rem;padding:30px 0 240px">Publié hier · Toulouse 31000 · ref 2834711</div>
</div></body></html>`

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  recordVideo: { dir: CAS_DIR, size: { width: 390, height: 844 } },
})
const page = await ctx.newPage()
await page.setContent(html, { waitUntil: 'load' })
await page.waitForTimeout(900)
// Défilement lent de haut en bas (~9 s), comme le ferait l'utilisateur.
const hauteur = await page.evaluate(() => document.body.scrollHeight - window.innerHeight)
const etapes = 24
for (let i = 1; i <= etapes; i++) {
  await page.evaluate((y) => window.scrollTo({ top: y }), Math.round((hauteur * i) / etapes))
  await page.waitForTimeout(340)
}
await page.waitForTimeout(600)
await ctx.close()
await browser.close()

// Playwright nomme la vidéo aléatoirement : on la renomme.
const webm = readdirSync(CAS_DIR).find((f) => f.endsWith('.webm') && f !== 'enregistrement.webm')
if (webm) renameSync(join(CAS_DIR, webm), join(CAS_DIR, 'enregistrement.webm'))

writeFileSync(join(CAS_DIR, 'expected.json'), JSON.stringify({
  texte_must_include: ['PureTech', ['84 500', '84500'], ['9 400', '9400'], 'Distribution jamais faite'],
  images_vehicule_min: 1,
  cout_max_eur: 0.20,
}, null, 2) + '\n')

console.log('enregistrement synthétique prêt :', join(CAS_DIR, 'enregistrement.webm'))
