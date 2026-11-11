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
    // Pas de marque en tête (« 36 modèles dont 208, …, Opel Corsa ») : la liste
    // est lue quand même, et seul un modèle PRÉCÉDÉ d'une marque écrite reçoit
    // une marque. « C3 » seul ne devient jamais une Citroën : ce serait déduit.
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
        if (parts.length > 1) return parts.map((x) => `${x.trim()} ${parenthese}`.trim())
        // « One et Cooper 1.6 essence 2006-2013 » : deux modèles, la suite commune
        // (motorisation, années) reste attachée à chacun.
        const et = sansPar.match(/^(\S+(?:\s+[IVX]+)?)\s+et\s+(\S+)(\s+.*)?$/)
        if (et && !/\d[.,]\d/.test(et[1] + et[2])) return [`${et[1]}${et[3] ?? ''} ${parenthese}`.trim(), `${et[2]}${et[3] ?? ''} ${parenthese}`.trim()]
        return [m]
      })
    if (morceaux.length === 0) { rejets.push({ extrait: seg, motif: 'aucun modèle nommé' }); continue }
    for (let morceau of morceaux) {
      // Un DEUX-POINTS remet la marque à zéro : « VW, Audi, Seat, Skoda 2.0 TDI :
      // Golf VI, Passat VII… » — la liste appartient aux quatre marques, pas à
      // la dernière lue. Chaque modèle qui suit doit porter sa propre marque.
      if (/:/.test(morceau)) { marque = null; morceau = morceau.slice(morceau.lastIndexOf(':') + 1) }
      // Un modèle qui commence par une AUTRE marque de l'affirmation change de
      // marque (« Citroën C5 Aircross, DS 7 Crossback, Peugeot 508 »).
      for (const m of marques) {
        const re = new RegExp(`^${echapper(m.brut)}\\b`, 'i')
        if (re.test(morceau.trim())) { marque = m; morceau = morceau.trim().replace(re, '').trim(); break }
      }
      if (!marque) { rejets.push({ extrait: morceau.trim(), motif: 'aucune marque écrite devant ce modèle' }); continue }
      const parenthese = (morceau.match(/\(([^()]*)\)/) ?? [])[1] ?? ''
      const nom = morceau.replace(/\([^()]*\)/g, ' ')
        .split(/\s+(?=(?:19|20)\d\d\b|\d[.,]\d|à moteur\b|diesel\b|essence\b|années?-modèles?\b)/i)[0]
        .replace(/\s+(?:et|ainsi que)\s*$/i, '').replace(/[\s.;:]+$/, '').replace(/\s{2,}/g, ' ').trim()
      // Une parenthèse sans nom de modèle (« Dacia (dCi 70/85 et 110) ») ne nomme rien.
      if (!nom || /^(?:dci|tce|hdi|bluehdi|tdi|tsi|puretech)\b/i.test(nom)) {
        rejets.push({ extrait: `${marque.brut} ${morceau}`, motif: 'aucun modèle nommé' }); continue
      }
      const modele = modeleCanonique(nom)
      // Un « nom » qui contient une phrase (« SD. Moteurs 2007-2009 les plus
      // fragiles ») n'est pas un modèle : rien n'est proposé.
      if (/\s(?:et|ou)\s/i.test(nom)) {
        rejets.push({ extrait: `${marque.brut} ${morceau}`, motif: 'deux modèles dans un même nom : à relire' }); continue
      }
      if (/[.!?]/.test(nom) || nom.split(/\s+/).length > 4) {
        rejets.push({ extrait: `${marque.brut} ${morceau}`, motif: 'phrase, pas un nom de modèle' }); continue
      }
      if (!modele || modele.length < 2 || /^\d/.test(modele)) {
        rejets.push({ extrait: `${marque.brut} ${morceau}`, motif: 'modèle illisible' }); continue
      }
      const horsNom = morceau.replace(/\([^()]*\)/g, ' ')
      const pInline = /\b(?:19|20)\d\d\s*[-–]\s*(?:19|20)\d\d\b/.test(horsNom) ? periodeEcrite(horsNom.match(/\b(?:19|20)\d\d\s*[-–]\s*(?:19|20)\d\d\b/)[0]) : null
      const pParenthese = parenthese ? periodeEcrite(parenthese) : null
      // Une borne PROPRE au modèle et incomplète (« Duster 2 (jusqu'au
      // 10/02/2020) ») l'emporte : on ne lui prête pas la période du segment.
      const periode = pParenthese?.incomplete ? null : (pInline && !pInline.incomplete ? pInline : null)
        ?? (pParenthese && !pParenthese.incomplete ? pParenthese : null)
        ?? (periodeSegment && !periodeSegment.incomplete ? periodeSegment : null)
        ?? (periodeQueue && !periodeQueue.incomplete ? periodeQueue : null)
      const incomplete = [pParenthese, periodeSegment, periodeQueue].some((p) => p?.incomplete)
      out.push({ marque: marque.c, marque_brute: marque.brut, modele, nom, periode, incomplete, extrait: morceau.trim().slice(0, 120),
        // Une fenêtre de RAPPEL n'est pas une période de production (décision
        // d'Utku du 11 nov. 2026) : elle est gardée, mais marquée comme telle.
        nature: objet.type === 'rappel' || objet.type === 'campagne' ? 'fenetre_rappel' : 'production' })
    }
  }
  return { out, rejets }
}

