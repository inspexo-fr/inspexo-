// SPRINT 24, chantier A — Fiches moteur construites depuis les PARTIES
// CONFIRMÉES par le juge (aucune recherche web). Méthode validée par Utku le
// 13 nov. 2026 : moteurs seulement, par fréquence, lots de 10, arrêt si moins
// de 5 fiches UTILES (publiées ET indexables). Une fiche existante n'est
// jamais remplacée (`hit`).
//
//   node scripts/fiches-depuis-parties.mjs --estimer
//   node scripts/fiches-depuis-parties.mjs --budget 1.00 [--seuil 5]
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { murAtteint } from './budget.mjs'
import { partiesConfirmees } from './parties-confirmees.mjs'

const args = process.argv.slice(2)
const flag = (n, d = null) => { const i = args.indexOf(n); return i >= 0 ? (args[i + 1] ?? d) : d }
const BUDGET = Number(flag('--budget', '1.00')) || 1
const SEUIL = Number(flag('--seuil', '5')) || 5
const PLAFOND_CUMUL = 45 // mur du chantier A
const COMPTEUR = '.fiches-parties-cout.json'
const JOURNAL = 'docs/fiches-depuis-parties-journal.json'
const COUT_ESTIME = 0.08
const TYPES = new Set(['panne', 'rappel', 'campagne'])

// Lot 1, par fréquence dans le parc. `relevé` = familles du relevé externe.
const TOUT = [
  { marque: 'Renault', famille: 'R9M', nom: '1.6 dCi', releve: ['RENAULT-R9M'] },
  { marque: 'Fiat', famille: 'SDE', nom: '1.3 Multijet', releve: ['FIAT-1.3-MULTIJET'] },
  { marque: 'Volkswagen', famille: 'EA188', nom: '1.9 et 2.0 TDI PD', releve: ['VAG-EA188-TDI-PD'] },
  { marque: 'Volkswagen', famille: 'EA888', nom: '1.8 et 2.0 TSI', releve: ['VAG-EA888-1.8-2.0TSI'] },
  // EA211 : 1.5 TSI seul. Une page réunissant 1.0 à 1.5 masquerait chaque
  // panne propre à une cylindrée (règle des variantes, barème 11.17).
  { marque: 'Volkswagen', famille: 'EA211', nom: '1.5 TSI', releve: ['VAG-EA211-1.5TSI'] },
  // Toyota AD : codes complets 1AD-FTV / 2AD-FTV / 2AD-FHV déclarés dans la
  // table et ramenés à « AD » par le résolveur (décision d'Utku, 13 nov. 2026).
  { marque: 'Toyota', famille: 'AD', nom: '2.0 et 2.2 D-4D', releve: ['TOYOTA-2.0-2.2-D4D-1AD-2AD'] },
  { marque: 'Renault', famille: 'K4M', nom: '1.6 16V', releve: ['RENAULT-D4F-K4M', 'RENAULT-1.4-1.6-16V-K4J-K4M'] },
  { marque: 'Renault', famille: 'H5HT', nom: '1.3 TCe', releve: ['RENAULT-H5HT'] },
]

// `--familles R9M,AD` : ne joue que ces familles (une fiche déjà créée est
// renvoyée telle quelle, jamais remplacée).
const LOT = flag('--familles') ? TOUT.filter((f) => flag('--familles').split(',').includes(f.famille)) : TOUT

