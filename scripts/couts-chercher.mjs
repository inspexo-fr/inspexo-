// SPRINT 24, campagne 1 — phase « chercher » (PAYANTE). Pour chaque panne
// confirmée sans coût (docs/couts-manquants-releve.json, hors rappels/OTS) :
//   1. atlas-builder cherche des pages publiant le coût de réparation ;
//   2. chaque page proposée est relue ICI (gratuit) : les deux montants
//      doivent y figurer LITTÉRALEMENT, dans une même phrase citée ;
//   3. le juge (sources-externes, 2 votes + 1 en cas de désaccord, silence ≠
//      vote) valide « Selon <page>, <panne> sur <moteur> : X à Y € ».
// Rien n'est écrit en base : sortie docs/couts-manquants-journal.json, écrite
// ensuite par une session de jeton (admin-defect-sheets `ajouter_cout`).
//   node scripts/couts-chercher.mjs --budget 3.50 --limite 10
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { murAtteint } from './budget.mjs'
import { montantPresent } from '../supabase/functions/_shared/defectSheets.ts'
import { sourcesPortentLEntree, coutUtilisable } from '../supabase/functions/_shared/atlasSource.ts'

const args = process.argv.slice(2)
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d }
const BUDGET = Number(flag('--budget', '3.5'))
const LIMITE = Number(flag('--limite', '10'))
const PLAFOND = 40 // plafond dédié aux crédits (décision d'Utku)
const COMPTEUR = '.credits-cout.json'
const JOURNAL = 'docs/couts-manquants-journal.json'
const ESTIME = 0.35
const env = {}
for (const l of (existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '').split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '') }
const U = env.REACT_APP_SUPABASE_URL, K = env.REACT_APP_SUPABASE_ANON_KEY, EVAL = env.EVAL_BYPASS_SECRET
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${K}`, 'x-eval-secret': EVAL }

const releve = JSON.parse(readFileSync('docs/couts-manquants-releve.json', 'utf8')).pannes
  .filter((p) => !/^(rappel|ots)\b/i.test(p.titre) && !/\brappel\b/i.test(p.titre.slice(0, 20)))
const journal = existsSync(JOURNAL) ? JSON.parse(readFileSync(JOURNAL, 'utf8')) : []
const fait = new Set(journal.map((j) => `${j.famille}|${j.titre}`))
const cumul = existsSync(COMPTEUR) ? JSON.parse(readFileSync(COMPTEUR, 'utf8')).eur ?? 0 : 0
const texte = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&euro;/g, '€').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ')

let coutRun = 0, joues = 0
for (const p of releve.filter((x) => !fait.has(`${x.famille}|${x.titre}`)).slice(0, LIMITE)) {
  const mur = murAtteint({ coutRun, casJoues: joues, coutSession: cumul + coutRun, budgetRun: BUDGET, plafondSession: PLAFOND, estime: ESTIME })
  if (mur) { console.log(`\n⏸ mur atteint (${mur}) avant ${p.famille} « ${p.titre.slice(0, 50)} » : non joué.`); break }
  const moteur = `${p.marque} ${p.famille}`
  let r
  try {
    const res = await fetch(`${U}/functions/v1/atlas-builder`, { method: 'POST', headers: H, signal: AbortSignal.timeout(170_000),
      body: JSON.stringify({ entree: { marque: p.marque, title: `${p.titre} — coût de réparation`, description: `Coût publié (en euros) de la réparation : « ${p.titre} » sur le moteur ${moteur}. Chercher une page de presse auto, un constructeur ou un éditeur identifiable qui chiffre cette réparation.`, models: moteur, years: '' } }) })
    r = await res.json()
    if (!res.ok || typeof r?.cout_eur !== 'number') { console.error(`⚠️ ARRÊT — atlas-builder HTTP ${res.status} : coût engagé inconnu.`); break }
  } catch (e) { console.error(`⚠️ ARRÊT — ${String(e).slice(0, 120)} : coût engagé inconnu.`); break }
  joues++; coutRun += r.cout_eur
  const min = Number(r.cout_min_eur) || 0, max = Number(r.cout_max_eur) || 0
  const ligne = { famille: p.famille, marque: p.marque, titre: p.titre, propose: min && max ? [min, max] : null, retenu: null, refus: [], le: new Date().toISOString() }
  let arret = false
  if (min > 0 && max >= min) try {
    for (const s of (r.sources ?? []).map((x) => x.url).filter((u) => sourcesPortentLEntree([u]) && coutUtilisable([u]))) {
      let t = null
      try { const res = await fetch(s, { headers: { 'User-Agent': 'Mozilla/5.0 InspexoVerif' }, signal: AbortSignal.timeout(20000) }); t = res.ok ? texte(await res.text()) : null } catch { t = null }
      if (!t) { ligne.refus.push({ url: s, motif: 'illisible' }); continue }
      const phrase = t.split(/(?<=[.!?])\s+/).find((ph) => montantPresent(ph, min) && montantPresent(ph, max))
      if (!phrase) { ligne.refus.push({ url: s, motif: 'montants absents de la page' }); continue }
      const aff = `Selon cette page, sur le moteur ${moteur}, la réparation « ${p.titre} » coûte entre ${min} et ${max} €.`
      const appelJuge = async (extra) => { const res = await fetch(`${U}/functions/v1/sources-externes`, { method: 'POST', headers: H, signal: AbortSignal.timeout(150_000), body: JSON.stringify({ mode: 'juger', url: s, cible: moteur, moteur: p.famille, affirmations: [{ id: 'cout', texte: aff, extraits: [phrase.slice(0, 380)], ...extra }] }) }); const j = await res.json(); if (!res.ok || typeof j?.cout_eur !== 'number') throw new Error(`juge HTTP ${res.status}`); return j }
      let j = await appelJuge({}); coutRun += j.cout_eur
      let v = j.verdicts?.cout
      if (v?.a_departager) { const j2 = await appelJuge({ votes: v.votes_detail ?? [] }); coutRun += j2.cout_eur; v = j2.verdicts?.cout ?? v }
      if (v?.verdict === 'soutenue') { ligne.retenu = { min, max, url: s, extrait: phrase.slice(0, 380), juge: 'soutenue', votes: v.votes ?? null }; break }
      ligne.refus.push({ url: s, motif: `juge : ${v?.verdict ?? 'sans verdict'}` })
    }
  } catch (e) { ligne.refus.push({ motif: `ARRÊT : ${String(e).slice(0, 80)}` }); arret = true }
  else ligne.refus.push({ motif: 'aucun coût publié trouvé' })
  journal.push(ligne)
  writeFileSync(JOURNAL, JSON.stringify(journal, null, 1))
  writeFileSync(COMPTEUR, JSON.stringify({ eur: Number((cumul + coutRun).toFixed(4)), maj: new Date().toISOString() }))
  if (arret) { console.error('⚠️ ARRÊT — appel au juge en échec ; coût engagé compté jusqu’ici.'); break }
  console.log(`${ligne.retenu ? 'COÛT ' : '     '} ${p.famille.padEnd(7)} ${p.titre.slice(0, 55).padEnd(55)} ${ligne.retenu ? `${min}–${max} € selon ${new URL(ligne.retenu.url).hostname}` : (ligne.refus.at(-1)?.motif ?? '')} · cumul ${(coutRun).toFixed(3)} €`)
}
const lot = journal.slice(-joues)
console.log(`\n— ${lot.filter((l) => l.retenu).length} coût(s) validé(s) sur ${joues} panne(s) · run ${coutRun.toFixed(3)} € / ${BUDGET} € · crédits ${(cumul + coutRun).toFixed(2)} € / ${PLAFOND} €`)
