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
const panne = (gravite, rappel = false) => ({ gravite, rappel_officiel: rappel, rappel_confirme_effectue: false })

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
