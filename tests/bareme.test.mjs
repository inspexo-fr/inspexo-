// Test hors ligne du barème déterministe (aucun appel API).
// Vérifie la calibration sur des profils réels et, surtout, le DÉTERMINISME.
// Usage : node tests/bareme.test.mjs
import { calculerAxes } from '../supabase/functions/_shared/bareme.ts'

const base = {
  annee_courante: 2026,
  statut_vendeur: 'particulier',
  annee: 2018, kilometrage: 120000, prix_affiche: null,
  fourchette: null, comparables_count: 0,
  entretien_renseigne: false, signaux_entretien: 0,
  contradictions_entretien: 0, operations_critiques_non_faites: 0,
  catalogue_vide: false, pannes: [], incoherences: 0,
}
const panne = (gravite, rappel = false, couverte = false) =>
  ({ gravite, rappel_officiel: rappel, rappel_confirme_effectue: false, couverte_garantie: couverte })

let ko = 0
const verifie = (titre, faits, attendu) => {
  const r = calculerAxes({ ...base, ...faits })
  const okVerdict = !attendu.verdict || r.verdict === attendu.verdict
  const okMin = attendu.score_min == null || r.score >= attendu.score_min
  const okMax = attendu.score_max == null || r.score <= attendu.score_max
  const ok = okVerdict && okMin && okMax
  if (!ok) ko++
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${titre} → ${r.verdict} ${r.score}/100` +
    (ok ? '' : ` (attendu ${attendu.verdict ?? '*'} ${attendu.score_min ?? ''}-${attendu.score_max ?? ''})`))
}

console.log('CALIBRATION\n')
verifie('Audi S7 : 2 sécurité + 2 rappels + 3 majeures, intermédiaire, 159 000 km/11 ans',
  { statut_vendeur: 'intermediaire_pour_particulier', annee: 2015, kilometrage: 159000, incoherences: 2,
    entretien_renseigne: true, signaux_entretien: 2,
    pannes: [panne('securite', true), panne('securite', true), panne('majeure'), panne('majeure'), panne('majeure')] },
  { verdict: 'rouge' })

verifie('308 PureTech : 1 sécurité + 1 rappel, 1 opération critique non faite',
  { annee: 2016, kilometrage: 84500, incoherences: 1, entretien_renseigne: true,
    signaux_entretien: 4, operations_critiques_non_faites: 1, contradictions_entretien: 1,
    pannes: [panne('securite', true)] },
  { verdict: 'orange', score_max: 55 })

verifie('BMW N47 : 2 majeures, particulier, 142 000 km/14 ans',
  { annee: 2012, kilometrage: 142000, incoherences: 1, entretien_renseigne: true, signaux_entretien: 1,
    pannes: [panne('majeure'), panne('majeure')] },
  { verdict: 'orange' })

verifie('Mercedes 2025 pro, 36 606 km, aucune panne, entretien non renseigné',
  { statut_vendeur: 'pro', annee: 2025, kilometrage: 36606, catalogue_vide: true },
  { verdict: 'vert', score_min: 70 })

verifie('Annonce saine : pro, faible km, prix sous la médiane',
  { statut_vendeur: 'pro', annee: 2022, kilometrage: 40000, prix_affiche: 15000,
    fourchette: { p25: 15500, mediane: 17000, p75: 18500 }, comparables_count: 20,
    entretien_renseigne: true, signaux_entretien: 3 },
  { verdict: 'vert' })

verifie('Prix très au-dessus du marché',
  { prix_affiche: 25000, fourchette: { p25: 15000, mediane: 17000, p75: 19000 }, comparables_count: 20 },
  { score_max: 69 })

verifie('Annonce très courte : Golf 7 de 2015, 123 000 km, rien sur l\'entretien',
  { annee: 2015, kilometrage: 123000, catalogue_vide: true },
  { verdict: 'orange', score_max: 69 })

// Cas 308 : la courroie est couverte par l'extension PureTech si l'acheteur
// fournit les 3 dernières factures → le verdict doit passer de rouge à orange.
{
  const faits = {
    ...base, annee: 2020, kilometrage: 138000,
    pannes: [panne('securite', true, true), panne('majeure'), panne('mineure')],
    condition_garantie: 'les 3 dernières factures d\'entretien',
  }
  const r = calculerAxes(faits)
  const c = r.verdict_conditionnel
  const ok = r.verdict === 'rouge' && c && c.verdict === 'orange' && c.score > r.score
  if (!ok) ko++
  console.log(`${ok ? 'PASS' : 'FAIL'} — 308 couverte par l'extension : ${r.verdict} ${r.score} → conditionnel ` +
    (c ? `${c.verdict} ${c.score} (${c.condition})` : 'ABSENT'))
}

