#!/usr/bin/env node
// SPRINT 7 — Éval de la lecture du PV de contrôle technique, contre les
// fonctions DÉPLOYÉES (header x-eval-secret).
//
// Un cas = tests/eval-ct/<cas>/ { annonce.txt, photos/*.png|jpg, expected.json }.
//  - pv-synthetique : PV généré (node tests/eval-ct/generer-pv.mjs), COMMITÉ.
//  - PV RÉELS : déposer les photos dans tests/eval-ct/<cas>/photos/ (gitignoré
//    — un PV réel porte plaque, VIN et nom du titulaire) + expected.json.
//
// Coût : l'analyse de l'annonce passe par le CACHE 7 j de `score` (≈ 0,08 €
// seulement au premier passage, 0 ensuite) ; chaque lecture de PV ≈ 0,01 €.
// Vérifie aussi, GRATUITEMENT, que la fonction refuse un appelant sans Pass.
//
// Usage : npm run eval:ct   (ou node tests/eval-ct/run.mjs [nom-de-cas])
import { readFileSync, readdirSync, existsSync } from 'node:fs'
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
if (!URL_BASE || !ANON || !EVAL_SECRET) {
  console.error('env manquant : REACT_APP_SUPABASE_URL / REACT_APP_SUPABASE_ANON_KEY / EVAL_BYPASS_SECRET')
  process.exit(2)
}

