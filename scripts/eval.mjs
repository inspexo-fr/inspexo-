#!/usr/bin/env node
// SPRINT 1.5 — Éval de non-régression du score d'annonce.
// Rejoue chaque cas de tests/eval/ contre la fonction `score` déployée
// (bypass du rate limit via EVAL_BYPASS_SECRET) et échoue (exit 1) si :
//   - le statut HTTP ne correspond pas,
//   - le verdict sort de la plage [verdict_min, verdict_max],
//   - le score sort de [score_min, score_max],
//   - un must_not_include apparaît dans la sortie (score + rappels),
//   - un must_include manque,
//   - statut_vendeur / famille_moteur ne correspondent pas,
//   - statut_in_raisons12 : le statut vendeur n'est pas en raison 1 ou 2,
//   - rappels_min : pas assez de rappels trouvés.
// BLOQUANT avant tout deploy.
//
// Usage : npm run eval  (ou node scripts/eval.mjs [nom-de-cas])
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const EVAL_DIR = join(ROOT, 'tests', 'eval')

// ---------- env ----------
function loadEnv() {
  const env = {}
  for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)="?([^"\n]*)"?$/)
    if (m) env[m[1]] = m[2]
  }
  return env
}
const env = loadEnv()
const URL_BASE = env.REACT_APP_SUPABASE_URL
const ANON = env.REACT_APP_SUPABASE_ANON_KEY
const EVAL_SECRET = env.EVAL_BYPASS_SECRET
if (!URL_BASE || !ANON || !EVAL_SECRET) {
  console.error('env manquant : REACT_APP_SUPABASE_URL / REACT_APP_SUPABASE_ANON_KEY / EVAL_BYPASS_SECRET dans .env.local')
  process.exit(2)
}

const SEVERITY = { rouge: 0, orange: 1, vert: 2 }
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const normFam = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')

