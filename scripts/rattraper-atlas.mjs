#!/usr/bin/env node
// SPRINT 16 (suite) — Passe de rattrapage sur les pages écartées « illisibles ».
//
// La première campagne a écarté 22 pages pour ce motif, et c'étaient surtout
// des PDF : notes techniques NHTSA, documents constructeur — autrement dit les
// sources de RANG 1. Refuser le format le plus fiable biaisait la mesure
// contre les meilleures preuves. `unpdf` les lit maintenant.
//
// Ce rattrapage ne repaie PAS la recherche : il rejoue seulement la
// vérification indépendante sur des URL déjà connues, et elle tranche
// exactement comme pour les autres entrées. Une page qui redevient lisible
// mais que le juge ne retient pas ne sauve rien — c'est le but.
//
// Usage :
//   node scripts/rattraper-atlas.mjs --estimer
//   node scripts/rattraper-atlas.mjs --lancer [--plafond 3]

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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

const { resultats } = JSON.parse(readFileSync(RELEVE, 'utf8'))
// On ne rattrape que ce qui a été RETIRÉ : une entrée déjà gardée n'a rien à
// gagner, et la repasser coûterait sans rien changer.
const cibles = resultats
  .filter((r) => !r.garde)
  .map((r) => ({ r, urls: (r.ecartees ?? []).filter((e) => e.motif === 'page_illisible').map((e) => e.url) }))
  .filter((c) => c.urls.length > 0)

if (args.includes('--estimer') || args.length === 0) {
  console.log('Estimation — AUCUN appel payant.\n')
  console.log(`  entrées retirées ayant au moins une page illisible  ${cibles.length}`)
  console.log(`  pages à relire                                     ${cibles.reduce((n, c) => n + c.urls.length, 0)}`)
  console.log('  coût : 1 vérification par page (≈ 0,015 €), aucune recherche web')
  console.log(`\n  TOTAL ESTIMÉ                                       ≈ ${(cibles.reduce((n, c) => n + c.urls.length, 0) * 0.015).toFixed(2)} €`)
  process.exit(0)
}

const env = {}
for (const l of readFileSync(join(RACINE, '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
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

let rattrapees = 0
for (const { r, urls } of cibles) {
  if (budgetAtteint()) { console.log(`\n⏸ Plafond atteint (${cout.toFixed(2)} €).`); break }
  process.stdout.write(`▶ ${r.cle.padEnd(9)} ${r.title.slice(0, 44).padEnd(46)} `)
  let d = null
  try {
    const res = await fetch(`${env.REACT_APP_SUPABASE_URL}/functions/v1/atlas-builder`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.REACT_APP_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'x-eval-secret': env.EVAL_BYPASS_SECRET,
      },
      body: JSON.stringify({
        entree: { marque: r.marque, title: r.title, description: '', models: '', years: '' },
        urls,
        type_source: 'constructeur_ou_rappel',
        remede: r.remede ?? '',
        cout_min_eur: r.cout_min_eur ?? 0,
        cout_max_eur: r.cout_max_eur ?? 0,
      }),
    })
    d = await res.json()
    if (!res.ok) { console.log(`ÉCHEC ${res.status}`); continue }
  } catch (e) { console.log('ÉCHEC réseau'); continue }

  cout += d.cout_eur ?? 0
  writeFileSync(COUT_FICHIER, JSON.stringify({ total_eur: Math.round(cout * 10000) / 10000, maj: new Date().toISOString() }, null, 2))

  if (d.garde) {
    rattrapees++
    // La ligne du relevé est remplacée : l'entrée redevient gardée, avec les
    // sources qui ont tenu. Le reste du relevé n'est pas touché.
    Object.assign(r, {
      garde: true,
      motif: '',
      sources: d.sources,
      gravite: d.gravite,
      rattrapee: true,
      ecartees: [...(r.ecartees ?? []).filter((e) => e.motif !== 'page_illisible'), ...(d.ecartees ?? [])],
    })
    console.log(`RATTRAPÉE  ${d.sources.length} source(s) · ${(d.cout_eur ?? 0).toFixed(4)} €`)
  } else {
    // ⚠️ On enregistre le résultat du SECOND passage même quand il ne sauve
    // rien. Laisser « page_illisible » dans le relevé pour une page que l'on
    // vient de lire et de rejeter sur le fond serait un compte rendu faux —
    // précisément le genre d'inexactitude que ce sprint corrige.
    r.ecartees = [...(r.ecartees ?? []).filter((e) => e.motif !== 'page_illisible'), ...(d.ecartees ?? [])]
    r.relue_en_pdf = true
    const pourquoi = (d.ecartees ?? []).map((e) => e.motif).join(', ') || d.motif
    console.log(`non retenue (${pourquoi}) · ${(d.cout_eur ?? 0).toFixed(4)} €`)
  }
}

writeFileSync(RELEVE, JSON.stringify({ resultats }, null, 2))
console.log(`\n${rattrapees} entrée(s) rattrapée(s) sur ${cibles.length} tentée(s).`)
console.log(`— Coût de ce run : ${(cout - coutDepart).toFixed(4)} € · cumul atlas : ${cout.toFixed(2)} €`)
console.log('Relevé mis à jour. Appliquer avec : node scripts/sourcer-atlas.mjs --appliquer')