async function post(path, body, { evalSecret = true, timeoutMs = 170_000 } = {}) {
  const res = await fetch(`${URL_BASE}/functions/v1/${path}`, {
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ANON}`,
      apikey: ANON,
      ...(evalSecret ? { 'x-eval-secret': EVAL_SECRET } : {}),
    },
    body: JSON.stringify(body),
  })
  return { status: res.status, json: await res.json().catch(() => null) }
}

const imageEnDataUrl = (p) => {
  const ext = p.toLowerCase().endsWith('.png') ? 'png' : 'jpeg'
  return `data:image/${ext};base64,${readFileSync(p).toString('base64')}`
}

async function runCase(name) {
  const dir = join(DIR, name)
  const expected = JSON.parse(readFileSync(join(dir, 'expected.json'), 'utf8'))
  const annonce = readFileSync(join(dir, 'annonce.txt'), 'utf8')
  const photosDir = join(dir, 'photos')
  const photos = existsSync(photosDir)
    ? readdirSync(photosDir).filter(f => /\.(png|jpe?g|webp)$/i.test(f)).sort()
      .map(f => imageEnDataUrl(join(photosDir, f)))
    : []
  const failures = []
  if (photos.length === 0) {
    return { failures: [`aucune photo dans ${photosDir} (PV réel à déposer ?)`], skipped: true }
  }

  // 1. Analyse de l'annonce (cache 7 j : même texte → même analyse, 0 token).
  const score = await post('score', { text: annonce })
  if (score.status !== 200 || !score.json?.id) {
    return { failures: [`score HTTP ${score.status} : ${JSON.stringify(score.json)?.slice(0, 160)}`] }
  }
  const analysisId = score.json.id
  console.log(`   analyse ${analysisId}${score.json.cache ? ' (cache)' : ''} — verdict initial ${score.json.result?.verdict}/${score.json.result?.score}`)

  // 2. Sans secret d'éval ni Pass : la fonction DOIT refuser (gratuit).
  const refus = await post('lecture-ct', { analysis_id: analysisId, images: photos }, { evalSecret: false, timeoutMs: 30_000 })
  if (refus.status !== 403 || refus.json?.error !== 'pass_requis') {
    failures.push(`sans Pass : attendu 403 pass_requis, reçu ${refus.status} ${refus.json?.error}`)
  }

  // 3. Lecture du PV.
  const lu = await post('lecture-ct', { analysis_id: analysisId, images: photos })
  if (lu.status !== 200) {
    failures.push(`lecture-ct HTTP ${lu.status} : ${JSON.stringify(lu.json)?.slice(0, 160)}`)
    return { failures }
  }
  const l = lu.json?.lecture
  const r = lu.json?.result
  const tout = JSON.stringify(lu.json)

  if (expected.lisible && !l?.lisible) failures.push('PV déclaré illisible')
  if (expected.km_releve != null && l?.km_releve !== expected.km_releve) {
    failures.push(`km_releve ${l?.km_releve} ≠ ${expected.km_releve}`)
  }
  if (expected.date_ct && l?.date_ct !== expected.date_ct) failures.push(`date_ct ${l?.date_ct} ≠ ${expected.date_ct}`)
  if (expected.contre_visite != null && l?.contre_visite !== expected.contre_visite) {
    failures.push(`contre_visite ${l?.contre_visite} ≠ ${expected.contre_visite}`)
  }
  const defauts = l?.defauts ?? []
  if (expected.defauts_min != null && defauts.length < expected.defauts_min) {
    failures.push(`${defauts.length} défaut(s) < ${expected.defauts_min}`)
  }
  for (const code of expected.codes_attendus ?? []) {
    if (!defauts.some(d => d.code === code)) failures.push(`code attendu absent : ${code}`)
  }
  if (expected.majeures_min != null) {
    const n = defauts.filter(d => d.categorie === 'majeure' || d.categorie === 'critique').length
    if (n < expected.majeures_min) failures.push(`${n} majeure(s)/critique(s) < ${expected.majeures_min}`)
  }
  if (expected.chiffres_min != null) {
    const n = defauts.filter(d => d.cout_min_eur != null || d.cout_max_eur != null).length
    if (n < expected.chiffres_min) failures.push(`${n} défaut(s) chiffré(s) < ${expected.chiffres_min}`)
  }
  for (const d of defauts) {
    if (!d.explication || d.explication.length < 15) failures.push(`défaut sans explication : ${d.libelle?.slice(0, 50)}`)
  }
  for (const pii of expected.pii_interdits ?? []) {
    if (tout.toLowerCase().includes(pii.toLowerCase())) failures.push(`DONNÉE PERSONNELLE restituée : ${pii}`)
  }
  if (expected.compteur_contredit) {
    if (!(r?.incoherences ?? []).some(i => /proc[eè]s-verbal/i.test(i))) {
      failures.push('incohérence kilométrique (PV vs annonce) absente')
    }
    if (expected.verdict_apres && r?.verdict !== expected.verdict_apres) {
      failures.push(`verdict après lecture ${r?.verdict} ≠ ${expected.verdict_apres}`)
    }
    if (expected.score_max_apres != null && !(typeof r?.score === 'number' && r.score <= expected.score_max_apres)) {
      failures.push(`score après lecture ${r?.score} > ${expected.score_max_apres}`)
    }
  }
  return { failures }
}

const seul = process.argv[2]
const cas = readdirSync(DIR, { withFileTypes: true })
  .filter(d => d.isDirectory() && existsSync(join(DIR, d.name, 'expected.json')))
  .map(d => d.name)
  .filter(n => !seul || n === seul)
if (cas.length === 0) {
  console.error(seul ? `cas introuvable : ${seul}` : 'aucun cas')
  process.exit(2)
}

let ko = 0, skipped = 0
for (const name of cas) {
  console.log(`\n▶ ${name}`)
  try {
    const { failures, skipped: s } = await runCase(name)
    if (s) { skipped++; console.log(`   IGNORÉ — ${failures[0]}`); continue }
    if (failures.length === 0) console.log('   PASS')
    else { ko++; for (const f of failures) console.log(`   FAIL — ${f}`) }
  } catch (e) {
    ko++
    console.log(`   FAIL — exception : ${e.message}`)
  }
}
console.log(`\n${cas.length - ko - skipped} PASS / ${ko} FAIL / ${skipped} ignoré(s). Coût ≈ 0,01 € par lecture (+ 0,08 € par analyse non cachée).`)
process.exit(ko === 0 ? 0 : 1)
