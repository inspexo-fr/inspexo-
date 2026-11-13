#!/usr/bin/env node
// SPRINT 22 — Campagne de plans d'entretien SOURCÉS (lot pilote).
//
// Décision d'Utku du 8 nov. 2026 : lot pilote de 5 moteurs, dans l'ordre du
// parc français (PureTech EB2 en tête, puis DV6, K9K, H4D, EP6), mur 2,20 €,
// ARRÊT si moins de 2 moteurs sur 5 sortent avec au moins une échéance établie.
//
// Trois modes, et seul le premier dépense :
//   node scripts/plans-entretien.mjs [--budget 2.20]   génère (sheet-builder mode « plan »),
//                                                      n'écrit RIEN dans les fiches
//   node scripts/plans-entretien.mjs --estimer         aucune dépense
//   node scripts/plans-entretien.mjs --appliquer       écrit (jeton admin, `ajouter_plan`)
//   node scripts/plans-entretien.mjs --restaurer       remet les plans d'AVANT (jeton admin)
//
// ⚠️ La génération ne touche ni aux pannes ni au plan en place : elle RENVOIE
// un plan. L'écriture est un second geste, avec un jeton d'une heure.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { murAtteint } from './budget.mjs'

const args = process.argv.slice(2)
const flag = (n, d = null) => { const i = args.indexOf(n); return i >= 0 ? (args[i + 1] ?? d) : d }
const ESTIMER = args.includes('--estimer')
const APPLIQUER = args.includes('--appliquer')
const RESTAURER = args.includes('--restaurer')
const BUDGET = Number(flag('--budget', '2.20')) || 2.2
const PLAFOND_CUMUL = 15
const SEUIL_PILOTE = 2 // moteurs avec ≥ 1 échéance établie, sur 5
const JOURNAL = 'docs/plans-entretien-journal.json'
const SAUVEGARDE = 'docs/plans-entretien-sauvegarde.json'
const COMPTEUR = '.plans-cout.json'
// Mesuré le 8 nov. 2026 : recherche ≈ 0,17 € (jusqu'à 0,23 €), + 0,01 $ par
// recherche web (non compté jusqu'ici), + juge à vote 0,04 à 0,06 € par page.
const COUT_MOTEUR_ESTIME = 0.42

const PILOTE = [
  { marque: 'Peugeot', famille: 'EB2' },
  { marque: 'Peugeot', famille: 'DV6' },
  { marque: 'Renault', famille: 'K9K' },
  { marque: 'Renault', famille: 'H4D' },
  { marque: 'Peugeot', famille: 'EP6' },
]

// SPRINT 24 — `--familles Marque:FAMILLE,…` joue un autre lot que le pilote,
// et `--seuil N` fixe sa règle d'arrêt (moteurs avec au moins une échéance
// établie). Sans ces options, le comportement du pilote est inchangé.
const LOT = flag('--familles')
  ? flag('--familles').split(',').map((x) => { const [marque, famille] = x.split(':'); return { marque, famille } }).filter((x) => x.marque && x.famille)
  : PILOTE
const SEUIL = Number(flag('--seuil', String(SEUIL_PILOTE))) || SEUIL_PILOTE
const NOM_LOT = flag('--familles') ? 'LOT' : 'LOT PILOTE'

