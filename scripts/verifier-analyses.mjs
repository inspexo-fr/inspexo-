#!/usr/bin/env node
// SPRINT 15 — Lance la vérification indépendante sur les analyses réelles.
//
// Chaque appel confronte les affirmations d'UNE analyse aux pages qu'elles
// citent, par un passage qui n'a pas vu la génération. Le résultat va dans la
// table `verifications` et alimente /fiabilite dès 30 analyses.
//
// ⚠️ CE SCRIPT DÉPENSE. Il tient son propre compteur dans
// `.verification-cout.json` et s'ARRÊTE au plafond, comme `npm run eval`.
// Toute campagne passe par ici, jamais par curl : un appel direct échappe au
// compteur, et c'est exactement ainsi que 1,20 € sont sortis hors budget le
// 28 octobre.
//
// Usage :
//   node scripts/verifier-analyses.mjs --estimer         # ne dépense RIEN
//   node scripts/verifier-analyses.mjs --combien 10
//   node scripts/verifier-analyses.mjs --analyse <uuid>
//   node scripts/verifier-analyses.mjs --plafond 6 --reset-cout

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const COUT_FICHIER = join(RACINE, '.verification-cout.json')

// MESURÉ, pas supposé : le module d'extraction a été passé sur les 505
// `result_json` réellement produits (dump de production du 4 novembre 2026).
//   · 5,1 affirmations par analyse réelle (médiane 4, max 10)
//   · 1,62 page distincte à lire par analyse (médiane 2, max 4)
//   · 55 % des affirmations ne citent AUCUNE page publique (catalogue interne)
// Un appel ≈ 5 000 jetons d'entrée + 300 de sortie = 0,0195 $.
// 1,62 × 0,0195 $ × 0,92 ≈ 0,029 € par analyse vérifiée.
const COUT_ESTIME_PAR_ANALYSE_EUR = 0.029

const args = process.argv.slice(2)
const flag = (nom, defaut = null) => {
  const i = args.indexOf(`--${nom}`)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : defaut
}
const ESTIMER = args.includes('--estimer')
const COMBIEN = Math.max(1, Number(flag('combien', '10')))
const ANALYSE = flag('analyse')
// ⚠️ `--budget` est le mur de CE run (règle du 5 nov. 2026) : il s'ajoute au
// plafond cumulé, et c'est le PREMIER atteint qui arrête. Aller au-delà est une
// décision explicite, jamais un glissement.
const BUDGET_RUN_EUR = (() => { const v = Number(flag('budget', '')); return Number.isFinite(v) && v > 0 ? v : null })()
const PLAFOND_EUR = Number(flag('plafond', '6'))

if (args.includes('--reset-cout') && existsSync(COUT_FICHIER)) rmSync(COUT_FICHIER)

// ── Configuration ───────────────────────────────────────────────────────────
const env = {}
for (const ligne of readFileSync(join(RACINE, '.env.local'), 'utf8').split('\n')) {
  const m = ligne.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const URL_BASE = env.REACT_APP_SUPABASE_URL
const ANON = env.REACT_APP_SUPABASE_ANON_KEY
const EVAL_SECRET = env.EVAL_BYPASS_SECRET
if (!URL_BASE || !ANON || !EVAL_SECRET) {
  console.error('✗ REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY et EVAL_BYPASS_SECRET requis dans .env.local')
  process.exit(1)
}

let cout = existsSync(COUT_FICHIER) ? (JSON.parse(readFileSync(COUT_FICHIER, 'utf8')).total_eur ?? 0) : 0
const coutDepart = cout
// Le PREMIER des deux murs atteint arrête le run : le budget annoncé
// pour ce run, ou le plafond cumulé.
const budgetAtteint = () =>
  cout >= PLAFOND_EUR || (BUDGET_RUN_EUR != null && cout - coutDepart >= BUDGET_RUN_EUR)
const motifArret = () =>
  BUDGET_RUN_EUR != null && cout - coutDepart >= BUDGET_RUN_EUR
    ? `budget annoncé atteint (${(cout - coutDepart).toFixed(2)} € ≥ ${BUDGET_RUN_EUR.toFixed(2)} €)`
    : `plafond cumulé atteint (${cout.toFixed(2)} € ≥ ${PLAFOND_EUR} €)`
const ajouter = (eur) => {
  cout += eur || 0
  writeFileSync(COUT_FICHIER, JSON.stringify({ total_eur: Math.round(cout * 10000) / 10000, maj: new Date().toISOString() }, null, 2))
}

const appel = (chemin, options = {}) =>
  fetch(`${URL_BASE}/functions/v1/${chemin}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${ANON}`,
      'Content-Type': 'application/json',
      'x-eval-secret': EVAL_SECRET,
      ...(options.headers ?? {}),
    },
  })

