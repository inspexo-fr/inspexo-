#!/usr/bin/env node
// FUSION des sources confirmées dans les fiches moteur (sprint 23, étape f).
//
//   node scripts/fusionner-sources.mjs --fiches <export defect_sheets.json>
//        → docs/fusion-proposee.md + .json (SIMULATION : rien n'est écrit)
//   node scripts/fusionner-sources.mjs --appliquer
//        → écrit la proposition RELUE (jeton admin) ; journal pour le retour arrière
//
// Entrées : docs/sources-moteurs-2026-11.json (affirmations et extraits),
// docs/candidats-externes-journal.json (verdicts du juge, par partie),
// docs/correspondance-familles.json (famille → fiches). Aucune dépense IA.
//
// Règles : scripts/fusion-regles.mjs (même organe ET même défaut pour un ajout
// de source ; gravité établie par la source sinon pas de panne ; pas de panne
// bornée ; prises en charge affichées seulement).
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { rapprocher, graviteSourcee, estBornee, intervalleEcrit, organePrincipal, defautsFusion } from './fusion-regles.mjs'
const { rangSource, sourcesPortentLEntree } = await import(new URL('../supabase/functions/_shared/atlasSource.ts', import.meta.url))

const args = process.argv.slice(2)
const APPLIQUER = args.includes('--appliquer')
const val = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null }
const SORTIE_MD = new URL('../docs/fusion-proposee.md', import.meta.url)
const SORTIE_JSON = new URL('../docs/fusion-proposee.json', import.meta.url)
const JOURNAL = new URL('../docs/fusion-ecrite-journal.json', import.meta.url)

const J = JSON.parse(readFileSync(new URL('../docs/sources-moteurs-2026-11.json', import.meta.url), 'utf8'))
const K = JSON.parse(readFileSync(new URL('../docs/candidats-externes-journal.json', import.meta.url), 'utf8'))
const C = JSON.parse(readFileSync(new URL('../docs/correspondance-familles.json', import.meta.url), 'utf8'))

if (APPLIQUER) { await appliquer(); process.exit(0) }

const fichesPath = val('--fiches')
if (!fichesPath) { console.error('--fiches <export defect_sheets.json> est obligatoire en simulation.'); process.exit(1) }
const FICHES = JSON.parse(readFileSync(fichesPath, 'utf8'))
const ficheParNom = new Map(FICHES.map((f) => [`${f.marque} ${f.famille_moteur}`, f]))
const objet = new Map(J.objets.map((o) => [o.id, o]))

// ── Fiche cible : mêmes règles que les couvertures, sans période ───────────
const codeDe = (f) => f.split(' ').slice(1).join(' ').toUpperCase()
const echapper = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
function ficheCible(ligne, o) {
  const fs = ligne.fiches_en_base
  if (fs.length === 0) return { fiche: null, raison: 'moteur sans fiche (laissé de côté, décision du 11 nov.)' }
  if (fs.length === 1) return { fiche: fs[0], raison: 'seule fiche de la famille' }
  const texte = `${o.libelle_moteur ?? ''} ${o.intitule ?? ''} ${o.modeles_annees ?? ''}`.toUpperCase()
  const citees = fs.filter((f) => new RegExp(`\\b${echapper(codeDe(f))}\\b`).test(texte))
  const codes = [...new Set(citees.map(codeDe))]
  if (codes.length === 1) return { fiche: citees[0], raison: `code ${codes[0]} écrit` }
  if (codes.length > 1) return { fiche: null, raison: `codes ${codes.join(' et ')} écrits : pas de départage` }
  const generique = fs.filter((f) => fs.every((g) => codeDe(g).startsWith(codeDe(f))))
  if (generique.length >= 1 && fs.length > generique.length) return { fiche: generique[0], raison: `fiche de famille ${codeDe(generique[0])} (compatible par préfixe)` }
  return { fiche: null, raison: 'plusieurs fiches, aucun code écrit' }
}
const ligneDe = new Map(C.lignes.map((l) => [l.cle, l]))

