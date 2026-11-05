#!/usr/bin/env node
// SPRINT 16 — Sourcer le Defect Atlas.
//
// Deux phases SÉPARÉES, volontairement :
//   --collecter  interroge `atlas-builder` pour chaque entrée et écrit le
//                relevé brut dans docs/atlas-sourcing-resultats.json ;
//   --appliquer  réécrit src/data/defectAtlas.js et sa copie serveur à partir
//                de ce relevé, SANS rappeler l'API.
//
// La séparation permet de relire ce qui a été trouvé avant de toucher au
// catalogue, et de réappliquer sans repayer.
//
// ⚠️ CE SCRIPT DÉPENSE. Compteur dans `.atlas-cout.json`, plafond 10 € par
// défaut, arrêt automatique. Même règle que `npm run eval` : toute campagne
// passe par ici, jamais par curl.
//
// Usage :
//   node scripts/sourcer-atlas.mjs --estimer
//   node scripts/sourcer-atlas.mjs --collecter [--marque BMW] [--plafond 10]
//   node scripts/sourcer-atlas.mjs --appliquer

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { coutProchainCas, murAtteint } from './budget.mjs'
import { defectAtlas } from '../src/data/defectAtlas.js'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const COUT_FICHIER = join(RACINE, '.atlas-cout.json')
const RELEVE = join(RACINE, 'docs', 'atlas-sourcing-resultats.json')

const args = process.argv.slice(2)
const flag = (n, d = null) => {
  const i = args.indexOf(`--${n}`)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d
}
// ⚠️ `--budget` est le mur de CE run (règle du 5 nov. 2026) : il s'ajoute au
// plafond cumulé, et c'est le PREMIER atteint qui arrête. Aller au-delà est une
// décision explicite, jamais un glissement.
const BUDGET_RUN_EUR = (() => { const v = Number(flag('budget', '')); return Number.isFinite(v) && v > 0 ? v : null })()
const PLAFOND_EUR = Number(flag('plafond', '10'))
const MARQUE = flag('marque')
if (args.includes('--reset-cout') && existsSync(COUT_FICHIER)) rmSync(COUT_FICHIER)

const entrees = []
for (const [cle, bloc] of Object.entries(defectAtlas)) {
  if (MARQUE && cle.toLowerCase() !== MARQUE.toLowerCase()) continue
  for (const d of bloc.defects ?? []) {
    entrees.push({ cle, marque: bloc.label ?? cle, ...d })
  }
}

if (args.includes('--estimer') || args.length === 0) {
  console.log('Estimation — AUCUN appel payant.\n')
  console.log(`  entrées à sourcer                 ${entrees.length}`)
  console.log('  par entrée : 1 recherche web (≤3 requêtes) + 1 à 4 vérifications indépendantes')
  console.log('  coût observé sur une fiche moteur  ≈ 0,30 € (campagne de couverture, 13,21 € / 44)')
  console.log(`\n  TOTAL ESTIMÉ                      ≈ ${(entrees.length * 0.2).toFixed(2)} €`)
  console.log(`  plafond                           ${PLAFOND_EUR.toFixed(2)} €`)
  process.exit(0)
}

