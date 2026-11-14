// SPRINT 24, campagne 2 — REVÉRIFICATION DES 116 PRISES EN CHARGE (décision
// d'Utku du 14 nov. 2026). Pour chaque page citée :
//   1. GRATUIT : la page répond-elle encore ?
//   2. PAYANT : le juge relit la page SANS cache (2 votes + 1 en désaccord,
//      silence ≠ vote) avec EXACTEMENT l'affirmation jugée la première fois ;
//      l'ancien verdict est archivé avec sa date (`verif_cache_archive`).
// Une prise dont la page a disparu, ou dont le nouveau verdict n'est plus
// « soutenue », passe « à revérifier » et va dans la liste pour Utku.
// AUCUN retrait : rien n'est écrit dans les fiches ici.
//   node scripts/prises-reverifier.mjs --budget 9
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { murAtteint } from './budget.mjs'

const args = process.argv.slice(2)
const BUDGET = Number(args[args.indexOf('--budget') + 1]) || 9
const PLAFOND = 40, COMPTEUR = '.credits-cout.json', SORTIE = 'docs/prises-reverification.json', ESTIME = 0.06
const env = {}
for (const l of (existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '').split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '') }
const U = env.REACT_APP_SUPABASE_URL, H = { 'Content-Type': 'application/json', Authorization: `Bearer ${env.REACT_APP_SUPABASE_ANON_KEY}`, 'x-eval-secret': env.EVAL_BYPASS_SECRET }

const prises = JSON.parse(readFileSync('docs/fusion-proposee.json', 'utf8')).prises
const objets = Object.values(JSON.parse(readFileSync('docs/sources-moteurs-2026-11.json', 'utf8')).objets)
const journalJuge = JSON.parse(readFileSync('docs/candidats-externes-journal.json', 'utf8')).affirmations
const objetDe = (uid) => objets.find((o) => o.id === uid.split('#')[0])
// Texte, cible et extraits IDENTIQUES à ceux de la première campagne
// (scripts/resourcer-fiches.mjs) : même clé de cache, donc archive exacte.
const cibleDe = (o) => `${(o.marques ?? []).join('/')} ${o.libelle_moteur}${o.modeles_annees ? ` — ${o.modeles_annees}` : ''}`.slice(0, 200)
const extraits = (o, url) => (o.sources.find((s) => s.url === url)?.extraits ?? []).filter((e) => e?.verbatim === true && typeof e.texte === 'string').map((e) => e.texte)
const ancien = (uid, url) => {
  for (const a of Object.values(journalJuge)) for (const p of a.parties ?? []) if (p.uid === uid) {
    const c = (p.confirmees ?? []).find((x) => x.url === url); if (c) return { verdict: c.verdict, cache: c.cache ?? null }
  }
  return null
}