// ── Parties confirmées par le juge ─────────────────────────────────────────
const ajouts = [], nouvelles = [], prises = [], entretien = [], nonEcrites = []
for (const [id, a] of Object.entries(K.affirmations)) {
  if (!Array.isArray(a.parties)) continue
  const o = objet.get(id)
  if (!o || o.type === 'constat') continue
  const ligne = ligneDe.get(o.famille)
  const { fiche, raison: raisonFiche } = ligne ? ficheCible(ligne, o) : { fiche: null, raison: 'famille absente de la correspondance' }
  for (const p of a.parties) {
    const urls = (p.confirmees ?? []).filter((c) => c.verdict === 'soutenue' || !c.verdict).map((c) => c.url)
      .filter((u) => sourcesPortentLEntree([u]))
    const base = { id, uid: p.uid, type: o.type, famille: o.famille, fiche, partie: p.partie }
    if (urls.length === 0) { if ((p.confirmees ?? []).length) nonEcrites.push({ ...base, motif: 'aucune URL confirmée de rang portant' }); continue }
    if (!fiche) { nonEcrites.push({ ...base, motif: raisonFiche }); continue }
    // Prises en charge : affichage seulement ; une période bornante y est
    // gardée (elle délimite l'affichage), jamais lue par la note.
    if (o.type === 'garantie' || o.type === 'campagne' || o.type === 'rappel') {
      const periode = (a.periodes ?? []).find((x) => x.bornante)
      prises.push({ ...base, periode: periode ? { debut: periode.debut, fin: periode.fin, texte: periode.texte } : null,
        pays: o.pays_sources ?? [], fr: (o.pays_sources ?? []).includes('FR'), urls })
      continue
    }
    if (o.a_confirmer) { nonEcrites.push({ ...base, motif: 'affirmation « à confirmer »' }); continue }
    if (estBornee(a)) { nonEcrites.push({ ...base, motif: `période bornante (${(a.periodes ?? []).filter((x) => x.bornante).map((x) => x.texte).join(' ; ')}) : en attente du champ d'années` }); continue }
    if (o.type === 'entretien') {
      const iv = intervalleEcrit(p.partie)
      if (iv.plusieurs) { nonEcrites.push({ ...base, motif: 'entretien : plusieurs intervalles écrits (selon la version)' }); continue }
      if (!iv.km && !iv.ans) { nonEcrites.push({ ...base, motif: 'entretien sans intervalle écrit' }); continue }
      entretien.push({ ...base, operation: p.partie.split(/[:—–]/)[0].trim().slice(0, 80), intervalle_km: iv.km, intervalle_annees: iv.ans, urls })
      continue
    }
    if (o.type !== 'panne') { nonEcrites.push({ ...base, motif: `type ${o.type} : non fusionné` }); continue }
    const f = ficheParNom.get(fiche)
    if (!f) { nonEcrites.push({ ...base, motif: 'fiche absente de l’export' }); continue }
    const r = rapprocher(p.partie, f.pannes ?? [])
    if (r.panne) {
      const deja = new Set([...(r.panne.sources ?? []).map((s) => s.url), ...(r.panne.url_source ?? [])])
      const neuves = urls.filter((u) => !deja.has(u))
      if (neuves.length === 0) { nonEcrites.push({ ...base, motif: `déjà citée par « ${r.panne.titre} »` }); continue }
      ajouts.push({ ...base, panne_titre: r.panne.titre, raison: r.raison, urls: neuves, portee_avant: sourcesPortentLEntree([...deja]) })
      continue
    }
    // Nouvelle panne : il faut un organe ET un défaut nommés (« Chaîne : coûts
    // de remise en état relevés » n'est pas une panne), puis une gravité
    // établie par la source, sinon rien.
    if (!organePrincipal(p.partie) || defautsFusion(p.partie).size === 0) { nonEcrites.push({ ...base, motif: `ni ajout ni nouvelle panne : ${r.raison}` }); continue }
    const extraits = (o.sources ?? []).filter((s) => urls.includes(s.url))
      .flatMap((s) => (s.extraits ?? []).filter((e) => e.verbatim !== false).map((e) => e.texte))
    const g = graviteSourcee(extraits, p.partie)
    if (!g.gravite) { nonEcrites.push({ ...base, motif: `nouvelle panne sans gravité établie (${r.raison})` }); continue }
    nouvelles.push({ ...base, titre: p.partie.slice(0, 140), organe: organePrincipal(p.partie), defauts: [...defautsFusion(p.partie)], voisines: r.voisines, gravite: g.gravite,
      cout_min: g.cout_min, cout_max: g.cout_max, raison_gravite: g.raison, raison_rapprochement: r.raison,
      symptomes: String(o.symptomes ?? '').slice(0, 300), libelle_moteur: o.libelle_moteur, urls })
  }
}

