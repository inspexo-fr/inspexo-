#!/usr/bin/env node
// PROPOSITION des couvertures multi-marques (sprint 23, étape e) — AUCUNE
// écriture, AUCUNE dépense, AUCUN appel réseau. Le résultat est relu par Utku
// avant toute écriture en base.
//
// Règles (décision d'Utku du 11 nov. 2026) :
//   1. Une couverture ne contient que des marques, modèles et années ÉCRITS
//      dans docs/sources-moteurs-2026-11.json — rien de déduit.
//   2. Période inconnue (ou bornée d'un seul côté) ⇒ pas de couverture pour ce
//      modèle.
//   3. Un même (marque, modèle) dont la période écrite chevauche celle d'une
//      AUTRE fiche ⇒ deux générations de moteur possibles ⇒ pas de couverture.
//   4. Seules les familles rattachées à UNE seule fiche en base, sans
//      ambiguïté, reçoivent une proposition (docs/correspondance-familles.json).
//   5. Les modèles de la propre marque d'une fiche ne sont pas proposés : la
//      fiche leur sert déjà sans couverture.
//   6. Une période qui DÉBORDE les années de la fiche en base couvre aussi une
//      autre génération ⇒ pas de couverture. Et « toutes motorisations » ne
//      désigne pas ce moteur ⇒ pas de couverture.
//
// Usage : node scripts/proposer-couvertures.mjs --fiches <export defect_sheets.json>
//           [--json docs/couvertures-proposees.json]
// L'export des fiches se fait en LECTURE SEULE (supabase db dump --data-only
// en excluant toutes les autres tables) : marque, famille_moteur, annee_debut,
// annee_fin suffisent.
import { readFileSync, writeFileSync } from 'node:fs'
const { marqueCanonique, modeleCanonique } = await import(new URL('../supabase/functions/_shared/marche.ts', import.meta.url))

const SOURCES = JSON.parse(readFileSync(new URL('../docs/sources-moteurs-2026-11.json', import.meta.url), 'utf8'))
const CORR = JSON.parse(readFileSync(new URL('../docs/correspondance-familles.json', import.meta.url), 'utf8'))
const iFiches = process.argv.indexOf('--fiches')
if (iFiches < 0) { console.error('--fiches <export defect_sheets.json> est obligatoire (années des fiches, règle 6).'); process.exit(1) }
const FICHES = JSON.parse(readFileSync(process.argv[iFiches + 1], 'utf8'))
const anneesFiche = (nom) => {
  const f = FICHES.find((x) => `${x.marque} ${x.famille_moteur}` === nom)
  return f ? { debut: f.annee_debut == null ? null : Number(f.annee_debut), fin: f.annee_fin == null ? null : Number(f.annee_fin) } : null
}
const iJson = process.argv.indexOf('--json')
const SORTIE_JSON = iJson > 0 ? process.argv[iJson + 1] : null

