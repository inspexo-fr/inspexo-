// SPRINT 24 — SESSION DE JETON UNIQUE (décisions d'Utku du 14 nov. 2026) :
//   1. dates de vérification des 116 prises (campagne 2) ;
//   2. les 6 corrections : N47 réchauffeur, Mini N18, OM651 KBA ⇒ masquées
//      (jamais supprimées ; rappel ⇒ question du VIN) ; DV6 EGR ⇒ nouvelle
//      source L'Argus ajoutée ; DW10 ⇒ restreinte au Xsara Picasso (retirée
//      de la 307) ; G4KD ⇒ à jour, « contrôle de présence bloqué (403) » ;
//   3. les 2 pannes de la campagne 3 (H4M, H4D) ;
//   puis, hors de ce script, les 4 références × 1.
// Sauvegarde de chaque fiche touchée AVANT écriture. Simulation par défaut.
//   node scripts/session-jeton-sprint24b.mjs            (simule)
//   node scripts/session-jeton-sprint24b.mjs --ecrire
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
const ECRIRE = process.argv.includes('--ecrire')
const env = {}
for (const l of (existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '').split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '') }
if (!env.ADMIN_ACCESS_TOKEN) { console.error('ADMIN_ACCESS_TOKEN absent de .env.local'); process.exit(1) }
const F = `${env.REACT_APP_SUPABASE_URL}/functions/v1/admin-defect-sheets`
const H = { 'Content-Type': 'application/json', apikey: env.REACT_APP_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.ADMIN_ACCESS_TOKEN}` }
const fin = (code, msg) => { if (msg) console.error(msg); console.log('\n⚠️ Retirer ADMIN_ACCESS_TOKEN de .env.local maintenant.'); process.exit(code) }
const patch = async (corps) => { const r = await fetch(F, { method: 'PATCH', headers: H, body: JSON.stringify(corps) }); return { status: r.status, json: await r.json().catch(() => null) } }

const g = await fetch(F, { headers: H })
if (!g.ok) fin(1, `Lecture refusée : HTTP ${g.status} (jeton expiré ?)`)
const fiches = (await g.json()).sheets ?? []
const norm = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
const ficheDe = (nom) => { const [marque, ...r] = nom.split(' '); const fam = r.join('').toUpperCase().replace(/[^A-Z0-9]/g, ''); return fiches.find((f) => norm(f.marque).startsWith(norm(marque).slice(0, 5)) && f.famille_norm === fam) }
const mots = (t) => new Set(norm(t).split(' ').filter((w) => w.length >= 4))
const proche = (a, b) => { const A = mots(a); let n = 0; for (const w of mots(b)) if (A.has(w)) n++; return n }
const priseDe = (f, u) => {
  const cands = (f?.prises_en_charge ?? []).filter((p) => (p.urls ?? []).includes(u.url))
  return cands.sort((x, y) => proche(y.texte, u.partie) - proche(x.texte, u.partie))[0] ?? null
}

// 1 et 2. Vérifications et corrections, regroupées par fiche.
const unites = JSON.parse(readFileSync('docs/prises-reverification.json', 'utf8')).unites
const decisions = [
  { re: /N47/, partie: /réchauffeur/i, action: 'masquer', motif: 'plus de source portante (revérification du 14 nov. 2026)' },
  { re: /Mini N18/, partie: /Cooper S/i, action: 'masquer', motif: 'seule source trouvée étrangère (NHTSA) : non confirmée en France' },
  { re: /OM651/, partie: /KBA/i, action: 'masquer', motif: 'plus de source portante (revérification du 14 nov. 2026)' },
  { re: /DV6/, partie: /EGR/i, action: 'ajouter_source', url: 'https://www.largus.fr/actualite-automobile/peugeot-207-et-307-16-hdi-139461.html' },
  { re: /DW10/, partie: /Xsara Picasso/i, action: 'restreindre', vehicules: ['Xsara Picasso'] },
]
const parFiche = new Map(), introuvables = []
const le = new Date().toISOString().slice(0, 10)
for (const u of unites) {
  const f = ficheDe(u.fiche), p = f && priseDe(f, u)
  if (!p) { introuvables.push(`${u.fiche} · ${u.partie.slice(0, 60)}`); continue }
  const e = parFiche.get(f.id) ?? { nom: u.fiche, verifs: [], corrections: [] }
  const d = decisions.find((x) => x.re.test(u.fiche) && x.partie.test(u.partie))
  let statut = u.statut, motif = u.motif
  if (/G4KD/.test(u.fiche) && u.en_ligne !== 200) { statut = 'a_jour'; motif = `contrôle de présence bloqué (${u.en_ligne}) ; lue et soutenue par le juge — à réessayer au prochain passage` }
  if (d?.action === 'ajouter_source') { statut = 'a_jour'; motif = 'nouvelle source portante (L\'Argus) ajoutée' }
  if (d?.action === 'restreindre') { statut = 'a_jour'; motif = 'restreinte au Xsara Picasso (la page ne nomme pas la 307)' }
  e.verifs.push({ texte: p.texte, statut, le, motif })
  if (d) e.corrections.push({ texte: p.texte, action: d.action, motif: d.motif, url: d.url, vehicules: d.vehicules })
  parFiche.set(f.id, e)
}
// 3. Les 2 pannes de la campagne 3.
const journal = JSON.parse(readFileSync('docs/resourcage-fiches-journal.json', 'utf8'))
const pannes = (Array.isArray(journal) ? journal : []).filter((j) => j.porte && (j.sources_trouvees ?? []).length && /^Renault (H4M|H4D)$/.test(j.fiche))

const nb = (k) => [...parFiche.values()].reduce((s, e) => s + e[k].length, 0)
console.log(`Fiches touchées : ${parFiche.size} · vérifications : ${nb('verifs')} (${[...parFiche.values()].flatMap((e) => e.verifs).filter((v) => v.statut === 'a_reverifier').length} à revérifier) · corrections : ${nb('corrections')} · pannes campagne 3 : ${pannes.length}`)
for (const e of parFiche.values()) for (const c of e.corrections) console.log(`  ${c.action.padEnd(15)} ${e.nom} · ${c.texte.slice(0, 70)}`)
for (const j of pannes) console.log(`  source portante ${j.fiche} · ${j.titre.slice(0, 60)} · ${j.sources_trouvees[0].url}`)
if (introuvables.length) console.log(`  ⚠️ ${introuvables.length} prise(s) introuvable(s) en base :\n   - ${introuvables.join('\n   - ')}`)
if (nb('corrections') !== 5 || pannes.length !== 2) fin(1, 'ARRÊT : 5 corrections et 2 pannes attendues exactement. Rien n’est écrit.')
if (!ECRIRE) fin(0, '\nSimulation seulement. Relancer avec --ecrire.')

const dossier = join(homedir(), 'inspexo-backups'); mkdirSync(dossier, { recursive: true })
const sauvegarde = join(dossier, `fiches-session-sprint24b-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
const ids = new Set([...parFiche.keys(), ...pannes.map((j) => j.fiche_id)])
writeFileSync(sauvegarde, JSON.stringify(fiches.filter((f) => ids.has(f.id)), null, 1))
console.log(`\nSauvegarde : ${sauvegarde}`)
const resultats = []
for (const [id, e] of parFiche) {
  const v = await patch({ id, verifier_prises: e.verifs }); resultats.push({ id, quoi: 'verifier_prises', ...v })
  console.log(`  ${v.status} vérif  ${e.nom.padEnd(18)} ${v.json?.marquees ?? 0} marquée(s)${v.json?.introuvables?.length ? `, ${v.json.introuvables.length} introuvable(s)` : ''}`)
  if (e.corrections.length) { const c = await patch({ id, corriger_prises: e.corrections }); resultats.push({ id, quoi: 'corriger_prises', ...c }); console.log(`  ${c.status} corr.  ${e.nom.padEnd(18)} ${JSON.stringify(c.json?.faites ?? c.json)}`) }
}
for (const j of pannes) {
  const r = await patch({ id: j.fiche_id, ajouter_sources: [{ panne_titre: j.titre, sources: j.sources_trouvees.map((s) => ({ url: s.url, title: s.titre || null })) }] })
  resultats.push({ id: j.fiche_id, quoi: 'ajouter_sources', ...r }); console.log(`  ${r.status} panne  ${j.fiche.padEnd(18)} ${JSON.stringify(r.json)}`)
}
writeFileSync(sauvegarde.replace('.json', '-resultat.json'), JSON.stringify(resultats, null, 1))
fin(resultats.every((r) => r.status === 200) ? 0 : 1)