// Unités (prise, page), groupées par page et par moteur.
const groupes = new Map()
for (const p of prises) {
  const o = objetDe(p.uid); if (!o) continue
  for (const url of p.urls ?? []) {
    const k = `${url}|${o.famille}`
    if (!groupes.has(k)) groupes.set(k, { url, o, unites: [] })
    groupes.get(k).unites.push({ p, texte: `Sur ${String(o.libelle_moteur).trim()} : ${p.partie}`.slice(0, 400) })
  }
}
const sortie = existsSync(SORTIE) ? JSON.parse(readFileSync(SORTIE, 'utf8')) : { unites: [] }
const deja = new Set(sortie.unites.map((u) => `${u.uid}|${u.url}`))
const cumul = existsSync(COMPTEUR) ? JSON.parse(readFileSync(COMPTEUR, 'utf8')).eur ?? 0 : 0
let coutRun = 0, joues = 0
const juge = async (g, unites, extra = {}) => {
  const res = await fetch(`${U}/functions/v1/sources-externes`, { method: 'POST', headers: H, signal: AbortSignal.timeout(150_000),
    body: JSON.stringify({ mode: 'juger', sans_cache: true, url: g.url, cible: cibleDe(g.o), moteur: g.o.famille, ...extra,
      affirmations: unites.map((u, i) => ({ id: String(i), texte: u.texte, extraits: extraits(g.o, g.url), ...(extra.departager ? { votes: u.votes ?? [] } : {}) })) }) })
  const j = await res.json().catch(() => null)
  if (!res.ok || typeof j?.cout_eur !== 'number') throw new Error(`juge HTTP ${res.status}`)
  return j
}
for (const g of groupes.values()) {
  const unites = g.unites.filter((u) => !deja.has(`${u.p.uid}|${g.url}`)).slice(0, 12)
  if (!unites.length) continue
  const mur = murAtteint({ coutRun, casJoues: joues, coutSession: cumul + coutRun, budgetRun: BUDGET, plafondSession: PLAFOND, estime: ESTIME })
  if (mur) { console.log(`\n⏸ mur atteint (${mur}) : ${[...groupes.values()].length} pages au total, arrêt avant ${g.url}`); break }
  // 1. En ligne ?
  let enLigne = null
  try { const r = await fetch(g.url, { headers: { 'User-Agent': 'Mozilla/5.0 InspexoVerif' }, signal: AbortSignal.timeout(20000) }); enLigne = r.status } catch (e) { enLigne = 'injoignable' }
  // 2. Le juge, sans cache.
  let j = null, erreur = null
  try {
    j = await juge(g, unites); coutRun += j.cout_eur
    const aDep = unites.map((u, i) => ({ u, v: j.verdicts?.[String(i)] })).filter((x) => x.v?.a_departager)
    if (aDep.length) {
      const j2 = await juge(g, aDep.map((x) => ({ ...x.u, votes: x.v.votes_detail ?? [] })), { departager: true }); coutRun += j2.cout_eur
      aDep.forEach((x, k) => { j.verdicts[String(unites.indexOf(x.u))] = j2.verdicts?.[String(k)] ?? x.v })
    }
  } catch (e) { erreur = String(e).slice(0, 100) }
  joues++
  const le = new Date().toISOString().slice(0, 10)
  unites.forEach((u, i) => {
    const v = j?.verdicts?.[String(i)]
    const anc = ancien(u.p.uid, g.url)
    const disparue = enLigne !== 200
    const change = v && v.verdict !== 'soutenue'
    sortie.unites.push({
      uid: u.p.uid, fiche: u.p.fiche, type: u.p.type, partie: u.p.partie, url: g.url, en_ligne: enLigne,
      ancien: anc?.verdict ?? null, nouveau: v?.verdict ?? null, votes: v?.votes ?? null, justification: v?.justification ?? null,
      lisible: j?.lisible ?? null, erreur, verifie_le: le,
      statut: erreur ? 'non_verifiee' : (disparue || change) ? 'a_reverifier' : 'a_jour',
      motif: erreur ? `appel en échec : ${erreur}` : disparue && change ? `page ${enLigne} et verdict ${v.verdict}` : disparue ? `page ${enLigne}` : change ? `verdict ${v.verdict} (était ${anc?.verdict ?? '?'})` : null,
    })
  })
  writeFileSync(SORTIE, JSON.stringify(sortie, null, 1))
  writeFileSync(COMPTEUR, JSON.stringify({ eur: Number((cumul + coutRun).toFixed(4)), maj: new Date().toISOString() }))
  const s = sortie.unites.slice(-unites.length)
  console.log(`${String(enLigne).padEnd(11)} ${unites.length} prise(s) · ${s.filter((x) => x.statut === 'a_jour').length} à jour, ${s.filter((x) => x.statut === 'a_reverifier').length} à revérifier${erreur ? ` · ERREUR ${erreur}` : ''} · ${g.url.slice(0, 70)} · ${coutRun.toFixed(3)} €`)
  if (erreur) { console.error('⚠️ ARRÊT — appel au juge en échec.'); break }
}
const u = sortie.unites
console.log(`\n— ${u.length} prise×page vérifiées · ${u.filter((x) => x.statut === 'a_jour').length} à jour · ${u.filter((x) => x.statut === 'a_reverifier').length} à revérifier · run ${coutRun.toFixed(3)} € / ${BUDGET} € · crédits ${(cumul + coutRun).toFixed(2)} € / ${PLAFOND} €`)
