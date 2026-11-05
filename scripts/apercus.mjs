#!/usr/bin/env node
// SPRINT 17.2 — Génère les aperçus de partage, une fois par dossier.
//
// ⚠️ POURQUOI UN NAVIGATEUR ET NON UN MOTEUR DE RENDU SERVEUR.
// La première tentative rendait l'image à la volée dans une fonction Vercel
// (`@vercel/og`). Quatre corrections successives — runtime edge refusé,
// ERR_REQUIRE_ESM, signature Node au lieu de la signature edge, traçage des
// `.wasm` — n'ont jamais abouti, et pendant ce temps `og:image` pointait sur
// une URL en 500 : les aperçus de partage étaient cassés en production.
//
// Un navigateur, lui, rend l'image exactement comme la page : il lit nos
// fontes **woff2**, que les moteurs de rendu SVG côté serveur refusent. La
// typographie de la charte est donc respectée, ce que l'autre approche ne
// permettait pas.
//
// L'image ne montre QUE ce que la page publique affiche déjà : marque,
// modèle, année, tampon du verdict, score. Elle voyage plus loin que la page
// — aperçus, caches, captures — donc elle en dit moins, jamais plus.
//
// AUCUN COÛT IA : rien n'est analysé, on relit des dossiers déjà produits.
//
// Usage :
//   node scripts/apercus.mjs --lister
//   node scripts/apercus.mjs --generer [--limite 20]
//   node scripts/apercus.mjs --analyse <uuid> [--sans-depot]

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const flag = (n, d = null) => {
  const i = args.indexOf(`--${n}`)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d
}