// ── Choix de la fiche (décision d'Utku du 11 nov. 2026) ────────────────────
// Une famille du fichier de sources peut être rattachée à plusieurs fiches
// (K9K, EB2, OM654…). Pour chaque entrée, la fiche est choisie PAR CODE MOTEUR
// ET PAR PÉRIODE, dans cet ordre, et la raison est écrite :
//   a. le code d'UNE seule fiche est écrit dans l'affirmation ;
//   b. plusieurs fiches pour le MÊME code (« Mercedes » / « Mercedes-Benz ») :
//      la première, les deux étant fusionnées à la lecture (expandBrand) ;
//   c. aucun code écrit : la fiche DE FAMILLE dont le code est le préfixe de
//      tous les autres (« EB2 » pour EB2DT, EB2DTS…) — compatible par préfixe
//      avec chacune des variantes à l'identification ;
//   d. sinon, la SEULE fiche dont les années contiennent la période écrite ;
//   e. sinon : aucune fiche, aucune couverture.
const codeDe = (fiche) => fiche.split(' ').slice(1).join(' ').toUpperCase()
const marqueDe = (fiche) => marqueCanonique(fiche.split(' ')[0])
function choisirFiche(l, objet, e) {
  const fs = l.fiches_en_base
  if (fs.length === 1) return { fiche: fs[0], raison: 'seule fiche rattachée à cette famille' }
  const texte = `${objet.libelle_moteur ?? ''} ${objet.intitule ?? ''} ${objet.modeles_annees ?? ''}`.toUpperCase()
  const citees = fs.filter((f) => new RegExp(`\\b${echapper(codeDe(f))}\\b`).test(texte))
  const codesCites = [...new Set(citees.map(codeDe))]
  if (codesCites.length === 1) return { fiche: citees[0], raison: `code ${codesCites[0]} écrit dans l'affirmation${citees.length > 1 ? ' (fiches de même code fusionnées à la lecture)' : ''}` }
  const dansLesAnnees = (f) => { const a = anneesFiche(f); return a && e.periode && (a.debut == null || e.periode.debut >= a.debut) && (a.fin == null || e.periode.fin <= a.fin) }
  if (codesCites.length > 1) {
    const ok = citees.filter(dansLesAnnees)
    const codesOk = [...new Set(ok.map(codeDe))]
    if (codesOk.length === 1) return { fiche: ok[0], raison: `codes ${codesCites.join(' et ')} écrits ; seul ${codesOk[0]} couvre la période` }
    return { fiche: null, raison: `codes ${codesCites.join(' et ')} écrits, période sans départage` }
  }
  const generique = fs.filter((f) => fs.every((g) => codeDe(g).startsWith(codeDe(f))))
  if (generique.length >= 1 && fs.length > generique.length) return { fiche: generique[0], raison: `aucun code écrit ; fiche de famille ${codeDe(generique[0])}, compatible par préfixe avec ${fs.filter((g) => !generique.includes(g)).map(codeDe).join(', ')}` }
  const ok = fs.filter(dansLesAnnees)
  const codesOk = [...new Set(ok.map(codeDe))]
  if (codesOk.length === 1) return { fiche: ok[0], raison: `aucun code écrit ; seule ${ok[0]} couvre la période` }
  return { fiche: null, raison: ok.length ? `aucun code écrit ; ${ok.length} fiches couvrent la période` : 'aucun code écrit ; aucune fiche ne couvre la période' }
}