async function post(path, body, timeoutMs = 170_000) {
  const res = await fetch(`${URL_BASE}/functions/v1/${path}`, {
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ANON}`,
      apikey: ANON,
      'x-eval-secret': EVAL_SECRET,
    },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => null)
  return { status: res.status, json }
}

async function runCase(name) {
  const dir = join(EVAL_DIR, name)
  const annonce = readFileSync(join(dir, 'annonce.txt'), 'utf8').trim()
  const expected = JSON.parse(readFileSync(join(dir, 'expected.json'), 'utf8'))
  const input = existsSync(join(dir, 'input.json'))
    ? JSON.parse(readFileSync(join(dir, 'input.json'), 'utf8'))
    : {}

  const failures = []
  const t0 = Date.now()

  let { status, json } = await post('score', { text: annonce, ...input })

  // Fiche moteur encore en génération ? Un retry après 50 s.
  if (
    status === 200 &&
    json?.result?.fiche?.cache === 'pending' &&
    (expected.must_include?.length || expected.famille_moteur)
  ) {
    process.stdout.write('  (fiche en génération — retry dans 50 s)\n')
    await new Promise((r) => setTimeout(r, 50_000))
    ;({ status, json } = await post('score', { text: annonce, ...input }))
  }

  const expectedStatus = expected.http_status ?? 200
  if (status !== expectedStatus) {
    failures.push(`HTTP ${status} ≠ attendu ${expectedStatus} — ${JSON.stringify(json).slice(0, 150)}`)
    return { failures, ms: Date.now() - t0 }
  }
  if (expectedStatus !== 200) return { failures, ms: Date.now() - t0 }

  const r = json.result
  let haystack = JSON.stringify(r)

  // Rappels (inclus dans le texte vérifié + assertion rappels_min)
  let rappels = null
  if (r.vehicule?.marque && r.vehicule?.modele) {
    try {
      const rr = await post('rappels', {
        marque: r.vehicule.marque,
        modele: r.vehicule.modele,
        annee: r.vehicule.annee,
        analysis_id: json.id,
      }, 30_000)
      rappels = rr.json
      haystack += JSON.stringify(rappels)
    } catch (_) { /* rappels indisponibles : rappels_min échouera le cas échéant */ }
  }
  const hay = norm(haystack)

  // Verdict / score
  if (expected.verdict_min && SEVERITY[r.verdict] < SEVERITY[expected.verdict_min]) {
    failures.push(`verdict ${r.verdict} < min ${expected.verdict_min}`)
  }
  if (expected.verdict_max && SEVERITY[r.verdict] > SEVERITY[expected.verdict_max]) {
    failures.push(`verdict ${r.verdict} > max ${expected.verdict_max}`)
  }
  if (expected.score_min != null && r.score < expected.score_min) {
    failures.push(`score ${r.score} < min ${expected.score_min}`)
  }
  if (expected.score_max != null && r.score > expected.score_max) {
    failures.push(`score ${r.score} > max ${expected.score_max}`)
  }

  // Statut vendeur / famille moteur
  if (expected.statut_vendeur && r.statut_vendeur !== expected.statut_vendeur) {
    failures.push(`statut_vendeur ${r.statut_vendeur} ≠ ${expected.statut_vendeur}`)
  }
  if ('famille_moteur' in expected) {
    const actual = r.vehicule?.famille_moteur ?? null
    if (expected.famille_moteur === null) {
      if (actual !== null) failures.push(`famille_moteur ${actual} ≠ null attendu`)
    } else {
      const a = normFam(actual), e = normFam(expected.famille_moteur)
      if (!a || (!a.startsWith(e) && !e.startsWith(a))) {
        failures.push(`famille_moteur ${actual} incompatible avec ${expected.famille_moteur}`)
      }
    }
  }

  // Statut vendeur en raison 1 ou 2
  if (expected.statut_in_raisons12) {
    const deuxPremieres = (r.raisons_principales || []).slice(0, 2).map(norm).join(' ')
    if (!/intermediaire|deguis|depot[- ]vente|mandataire|agence|garantie legale/.test(deuxPremieres)) {
      failures.push('statut vendeur absent des raisons 1-2')
    }
  }

  // Rappels minimum
  if (expected.rappels_min != null) {
    const n = Array.isArray(rappels?.rappels) ? rappels.rappels.length : 0
    if (n < expected.rappels_min) failures.push(`rappels ${n} < min ${expected.rappels_min}`)
  }

  // must_include / must_not_include (une entrée tableau = alternatives, OU logique)
  for (const needle of expected.must_include || []) {
    const alts = Array.isArray(needle) ? needle : [needle]
    if (!alts.some((a) => hay.includes(norm(a)))) {
      failures.push(`must_include manquant : "${alts.join('|')}"`)
    }
  }
  for (const needle of expected.must_not_include || []) {
    if (hay.includes(norm(needle))) failures.push(`must_not_include présent : "${needle}"`)
  }

  return { failures, ms: Date.now() - t0, verdict: r.verdict, score: r.score, id: json.id }
}

// ---------- main ----------
const only = process.argv[2]
const cases = readdirSync(EVAL_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((n) => !only || n === only)
  .sort()

let failed = 0
console.log(`Éval Inspexo — ${cases.length} cas contre ${URL_BASE}\n`)
for (const name of cases) {
  process.stdout.write(`▶ ${name}\n`)
  try {
    const { failures, ms, verdict, score } = await runCase(name)
    if (failures.length === 0) {
      console.log(`  PASS (${(ms / 1000).toFixed(1)}s${verdict ? ` — ${verdict} ${score}` : ''})\n`)
    } else {
      failed++
      console.log(`  FAIL (${(ms / 1000).toFixed(1)}s${verdict ? ` — ${verdict} ${score}` : ''})`)
      for (const f of failures) console.log(`    ✗ ${f}`)
      console.log('')
    }
  } catch (e) {
    failed++
    console.log(`  FAIL — exception : ${e.message}\n`)
  }
}
console.log(failed === 0 ? `✓ ${cases.length}/${cases.length} cas passent` : `✗ ${failed}/${cases.length} cas échouent`)
process.exit(failed === 0 ? 0 : 1)