// ── Estimation seule : ne dépense rien ─────────────────────────────────────
if (ESTIMER) {
  console.log('Estimation du budget — AUCUN appel payant n’est fait.\n')
  const lignes = [
    ['Analyses à vérifier', COMBIEN],
    ['Pages lues par analyse (mesuré sur 505 analyses)', '1,62'],
    ['Affirmations par analyse (mesuré)', '5,1 dont 55 % sans source publique'],
    ['Coût d’un appel (≈5 000 jetons entrée, 300 sortie)', '0,0195 $'],
    ['Coût estimé par analyse', `${COUT_ESTIME_PAR_ANALYSE_EUR.toFixed(3)} €`],
  ]
  for (const [k, v] of lignes) console.log(`  ${String(k).padEnd(48)} ${v}`)
  const total = COMBIEN * COUT_ESTIME_PAR_ANALYSE_EUR
  console.log(`\n  ${'TOTAL ESTIMÉ'.padEnd(48)} ${total.toFixed(2)} €`)
  console.log(`  ${'Déjà dépensé (compteur)'.padEnd(48)} ${cout.toFixed(2)} €`)
  console.log(`  ${'Plafond'.padEnd(48)} ${PLAFOND_EUR.toFixed(2)} €`)
  console.log('\n⚠️ L’estimation ne couvre QUE la vérification. Les analyses elles-mêmes')
  console.log('   (lancées depuis le site) coûtent ≈ 0,12 € chacune, plus ≈ 0,30 € par')
  console.log('   nouvelle fiche moteur à générer.')
  process.exit(0)
}

// ── Quelles analyses ────────────────────────────────────────────────────────
let cibles = []
if (ANALYSE) {
  cibles = [{ id: ANALYSE }]
} else {
  // `analyses_a_verifier` est réservée au service role : on passe par la
  // fonction admin, qui l'appelle pour nous. Sans jeton admin, on demande
  // l'identifiant en clair.
  console.error('✗ Sans --analyse <uuid>, il faut la liste des analyses à vérifier.')
  console.error('  Elle est dans l’admin, onglet « Fiabilité » : le bouton y lance')
  console.error('  la vérification directement, compteur de coût compris.')
  console.error('  Ce script sert aux vérifications ciblées et à --estimer.')
  process.exit(1)
}

if (budgetAtteint()) {
  console.log(`\n⏸ ${motifArret()}. Reste non traité.`)
  console.error('   Relancer avec --plafond plus haut, ou --reset-cout.')
  process.exit(1)
}

// ── Exécution ───────────────────────────────────────────────────────────────
let total = 0
for (const c of cibles) {
  if (budgetAtteint()) {
    console.log(`\n⏸ ${motifArret()}. Reste non traité.`)
    break
  }
  process.stdout.write(`▶ ${c.id} … `)
  const res = await appel('verification', { method: 'POST', body: JSON.stringify({ analysis_id: c.id }) })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json) {
    console.log(`ÉCHEC (${res.status}) ${json?.message ?? ''}`)
    continue
  }
  ajouter(json.cout_eur ?? 0)
  total++
  console.log(
    `${json.affirmations} affirmations · ${json.soutenues} soutenues · ` +
    `${json.non_soutenues} non soutenues · ${json.mauvais_moteur} mauvais moteur · ` +
    `${json.sans_source} sans source · ${(json.cout_eur ?? 0).toFixed(4)} €`,
  )
}

console.log(`\n${total} analyse(s) vérifiée(s).`)
console.log(`— Coût de ce run : ${(cout - coutDepart).toFixed(4)} € · cumul : ${cout.toFixed(2)} € / ${PLAFOND_EUR} €`)
