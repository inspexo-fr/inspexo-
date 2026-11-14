// SPRINT 24 — les prises « à revérifier » : chercher une AUTRE source portante
// (décision d'Utku du 14 nov. 2026). atlas-builder cherche et fait juger
// l'affirmation ; une prise sans nouvelle source sera MASQUÉE (jamais
// supprimée) pendant la session de jeton. Mur --budget (défaut 1 €).
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { murAtteint } from './budget.mjs'
import { sourcesPortentLEntree } from '../supabase/functions/_shared/atlasSource.ts'
const BUDGET = Number(process.argv[process.argv.indexOf('--budget') + 1]) || 1
const PLAFOND = 40, COMPTEUR = '.credits-cout.json', SORTIE = 'docs/prises-autre-source.json'
const env = {}
for (const l of (existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '').split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '') }
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${env.REACT_APP_SUPABASE_ANON_KEY}`, 'x-eval-secret': env.EVAL_BYPASS_SECRET }
const CIBLES = [/N47/, /Mini N18/, /OM651/, /DV6/]
const u = JSON.parse(readFileSync('docs/prises-reverification.json', 'utf8')).unites.filter((x) => x.statut === 'a_reverifier' && CIBLES.some((re) => re.test(x.fiche)))
const cumul = existsSync(COMPTEUR) ? JSON.parse(readFileSync(COMPTEUR, 'utf8')).eur ?? 0 : 0
let cout = 0, n = 0; const out = []
for (const x of u) {
  const mur = murAtteint({ coutRun: cout, casJoues: n, coutSession: cumul + cout, budgetRun: BUDGET, plafondSession: PLAFOND, estime: 0.25 })
  if (mur) { console.log(`⏸ mur (${mur}) avant ${x.fiche}`); break }
  const [marque, ...fam] = x.fiche.split(' ')
  const res = await fetch(`${env.REACT_APP_SUPABASE_URL}/functions/v1/atlas-builder`, { method: 'POST', headers: H, signal: AbortSignal.timeout(170000),
    body: JSON.stringify({ entree: { marque, title: x.partie.slice(0, 200), description: `${x.type} — ${x.partie}. Chercher une source officielle (constructeur, RappelConso, autorité) ou de presse qui l'atteste, autre que ${new URL(x.url).hostname}.`, models: x.fiche, years: '' } }) })
  const r = await res.json().catch(() => null)
  if (!res.ok || typeof r?.cout_eur !== 'number') { console.error(`⚠️ ARRÊT — HTTP ${res.status}`); break }
  n++; cout += r.cout_eur
  // Seulement une source RETENUE par le juge ET de rang portant (r.garde).
  const nouvelles = r.garde === true ? (r.sources ?? []).map((s) => s.url).filter((s) => s && s !== x.url && sourcesPortentLEntree([s])) : []
  out.push({ fiche: x.fiche, partie: x.partie, ancienne: x.url, trouve: r.garde === true || (r.sources ?? []).length > 0, nouvelles, motif: r.motif ?? null, decision: nouvelles.length ? 'garder (nouvelle source)' : 'masquer' })
  console.log(`${nouvelles.length ? 'SOURCE' : 'aucune'} ${x.fiche} · ${x.partie.slice(0, 60)} · ${nouvelles[0] ?? r.motif ?? ''} · ${cout.toFixed(3)} €`)
}
writeFileSync(SORTIE, JSON.stringify(out, null, 1))
writeFileSync(COMPTEUR, JSON.stringify({ eur: Number((cumul + cout).toFixed(4)), maj: new Date().toISOString() }))
console.log(`— ${out.filter((o) => o.nouvelles.length).length}/${out.length} avec une autre source · ${cout.toFixed(3)} € / ${BUDGET} € · crédits ${(cumul + cout).toFixed(2)} € / ${PLAFOND} €`)