const MOIS = 'janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre'
const RE_ANNEE = new RegExp(`(?:\\b\\d{1,2}\\/)?(?:\\b\\d{1,2}\\/)?\\b(19[89]\\d|20[0-3]\\d)\\b`, 'g')
const annees = (t) => [...String(t).matchAll(RE_ANNEE)].map((m) => Number(m[1]))
// « jusqu'au », « à partir de », « depuis » : une seule borne écrite.
// ⚠️ Pas de \b final : « à » n'est pas un caractère de mot pour \b sans
// drapeau u, « jusqu'à » n'était pas reconnu. Et « (2008-) » est ouvert.
const UNE_BORNE = /(?:\bjusqu['’]?\s?(?:au|en|à|a)(?=\s|$)|\bà partir d|\bdepuis\b|\bavant\b|\baprès\b|\b(?:19|20)\d\d\s*(?:\+|[-–]\s*(?:\)|$|[^\d\s])))/i
// Une période de segment ou de fin de texte n'est lue que si elle est
// INTRODUITE comme une période de production : sinon on ne sait pas à quels
// modèles elle s'applique (« … Seat Ibiza (2008-) TDI – 2009-2014 »).
const PRODUCTION = /\b(?:production|produit(?:e|s|es)?|fabriqu\w*|construit\w*|assembl\w*)\b/i

/** Période écrite dans un fragment : {debut, fin, texte} si deux bornes, sinon null. */
function periodeEcrite(t) {
  const ys = annees(t)
  if (ys.length === 0) return null
  if (ys.length === 1) return UNE_BORNE.test(t) ? { incomplete: true } : { debut: ys[0], fin: ys[0] }
  return { debut: Math.min(...ys), fin: Math.max(...ys) }
}

const echapper = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Lit `modeles_annees` d'une affirmation : [{marque, modele, periode, extrait}] et les rejets. */
function lireModeles(objet) {
  const out = [], rejets = []
  const texte = String(objet.modeles_annees ?? '')
  let [corps, ...queue] = texte.split(/\s+[—–]\s+/)
  const queueTexte = queue.join(' ')
  let periodeQueue = queue.length && PRODUCTION.test(queueTexte) ? periodeEcrite(queueTexte) : null
  // « 1.5 BlueHDi produits d'octobre 2025 à février 2026 : Peugeot 208 II… » :
  // une période de production écrite AVANT les deux-points vaut pour la liste.
  const deuxPoints = corps.indexOf(' : ') >= 0 ? corps.indexOf(' : ') : corps.indexOf(': ')
  if (deuxPoints > 0 && PRODUCTION.test(corps.slice(0, deuxPoints))) {
    periodeQueue = periodeEcrite(corps.slice(0, deuxPoints)) ?? periodeQueue
    corps = corps.slice(deuxPoints + 2)
  }
  const marques = (objet.marques ?? []).map((m) => ({ brut: m, c: marqueCanonique(m) })).filter((m) => m.c)
  for (const seg of corps.split(/\s*;\s*/)) {
    let reste = seg.trim()
    let marque = null
    for (const m of marques) {
      const re = new RegExp(`^${echapper(m.brut)}\\b`, 'i')
      if (re.test(reste)) { marque = m; reste = reste.replace(re, '').trim(); break }
    }
    if (!marque) { if (reste) rejets.push({ extrait: seg, motif: 'aucune marque nommée en tête' }); continue }
    // Période du segment : dates écrites HORS parenthèses (« produits du … au … »).
    const horsParentheses = reste.replace(/\([^()]*\)/g, ' ')
    const iProd = horsParentheses.search(PRODUCTION)
    const periodeSegment = iProd >= 0 ? periodeEcrite(horsParentheses.slice(iProd)) : null
    const iProdReste = reste.search(PRODUCTION)
    const listeModeles = iProdReste >= 0 ? reste.slice(0, iProdReste) : reste
    const morceaux = listeModeles.split(/\s*,\s*(?![^()]*\))/).filter((x) => x.trim())
      // « S40/V50 », « Logan II / Sandero II » : deux modèles. « Mégane II/III »
      // reste un modèle (le côté droit est une génération en chiffres romains).
      .flatMap((m) => {
        const sansPar = m.replace(/\([^()]*\)/g, '')
        const parenthese = (m.match(/\([^()]*\)/) ?? [''])[0]
        const parts = sansPar.split(/\s*\/\s*(?=[A-Za-zÀ-ÿ])(?![IVX]+\b)/)
        return parts.length > 1 ? parts.map((x) => `${x.trim()} ${parenthese}`.trim()) : [m]
      })
    if (morceaux.length === 0) { rejets.push({ extrait: seg, motif: 'aucun modèle nommé' }); continue }
    for (let morceau of morceaux) {
      // Un modèle qui commence par une AUTRE marque de l'affirmation change de
      // marque (« Citroën C5 Aircross, DS 7 Crossback, Peugeot 508 »).
      for (const m of marques) {
        const re = new RegExp(`^${echapper(m.brut)}\\b`, 'i')
        if (re.test(morceau.trim())) { marque = m; morceau = morceau.trim().replace(re, '').trim(); break }
      }
      const parenthese = (morceau.match(/\(([^()]*)\)/) ?? [])[1] ?? ''
      const nom = morceau.replace(/\([^()]*\)/g, ' ')
        .split(/\s+(?=(?:19|20)\d\d\b|\d[.,]\d|à moteur\b|diesel\b|essence\b|années?-modèles?\b)/i)[0]
        .replace(/\s+(?:et|ainsi que)\s*$/i, '').replace(/[\s.;:]+$/, '').replace(/\s{2,}/g, ' ').trim()
      // Une parenthèse sans nom de modèle (« Dacia (dCi 70/85 et 110) ») ne nomme rien.
      if (!nom || /^(?:dci|tce|hdi|bluehdi|tdi|tsi|puretech)\b/i.test(nom)) {
        rejets.push({ extrait: `${marque.brut} ${morceau}`, motif: 'aucun modèle nommé' }); continue
      }
      const modele = modeleCanonique(nom)
      if (!modele || modele.length < 2 || /^\d/.test(modele)) {
        rejets.push({ extrait: `${marque.brut} ${morceau}`, motif: 'modèle illisible' }); continue
      }
      const horsNom = morceau.replace(/\([^()]*\)/g, ' ')
      const pInline = /\b(?:19|20)\d\d\s*[-–]\s*(?:19|20)\d\d\b/.test(horsNom) ? periodeEcrite(horsNom.match(/\b(?:19|20)\d\d\s*[-–]\s*(?:19|20)\d\d\b/)[0]) : null
      const pParenthese = parenthese ? periodeEcrite(parenthese) : null
      const periode = (pInline && !pInline.incomplete ? pInline : null)
        ?? (pParenthese && !pParenthese.incomplete ? pParenthese : null)
        ?? (periodeSegment && !periodeSegment.incomplete ? periodeSegment : null)
        ?? (periodeQueue && !periodeQueue.incomplete ? periodeQueue : null)
      const incomplete = [pParenthese, periodeSegment, periodeQueue].some((p) => p?.incomplete)
      out.push({ marque: marque.c, marque_brute: marque.brut, modele, nom, periode, incomplete, extrait: morceau.trim().slice(0, 120) })
    }
  }
  return { out, rejets }
}

// ── Lignes retenues : une fiche, aucune ambiguïté ──────────────────────────
const objetsParFamille = new Map()
for (const o of SOURCES.objets) {
  if (o.type === 'constat') continue
  if (!objetsParFamille.has(o.famille)) objetsParFamille.set(o.famille, [])
  objetsParFamille.get(o.famille).push(o)
}
const lignes = CORR.lignes
const nonProposees = []
const candidats = [] // {fiche, marqueFiche, entree, objet}
for (const l of lignes) {
  if (l.fiches_en_base.length !== 1) {
    if (l.fiches_en_base.length > 1) nonProposees.push({ cle: l.cle, motif: `rattachée à ${l.fiches_en_base.length} fiches (${l.fiches_en_base.join(', ')})` })
    continue
  }
  if ((l.ambigu ?? []).length) { nonProposees.push({ cle: l.cle, motif: `ambiguë (${l.ambigu.join(', ')})` }); continue }
  const fiche = l.fiches_en_base[0]
  const marqueFiche = marqueCanonique(fiche.split(' ')[0] === 'Mercedes-Benz' ? 'Mercedes-Benz' : fiche.split(' ')[0])
  for (const o of objetsParFamille.get(l.cle) ?? []) {
    const { out } = lireModeles(o)
    for (const e of out) candidats.push({ fiche, marqueFiche, cle: l.cle, entree: e, objet: o })
  }
}

// ── Règles 2, 3 et 5 ───────────────────────────────────────────────────────
const chevauche = (a, b) => a.debut <= b.fin && b.debut <= a.fin
const retenues = [], ecartees = []
for (const c of candidats) {
  const { entree: e } = c
  const base = { fiche: c.fiche, marque: e.marque_brute, modele: e.nom, cle: c.cle, objet: c.objet.id }
  if (e.marque === c.marqueFiche) continue // règle 5, silencieuse : rien à couvrir
  if (!e.periode) { ecartees.push({ ...base, motif: e.incomplete ? 'période bornée d’un seul côté' : 'période inconnue' }); continue }
  if (/toutes\s+motorisations/i.test(e.extrait)) { ecartees.push({ ...base, motif: '« toutes motorisations » : ne désigne pas ce moteur' }); continue }
  const af = anneesFiche(c.fiche)
  if (!af) { ecartees.push({ ...base, motif: 'fiche absente de l’export' }); continue }
  if ((af.debut != null && e.periode.debut < af.debut) || (af.fin != null && e.periode.fin > af.fin)) {
    ecartees.push({ ...base, annees: `${e.periode.debut}-${e.periode.fin}`, motif: `déborde la fiche (${af.debut ?? '?'}-${af.fin ?? '…'}) : autre génération possible` }); continue
  }
  const autre = candidats.find((x) => x.fiche !== c.fiche && x.entree.marque === e.marque && x.entree.modele === e.modele &&
    x.entree.periode && chevauche(x.entree.periode, e.periode))
  if (autre) { ecartees.push({ ...base, annees: `${e.periode.debut}-${e.periode.fin}`, motif: `chevauche la fiche ${autre.fiche} (${autre.entree.periode.debut}-${autre.entree.periode.fin}, ${autre.objet.id})` }); continue }
  const src = (c.objet.sources ?? [])[0]
  retenues.push({ ...base, marque_c: e.marque, modele_c: e.modele, annee_debut: e.periode.debut, annee_fin: e.periode.fin,
    source: src?.url ?? '(aucune URL)', classe: c.objet.meilleure_classe ?? '', pays: (c.objet.pays_sources ?? []).join('/'), ecrit: e.extrait })
}

// Une ligne par (fiche, marque, modèle, années) : les doublons d'affirmations
// se regroupent, la première source est gardée et le nombre d'affirmations dit.
const cle = (r) => `${r.fiche}|${r.marque_c}|${r.modele_c}|${r.annee_debut}|${r.annee_fin}`
const parCle = new Map()
for (const r of retenues) {
  if (!parCle.has(cle(r))) parCle.set(cle(r), { ...r, affirmations: 0 })
  parCle.get(cle(r)).affirmations++
}
const lignesSortie = [...parCle.values()].sort((a, b) => a.fiche.localeCompare(b.fiche) || a.marque.localeCompare(b.marque) || a.modele.localeCompare(b.modele))

console.log(`PROPOSITION DE COUVERTURES — ${lignesSortie.length} ligne(s) sur ${new Set(lignesSortie.map((l) => l.fiche)).size} fiche(s)\n`)
let ficheCourante = ''
for (const l of lignesSortie) {
  if (l.fiche !== ficheCourante) { console.log(`\n■ ${l.fiche}`); ficheCourante = l.fiche }
  console.log(`  ${l.marque} ${l.modele} · ${l.annee_debut}-${l.annee_fin} · en base : ${l.marque_c}/${l.modele_c} · écrit : « ${l.ecrit} » · ${l.objet}${l.affirmations > 1 ? ` (+${l.affirmations - 1})` : ''} · ${l.classe} ${l.pays} · ${l.source}`)
}
console.log(`\nÉCARTÉES — ${ecartees.length}`)
const parMotif = {}
for (const e of ecartees) { const m = e.motif.startsWith('chevauche') ? 'chevauche une autre fiche' : e.motif.startsWith('déborde') ? 'déborde les années de la fiche' : e.motif; parMotif[m] = (parMotif[m] ?? 0) + 1 }
console.log('  ' + Object.entries(parMotif).map(([m, n]) => `${m} : ${n}`).join(' · '))
for (const e of ecartees.filter((x) => x.annees)) console.log(`  ✗ ${e.fiche} · ${e.marque} ${e.modele} ${e.annees} — ${e.motif}`)
console.log(`\nFAMILLES SANS PROPOSITION (rattachement) — ${nonProposees.length}`)
for (const n of nonProposees) console.log(`  ${n.cle} — ${n.motif}`)

if (SORTIE_JSON) {
  const couvertures = {}
  for (const l of lignesSortie) (couvertures[l.fiche] ??= []).push({ marque: l.marque_c, modele: l.modele_c, annee_debut: l.annee_debut, annee_fin: l.annee_fin, objet: l.objet, source: l.source })
  writeFileSync(SORTIE_JSON, JSON.stringify({ genere_le: new Date().toISOString().slice(0, 10), regles: 'scripts/proposer-couvertures.mjs', couvertures, ecartees, non_proposees: nonProposees }, null, 1) + '\n')
  console.log(`\n→ ${SORTIE_JSON}`)
}