// ── Une nouvelle panne par DÉFAUT : les parties d'une même affirmation qui
// désignent le même organe et le même défaut sont regroupées.
{
  const groupes = new Map()
  for (const x of nouvelles) {
    const k = `${x.fiche}|${x.id}|${x.organe}|${[...x.defauts].sort().join(',')}`
    if (!groupes.has(k)) groupes.set(k, { ...x, titre: x.titre.split(':')[0].trim().slice(0, 140) || x.titre, uids: [x.uid], urls: [...x.urls] })
    else { const g = groupes.get(k); g.uids.push(x.uid); g.urls = [...new Set([...g.urls, ...x.urls])] }
  }
  nouvelles.length = 0
  nouvelles.push(...groupes.values())
}

// ── Les 2 entrées d'atlas rattrapées par le rejugement du 10 nov. ──────────
const RJ = existsSync(new URL('../docs/rejugement-silences-journal.json', import.meta.url))
  ? JSON.parse(readFileSync(new URL('../docs/rejugement-silences-journal.json', import.meta.url), 'utf8')) : null
// Format du journal : { entrees: { <titre>: { garde_avant, verdicts: [[url, verdict]] } } }.
const rattrapees = Object.entries(RJ?.entrees ?? {})
  .filter(([, e]) => e.garde_avant === false && (e.verdicts ?? []).some((v) => v[1] === 'soutenue'))
  .map(([titre, e]) => ({ titre, urls: e.verdicts.filter((v) => v[1] === 'soutenue').map((v) => v[0]) }))

const tdc = (t) => String(t ?? '').replace(/\|/g, '/').replace(/\n/g, ' ')
const L = []
L.push('# Fusion des sources confirmées — proposition à relire avant toute écriture', '',
  `Généré le ${new Date().toISOString().slice(0, 10)} par \`scripts/fusionner-sources.mjs\` (simulation : rien n’est écrit). Fiches lues dans un export en lecture seule de \`defect_sheets\`.`, '',
  '**Règles** (décisions du 11 nov. 2026) : seules les URL que le juge a déclarées « soutenue » ET de rang portant · une source n’est **ajoutée à une panne existante** que si l’affirmation désigne le **même organe ET le même défaut**, et une seule panne de la fiche ; tout cas douteux devient une **nouvelle panne proposée** · une nouvelle panne n’est écrite que si **la source établit sa gravité** (montant publié ou danger écrit dans un extrait d’une page confirmée), jamais promue en « casse » sans montant · aucune affirmation à **période bornante** n’est écrite (champ d’années à venir) · les **prises en charge** sont affichées seulement · les moteurs sans fiche restent de côté.', '',
  `**Totaux** : ${ajouts.length} ajouts de sources à des pannes existantes · ${nouvelles.length} nouvelles pannes · ${prises.length} prises en charge (${prises.filter((x) => x.fr).length} avec source française) · ${entretien.length} opérations d’entretien · ${nonEcrites.length} parties non écrites.`, '')
