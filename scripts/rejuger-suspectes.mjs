#!/usr/bin/env node
// SPRINT 23 — Rejugement des 42 pages SUSPECTES (décision d'Utku du 11 nov. 2026).
//
// Pages rejetées « non_soutenue » avec une justification VIDE dans les
// campagnes de production (atlas 4-5 nov., atlas hors moteur, re-sourcing du
// 8 nov.) : signature probable d'un verdict encodé en chaîne JSON que l'ancien
// `atlas-builder` lisait par `verdicts?.[0]`. Elles sont REJUGÉES avec le juge
// corrigé (lecteur commun, vote, cache), en mode rattrapage (aucune recherche).
//
// ⚠️ CACHE ET JOURNAL SEULEMENT. Rien n'est écrit dans l'atlas ni dans les
// fiches : une entrée confirmée ne revient qu'à l'étape (f), la fusion, qui
// est un changement de score de la séquence.
//
// Usage : node scripts/rejuger-suspectes.mjs --estimer
//         node scripts/rejuger-suspectes.mjs --budget 3
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { murAtteint } from './budget.mjs'

const args = process.argv.slice(2)
const flag = (n, d = null) => { const i = args.indexOf(n); return i >= 0 ? (args[i + 1] ?? d) : d }
const ESTIMER = args.includes('--estimer')
const BUDGET = Number(flag('--budget', '0')) || 0
const JOURNAL = 'docs/rejugement-silences-journal.json'
const PAR_PAGE_MIN = 0.042, PAR_PAGE_MAX = 0.063

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim() }
const vide = (e) => (e.motif === 'non_soutenue' || e.verdict === 'non_soutenue') && !String(e.justification || '').trim()

// Entrées d'origine (avant réécriture) : l'atlas avant sprint 16 et les
// candidats hors moteur. Le texte jugé est celui que l'entrée portait alors.
const { execSync } = await import('node:child_process')
const atlasAvant = execSync('git show 8f9b916^:src/data/defectAtlas.js', { encoding: 'utf8' })
const dir = '/private/tmp'
const tmp = `${process.env.TMPDIR ?? dir}/atlas-avant-${process.pid}.mjs`
writeFileSync(tmp, atlasAvant)
const { defectAtlas } = await import(tmp)
const origMoteur = Object.entries(defectAtlas).flatMap(([m, v]) => (v.defects || []).map((d) => ({ ...d, marque: m })))
const candHM = (() => { const c = JSON.parse(readFileSync('docs/atlas-hors-moteur-candidats.json', 'utf8')); return Array.isArray(c) ? c : (c.candidats || c.entrees || Object.values(c)) })()

const unites = []
for (const [fichier, orig] of [['docs/atlas-sourcing-resultats.json', origMoteur], ['docs/atlas-hors-moteur-resultats.json', candHM]]) {
  const d = JSON.parse(readFileSync(fichier, 'utf8'))
  for (const r of (d.resultats || d)) {
    const pages = (r.ecartees || []).filter(vide).map((e) => e.url)
    if (!pages.length) continue
    const o = orig.find((x) => x.title === r.title) ?? {}
    unites.push({ source: fichier, titre: r.title, garde_avant: r.garde === true, pages,
      entree: { marque: r.marque, title: r.title, description: o.description ?? '', models: o.models ?? '', years: o.years ?? '' } })
  }
}
for (const j of JSON.parse(readFileSync('docs/resourcage-fiches-journal.json', 'utf8'))) {
  const pages = (j.ecartees || []).filter(vide).map((e) => e.url)
  if (!pages.length) continue
  unites.push({ source: 'docs/resourcage-fiches-journal.json', titre: `${j.fiche} · ${j.titre}`, garde_avant: j.porte === true, pages,
    entree: { marque: j.marque, title: j.titre, description: j.symptomes ?? '', models: j.famille, years: j.annees ?? '' } })
}
const nPages = unites.reduce((n, u) => n + u.pages.length, 0)
console.log(`${unites.length} entrées · ${nPages} pages suspectes`)
console.log(`coût estimé : ${(nPages * PAR_PAGE_MIN).toFixed(2)} à ${(nPages * PAR_PAGE_MAX).toFixed(2)} € (moins les pages déjà au cache)`)
if (ESTIMER) process.exit(0)
if (!BUDGET) { console.error('--budget <eur> obligatoire (mur du run).'); process.exit(1) }

const journal = existsSync(JOURNAL) ? JSON.parse(readFileSync(JOURNAL, 'utf8')) : { entrees: {} }
let cout = 0, joues = 0
for (const u of unites) {
  if (journal.entrees[u.titre]) continue
  const mur = murAtteint({ coutRun: cout, casJoues: joues, coutSession: cout, budgetRun: BUDGET, plafondSession: BUDGET, estime: PAR_PAGE_MAX * u.pages.length })
  if (mur) { console.log(`⏸ mur atteint avant « ${u.titre.slice(0, 50)} » : non joué.`); break }
  const res = await fetch(`${env.REACT_APP_SUPABASE_URL}/functions/v1/atlas-builder`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.REACT_APP_SUPABASE_ANON_KEY}`, 'x-eval-secret': env.EVAL_BYPASS_SECRET },
    body: JSON.stringify({ entree: u.entree, urls: u.pages }), signal: AbortSignal.timeout(240_000) })
  const r = await res.json().catch(() => null)
  if (!res.ok || typeof r?.cout_eur !== 'number') { console.error(`⚠️ ARRÊT — ${u.titre.slice(0, 50)} : HTTP ${res.status}, coût non chiffrable.`); process.exit(1) }
  joues++; cout += r.cout_eur
  const verdicts = [...(r.sources ?? []).map((x) => [x.url, 'soutenue']), ...(r.ecartees ?? []).map((e) => [e.url, e.motif])]
  journal.entrees[u.titre] = { source: u.source, garde_avant: u.garde_avant, pages: u.pages, verdicts, juge: r.juge, cout_eur: r.cout_eur, le: new Date().toISOString() }
  writeFileSync(JOURNAL, JSON.stringify(journal, null, 1))
  console.log(`  ${u.garde_avant ? 'gardée ' : 'retirée'} → ${verdicts.some((v) => v[1] === 'soutenue') ? 'CONFIRMÉE' : 'non confirmée'}  ${u.titre.slice(0, 60)} · ${JSON.stringify(r.juge)} · ${r.cout_eur.toFixed(3)} €`)
}
console.log(`\n— Coût : ${cout.toFixed(3)} € / ${BUDGET.toFixed(2)} € · journal ${JOURNAL} · rien n'est écrit dans l'atlas ni les fiches.`)
