#!/usr/bin/env node
// SPRINT 18 — Visuels de l'appli : icône et écran de lancement.
//
// Dessinés depuis la charte (tokens.css, cachet IX, fonte Schibsted embarquée)
// et rendus par un navigateur, comme les aperçus de partage. Les sources
// vivent dans `resources/` ; `@capacitor/assets` en dérive ensuite toutes les
// tailles exigées par iOS et Android.
//
// ⚠️ L'icône n'a NI texte fin NI transparence : iOS refuse l'alpha sur
// l'icône d'app, et un texte de 11 px disparaît à 40×40. Le cachet IX est le
// seul élément — c'est déjà la marque du site.
//
// Usage : node scripts/generer-visuels-appli.mjs
import { mkdirSync, readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const SORTIE = join(RACINE, 'resources')
mkdirSync(SORTIE, { recursive: true })

// Mêmes valeurs que src/styles/tokens.css (thème clair).
const PAPIER = '#F3F0E9'
const ENCRE = '#0F1B2D'

function fonte() {
  const f = join(RACINE, 'public/fonts/schibsted-grotesk-var-latin.woff2')
  if (!existsSync(f)) return ''
  return `@font-face{font-family:'Schibsted';src:url(data:font/woff2;base64,${
    readFileSync(f).toString('base64')
  }) format('woff2');font-weight:400 900;font-display:block}`
}

/** Le cachet IX du site (src/components/Seal.jsx), en SVG autonome. */
const cachet = (taille, encre, papier) => `
<svg viewBox="0 0 30 30" width="${taille}" height="${taille}" aria-hidden="true">
  <rect x="0" y="0" width="30" height="30" fill="${papier}"/>
  <rect x="3.5" y="3.5" width="23" height="23" fill="none" stroke="${encre}" stroke-width="1.6"/>
  <text x="15" y="20.5" text-anchor="middle" font-family="Schibsted,sans-serif"
        font-weight="800" font-size="13" fill="${encre}" letter-spacing="0.5">IX</text>
</svg>`

const PAGES = [
  {
    nom: 'icon.png',
    l: 1024,
    h: 1024,
    // ⚠️ Fond PLEIN, pas de transparence : iOS rejette une icône avec alpha.
    corps: `<div style="width:1024px;height:1024px;background:${PAPIER};display:flex;
      align-items:center;justify-content:center">${cachet(620, ENCRE, PAPIER)}</div>`,
  },
  {
    nom: 'icon-foreground.png',
    l: 1024,
    h: 1024,
    // Android adaptatif : le premier plan est rogné en cercle par le système.
    // Le cachet est donc réduit pour tenir dans la zone sûre (66 % du côté).
    corps: `<div style="width:1024px;height:1024px;background:transparent;display:flex;
      align-items:center;justify-content:center">${cachet(430, ENCRE, 'transparent')}</div>`,
  },
  {
    nom: 'icon-background.png',
    l: 1024,
    h: 1024,
    corps: `<div style="width:1024px;height:1024px;background:${PAPIER}"></div>`,
  },
  {
    nom: 'splash.png',
    l: 2732,
    h: 2732,
    // Écran de lancement : carré, recadré par le système sur tous les formats.
    // Rien d'autre que la marque — un écran de lancement qui annonce une
    // promesse la fait attendre plus longtemps qu'elle ne dure.
    corps: `<div style="width:2732px;height:2732px;background:${PAPIER};display:flex;
      flex-direction:column;align-items:center;justify-content:center;gap:60px">
      ${cachet(420, ENCRE, PAPIER)}
      <div style="font-family:Schibsted,sans-serif;font-weight:800;font-size:150px;
        letter-spacing:12px;color:${ENCRE}">INSPEXO</div>
    </div>`,
  },
  {
    nom: 'splash-dark.png',
    l: 2732,
    h: 2732,
    corps: `<div style="width:2732px;height:2732px;background:${ENCRE};display:flex;
      flex-direction:column;align-items:center;justify-content:center;gap:60px">
      ${cachet(420, PAPIER, ENCRE)}
      <div style="font-family:Schibsted,sans-serif;font-weight:800;font-size:150px;
        letter-spacing:12px;color:${PAPIER}">INSPEXO</div>
    </div>`,
  },
]

const css = fonte()
if (!css) console.warn('⚠ fonte de la charte introuvable : rendu avec la fonte système.')

const n = await chromium.launch()
for (const p of PAGES) {
  const ctx = await n.newContext({ viewport: { width: p.l, height: p.h }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>${css}
    html,body{margin:0;padding:0;background:transparent}</style>${p.corps}`)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({
    path: join(SORTIE, p.nom),
    omitBackground: p.nom === 'icon-foreground.png',
  })
  await ctx.close()
  console.log(`✓ resources/${p.nom}  ${p.l}×${p.h}`)
}
await n.close()
console.log('\nDériver toutes les tailles : npx @capacitor/assets generate')