const env = {}
for (const l of readFileSync(join(RACINE, '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const URL_BASE = env.REACT_APP_SUPABASE_URL
const ANON = env.REACT_APP_SUPABASE_ANON_KEY
const SECRET = env.EVAL_BYPASS_SECRET
if (!URL_BASE || !ANON || !SECRET) {
  console.error('✗ REACT_APP_SUPABASE_URL / REACT_APP_SUPABASE_ANON_KEY / EVAL_BYPASS_SECRET requis dans .env.local')
  process.exit(1)
}
const entetes = {
  Authorization: `Bearer ${ANON}`,
  apikey: ANON,
  'Content-Type': 'application/json',
  'x-eval-secret': SECRET,
}

// Mêmes valeurs que src/styles/tokens.css (thème clair).
const PAPIER = '#F3F0E9', ENCRE = '#0F1B2D', GRAPHITE = '#5B6270', RULE = '#CFC9BC'
const COULEUR = { vert: '#1E6B3A', orange: '#8F4D00', rouge: '#B3122E' }
const TAMPON = { vert: 'FEU VERT', orange: 'PRUDENCE', rouge: 'SIGNAUX ROUGES' }

const echapper = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** La fonte de la charte, en base64, pour que le rendu ne dépende d'aucun
 *  réseau — un @font-face distant qui n'arrive pas donnerait une image à la
 *  mauvaise fonte, sans la moindre erreur. */
function fonte() {
  try {
    const f = readFileSync(join(RACINE, 'public/fonts/schibsted-grotesk-var-latin.woff2'))
    return `@font-face{font-family:'Schibsted';src:url(data:font/woff2;base64,${f.toString('base64')}) format('woff2');font-weight:400 900;font-display:block}`
  } catch (_) {
    return '' // repli : la fonte système, plutôt qu'aucune image
  }
}

function html(d, css) {
  const verdict = d.verdict && d.score != null ? d.verdict : null
  const coul = verdict ? (COULEUR[verdict] ?? ENCRE) : GRAPHITE
  const tampon = verdict ? (TAMPON[verdict] ?? 'ANALYSE') : 'ANALYSE EN COURS'
  const titre = echapper([d.marque, d.modele].filter(Boolean).join(' ').slice(0, 42) || 'Dossier Inspexo')
  const sous = echapper([d.annee, d.motorisation].filter(Boolean).join(' · ').slice(0, 60))
  return `<!doctype html><meta charset="utf-8"><style>${css}
  *{box-sizing:border-box;margin:0}
  body{width:1200px;height:630px;background:${PAPIER};color:${ENCRE};
    font-family:'Schibsted',system-ui,sans-serif;padding:56px 64px;
    display:flex;flex-direction:column;justify-content:space-between}
  .tete{display:flex;justify-content:space-between;align-items:center;
    border-bottom:2px solid ${ENCRE};padding-bottom:18px;font-size:24px;letter-spacing:4px}
  .tete b{font-weight:800}.tete span{color:${GRAPHITE};letter-spacing:2px}
  h1{font-size:78px;font-weight:800;line-height:1.05;letter-spacing:-1px}
  .sous{font-size:32px;color:${GRAPHITE};margin-top:10px}
  .bas{display:flex;align-items:center;gap:32px}
  .tampon{border:4px solid ${coul};color:${coul};padding:14px 28px;font-size:40px;
    font-weight:800;letter-spacing:3px;transform:rotate(-2deg)}
  .score{color:${coul};font-size:64px;font-weight:800}
  .score i{font-style:normal;font-size:28px;color:${GRAPHITE}}
  .pied{border-top:1px solid ${RULE};padding-top:16px;font-size:22px;color:${GRAPHITE}}
  </style>
  <div class="tete"><b>INSPEXO</b><span>ANALYSE D'ANNONCE</span></div>
  <div><h1>${titre}</h1>${sous ? `<div class="sous">${sous}</div>` : ''}</div>
  <div class="bas"><div class="tampon">${tampon}</div>${
    verdict ? `<div class="score">${d.score}<i>/100</i></div>` : ''
  }</div>
  <div class="pied">Analyse automatique de l'annonce. Ne remplace pas un examen du véhicule. · inspexo.io</div>`
}

async function dossier(id) {
  const res = await fetch(`${URL_BASE}/rest/v1/rpc/get_public_analysis`, {
    method: 'POST',
    headers: entetes,
    body: JSON.stringify({ p_id: id, p_track: false }),
  })
  if (!res.ok) return null
  const j = await res.json()
  const r = j?.result_json || j?.result || null
  if (!r) return null
  const v = r.vehicule || {}
  return {
    id,
    // ⚠️ Les deux seules valeurs sont 'en_cours' et 'terminee'. On exclut
    // l'échec plutôt que d'énumérer le succès : écrire `=== 'fini'` rendait
    // tout dossier « en cours », et le tampon de l'image était faux.
    verdict: r.statut_analyse === 'en_cours' ? null : r.verdict,
    score: r.statut_analyse === 'en_cours' ? null : r.score,
    marque: v.marque, modele: v.modele, annee: v.annee, motorisation: v.motorisation,
  }
}

// ── Quelles analyses ────────────────────────────────────────────────────────
let cibles = []
const unique = flag('analyse')
if (unique) {
  cibles = [unique]
} else {
  const res = await fetch(`${URL_BASE}/functions/v1/apercu?limite=${flag('limite', '20')}`, { headers: entetes })
  const j = await res.json().catch(() => null)
  if (!res.ok) { console.error('✗', res.status, JSON.stringify(j).slice(0, 200)); process.exit(1) }
  cibles = (j.analyses ?? []).map((a) => a.id)
  if (args.includes('--lister')) {
    console.log(`${cibles.length} analyse(s) sans aperçu :`)
    for (const a of j.analyses ?? []) console.log(`  ${a.id}  ${a.verdict ?? '—'} ${a.score ?? ''}  ${a.created_at}`)
    process.exit(0)
  }
}

if (cibles.length === 0) { console.log('Rien à générer.'); process.exit(0) }

const css = fonte()
if (!css) console.warn('⚠ fonte de la charte introuvable : rendu avec la fonte système.')
mkdirSync(join(RACINE, 'captures-sprint14'), { recursive: true })

const navigateur = await chromium.launch()
let faits = 0, rates = 0
for (const id of cibles) {
  process.stdout.write(`▶ ${id} … `)
  const d = await dossier(id)
  if (!d) { console.log('dossier illisible'); rates++; continue }

  const ctx = await navigateur.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  await page.setContent(html(d, css), { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  const png = await page.screenshot({ type: 'png' })
  await ctx.close()

  if (args.includes('--sans-depot')) {
    const f = join(RACINE, 'captures-sprint14', `apercu-${id}.png`)
    writeFileSync(f, png)
    console.log(`rendu local ${png.length} octets → ${f}`)
    faits++
    continue
  }

  const res = await fetch(`${URL_BASE}/functions/v1/apercu`, {
    method: 'POST',
    headers: entetes,
    body: JSON.stringify({ analysis_id: id, png_base64: png.toString('base64') }),
  })
  const j = await res.json().catch(() => null)
  if (!res.ok) { console.log(`ÉCHEC ${res.status} ${JSON.stringify(j).slice(0, 120)}`); rates++; continue }
  console.log(`déposé ${j.octets} octets → ${j.url}`)
  faits++
}
await navigateur.close()
console.log(`\n${faits} aperçu(s) produit(s), ${rates} échec(s).`)