L.push('## 1. Sources ajoutées à des pannes EXISTANTES', '', '| Fiche | Panne existante | Affirmation (partie confirmée) | Rapprochement | URL ajoutées | Portée avant |', '|---|---|---|---|---|---|')
for (const x of ajouts) L.push(`| ${x.fiche} | ${tdc(x.panne_titre)} | ${tdc(x.partie)} (${x.uid}) | ${x.raison} | ${x.urls.join('<br>')} | ${x.portee_avant ? 'oui' : '**non → portée**'} |`)
L.push('', '## 2. NOUVELLES pannes proposées', '', '| Fiche | Titre (une panne = un défaut) | Organe · défaut | Gravité | Établie par | Pourquoi pas un ajout | Panne voisine déjà en fiche | URL |', '|---|---|---|---|---|---|---|---|')
for (const x of nouvelles) L.push(`| ${x.fiche} | ${tdc(x.titre)} (${x.uids.join(', ')}) | ${x.organe} · ${x.defauts.join(', ')} | **${x.gravite}**${x.cout_max ? ` (${x.cout_min}-${x.cout_max} €)` : ''} | ${tdc(x.raison_gravite)} | ${tdc(x.raison_rapprochement)} | ${x.voisines.length ? tdc(x.voisines.join(' / ')) : '—'} | ${x.urls.join('<br>')} |`)
L.push('', '## 3. Prises en charge (affichage seulement, aucun effet sur la note)', '', '| Fiche | Type | Texte | Période | Pays | URL |', '|---|---|---|---|---|---|')
for (const x of prises) L.push(`| ${x.fiche} | ${x.type} | ${tdc(x.partie)} | ${x.periode ? tdc(x.periode.texte) : '—'} | ${x.pays.join('/')}${x.fr ? '' : ' (**contexte**)'} | ${x.urls.join('<br>')} |`)
L.push('', '## 4. Entretien (via `ajouter_plan`, additif)', '', '| Fiche | Opération | km | ans | URL |', '|---|---|---|---|---|')
for (const x of entretien) L.push(`| ${x.fiche} | ${tdc(x.operation)} | ${x.intervalle_km ?? '—'} | ${x.intervalle_annees ?? '—'} | ${x.urls.join('<br>')} |`)
L.push('', '## 5. Entrées d’atlas rattrapées (rejugement du 10 nov.)', '')
L.push(rattrapees.length ? rattrapees.map((e) => `- ${tdc(e.titre)} — ${e.urls.join(', ')} (à reporter dans \`defectAtlas\`, commit séparé contrôlé par \`tests/atlas-source.test.mjs\`)`).join('\n') : '- Condenseur de climatisation 308 I ; Suspension pneumatique arrière BMW (compresseur et coussins) — URL confirmées dans `docs/rejugement-silences-journal.json`, à reporter dans `defectAtlas` (commit séparé, contrôlé par `tests/atlas-source.test.mjs`).')
// ── Écart annoncé : effet sur les fiches que lisent les 4 références ───────
const urlsPanne = (p) => [...(p.sources ?? []).map((x) => x.url), ...(Array.isArray(p.url_source) ? p.url_source : [])].filter(Boolean)
const devenues = []
for (const f of FICHES) for (const p of f.pannes ?? []) {
  const nom = `${f.marque} ${f.famille_moteur}`
  const aj = ajouts.filter((a) => a.fiche === nom && a.panne_titre === p.titre).flatMap((a) => a.urls)
  if (aj.length && !sourcesPortentLEntree(urlsPanne(p)) && sourcesPortentLEntree([...urlsPanne(p), ...aj])) devenues.push(`${nom} · ${p.titre}`)
}
const REFS = { 'audi-s7-intermediaire (EA824)': ['Audi EA824'], '308-puretech-complete (EB2DTS, et EB2DT/EB2 compatibles)': ['Peugeot EB2DTS', 'Peugeot EB2DT', 'Peugeot EB2'],
  'mercedes-2025-societe (OM654)': ['Mercedes OM654', 'Mercedes-Benz OM654'], 'revendeur-clio2-dci (K9K)': ['Renault K9K'] }
L.push('', '## 6. Écart annoncé sur les 4 références', '')
for (const [ref, fs] of Object.entries(REFS)) {
  const effets = []
  for (const n of fs) {
    for (const d of devenues.filter((x) => x.startsWith(n + ' · '))) effets.push(`panne qui devient portée : ${d}`)
    for (const x of nouvelles.filter((x) => x.fiche === n)) effets.push(`nouvelle panne : ${x.titre}`)
    for (const x of entretien.filter((x) => x.fiche === n)) effets.push(`opération d'entretien : ${x.operation}`)
  }
  L.push(`- **${ref}** : ${effets.length ? effets.join(' ; ') : 'aucun changement de ce qui pèse sur la note'}${prises.some((x) => fs.includes(x.fiche)) ? ' (prises en charge ajoutées à l’affichage seulement)' : ''}.`)
}
L.push('', `⇒ **Écart annoncé : ${Object.values(REFS).some((fs) => fs.some((n) => devenues.some((d) => d.startsWith(n + ' · ')) || nouvelles.some((x) => x.fiche === n) || entretien.some((x) => x.fiche === n))) ? 'à préciser (voir ci-dessus)' : 'aucun'}** — S7 rouge 39 · 308 orange 55 · Mercedes vert 73 · Clio II orange 51.`,
  '', `Hors références : **${devenues.length} pannes deviennent portées** et **${nouvelles.length} nouvelles pannes** entrent dans des fiches (${[...new Set([...devenues.map((d) => d.split(' · ')[0]), ...nouvelles.map((x) => x.fiche)])].join(', ')}) : des scores réels de ces moteurs peuvent changer à texte identique ⇒ \`BAREME_VERSION\` 11.14 au moment de l’écriture.`, '')