// ── Configuration ───────────────────────────────────────────────────────────
const env = {}
for (const l of readFileSync(join(RACINE, '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const URL_BASE = env.REACT_APP_SUPABASE_URL
const ANON = env.REACT_APP_SUPABASE_ANON_KEY
const SECRET = env.EVAL_BYPASS_SECRET

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
const ajouter = (e) => {
  unitesFaites += 1
  cout += e || 0
  writeFileSync(COUT_FICHIER, JSON.stringify({ total_eur: Math.round(cout * 10000) / 10000, maj: new Date().toISOString() }, null, 2))
}

// ── Phase 1 : collecte ──────────────────────────────────────────────────────
if (args.includes('--collecter')) {
  const deja = existsSync(RELEVE) ? JSON.parse(readFileSync(RELEVE, 'utf8')) : { resultats: [] }
  const faites = new Set(deja.resultats.map((r) => `${r.cle}|${r.title}`))

  for (const e of entrees) {
    const id = `${e.cle}|${e.title}`
    if (faites.has(id)) { console.log(`· ${e.cle} — ${e.title.slice(0, 48)} (déjà fait)`); continue }
    if (budgetAtteint()) {
      console.log(`\n⏸ ${motifArret()}. Reste non traité.`)
      break
    }
    process.stdout.write(`▶ ${e.cle.padEnd(9)} ${e.title.slice(0, 46).padEnd(48)} `)
    let r = null
    try {
      const res = await fetch(`${URL_BASE}/functions/v1/atlas-builder`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json', 'x-eval-secret': SECRET },
        body: JSON.stringify({ entree: e }),
      })
      r = await res.json()
      if (!res.ok) { console.log(`ÉCHEC ${res.status} ${r?.error ?? ''}`); continue }
    } catch (err) {
      console.log('ÉCHEC réseau', String(err).slice(0, 60))
      continue
    }
    ajouter(r.cout_eur ?? 0)
    deja.resultats.push({ cle: e.cle, ...r })
    writeFileSync(RELEVE, JSON.stringify(deja, null, 2))
    console.log(
      r.garde
        ? `GARDÉE  ${r.sources.length} source(s) · ${r.gravite_avant} → ${r.gravite} · ${(r.cout_eur ?? 0).toFixed(3)} €`
        : `RETIRÉE (${r.motif}) · ${(r.cout_eur ?? 0).toFixed(3)} €`,
    )
  }

  const res = (existsSync(RELEVE) ? JSON.parse(readFileSync(RELEVE, 'utf8')) : { resultats: [] }).resultats
  console.log(`\n${res.filter((r) => r.garde).length} gardée(s), ${res.filter((r) => !r.garde).length} retirée(s), sur ${res.length} traitée(s).`)
  console.log(`— Coût de ce run : ${(cout - coutDepart).toFixed(3)} € · cumul : ${cout.toFixed(2)} € / ${PLAFOND_EUR} €`)
  process.exit(0)
}

// ── Phase 2 : application ───────────────────────────────────────────────────
if (args.includes('--appliquer')) {
  if (!existsSync(RELEVE)) { console.error('✗ Relevé absent : lancer --collecter d’abord.'); process.exit(1) }
  const { resultats } = JSON.parse(readFileSync(RELEVE, 'utf8'))
  const parId = new Map(resultats.map((r) => [`${r.cle}|${r.title}`, r]))

  // ⚠️ GARDE-FOU : ne jamais appliquer sur un atlas DÉJÀ réécrit.
  // Lancé deux fois de suite, le script lisait sa propre sortie : les entrées
  // retirées n'y figuraient plus, donc « 0 retirées » — et une entrée
  // rattrapée après coup était impossible à réintégrer, en silence.
  // L'atlas d'entrée doit contenir au moins autant d'entrées que le relevé en
  // a traitées.
  const entreesEntree = Object.values(defectAtlas).reduce((n, b) => n + (b.defects?.length ?? 0), 0)
  if (entreesEntree < resultats.length) {
    console.error(`✗ L'atlas d'entrée ne porte que ${entreesEntree} entrées alors que le relevé en a traité ${resultats.length}.`)
    console.error('  Il a déjà été réécrit. Restaurer la version d’origine avant de réappliquer :')
    console.error('    git show <commit-avant-sprint16>:src/data/defectAtlas.js > src/data/defectAtlas.js')
    process.exit(1)
  }

  const sortie = {}
  let gardees = 0, retirees = 0, rejugees = 0
  const journal = []
  for (const [cle, bloc] of Object.entries(defectAtlas)) {
    const defects = []
    for (const d of bloc.defects ?? []) {
      const r = parId.get(`${cle}|${d.title}`)
      if (!r) { defects.push(d); continue } // non traitée : inchangée
      if (!r.garde) {
        retirees++
        journal.push({ cle, title: d.title, action: 'retiree', motif: r.motif })
        continue
      }
      gardees++
      // ⚠️ ON NE PROMEUT JAMAIS SANS COÛT PUBLIÉ.
      // La fonction retombe sur « majeure » quand aucune page ne donne de
      // prix — ce qui, pour une entrée notée MINEUR, serait une AGGRAVATION
      // décidée par défaut. Un défaut ne devient pas plus grave parce que
      // personne n'en a publié le prix. Sans coût sourcé, on garde le rang
      // d'origine ; avec coût sourcé, on applique ce que le coût dit.
      const RANG = { mineure: 0, majeure: 1, casse: 2, securite: 3 }
      const origine = d.severity === 'MINEUR' ? 'mineure' : d.severity === 'CRITIQUE' ? 'casse' : 'majeure'
      const coutSource = (r.cout_max_eur || 0) > 0
      const gravite = coutSource
        ? r.gravite
        : (RANG[r.gravite] > RANG[origine] ? origine : r.gravite)
      const nouvelle = {
        ...d,
        // `severity` reste pour compatibilité, `gravite` est ce que lit le serveur.
        gravite,
        sources: r.sources.map((s) => ({ url: s.url, title: s.titre || null })),
        url_source: r.sources.map((s) => s.url),
        ...(r.cout_min_eur ? { cout_min_eur: r.cout_min_eur } : {}),
        ...(r.cout_max_eur ? { cout_max_eur: r.cout_max_eur } : {}),
        ...(r.remede ? { remede: r.remede } : {}),
      }
      if (origine !== gravite) {
        rejugees++
        journal.push({
          cle, title: d.title, action: 'gravite', de: d.severity, vers: gravite,
          cout_source: coutSource ? `${r.cout_min_eur}-${r.cout_max_eur} €` : 'aucun',
        })
      }
      defects.push(nouvelle)
    }
    if (defects.length > 0) sortie[cle] = { ...bloc, defects }
  }

  // Fichier client (source de vérité) + copie serveur.
  const entete = `/**
 * INSPEXO — DEFECT ATLAS
 *
 * ⚠️ SPRINT 16 — CHAQUE ENTRÉE PORTE DÉSORMAIS SES SOURCES.
 * L'atlas a longtemps affiché des pannes sous la mention « source : base
 * Inspexo » — c'est-à-dire nous-mêmes. Depuis le sprint 15.1, une entrée sans
 * URL publique n'est plus affichée comme une panne. Les entrées ci-dessous ont
 * été sourcées par recherche web, chaque page a été relue par un passage
 * indépendant (le même que celui de /fiabilite), et toute entrée dont aucune
 * source n'a tenu a été RETIRÉE.
 *
 * Ne pas ajouter d'entrée sans \`sources\` : elle serait ignorée à l'affichage
 * et au score, et ne vaudrait qu'une question au vendeur.
 *
 * \`gravite\` suit le barème (securite / casse / majeure / mineure) et se juge
 * sur le REMÈDE, jamais sur la conséquence redoutée. \`severity\` est conservé
 * pour les écrans hérités.
 *
 * Relevé de sourcing : docs/atlas-sourcing-resultats.json
 */

export const defectAtlas = `
  writeFileSync(join(RACINE, 'src/data/defectAtlas.js'), entete + JSON.stringify(sortie, null, 2) + '\n')
  writeFileSync(join(RACINE, 'supabase/functions/_shared/defectAtlas.json'), JSON.stringify(sortie, null, 2) + '\n')
  writeFileSync(join(RACINE, 'docs', 'atlas-sourcing-journal.json'), JSON.stringify(journal, null, 2) + '\n')

  const restantes = Object.values(sortie).reduce((n, b) => n + b.defects.length, 0)
  console.log(`Atlas réécrit : ${restantes} entrées conservées, ${retirees} retirées, ${rejugees} gravités rejugées.`)
  console.log('Journal : docs/atlas-sourcing-journal.json')
  process.exit(0)
}

console.error('Rien à faire : passer --estimer, --collecter ou --appliquer.')
process.exit(1)
