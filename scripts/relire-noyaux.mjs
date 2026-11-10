#!/usr/bin/env node
// SPRINT 23 — Relecture AUTOMATIQUE des noyaux avant envoi au juge.
// Un noyau doit être une phrase propre (décision d'Utku du 10 nov. 2026).
// Usage : node scripts/relire-noyaux.mjs [K9K,EB2] [--tout]   (sortie 1 si un défaut)
import { readFileSync } from 'node:fs'
import { defautsNoyau, extraireNoyau } from '../supabase/functions/_shared/noyau.ts'

const S = JSON.parse(readFileSync('docs/sources-moteurs-2026-11.json', 'utf8'))
const C = JSON.parse(readFileSync('docs/correspondance-familles.json', 'utf8'))
const codes = Object.fromEntries(C.lignes.map((l) => [l.cle, l.codes ?? []]))
const filtre = (process.argv[2] && !process.argv[2].startsWith('--')) ? process.argv[2].split(',') : null
const TOUT = process.argv.includes('--tout')

// « avant » / « après » sont des mots légitimes (« suspensions avant »).
let n = 0, ko = 0
for (const o of S.objets) {
  if (o.type === 'constat') continue
  if (filtre && !(codes[o.famille] ?? []).some((c) => filtre.some((f) => c === f || c.startsWith(f)))) continue
  n++
  const r = extraireNoyau(o.intitule, o.type)
  const d = defautsNoyau(r.noyau, o.intitule, o.type)
  if (d.length) ko++
  if (d.length || TOUT) console.log(`${d.length ? '✗' : '✓'} ${o.id.padEnd(30)} ${r.noyau}${d.length ? `\n    → ${d.join(' ; ')}` : ''}${r.periodes.length ? `\n    période : ${r.periodes.map((p) => `${p.debut ?? '…'}–${p.fin ?? '…'}${p.bornante ? '' : ' (indicative)'}`).join(', ')}` : ''}`)
}
console.log(`\n${n} noyaux relus · ${ko} avec un défaut`)
process.exit(ko ? 1 : 0)
