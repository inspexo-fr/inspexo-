// Éval de la lecture des pièces du vendeur (sprint 23, lot 2).
// Usage : node tests/eval-facture/run.mjs --budget 0.20
//
// 1. Analyse de l'annonce (cache 7 j de `score` : ≈ 0,12 € au premier passage, 0 ensuite).
// 2. Étapes de expected.json, dans l'ordre, chacune en régime ÉPHÉMÈRE (pas de
//    dossier : l'éval n'a pas d'utilisateur) — donc indépendantes.
// Mur : chaque appel RÉSERVE son coût estimé avant de partir.
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
const ROOT = join(DIR, '..', '..')
const env = {}
for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)="?([^"\n]*)"?$/)
  if (m) env[m[1]] = m[2]
}
const URL_BASE = env.REACT_APP_SUPABASE_URL
const ANON = env.REACT_APP_SUPABASE_ANON_KEY
const EVAL_SECRET = env.EVAL_BYPASS_SECRET
const iB = process.argv.indexOf('--budget')
const BUDGET = iB > 0 ? Number(process.argv[iB + 1]) : NaN
if (!Number.isFinite(BUDGET) || BUDGET <= 0) { console.error('--budget <eur> obligatoire'); process.exit(2) }
const ESTIMATION = { score: 0.15, photo: 0.02, texte: 0 }

let depense = 0
const reserver = (nature) => {
  if (depense + ESTIMATION[nature] > BUDGET) {
    console.log(`MUR — ${depense.toFixed(3)} € dépensés, l'appel suivant (${nature}, ≈ ${ESTIMATION[nature]} €) dépasserait ${BUDGET} €. Arrêt.`)
    console.log(`Coût total : ${depense.toFixed(3)} €`)
    process.exit(1)
  }
}
async function post(path, body) {
  const res = await fetch(`${URL_BASE}/functions/v1/${path}`, {
    method: 'POST', signal: AbortSignal.timeout(170_000),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON}`, apikey: ANON, 'x-eval-secret': EVAL_SECRET },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => null)
  if (typeof json?.cout_eur === 'number') depense += json.cout_eur
  return { status: res.status, json }
}

const cas = join(DIR, 'clio-distribution')
const expected = JSON.parse(readFileSync(join(cas, 'expected.json'), 'utf8'))
const failures = []

reserver('score')
const s = await post('score', { text: readFileSync(join(cas, 'annonce.txt'), 'utf8') })
if (s.status !== 200 || !s.json?.id) { console.log(`FAIL — score HTTP ${s.status}`); process.exit(1) }
const id = s.json.id
const r0 = s.json.result
console.log(`analyse ${id}${s.json.cache ? ' (cache)' : ''} — ${r0?.verdict} ${r0?.score} — plafond : ${r0?.plafond_raison ?? 'aucun'}`)
console.log(`  URL : https://www.inspexo.io/a/${id}`)
if (!(r0?.score <= expected.plafond_initial_max)) failures.push(`score initial ${r0?.score} > ${expected.plafond_initial_max}`)
if (!/opération d'entretien critique/i.test(r0?.plafond_raison ?? '')) failures.push(`plafond initial inattendu : ${r0?.plafond_raison}`)

for (const e of expected.etapes) {
  reserver(e.type)
  const corps = e.type === 'photo'
    ? { analysis_id: id, images: [`data:image/png;base64,${readFileSync(join(cas, 'photos', e.fichier)).toString('base64')}`] }
    : { analysis_id: id, texte: e.texte }
  const r = await post('reponse-vendeur', corps)
  const nom = e.fichier ?? 'texte collé'
  if (r.status !== 200) { failures.push(`${nom} : HTTP ${r.status} ${JSON.stringify(r.json)?.slice(0, 160)}`); continue }
  const p = r.json.piece
  console.log(`- ${nom} : ${p ? `${p.statut}, vérifié ${JSON.stringify(p.verifie)}, incohérences ${JSON.stringify(p.incoherences)}, non vérifiable ${JSON.stringify(p.non_verifiable)}` : `${r.json.declares?.length ?? 0} fait(s) déclaré(s)`} — levés ${JSON.stringify(r.json.leves)} — ${r.json.result?.verdict} ${r.json.result?.score}`)
  const brut = JSON.stringify(r.json)
  if (/FG-?456-?HJ|ZT-?731-?KM/i.test(brut)) failures.push(`${nom} : une immatriculation sort dans la réponse`)
  if (JSON.stringify(r.json.leves) !== JSON.stringify(e.leves)) failures.push(`${nom} : levés ${JSON.stringify(r.json.leves)} ≠ ${JSON.stringify(e.leves)}`)
  if (e.type === 'photo') {
    if (p?.statut !== e.statut) failures.push(`${nom} : statut ${p?.statut} ≠ ${e.statut}`)
    if (Boolean(p?.incoherences?.length) !== e.incoherence) failures.push(`${nom} : incohérence ${p?.incoherences?.length} (attendu ${e.incoherence})`)
  } else {
    if (!(r.json.declares?.length > 0) || r.json.declares.some((d) => d.statut !== 'declare')) failures.push('texte : faits non relevés ou non déclarés')
    if (r.json.result?.score !== r0?.score) failures.push(`texte : le score a bougé (${r0?.score} → ${r.json.result?.score})`)
  }
  if (e.leves.length === 0 && r.json.result?.score !== r0?.score) failures.push(`${nom} : le score a bougé sans plafond levé`)
}

console.log(failures.length ? failures.map((f) => `FAIL — ${f}`).join('\n') : 'PASS — pièces du vendeur')
console.log(`Coût total : ${depense.toFixed(3)} €`)
process.exit(failures.length ? 1 : 0)