const env = {}
for (const l of (existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const U = env.REACT_APP_SUPABASE_URL ?? '', ANON = env.REACT_APP_SUPABASE_ANON_KEY ?? ''

const jetonAdmin = () => {
  const j = env.ADMIN_ACCESS_TOKEN ?? ''
  if (!j) {
    console.error('\nIl manque ADMIN_ACCESS_TOKEN dans .env.local (jeton d’une heure, voir resourcer-fiches.mjs --appliquer).\n')
    process.exit(1)
  }
  return j
}
const patchFiche = async (jeton, corps) => {
  const res = await fetch(`${U}/functions/v1/admin-defect-sheets`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}`, apikey: ANON },
    body: JSON.stringify(corps),
  })
  const t = await res.text()
  if (res.status === 401) { console.error('\n⚠️ Jeton refusé ou expiré. Rien de plus n’est écrit.'); process.exit(1) }
  return { ok: res.ok, status: res.status, json: (() => { try { return JSON.parse(t) } catch { return { brut: t.slice(0, 200) } } })() }
}

// ── --appliquer ─────────────────────────────────────────────────────────────
if (APPLIQUER) {
  const jeton = jetonAdmin()
  const journal = existsSync(JOURNAL) ? JSON.parse(readFileSync(JOURNAL, 'utf8')) : []
  const aEcrire = journal.filter((j) => !j.erreur && (j.operations ?? []).length > 0 && !j.ecrit)
  if (aEcrire.length === 0) { console.log('Aucun plan à écrire.'); process.exit(0) }
  const sauvegarde = existsSync(SAUVEGARDE) ? JSON.parse(readFileSync(SAUVEGARDE, 'utf8')) : {}
  console.log(`\nÉCRITURE — ${aEcrire.length} fiche(s)\n`)
  let ko = 0
  for (const j of aEcrire) {
    const r = await patchFiche(jeton, { id: j.fiche_id, ajouter_plan: j.operations })
    if (!r.ok) { ko++; console.log(`  ÉCHEC  ${j.fiche.padEnd(16)} HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 160)}`); continue }
    // Le plan d'AVANT est gardé AVANT de marquer la ligne écrite : sans lui,
    // pas de retour arrière possible dans l'heure du jeton.
    if (!(j.fiche_id in sauvegarde)) sauvegarde[j.fiche_id] = { fiche: j.fiche, plan_avant: r.json.plan_avant ?? [] }
    writeFileSync(SAUVEGARDE, JSON.stringify(sauvegarde, null, 1))
    j.ecrit = new Date().toISOString()
    writeFileSync(JOURNAL, JSON.stringify(journal, null, 1))
    console.log(`  OK     ${j.fiche.padEnd(16)} +${r.json.ajoutees} ajoutée(s), ${r.json.completees} complétée(s)` +
      (r.json.refusees?.length ? `, refusées : ${r.json.refusees.join(' ; ')}` : ''))
  }
  console.log(`\n  Sauvegarde des plans d’avant : ${SAUVEGARDE} (retour arrière : --restaurer)`)
  process.exit(ko ? 1 : 0)
}

// ── --restaurer ─────────────────────────────────────────────────────────────
if (RESTAURER) {
  const jeton = jetonAdmin()
  const sauvegarde = existsSync(SAUVEGARDE) ? JSON.parse(readFileSync(SAUVEGARDE, 'utf8')) : {}
  for (const [id, s] of Object.entries(sauvegarde)) {
    const r = await patchFiche(jeton, { id, restaurer_plan: s.plan_avant })
    console.log(`  ${r.ok ? 'RESTAURÉ' : `ÉCHEC ${r.status}`}  ${s.fiche} (${s.plan_avant.length} opération(s))`)
  }
  process.exit(0)
}

// ── Estimation ──────────────────────────────────────────────────────────────
if (ESTIMER) {
  console.log(`\n${NOM_LOT} — ${LOT.length} moteurs, ${COUT_MOTEUR_ESTIME.toFixed(2)} € estimés chacun au plus`)
  for (const p of LOT) console.log(`  ${p.marque} ${p.famille}`)
  console.log(`  ATTENDU : jusqu’à ${(LOT.length * COUT_MOTEUR_ESTIME).toFixed(2)} € · mur ${BUDGET.toFixed(2)} €`)
  console.log(`  Arrêt si moins de ${SEUIL} moteur(s) sur ${LOT.length} sortent avec une échéance établie.`)
  process.exit(0)
}

// ── Génération (dépense) ────────────────────────────────────────────────────
const EVAL = env.EVAL_BYPASS_SECRET ?? ''
if (!U || !ANON || !EVAL) { console.error('REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY, EVAL_BYPASS_SECRET requis.'); process.exit(1) }
const cumul = existsSync(COMPTEUR) ? (JSON.parse(readFileSync(COMPTEUR, 'utf8')).eur ?? 0) : 0
const journal = (existsSync(JOURNAL) ? JSON.parse(readFileSync(JOURNAL, 'utf8')) : []).filter((j) => !j.erreur)
const faits = new Set(journal.map((j) => `${j.marque}|${j.famille}`))
let coutRun = 0, joues = 0

console.log(`\n${NOM_LOT} — mur ${BUDGET.toFixed(2)} € · cumul déjà dépensé ${cumul.toFixed(2)} €\n`)
for (const p of LOT) {
  if (faits.has(`${p.marque}|${p.famille}`)) { console.log(`  déjà joué   ${p.marque} ${p.famille}`); continue }
  const mur = murAtteint({ coutRun, casJoues: joues, coutSession: cumul + coutRun, budgetRun: BUDGET, plafondSession: PLAFOND_CUMUL, estime: COUT_MOTEUR_ESTIME })
  if (mur) { console.log(`\n⏸ mur atteint (${mur}) avant ${p.marque} ${p.famille} : non joué.`); break }
  let r = null, erreur = null
  try {
    const res = await fetch(`${U}/functions/v1/sheet-builder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON}`, 'x-eval-secret': EVAL },
      body: JSON.stringify({ mode: 'plan', marque: p.marque, famille_moteur: p.famille }),
      signal: AbortSignal.timeout(170_000),
    })
    const t = await res.text()
    if (!res.ok) erreur = `HTTP ${res.status} — ${t.slice(0, 200)}`
    else r = JSON.parse(t)
  } catch (e) { erreur = String(e).slice(0, 200) }
  // ⚠️ Une fiche absente (404) n'a rien coûté ; un échec réseau a PEUT-ÊTRE
  // coûté : on s'arrête plutôt que de dérouler à l'aveugle.
  if (erreur && !/HTTP 404/.test(erreur)) {
    console.error(`\n⚠️ ARRÊT — ${p.marque} ${p.famille} : ${erreur}\n   Le coût engagé côté serveur n'est pas connu : vérifier la console Anthropic.`)
    break
  }
  if (!erreur && typeof r?.cout_eur !== 'number') { console.error('\n⚠️ ARRÊT — réponse sans `cout_eur` : le mur ne protège de rien.'); process.exit(1) }
  joues++
  coutRun += r?.cout_eur ?? 0
  const ligne = erreur
    ? { marque: p.marque, famille: p.famille, fiche: `${p.marque} ${p.famille}`, erreur, operations: [] }
    : { marque: p.marque, famille: p.famille, fiche: r.fiche, fiche_id: r.fiche_id, plan_existant: r.plan_existant,
        operations: r.operations, ecartees: r.ecartees, proposees: r.proposees, recherches: r.recherches,
        juge: r.juge, cout_eur: r.cout_eur, le: new Date().toISOString() }
  journal.push(ligne)
  writeFileSync(JOURNAL, JSON.stringify(journal, null, 1))
  writeFileSync(COMPTEUR, JSON.stringify({ eur: Number((cumul + coutRun).toFixed(4)), maj: new Date().toISOString() }))
  console.log(erreur
    ? `  ABSENTE     ${p.marque} ${p.famille} — ${erreur.slice(0, 80)}`
    : `  ${String(r.operations.length).padStart(2)} établie(s) ${r.fiche.padEnd(16)} sur ${r.proposees} proposée(s) · ` +
      `${r.recherches} recherche(s) · juge ${JSON.stringify(r.juge)} · ${r.cout_eur.toFixed(3)} €` +
      (r.operations.length ? `\n              ${r.operations.map((o) => `${o.operation} (${[o.intervalle_km && `${o.intervalle_km} km`, o.intervalle_annees && `${o.intervalle_annees} ans`].filter(Boolean).join(' / ')})`).join(' ; ')}` : ''))
}

// La règle d'arrêt porte sur CE lot, pas sur tout le journal.
const duLot = journal.filter((j) => LOT.some((p) => p.marque === j.marque && p.famille === j.famille))
const reussis = duLot.filter((j) => !j.erreur && (j.operations ?? []).length > 0).length
const tentes = duLot.length
console.log(`\n— ${reussis} moteur(s) sur ${tentes} avec au moins une échéance établie · coût du run ${coutRun.toFixed(3)} € / ${BUDGET.toFixed(2)} €`)
if (tentes >= LOT.length && reussis < SEUIL) {
  console.log(`⏹ RÈGLE D’ARRÊT : moins de ${SEUIL} sur ${LOT.length}. La campagne ne va pas plus loin.`)
}
console.log('  Écriture : node scripts/plans-entretien.mjs --appliquer (jeton admin).')
