#!/usr/bin/env node
// SPRINT 18 — Captures de vente, aux formats exigés par les stores.
//
// Prises sur l'APPLICATION réellement installée, sur un VRAI dossier — pas
// sur une maquette. Une capture de store qui ne correspond pas à l'app est un
// motif de rejet, et une promesse que le produit ne tient pas.
//
// Formats produits :
//   · iPhone 6,9″  1290×2796  (iPhone 17 Pro Max) — exigé par App Store Connect
//   · iPhone 6,5″  1284×2778  (iPhone 15 Plus)    — second format accepté
//   · Android      1080×2400  (émulateur)         — ≥ 1080×1920 exigé
//   · Bannière Google 1024×500 — composée, pas capturée : ce n'est pas une
//     copie d'écran mais une image de couverture.
//
// Usage : node scripts/captures-stores.mjs [uuid-du-dossier]

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const SORTIE = join(RACINE, 'captures-sprint18', 'stores')
mkdirSync(SORTIE, { recursive: true })

// Dossier réel, terminé, verdict orange : il montre le produit tel qu'il est.
const DOSSIER = process.argv[2] || '033fb86b-84a8-436b-b950-8ef30f22f04e'

const sh = (c, a) => execFileSync(c, a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const APP_IOS = '/tmp/ddios/Build/Products/Debug-iphonesimulator/App.app'
const ADB = `${process.env.HOME}/Library/Android/sdk/platform-tools/adb`

const ECRANS = [
  { nom: '1-accueil', chemin: '/', attente: 11000 },
  { nom: '2-dossier', chemin: `/a/${DOSSIER}`, attente: 15000 },
  { nom: '3-takata', chemin: '/airbags-takata', attente: 11000 },
]

// ── iOS ────────────────────────────────────────────────────────────────────
const APPAREILS_IOS = [
  { label: '1320x2868', id: process.env.SIM_69 },
  { label: '1290x2796', id: process.env.SIM_65 },
]

for (const a of APPAREILS_IOS) {
  if (!a.id) { console.log(`⚠ ${a.label} : identifiant de simulateur absent, ignoré`); continue }
  try { sh('xcrun', ['simctl', 'boot', a.id]) } catch (_) { /* déjà démarré */ }
  await new Promise((r) => setTimeout(r, 6000))
  if (existsSync(APP_IOS)) {
    try { sh('xcrun', ['simctl', 'install', a.id, APP_IOS]) } catch (e) { console.log('  install :', String(e).slice(0, 60)) }
  }
  // ⚠️ SUR iOS, ON NE CAPTURE QUE L'ACCUEIL, ET C'EST UNE LIMITE ASSUMÉE.
  //
  // iOS 27 affiche TOUJOURS « Ouvrir dans « Inspexo » ? » quand un lien
  // profond vient de l'extérieur — y compris application fermée. La boîte de
  // dialogue se retrouve sur la capture. Et aucun outil disponible ici ne sait
  // toucher l'écran du simulateur : AppleScript est bloqué par les
  // autorisations d'accessibilité, `simctl` n'a pas de commande de tap, et
  // `idb` n'est pas installé.
  //
  // Les écrans profonds sont donc capturés sur Android, où le lien profond
  // n'ouvre aucune boîte de dialogue. Montrer une capture iOS avec une alerte
  // système par-dessus serait pire que de ne pas la livrer.
  for (const e of ECRANS.filter((x) => x.chemin === '/')) {
    try { sh('xcrun', ['simctl', 'terminate', a.id, 'io.inspexo.app']) } catch (_) { /* pas lancée */ }
    // On passe par le lien profond pour atteindre une page précise : l'app
    // s'ouvre sinon sur l'accueil, et une capture de vente doit montrer
    // l'écran qu'elle annonce.
    sh('xcrun', ['simctl', 'launch', a.id, 'io.inspexo.app'])
    await new Promise((r) => setTimeout(r, e.attente))
    if (e.chemin !== '/') {
      // ⚠️ PAS une URL https : elle ouvrirait SAFARI, et la capture
      // montrerait le site dans un navigateur au lieu de l'application.
      sh('xcrun', ['simctl', 'openurl', a.id, `inspexo://aller?p=${encodeURIComponent(e.chemin)}`])
      await new Promise((r) => setTimeout(r, 6000))
    }
    const f = join(SORTIE, `ios-${a.label}-${e.nom}.png`)
    sh('xcrun', ['simctl', 'io', a.id, 'screenshot', f])
    console.log(`✓ ${f.replace(RACINE + '/', '')}`)
  }
}

// ── Android ────────────────────────────────────────────────────────────────
try {
  sh(ADB, ['shell', 'pidof', 'com.android.systemui'])
  for (const e of ECRANS) {
   try {
    // ⚠️ `monkey` et `force-stop` renvoient un code non nul dans des cas
    // parfaitement normaux (appli déjà arrêtée, événement injecté). Les
    // passer par execFileSync faisait échouer les TROIS captures.
    execFileSync('/bin/sh', ['-c', `${ADB} shell am force-stop io.inspexo.app || true`])
    await new Promise((r) => setTimeout(r, 1200))
    execFileSync('/bin/sh', ['-c', `${ADB} shell monkey -p io.inspexo.app -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1 || true`])
    await new Promise((r) => setTimeout(r, e.attente))
    if (e.chemin !== '/') {
      execFileSync('/bin/sh', ['-c', `${ADB} shell am start -a android.intent.action.VIEW -d 'inspexo://aller?p=${encodeURIComponent(e.chemin)}' >/dev/null 2>&1 || true`])
      await new Promise((r) => setTimeout(r, 7000))
    }
    const f = join(SORTIE, `android-${e.nom}.png`)
    execFileSync('/bin/sh', ['-c', `${ADB} exec-out screencap -p > "${f}"`])
    console.log(`✓ ${f.replace(RACINE + '/', '')}`)
   } catch (err) {
     // ⚠️ Une capture ratée ne doit pas emporter les suivantes : la première
     // version perdait deux écrans sur trois sans le dire.
     console.log(`⚠ android-${e.nom} : ${String(err).slice(0, 70)}`)
   }
  }
} catch (_) {
  console.log('⚠ émulateur Android indisponible : captures Android ignorées')
}

// ── Bannière Google Play 1024×500 ──────────────────────────────────────────
//
// Composée dans la charte : une bannière est une couverture, pas une copie
// d'écran. Elle ne promet rien que le produit ne tienne.
{
  const PAPIER = '#F3F0E9', ENCRE = '#0F1B2D', GRAPHITE = '#5B6270'
  let css = ''
  const fonte = join(RACINE, 'public/fonts/schibsted-grotesk-var-latin.woff2')
  if (existsSync(fonte)) {
    css = `@font-face{font-family:'Schibsted';src:url(data:font/woff2;base64,${
      readFileSync(fonte).toString('base64')}) format('woff2');font-weight:400 900}`
  }
  const n = await chromium.launch()
  const ctx = await n.newContext({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>${css}
    *{margin:0;box-sizing:border-box}
    body{width:1024px;height:500px;background:${PAPIER};color:${ENCRE};
      font-family:'Schibsted',system-ui,sans-serif;padding:64px 72px;
      display:flex;flex-direction:column;justify-content:space-between}
    .haut{display:flex;align-items:center;gap:18px;font-size:22px;letter-spacing:5px;font-weight:800}
    .sceau{width:44px;height:44px;border:3px solid ${ENCRE};display:flex;align-items:center;
      justify-content:center;font-size:20px;font-weight:800;letter-spacing:0}
    h1{font-size:62px;line-height:1.05;font-weight:800;letter-spacing:-1px;max-width:820px}
    .pied{font-size:21px;color:${GRAPHITE}}
    </style>
    <div class="haut"><span class="sceau">IX</span>INSPEXO</div>
    <h1>L'annonce dit ce que le vendeur veut.<br>On lit le reste.</h1>
    <div class="pied">Pannes connues · rappels constructeur · airbags Takata — chaque affirmation renvoie à sa source.</div>`)
  await page.evaluate(() => document.fonts.ready)
  const f = join(SORTIE, 'google-banniere-1024x500.png')
  await page.screenshot({ path: f })
  await n.close()
  console.log(`✓ ${f.replace(RACINE + '/', '')}`)
}

console.log('\nVérifier les dimensions : sips -g pixelWidth -g pixelHeight captures-sprint18/stores/*.png')
