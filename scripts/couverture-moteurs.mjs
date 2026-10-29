// SPRINT 6 — Campagne de couverture des familles moteur.
//
// Génère (ou régénère) la fiche de chaque famille de data/famillesMoteur.js
// en appelant la fonction `sheet-builder` déployée, une par une, et tient le
// budget : le coût réel de chaque génération est renvoyé par la fonction et
// cumulé dans .couverture-cout.json. Au-delà du plafond, la campagne
// s'ARRÊTE et affiche ce qui reste à faire — jamais de dépassement silencieux.
//
// Usage :
//   node scripts/couverture-moteurs.mjs                 # ce qui manque
//   node scripts/couverture-moteurs.mjs --regenerer     # tout, même l'existant
//   node scripts/couverture-moteurs.mjs --plafond 5     # budget de ce passage
//   node scripts/couverture-moteurs.mjs --famille EB2DT # une seule
//   node scripts/couverture-moteurs.mjs --etat          # inventaire, sans appel
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FAMILLES_MOTEUR } from '../src/data/famillesMoteur.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = Object.fromEntries(
  readFileSync(join(ROOT, '.env.local'), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const URL_BASE = env.REACT_APP_SUPABASE_URL
const ANON = env.REACT_APP_SUPABASE_ANON_KEY
const EVAL_SECRET = env.EVAL_BYPASS_SECRET
if (!URL_BASE || !ANON || !EVAL_SECRET) {
  console.error('.env.local incomplet (REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY, EVAL_BYPASS_SECRET)')
  process.exit(1)
}

const arg = (nom, defaut = null) => {
  const i = process.argv.indexOf(nom)
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : defaut
}
const REGENERER = process.argv.includes('--regenerer')
const ETAT_SEUL = process.argv.includes('--etat')
const PLAFOND = Number(arg('--plafond', '15')) || 15
const UNE_FAMILLE = arg('--famille')
const COUT_FICHIER = join(ROOT, '.couverture-cout.json')
if (process.argv.includes('--reset-cout') && existsSync(COUT_FICHIER)) rmSync(COUT_FICHIER)

let cumul = existsSync(COUT_FICHIER) ? (JSON.parse(readFileSync(COUT_FICHIER, 'utf8')).total_eur ?? 0) : 0
const depart = cumul
const ajouterCout = (eur) => {
  if (typeof eur !== 'number' || !Number.isFinite(eur)) return
  cumul += eur
  writeFileSync(COUT_FICHIER, JSON.stringify({ total_eur: Math.round(cumul * 10000) / 10000, maj: new Date().toISOString() }, null, 2))
}

async function appel(path, body, timeoutMs = 200_000) {
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
  return { status: res.status, json: await res.json().catch(() => null) }
}

/** Inventaire des fiches publiées, via la RPC publique (lecture seule). */
async function etatDesFiches() {
  const etat = new Map()
  for (const f of FAMILLES_MOTEUR) {
    const res = await fetch(`${URL_BASE}/rest/v1/rpc/get_defect_sheet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` },
      body: JSON.stringify({ p_marque: f.marque, p_famille: f.famille }),
    })
    const d = await res.json().catch(() => null)
    etat.set(f.famille, d && d.pannes
      ? { pannes: d.pannes.length, plan: (d.plan_entretien ?? []).length, statut: d.statut ?? '?' }
      : null)
  }
  return etat
}

const familles = FAMILLES_MOTEUR.filter((f) => !UNE_FAMILLE || f.famille === UNE_FAMILLE)

console.log(`Couverture moteurs — ${familles.length} familles · plafond ${PLAFOND} € · déjà dépensé ${depart.toFixed(2)} €\n`)

const etat = await etatDesFiches()
if (ETAT_SEUL) {
  let ok = 0, pauvres = 0, absentes = 0
  for (const f of familles) {
    const e = etat.get(f.famille)
    const verdict = !e ? 'ABSENTE' : e.pannes >= 3 ? 'OK' : 'PAUVRE'
    if (verdict === 'OK') ok++; else if (verdict === 'PAUVRE') pauvres++; else absentes++
    console.log(`  ${verdict.padEnd(8)} ${f.marque.padEnd(12)} ${f.famille.padEnd(10)} ${f.nom_commercial.padEnd(22)} ${e ? `${e.pannes} pannes, ${e.plan} entretien` : ''}`)
  }
  console.log(`\n${ok} au seuil · ${pauvres} pauvres · ${absentes} absentes`)
  process.exit(0)
}

const resultats = []
let arrete = null
for (const f of familles) {
  const e = etat.get(f.famille)
  // Une fiche déjà fournie n'est pas régénérée sans --regenerer.
  if (!REGENERER && e && e.pannes >= 3) {
    resultats.push({ ...f, statut: 'deja', pannes: e.pannes, plan: e.plan, cout: 0 })
    console.log(`  ·  ${f.marque} ${f.famille} — déjà ${e.pannes} pannes, ignorée`)
    continue
  }
  if (cumul >= PLAFOND) {
    arrete = f
    break
  }
  const t0 = Date.now()
  try {
    const { status, json } = await appel('sheet-builder', {
      marque: f.marque,
      famille_moteur: f.famille,
      moteur_label: f.nom_commercial,
      mode: 'regenerer', // hors cache et hors cooldown : on veut les règles du jour
    })
    const cout = json?.cout_eur ?? 0
    ajouterCout(cout)
    const secondes = ((Date.now() - t0) / 1000).toFixed(0)
    if (status !== 200 || !json || json.error) {
      resultats.push({ ...f, statut: 'erreur', pannes: 0, plan: 0, cout })
      console.log(`  ✗  ${f.marque} ${f.famille} — ${json?.error ?? `HTTP ${status}`} (${secondes}s, ${cout.toFixed(3)} €)`)
    } else {
      const sousSeuil = json.status === 'failed' || (json.pannes ?? 0) === 0
      resultats.push({ ...f, statut: sousSeuil ? 'sous_seuil' : 'creee', pannes: json.pannes ?? 0, plan: json.plan_entretien ?? 0, cout })
      console.log(`  ${sousSeuil ? '~' : '✓'}  ${f.marque} ${f.famille} — ${json.status}, ${json.pannes ?? 0} pannes, ${json.plan_entretien ?? 0} entretien (${secondes}s, ${cout.toFixed(3)} €) · cumul ${cumul.toFixed(2)} €`)
    }
  } catch (err) {
    resultats.push({ ...f, statut: 'erreur', pannes: 0, plan: 0, cout: 0 })
    console.log(`  ✗  ${f.marque} ${f.famille} — ${err.message}`)
  }
}

const n = (s) => resultats.filter((r) => r.statut === s).length
console.log(`\n— ${n('creee')} fiche(s) créée(s) · ${n('sous_seuil')} sous le seuil · ${n('erreur')} en erreur · ${n('deja')} déjà fournie(s)`)
console.log(`— Coût de ce passage : ${(cumul - depart).toFixed(2)} € · cumul campagne ${cumul.toFixed(2)} € / ${PLAFOND} €`)
if (arrete) {
  const restantes = familles.slice(familles.indexOf(arrete))
  console.log(`\n⏸ PLAFOND ATTEINT — campagne arrêtée avant ${arrete.marque} ${arrete.famille}.`)
  console.log(`   ${restantes.length} famille(s) non traitée(s) : ${restantes.map((r) => r.famille).join(', ')}`)
  console.log('   Relancer avec --plafond <montant> après validation.')
}
writeFileSync(join(ROOT, '.couverture-resultats.json'), JSON.stringify(resultats, null, 2))
