#!/usr/bin/env node
// SPRINT 18 — Preuve MESURÉE : qui contacte le site d'annonces ?
//
// La promesse publique est : « l'annonce est lue par votre appareil, jamais
// par nos serveurs ». `tests/pas-de-scraping.test.mjs` le prouve par le code ;
// ce script le prouve par l'OBSERVATION, sur l'émulateur Android.
//
// Il écoute le trafic de la WebView de l'application (protocole CDP) pendant
// un partage, et classe chaque requête :
//   · vers un site d'annonces  → doit partir DE L'APPAREIL ;
//   · vers inspexo.io          → doit transporter du TEXTE DÉJÀ EXTRAIT ;
//   · ailleurs                 → listé tel quel, pour ne rien cacher.
//
// ⚠️ Ce que ce script NE peut pas prouver : qu'aucun de nos serveurs ne fait
// la requête. Une observation depuis le téléphone ne voit pas ce que fait un
// serveur. C'est le test hors ligne qui couvre ce versant — les deux sont
// nécessaires, aucun ne suffit.
//
// Usage :
//   node scripts/capture-reseau-partage.mjs "https://www.leboncoin.fr/ad/voitures/…"

import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const SORTIE = join(RACINE, 'captures-sprint18')
mkdirSync(SORTIE, { recursive: true })

const ADB = `${process.env.HOME}/Library/Android/sdk/platform-tools/adb`
const adb = (...a) => execFileSync(ADB, a, { encoding: 'utf8' }).trim()

const URL_ANNONCE = process.argv[2]
if (!URL_ANNONCE || !/^https:\/\//.test(URL_ANNONCE)) {
  console.error('Usage : node scripts/capture-reseau-partage.mjs "https://www.leboncoin.fr/ad/…"')
  process.exit(1)
}

const SITES_ANNONCES = /leboncoin|lacentrale|autoscout24/i
const NOUS = /inspexo\.io|supabase\.co/i

// ── 1. Relancer l'appli à froid, puis ouvrir le lien profond ───────────────
adb('shell', 'am', 'force-stop', 'io.inspexo.app')
await new Promise((r) => setTimeout(r, 1500))
adb('shell', 'monkey', '-p', 'io.inspexo.app', '-c', 'android.intent.category.LAUNCHER', '1')
await new Promise((r) => setTimeout(r, 9000))

const pid = adb('shell', 'pidof', 'io.inspexo.app')
if (!pid) { console.error('✗ l’application n’est pas lancée'); process.exit(1) }
try { adb('forward', '--remove-all') } catch (_) { /* rien à retirer */ }
adb('forward', 'tcp:9222', `localabstract:webview_devtools_remote_${pid}`)

/** Ouvre une session CDP sur une cible et enregistre son trafic. */
async function espionner(cible, journal) {
  const ws = new WebSocket(cible.webSocketDebuggerUrl)
  let n = 0
  await new Promise((resolve, reject) => {
    ws.onopen = () => { ws.send(JSON.stringify({ id: ++n, method: 'Network.enable' })); resolve() }
    ws.onerror = reject
  })
  ws.onmessage = (m) => {
    const j = JSON.parse(m.data)
    if (j.method !== 'Network.requestWillBeSent') return
    const r = j.params.request
    journal.push({
      url: r.url.slice(0, 160),
      methode: r.method,
      // La taille suffit à montrer qu'on envoie du contenu, sans recopier une
      // annonce entière dans un fichier de preuve.
      octets_envoyes: r.postData ? r.postData.length : 0,
      champs: r.postData ? champsDuCorps(r.postData) : null,
    })
  }
  return ws
}

/** Les NOMS des champs envoyés, jamais leur contenu. */
function champsDuCorps(corps) {
  try {
    const j = JSON.parse(corps)
    return Object.keys(j).map((k) => {
      const v = j[k]
      if (Array.isArray(v)) return `${k}[${v.length}]`
      if (typeof v === 'string') return `${k}(${v.length} car.)`
      return k
    })
  } catch (_) {
    return ['(corps non JSON)']
  }
}

const journal = []
const sockets = []
async function cibles() {
  const res = await fetch('http://127.0.0.1:9222/json')
  return (await res.json()).filter((t) => t.type === 'page' && t.webSocketDebuggerUrl)
}

for (const t of await cibles()) sockets.push(await espionner(t, journal))

// ── 2. Déclencher le partage ───────────────────────────────────────────────
console.log(`▶ partage de ${URL_ANNONCE}\n`)
adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW',
  '-d', `inspexo://partage?url=${encodeURIComponent(URL_ANNONCE)}`)

// La WebView de l'annonce est une NOUVELLE cible : on la raccroche en cours
// de route, sinon son trafic — le plus important — passerait inaperçu.
const vues = new Set(sockets.length ? [] : [])
for (let i = 0; i < 24; i++) {
  await new Promise((r) => setTimeout(r, 2500))
  for (const t of await cibles()) {
    if (vues.has(t.id)) continue
    vues.add(t.id)
    try { sockets.push(await espionner(t, journal)) } catch (_) { /* cible fermée */ }
  }
}
for (const ws of sockets) { try { ws.close() } catch (_) { /* déjà fermée */ } }

// ── 3. Classer ─────────────────────────────────────────────────────────────
const annonces = journal.filter((r) => SITES_ANNONCES.test(r.url))
const chezNous = journal.filter((r) => NOUS.test(r.url))
const autres = journal.filter((r) => !SITES_ANNONCES.test(r.url) && !NOUS.test(r.url))

console.log(`${journal.length} requêtes observées depuis l'appareil\n`)
console.log(`── vers un site d'annonces : ${annonces.length}`)
for (const r of annonces.slice(0, 6)) console.log(`   ${r.methode} ${r.url}`)
console.log(`\n── vers nos serveurs : ${chezNous.length}`)
for (const r of chezNous.slice(0, 8)) {
  console.log(`   ${r.methode} ${r.url}`)
  if (r.champs) console.log(`      champs envoyés : ${r.champs.join(', ')}`)
}
console.log(`\n── ailleurs : ${autres.length}`)
for (const r of autres.slice(0, 5)) console.log(`   ${r.methode} ${r.url}`)

const preuve = {
  observe_le: new Date().toISOString(),
  url_partagee: URL_ANNONCE,
  requetes_totales: journal.length,
  vers_sites_annonces: annonces.length,
  vers_nos_serveurs: chezNous.length,
  journal,
}
const f = join(SORTIE, 'preuve-reseau-partage.json')
writeFileSync(f, JSON.stringify(preuve, null, 2))
console.log(`\nRelevé complet : ${f}`)
console.log(
  annonces.length > 0
    ? '\n✓ Les requêtes vers le site d’annonces partent bien DE L’APPAREIL.'
    : '\n⚠️ Aucune requête vers un site d’annonces observée — vérifier que le partage a abouti.',
)