// Le plafond « pas de preuve d'entretien » doit être explicité.
{
  const r = calculerAxes({ ...base, annee: 2015, kilometrage: 123000, catalogue_vide: true })
  const ok = typeof r.plafond_raison === 'string' && /preuve d'entretien/i.test(r.plafond_raison)
  if (!ok) ko++
  console.log(`${ok ? 'PASS' : 'FAIL'} — raison du plafond : ${r.plafond_raison ?? 'ABSENTE'}`)
}

// Un moteur mieux documenté ne doit pas être pénalisé pour cette raison.
{
  const peu = calculerAxes({ ...base, pannes: [panne('majeure')] })
  const beaucoup = calculerAxes({ ...base, pannes: [panne('majeure'), panne('majeure'), panne('majeure'), panne('mineure'), panne('mineure')] })
  const ok = peu.score === beaucoup.score
  if (!ok) ko++
  console.log(`${ok ? 'PASS' : 'FAIL'} — 1 panne majeure (${peu.score}) = 5 pannes même gravité max (${beaucoup.score})`)
}

// Le rouge est réservé aux faits graves : une panne « majeure » seule plafonne
// en orange, même avec tous les autres signaux au plus bas.
{
  const r = calculerAxes({ ...base, annee: 2012, kilometrage: 210000, incoherences: 3,
    statut_vendeur: 'particulier', entretien_renseigne: true, contradictions_entretien: 2,
    pannes: [panne('majeure'), panne('majeure'), panne('mineure')] })
  const ok = r.verdict === 'orange' && r.score >= 40
  if (!ok) ko++
  console.log(`${ok ? 'PASS' : 'FAIL'} — pannes majeures seules → ${r.verdict} ${r.score} (rouge interdit)`)
}

// Un risque de casse non couvert autorise le rouge : sur des faits très
// dégradés, le score peut descendre sous 40 — ce qu'une panne majeure seule
// ne permet pas (le plancher s'applique alors).
{
  const degrade = {
    ...base, statut_vendeur: 'pro_deguise_probable', annee: 2012, kilometrage: 230000,
    incoherences: 3, entretien_renseigne: true, contradictions_entretien: 2,
    operations_critiques_non_faites: 1,
  }
  const casse = calculerAxes({ ...degrade, pannes: [{ gravite: 'casse', rappel_officiel: true, rappel_confirme_effectue: false }] })
  const majeure = calculerAxes({ ...degrade, pannes: [panne('majeure', true)] })
  const ok = casse.verdict === 'rouge' && majeure.verdict === 'orange' && majeure.score === 40
  if (!ok) ko++
  console.log(`${ok ? 'PASS' : 'FAIL'} — mêmes faits dégradés : casse → ${casse.verdict} ${casse.score}, ` +
    `majeure seule → ${majeure.verdict} ${majeure.score} (plancher 40)`)
}

// Un rappel « stop drive » non traité lève le plancher à lui seul.
{
  const faits = { ...base, statut_vendeur: 'pro_deguise_probable', annee: 2012, kilometrage: 230000,
    incoherences: 3, entretien_renseigne: true, contradictions_entretien: 2,
    operations_critiques_non_faites: 1, pannes: [panne('majeure', true)] }
  const sans = calculerAxes(faits)
  const avec = calculerAxes({ ...faits, rappel_stop_drive: true })
  const ok = sans.score === 40 && avec.score < 40 && avec.verdict === 'rouge'
  if (!ok) ko++
  console.log(`${ok ? 'PASS' : 'FAIL'} — rappel stop drive : sans ${sans.verdict} ${sans.score} → avec ${avec.verdict} ${avec.score}`)
}

console.log('\nDÉTERMINISME')
const faitsRef = { ...base, statut_vendeur: 'pro', annee: 2019, kilometrage: 95000,
  entretien_renseigne: true, signaux_entretien: 2, pannes: [panne('majeure'), panne('mineure')] }
const scores = new Set()
for (let i = 0; i < 50; i++) scores.add(JSON.stringify(calculerAxes({ ...faitsRef })))
const deterministe = scores.size === 1
if (!deterministe) ko++
console.log(`${deterministe ? 'PASS' : 'FAIL'} — 50 appels identiques → ${scores.size} résultat(s) distinct(s)`)

console.log(ko === 0 ? '\n✓ barème conforme' : `\n✗ ${ko} écart(s)`)
process.exit(ko === 0 ? 0 : 1)