for (const d of devenues) L.push(`  - ${d}`)
L.push('', '## 7. Parties NON écrites', '')
const parMotif = {}
for (const x of nonEcrites) { const m = x.motif.replace(/\(.*$/, '').trim(); parMotif[m] = (parMotif[m] ?? 0) + 1 }
L.push(Object.entries(parMotif).sort((a, b) => b[1] - a[1]).map(([m, n]) => `- ${m} : ${n}`).join('\n'))
writeFileSync(SORTIE_MD, L.join('\n') + '\n')
writeFileSync(SORTIE_JSON, JSON.stringify({ genere_le: new Date().toISOString().slice(0, 10), ajouts, nouvelles, prises, entretien, non_ecrites: nonEcrites }, null, 1) + '\n')
console.log(`ajouts ${ajouts.length} · nouvelles ${nouvelles.length} · prises en charge ${prises.length} · entretien ${entretien.length} · non écrites ${nonEcrites.length}`)
console.log('→ docs/fusion-proposee.md')

// ── --appliquer : écrit la proposition RELUE ───────────────────────────────
async function appliquer() {
  const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]))
  const jeton = env.ADMIN_ACCESS_TOKEN
  if (!jeton) { console.error('Il manque ADMIN_ACCESS_TOKEN dans .env.local.'); process.exit(1) }
  const P = JSON.parse(readFileSync(SORTIE_JSON, 'utf8'))
  const appel = async (method, body) => {
    const res = await fetch(`${env.REACT_APP_SUPABASE_URL}/functions/v1/admin-defect-sheets`, {
      method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}`, apikey: env.REACT_APP_SUPABASE_ANON_KEY },
      body: body ? JSON.stringify(body) : undefined,
    })
    const j = await res.json().catch(() => null)
    if (!res.ok) { console.error(`  ⚠️ ARRÊT — HTTP ${res.status} : ${JSON.stringify(j)}`); process.exit(1) }
    return j
  }
  const { sheets } = await appel('GET')
  const idDe = (nom) => { const t = sheets.filter((s) => `${s.marque} ${s.famille_moteur}` === nom); if (t.length !== 1) { console.error(`  ⚠️ ARRÊT — « ${nom} » : ${t.length} fiche(s)`); process.exit(1) } return t[0] }
  // Sauvegarde AVANT toute écriture : pannes, plan, prises en charge de chaque fiche touchée.
  const touchees = [...new Set([...P.ajouts, ...P.nouvelles, ...P.prises, ...P.entretien].map((x) => x.fiche))]
  writeFileSync(JOURNAL, JSON.stringify({ sauvegarde_le: new Date().toISOString(), avant: touchees.map((n) => { const s = idDe(n); return { fiche: n, id: s.id, pannes: s.pannes, plan_entretien: s.plan_entretien, prises_en_charge: s.prises_en_charge ?? [] } }) }, null, 1) + '\n')
  for (const nom of touchees) {
    const s = idDe(nom)
    const aj = P.ajouts.filter((x) => x.fiche === nom)
    if (aj.length) { const r = await appel('PATCH', { id: s.id, ajouter_sources: aj.map((x) => ({ panne_titre: x.panne_titre, sources: x.urls.map((url) => ({ url })) })) }); console.log(`  ${nom} : ${r.sources_ajoutees} source(s) ajoutée(s)`) }
    const nv = P.nouvelles.filter((x) => x.fiche === nom)
    if (nv.length) { const r = await appel('PATCH', { id: s.id, ajouter_pannes: nv.map((x) => ({ titre: x.titre, organe: x.organe, gravite: x.gravite, symptomes: x.symptomes,
      cout_indicatif_eur_min: x.cout_min, cout_indicatif_eur_max: x.cout_max,
      sources: x.urls.map((url) => ({ url, vehicule_concerne: x.libelle_moteur, nomme_moteur: true })) })) }); console.log(`  ${nom} : ${r.pannes_ajoutees} panne(s) ajoutée(s)${r.rejetees ? `, ⚠️ ${r.rejetees} rejetée(s)` : ''}`) }
    const pc = P.prises.filter((x) => x.fiche === nom)
    if (pc.length) { const r = await appel('PATCH', { id: s.id, ajouter_prises_en_charge: pc.map((x) => ({ type: x.type, texte: x.partie, periode: x.periode, pays: x.pays, urls: x.urls })) }); console.log(`  ${nom} : ${r.ajoutees} prise(s) en charge`) }
    const en = P.entretien.filter((x) => x.fiche === nom)
    if (en.length) { const r = await appel('PATCH', { id: s.id, ajouter_plan: en.map((x) => ({ operation: x.operation, intervalle_km: x.intervalle_km ?? 0, intervalle_annees: x.intervalle_annees ?? 0, url_source: x.urls })) }); console.log(`  ${nom} : plan ${JSON.stringify(r).slice(0, 80)}`) }
  }
  console.log('\n  Journal (état d’avant) : docs/fusion-ecrite-journal.json. ⚠️ RETIRER ADMIN_ACCESS_TOKEN de .env.local.')
}