const objetsParFamille = new Map()
for (const o of SOURCES.objets) {
  if (o.type === 'constat') continue
  if (!objetsParFamille.has(o.famille)) objetsParFamille.set(o.famille, [])
  objetsParFamille.get(o.famille).push(o)
}
const lignes = CORR.lignes
const nonProposees = []
const candidats = [] // {fiche, marqueFiche, entree, objet, raison}
const decisionsMulti = new Map() // cle → [{entree, objet, fiche, raison}]
const PAYS_US = new Set(['US', 'CA'])
for (const l of lignes) {
  if (l.fiches_en_base.length === 0) continue
  if ((l.ambigu ?? []).length) { nonProposees.push({ cle: l.cle, motif: `ambiguë (${l.ambigu.join(', ')})` }); continue }
  for (const o of objetsParFamille.get(l.cle) ?? []) {
    const { out } = lireModeles(o)
    for (const e of out) {
      const { fiche, raison } = choisirFiche(l, o, e)
      if (l.fiches_en_base.length > 1) {
        if (!decisionsMulti.has(l.cle)) decisionsMulti.set(l.cle, [])
        decisionsMulti.get(l.cle).push({ entree: e, objet: o, fiche, raison })
      }
      if (!fiche) continue
      candidats.push({ fiche, marqueFiche: marqueDe(fiche), cle: l.cle, entree: e, objet: o, raison })
    }
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
  const pays = c.objet.pays_sources ?? []
  if (pays.length > 0 && pays.every((x) => PAYS_US.has(x))) { ecartees.push({ ...base, motif: 'sources nord-américaines seulement : moteur non garanti identique en Europe' }); continue }
  if (/toutes\s+motorisations/i.test(e.extrait)) { ecartees.push({ ...base, motif: '« toutes motorisations » : ne désigne pas ce moteur' }); continue }
  const af = anneesFiche(c.fiche)
  if (!af) { ecartees.push({ ...base, motif: 'fiche absente de l’export' }); continue }
  if ((af.debut != null && e.periode.debut < af.debut) || (af.fin != null && e.periode.fin > af.fin)) {
    ecartees.push({ ...base, annees: `${e.periode.debut}-${e.periode.fin}`, motif: `déborde la fiche (${af.debut ?? '?'}-${af.fin ?? '…'}) : autre génération possible` }); continue
  }
  // « Deux générations » : une fiche de la MÊME LIGNÉE de codes (même racine :
  // DV5/DV6, H4D/H4DT, OM651/OM654, EB2DT/EB2DTS). Un diesel K9K et un essence
  // H5FT sur le même Qashqai ne sont pas deux générations d'un moteur — et la
  // recherche de fiche exige de toute façon le bon code famille.
  const lignee = (a, b) => codeDe(a).slice(0, 2) === codeDe(b).slice(0, 2)
  const autre = candidats.find((x) => x.fiche !== c.fiche && lignee(x.fiche, c.fiche) && x.entree.marque === e.marque && x.entree.modele === e.modele &&
    x.entree.periode && chevauche(x.entree.periode, e.periode))
  if (autre) { ecartees.push({ ...base, annees: `${e.periode.debut}-${e.periode.fin}`, motif: `chevauche la fiche ${autre.fiche} (${autre.entree.periode.debut}-${autre.entree.periode.fin}, ${autre.objet.id})` }); continue }
  const src = (c.objet.sources ?? [])[0]
  retenues.push({ ...base, marque_c: e.marque, modele_c: e.modele, annee_debut: e.periode.debut, annee_fin: e.periode.fin,
    source: src?.url ?? '(aucune URL)', classe: c.objet.meilleure_classe ?? '', pays: (c.objet.pays_sources ?? []).join('/'), ecrit: e.extrait,
    nature: e.nature, raison_fiche: c.raison })
}

// Une ligne par (fiche, marque, modèle, années) : les doublons d'affirmations
// se regroupent, la première source est gardée et le nombre d'affirmations dit.
const cle = (r) => `${r.fiche}|${r.marque_c}|${r.modele_c}|${r.annee_debut}|${r.annee_fin}`
const parCle = new Map()
for (const r of retenues) {
  if (!parCle.has(cle(r))) parCle.set(cle(r), { ...r, affirmations: 0 })
  parCle.get(cle(r)).affirmations++
}
const avecProduction = new Set([...parCle.values()].filter((r) => r.nature === 'production').map((r) => `${r.fiche}|${r.marque_c}|${r.modele_c}`))
for (const [k, r] of parCle) {
  if (r.nature === 'fenetre_rappel' && avecProduction.has(`${r.fiche}|${r.marque_c}|${r.modele_c}`)) {
    parCle.delete(k)
    ecartees.push({ fiche: r.fiche, marque: r.marque, modele: r.modele, annees: `${r.annee_debut}-${r.annee_fin}`, objet: r.objet, motif: 'fenêtre de rappel remplacée par une période de production écrite' })
  }
}
const lignesSortie = [...parCle.values()].sort((a, b) => a.fiche.localeCompare(b.fiche) || a.marque.localeCompare(b.marque) || a.modele.localeCompare(b.modele))

console.log(`PROPOSITION DE COUVERTURES — ${lignesSortie.length} ligne(s) sur ${new Set(lignesSortie.map((l) => l.fiche)).size} fiche(s)\n`)
let ficheCourante = ''
for (const l of lignesSortie) {
  if (l.fiche !== ficheCourante) { console.log(`\n■ ${l.fiche}`); ficheCourante = l.fiche }
  console.log(`  ${l.marque} ${l.modele} · ${l.annee_debut}-${l.annee_fin}${l.nature === 'fenetre_rappel' ? ' [FENÊTRE DE RAPPEL]' : ''} · en base : ${l.marque_c}/${l.modele_c} · écrit : « ${l.ecrit} » · ${l.objet}${l.affirmations > 1 ? ` (+${l.affirmations - 1})` : ''} · ${l.classe} ${l.pays} · ${l.source}`)
}
console.log(`\nÉCARTÉES — ${ecartees.length}`)
const parMotif = {}
for (const e of ecartees) { const m = e.motif.startsWith('chevauche') ? 'chevauche une autre fiche' : e.motif.startsWith('déborde') ? 'déborde les années de la fiche' : e.motif; parMotif[m] = (parMotif[m] ?? 0) + 1 }
console.log('  ' + Object.entries(parMotif).map(([m, n]) => `${m} : ${n}`).join(' · '))
for (const e of ecartees.filter((x) => x.annees)) console.log(`  ✗ ${e.fiche} · ${e.marque} ${e.modele} ${e.annees} — ${e.motif}`)
console.log(`\nFAMILLES SANS PROPOSITION (rattachement) — ${nonProposees.length}`)
for (const n of nonProposees) console.log(`  ${n.cle} — ${n.motif}`)

const iMd = process.argv.indexOf('--md')
if (iMd > 0) {
  const L = []
  const tdc = (t) => String(t ?? '').replace(/\|/g, '/')
  L.push('# Couvertures multi-marques proposées — à relire avant toute écriture', '',
    `Généré le ${new Date().toISOString().slice(0, 10)} par \`scripts/proposer-couvertures.mjs\` (aucune écriture, aucune dépense). Une ligne = une entrée de couverture : la fiche servira AUSSI à ce véhicule d’une autre marque, si la famille moteur identifiée correspond et si l’année tombe dans la période.`, '',
    '**Règles** : marques, modèles et années **écrits** dans `docs/sources-moteurs-2026-11.json`, rien de déduit · un modèle sans marque écrite devant lui ne reçoit rien · période inconnue ou bornée d’un seul côté ⇒ rien · période qui déborde les années de la fiche, ou même modèle rattaché à une fiche de la même lignée de codes sur une période qui chevauche ⇒ rien (deux générations possibles) · « toutes motorisations » ⇒ rien · sources nord-américaines seulement ⇒ rien · une **fenêtre de rappel** n’est pas une période de production : gardée à défaut, marquée comme telle, et remplacée dès qu’une période de production est écrite pour le même modèle.', '',
    `**Total : ${lignesSortie.length} entrées sur ${new Set(lignesSortie.map((l) => l.fiche)).size} fiches** (dont ${lignesSortie.filter((l) => l.nature === 'fenetre_rappel').length} fenêtres de rappel) · ${ecartees.length} écartées.`, '',
    '## Entrées proposées', '', '| Fiche | Marque | Modèle (écrit en base) | Années | Nature | Écrit dans la source | Affirmation | Source |', '|---|---|---|---|---|---|---|---|')
  for (const l of lignesSortie) L.push(`| ${l.fiche} | ${l.marque} | ${tdc(l.modele_c)} | ${l.annee_debut}-${l.annee_fin} | ${l.nature === 'fenetre_rappel' ? '**fenêtre de rappel**' : 'production'} | ${tdc(l.ecrit)} | ${l.objet} (${l.classe} ${l.pays}) | ${l.source} |`)
  L.push('', '## Familles rattachées à plusieurs fiches — fiche retenue par code moteur et période', '',
    'Ordre de décision : (a) le code d’une seule fiche est écrit dans l’affirmation ; (b) même code sous deux écritures de marque ⇒ la première, fusionnées à la lecture ; (c) aucun code écrit ⇒ la fiche de famille dont le code est le préfixe des autres ; (d) sinon la seule fiche dont les années contiennent la période ; (e) sinon aucune.', '')
  for (const l of lignes.filter((x) => x.fiches_en_base.length > 1)) {
    const d = decisionsMulti.get(l.cle) ?? []
    L.push(`### ${l.cle}`, '', `Fiches en base : ${l.fiches_en_base.map((f) => { const a = anneesFiche(f); return `${f} (${a?.debut ?? '?'}-${a?.fin ?? '…'})` }).join(' · ')}. Codes de la famille : ${l.codes.join(', ') || '—'}.`, '')
    const parFiche = {}
    for (const x of d) { const k = x.fiche ?? '(aucune)'; (parFiche[k] ??= new Map()).set(x.raison, ((parFiche[k].get(x.raison)) ?? 0) + 1) }
    if (d.length === 0) { L.push('Aucun modèle d’une marque écrite dans les affirmations de cette famille : rien à rattacher.', ''); continue }
    for (const [f, raisons] of Object.entries(parFiche)) L.push(`- **${f}** — ${[...raisons].map(([r, n]) => `${r} (${n} modèle${n > 1 ? 's' : ''})`).join(' ; ')}`)
    const retenus = lignesSortie.filter((x) => x.cle === l.cle)
    L.push('', retenus.length ? `Entrées proposées pour cette famille : ${retenus.map((x) => `${x.marque} ${x.modele_c} ${x.annee_debut}-${x.annee_fin} → ${x.fiche}`).join(' · ')}.` : 'Aucune entrée proposée : les modèles sont de la marque de la fiche, ou sans période écrite.', '')
  }
  L.push('## Écartées', '', '| Fiche | Véhicule | Motif |', '|---|---|---|')
  for (const e of ecartees) L.push(`| ${e.fiche} | ${tdc(e.marque)} ${tdc(e.modele)}${e.annees ? ' ' + e.annees : ''} | ${tdc(e.motif)} |`)
  writeFileSync(process.argv[iMd + 1], L.join('\n') + '\n')
  console.log(`→ ${process.argv[iMd + 1]}`)
}

if (SORTIE_JSON) {
  const couvertures = {}
  for (const l of lignesSortie) (couvertures[l.fiche] ??= []).push({ marque: l.marque_c, modele: l.modele_c, annee_debut: l.annee_debut, annee_fin: l.annee_fin,
    nature_periode: l.nature, objet: l.objet, source: l.source, raison_fiche: l.raison_fiche })
  const multi = Object.fromEntries([...decisionsMulti].map(([k, v]) => [k, v.map((d) => ({ marque: d.entree.marque_brute, modele: d.entree.nom,
    periode: d.entree.periode ? `${d.entree.periode.debut}-${d.entree.periode.fin}` : null, fiche: d.fiche, raison: d.raison, objet: d.objet.id }))]))
  writeFileSync(SORTIE_JSON, JSON.stringify({ genere_le: new Date().toISOString().slice(0, 10), regles: 'scripts/proposer-couvertures.mjs', couvertures, ecartees, non_proposees: nonProposees, familles_multi: multi }, null, 1) + '\n')
  console.log(`\n→ ${SORTIE_JSON}`)
}