const env = {}
for (const l of (existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const U = env.REACT_APP_SUPABASE_URL ?? '', ANON = env.REACT_APP_SUPABASE_ANON_KEY ?? '', EVAL = env.EVAL_BYPASS_SECRET ?? ''

const j = JSON.parse(readFileSync('docs/candidats-externes-journal.json', 'utf8'))
const s = JSON.parse(readFileSync('docs/sources-moteurs-2026-11.json', 'utf8'))
const charges = LOT.map((f) => {
  const parties = f.releve.flatMap((r) => partiesConfirmees(j, s, r)).filter((p) => TYPES.has(p.type))
  return { ...f, parties: parties.map(({ texte, urls, extraits }) => ({ texte, urls, extraits })), urls: new Set(parties.flatMap((p) => p.urls)).size }
})
for (const c of charges) console.log(`  ${c.marque.padEnd(10)} ${c.famille.padEnd(6)} ${String(c.parties.length).padStart(2)} parties · ${c.urls} URL`)
if (args.includes('--estimer')) { console.log(`\nEstimation : ${charges.length} × ${COUT_ESTIME} € ≈ ${(charges.length * COUT_ESTIME).toFixed(2)} €`); process.exit(0) }
if (!U || !EVAL) { console.error('REACT_APP_SUPABASE_URL ou EVAL_BYPASS_SECRET absent'); process.exit(1) }

const cumul = existsSync(COMPTEUR) ? JSON.parse(readFileSync(COMPTEUR, 'utf8')).eur ?? 0 : 0
const journal = existsSync(JOURNAL) ? JSON.parse(readFileSync(JOURNAL, 'utf8')) : []
let coutRun = 0, joues = 0
for (const c of charges) {
  const mur = murAtteint({ coutRun, casJoues: joues, coutSession: cumul + coutRun, budgetRun: BUDGET, plafondSession: PLAFOND_CUMUL, estime: COUT_ESTIME })
  if (mur) { console.log(`\n⏸ mur atteint (${mur}) avant ${c.marque} ${c.famille} : non joué.`); break }
  let r = null, erreur = null
  try {
    const res = await fetch(`${U}/functions/v1/sheet-builder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON}`, 'x-eval-secret': EVAL },
      body: JSON.stringify({ mode: 'parties', marque: c.marque, famille_moteur: c.famille, moteur_label: c.nom, nom_commercial: c.nom, parties: c.parties }),
      signal: AbortSignal.timeout(170_000),
    })
    const t = await res.text()
    if (!res.ok) erreur = `HTTP ${res.status} — ${t.slice(0, 200)}`
    else r = JSON.parse(t)
  } catch (e) { erreur = String(e).slice(0, 200) }
  if (erreur) { console.error(`\n⚠️ ARRÊT — ${c.marque} ${c.famille} : ${erreur}\n   Coût engagé inconnu : vérifier la console Anthropic.`); break }
  if (typeof r?.cout_eur !== 'number') { console.error('\n⚠️ ARRÊT — réponse sans `cout_eur` : le mur ne protège de rien.'); process.exit(1) }
  joues++
  coutRun += r.cout_eur
  const utile = r.status === 'created' && r.indexation?.publiee === true && r.indexation?.indexable === true
  journal.push({ marque: c.marque, famille: c.famille, nom: c.nom, parties: c.parties.length, status: r.status, pannes: r.pannes, indexation: r.indexation ?? null, utile, cout_eur: r.cout_eur, le: new Date().toISOString() })
  writeFileSync(JOURNAL, JSON.stringify(journal, null, 1))
  writeFileSync(COMPTEUR, JSON.stringify({ eur: Number((cumul + coutRun).toFixed(4)), maj: new Date().toISOString() }))
  console.log(`  ${utile ? 'UTILE ' : '      '} ${c.marque} ${c.famille.padEnd(6)} ${String(r.status).padEnd(8)} ${r.pannes} panne(s)` +
    (r.indexation ? ` · ${r.indexation.n_portees} portée(s), ${r.indexation.n_sources} source(s), publiée ${r.indexation.publiee}, indexable ${r.indexation.indexable}` : '') +
    ` · ${r.cout_eur.toFixed(3)} €`)
}
const utiles = journal.filter((x) => LOT.some((f) => f.marque === x.marque && f.famille === x.famille) && x.utile).length
console.log(`\n— ${utiles} fiche(s) utile(s) sur ${joues} jouée(s) · coût du run ${coutRun.toFixed(3)} € / ${BUDGET.toFixed(2)} € · chantier A ${(cumul + coutRun).toFixed(2)} € / ${PLAFOND_CUMUL} €`)
if (joues >= LOT.length && utiles < SEUIL) console.log(`⏹ RÈGLE D’ARRÊT : moins de ${SEUIL} fiches utiles. Le chantier ne va pas plus loin.`)
