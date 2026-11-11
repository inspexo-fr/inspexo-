#!/usr/bin/env node
// SPRINT 23 — Pré-contrôle GRATUIT des pages du fichier de sources externes.
//
// Pour chaque page : joignable DEPUIS NOS FONCTIONS EDGE (pas depuis ce poste :
// c'est l'edge qui lira la page au moment du juge), et les extraits déclarés
// verbatim s'y retrouvent-ils (apostrophes, espaces, entités normalisées) ?
// Aucun modèle, aucun coût. Une page injoignable sort du lot du juge.
// Aucun contournement : une requête, le même agent qu'ailleurs.
//
// Usage : node scripts/precontrole-sources.mjs   → docs/precontrole-sources.json
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const SOURCE = 'docs/sources-moteurs-2026-11.json'
const SORTIE = 'docs/precontrole-sources.json'
const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim() }
const d = JSON.parse(readFileSync(SOURCE, 'utf8'))

// Une entrée par URL, avec TOUS ses extraits verbatim (toutes affirmations confondues).
const pages = new Map()
for (const o of d.objets) for (const s of o.sources ?? []) {
  const p = pages.get(s.url) ?? { url: s.url, extraits: new Set() }
  for (const e of s.extraits ?? []) if (e?.verbatim === true && typeof e.texte === 'string') p.extraits.add(e.texte)
  pages.set(s.url, p)
}
const deja = existsSync(SORTIE) ? JSON.parse(readFileSync(SORTIE, 'utf8')).pages ?? {} : {}
const aFaire = [...pages.values()].filter((p) => !deja[p.url])
console.log(`${pages.size} pages · déjà contrôlées ${pages.size - aFaire.length} · à contrôler ${aFaire.length}`)

const resultats = { ...deja }
for (let i = 0; i < aFaire.length; i += 20) {
  const lot = aFaire.slice(i, i + 20)
  const res = await fetch(`${env.REACT_APP_SUPABASE_URL}/functions/v1/sources-externes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.REACT_APP_SUPABASE_ANON_KEY}`, 'x-eval-secret': env.EVAL_BYPASS_SECRET },
    body: JSON.stringify({ mode: 'precontrole', pages: lot.map((p) => ({ url: p.url, extraits: [...p.extraits].slice(0, 20) })) }),
    signal: AbortSignal.timeout(140_000),
  })
  if (!res.ok) { console.error(`lot ${i / 20 + 1} : HTTP ${res.status} — arrêt, rien n'est perdu (reprise possible)`); break }
  const j = await res.json()
  for (const r of j.resultats) resultats[r.url] = r
  writeFileSync(SORTIE, JSON.stringify({ maj: new Date().toISOString(), limite_juge: j.limite_juge, pages: resultats }, null, 1))
  process.stdout.write(`.${i / 20 + 1}`)
}
console.log()

// Rapport par hôte.
const parHote = {}
for (const r of Object.values(resultats)) {
  const h = new URL(r.url).hostname.replace(/^www\./, '')
  const x = (parHote[h] ??= { classe: d.hotes[h]?.classe ?? '?', pages: 0, joignables: 0, verbatim: 0, trouves: 0, au_dela: 0 })
  x.pages++; if (r.joignable) x.joignables++
  x.verbatim += r.extraits_verbatim; x.trouves += r.trouves; x.au_dela += r.au_dela_du_juge
}
const lignes = Object.entries(parHote).sort((a, b) => b[1].pages - a[1].pages)
console.log('hôte'.padEnd(34), 'classe'.padEnd(13), 'pages joign.  extraits trouvés  au-delà du juge')
for (const [h, x] of lignes) {
  console.log(h.padEnd(34), x.classe.padEnd(13), `${String(x.pages).padStart(5)} ${String(x.joignables).padStart(5)}   ${String(x.verbatim).padStart(5)} ${String(x.trouves).padStart(6)}   ${String(x.au_dela).padStart(5)}`)
}
const tot = lignes.reduce((a, [, x]) => ({ p: a.p + x.pages, j: a.j + x.joignables, v: a.v + x.verbatim, t: a.t + x.trouves, u: a.u + x.au_dela }), { p: 0, j: 0, v: 0, t: 0, u: 0 })
console.log(`\nTOTAL : ${tot.j}/${tot.p} pages joignables · extraits verbatim retrouvés ${tot.t}/${tot.v} · dont au-delà des ${14000} caractères lus par le juge : ${tot.u}`)
