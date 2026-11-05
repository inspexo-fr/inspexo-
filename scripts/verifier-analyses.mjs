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
import { coutProchainCas, murAtteint } from './budget.mjs'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const COUT_FICHIER = join(RACINE, '.verification-cout.json')

// MESURÉ, pas supposé. Un appel ≈ 5 000 jetons d'entrée + 300 de sortie
// = 0,0195 $, et il y a UN appel par page citée (`parSource` : une page, un
// appel). Le coût d'une analyse vérifiée est donc celui de ses pages.
//
// ⚠️ CE CHIFFRE A ÉTÉ CORRIGÉ LE 5 NOVEMBRE 2026, il valait 0,029 €. Il avait
// été mesuré sur le dump du 4 novembre, c'est-à-dire sur des analyses
// produites AVANT le sourcing de l'atlas (sprint 16) : 1,62 page par analyse
// et 55 % d'affirmations sans aucune page publique. Depuis que l'atlas cite
// ses sources, les analyses portent 2 à 4 pages — relevé sur la base : 3 pages
// pour la 308 du 4/11, 4 pour la S7, contre 0 pour les analyses d'octobre.
// Une estimation périmée vers le bas fait franchir le mur budgétaire sans
// prévenir : c'est exactement ce que le mur existe pour empêcher.
const COUT_ESTIME_PAR_ANALYSE_EUR = 0.05

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
// Estimation prudente du coût d une unité avant d en avoir mesuré une.
const COUT_UNITE_ESTIME_EUR = 0.1
// Le PREMIER des deux murs atteint arrête le run : le budget annoncé pour ce
// run, ou le plafond cumulé. La décision vient du module PUR
// `scripts/budget.mjs`, testé hors ligne.
//
// ⚠️ Le mur RÉSERVE le coût de l'unité suivante. Sans cela il est toujours
// franchi d'une unité : constaté le 5 nov. 2026, un run d'éval annoncé à
// 0,40 € a coûté 0,447 €. La règle d'Utku ne souffre pas d'exception.
let unitesFaites = 0
const coutDuRun = () => cout - coutDepart
const murDuRun = () => murAtteint({
  coutRun: coutDuRun(), casJoues: unitesFaites, coutSession: cout,
  budgetRun: BUDGET_RUN_EUR, plafondSession: PLAFOND_EUR, estime: COUT_UNITE_ESTIME_EUR,
})
const budgetAtteint = () => murDuRun() !== null
const motifArret = () =>
  murDuRun() === 'run'
    ? `budget annoncé atteint (${coutDuRun().toFixed(3)} € dépensés, ` +
      `${coutProchainCas(coutDuRun(), unitesFaites, COUT_UNITE_ESTIME_EUR).toFixed(3)} € à réserver, ` +
      `mur à ${BUDGET_RUN_EUR.toFixed(2)} €)`
    : `plafond cumulé atteint (${cout.toFixed(2)} € + réserve > ${PLAFOND_EUR} €)`
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
    ['Pages lues par analyse (1 appel par page)', '2 à 4 depuis le sprint 16'],
    ['Affirmations par analyse (mesuré)', '4,1 dont 11 % sans source publique'],
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
  if (res.status === 409 && json?.error === 'analyse_eval') {
    // ⚠️ La fonction refuse les analyses d'éval AVANT de dépenser : elles sont
    // exclues de /fiabilite, donc les vérifier serait payer pour rien. Les
    // 9 vérifications déjà en base le 5 nov. 2026 étaient toutes dans ce cas.
    console.log('IGNORÉE — analyse marquée is_eval, aucun jeton dépensé')
    continue
  }
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
