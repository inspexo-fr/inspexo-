// Test hors ligne du barème déterministe (aucun appel API).
// Vérifie la calibration sur des profils réels et, surtout, le DÉTERMINISME.
// Usage : node tests/bareme.test.mjs
import { BAREME_VERSION, calculerAxes, seuilKmPanne, panneDansHorizon } from '../supabase/functions/_shared/bareme.ts'

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

// Assertion générique : `verifie` ci-dessus est spécialisée (elle appelle
// elle-même calculerAxes et compare un verdict attendu).
const affirme = (titre, cond, detail = '') => {
  if (!cond) ko++
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${titre}${cond || !detail ? '' : ` (${detail})`}`)
}

// toLocaleString('fr-FR') sépare les milliers par une espace FINE INSÉCABLE
// (U+202F) : comparer avec une espace ordinaire échouerait sans raison.
const ns = (t) => String(t).replace(/[\u202f\u00a0\u2009\u2007]/g, ' ')

const verifiePrix = (titre, cond, detail = '') => {
  if (!cond) ko++
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${titre}${cond || !detail ? '' : ` → ${detail}`}`)
}

// ---------------------------------------------------------------------------
// SPRINT 13 — SANS HistoVec, le score est STRICTEMENT identique.
//
// Deux faits HistoVec sont entrés dans le barème. La garantie qui compte est
// qu'ils ne changent RIEN quand aucun rapport n'a été déposé : c'est ce qui
// rend la nouveauté sans effet de bord sur les analyses existantes.
// On le prouve en rejouant des profils variés sous trois formes du même fait :
// champ absent, champ undefined, champ false.
// ---------------------------------------------------------------------------
{
  const profils = [
    { nom: 'vert sobre', f: { annee_courante: 2026, statut_vendeur: 'particulier', annee: 2022, kilometrage: 40000, prix_affiche: 18000, fourchette: { p25: 17000, mediane: 18500, p75: 20000 }, comparables_count: 20, entretien_renseigne: true, signaux_entretien: 3, contradictions_entretien: 0, operations_critiques_non_faites: 0, catalogue_vide: false, pannes: [], incoherences: 0 } },
    { nom: 'orange panne majeure', f: { annee_courante: 2026, statut_vendeur: 'particulier', annee: 2019, kilometrage: 120000, prix_affiche: 9000, fourchette: null, comparables_count: 0, entretien_renseigne: true, signaux_entretien: 1, contradictions_entretien: 1, operations_critiques_non_faites: 0, catalogue_vide: false, pannes: [{ gravite: 'majeure', rappel_officiel: false, rappel_confirme_effectue: false }], incoherences: 1 } },
    { nom: 'rouge securite', f: { annee_courante: 2026, statut_vendeur: 'pro_deguise_probable', annee: 2015, kilometrage: 230000, prix_affiche: 5000, fourchette: null, comparables_count: 0, entretien_renseigne: false, signaux_entretien: 0, contradictions_entretien: 0, operations_critiques_non_faites: 1, catalogue_vide: false, pannes: [{ gravite: 'securite', rappel_officiel: true, rappel_confirme_effectue: false }], incoherences: 2, juridique_grave: true } },
    { nom: 'compteur contredit', f: { annee_courante: 2026, statut_vendeur: 'particulier', annee: 2020, kilometrage: 60000, prix_affiche: 12000, fourchette: null, comparables_count: 0, entretien_renseigne: true, signaux_entretien: 2, contradictions_entretien: 0, operations_critiques_non_faites: 0, catalogue_vide: false, pannes: [], incoherences: 1, compteur_contredit: true } },
  ]
  let divergences = []
  for (const { nom, f } of profils) {
    const sansChamp = JSON.stringify(calculerAxes(f))
    const indefini = JSON.stringify(calculerAxes({ ...f, histovec_opposition: undefined, histovec_vge_en_cours: undefined }))
    const faux = JSON.stringify(calculerAxes({ ...f, histovec_opposition: false, histovec_vge_en_cours: false }))
    if (sansChamp !== indefini) divergences.push(`${nom} : absent ≠ undefined`)
    if (sansChamp !== faux) divergences.push(`${nom} : absent ≠ false`)
  }
  affirme('SANS HistoVec, le score est strictement identique (4 profils × 3 formes)',
    divergences.length === 0, divergences.join(' | '))
}
{
  // Et AVEC, les deux faits mordent bien — sinon le test ci-dessus serait
  // vrai pour la mauvaise raison (un champ jamais lu).
  const base = { annee_courante: 2026, statut_vendeur: 'particulier', annee: 2022, kilometrage: 30000, prix_affiche: 20000, fourchette: null, comparables_count: 0, entretien_renseigne: true, signaux_entretien: 3, contradictions_entretien: 0, operations_critiques_non_faites: 0, catalogue_vide: false, pannes: [], incoherences: 0 }
  const normal = calculerAxes(base)
  const avecOpposition = calculerAxes({ ...base, histovec_opposition: true })
  const avecVge = calculerAxes({ ...base, histovec_vge_en_cours: true })
  affirme('Une opposition HistoVec fait tomber le verdict en rouge',
    normal.verdict === 'vert' && avecOpposition.verdict === 'rouge' && avecOpposition.score <= 30,
    `${normal.score} → ${avecOpposition.score} (${avecOpposition.verdict})`)
  affirme('Une procédure VGE non levée fait tomber le verdict en rouge',
    avecVge.verdict === 'rouge' && avecVge.score <= 32, `${avecVge.score} ${avecVge.verdict}`)
  affirme('Le motif du plafond nomme la cause',
    /opposition/i.test(avecOpposition.plafond_raison ?? '') &&
    /gravement endommag/i.test(avecVge.plafond_raison ?? ''),
    `${avecOpposition.plafond_raison} | ${avecVge.plafond_raison}`)
  // Aucune garantie ne lève un gage.
  affirme('Le conditionnel de garantie ne lève jamais une opposition',
    (avecOpposition.verdict_conditionnel?.score ?? 0) <= 30)
}
{
  affirme('BAREME_VERSION passée à 11.3', BAREME_VERSION === '11.3', BAREME_VERSION)
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

// Un compteur photographié qui contredit le kilométrage annoncé est une preuve
// matérielle de fraude : rouge à lui seul, même sur un dossier par ailleurs sain.
{
  const sain = calculerAxes({ ...base, statut_vendeur: 'pro', annee: 2021, kilometrage: 60000,
    entretien_renseigne: true, signaux_entretien: 3 })
  const fraude = calculerAxes({ ...base, statut_vendeur: 'pro', annee: 2021, kilometrage: 60000,
    entretien_renseigne: true, signaux_entretien: 3, incoherences: 1,
    fraude_suspectee: true, compteur_contredit: true })
  const ok = sain.verdict === 'vert' && fraude.verdict === 'rouge' && fraude.score <= 35 &&
    /compteur/i.test(fraude.plafond_raison ?? '')
  if (!ok) ko++
  console.log(`${ok ? 'PASS' : 'FAIL'} — compteur contredit : ${sain.verdict} ${sain.score} → ${fraude.verdict} ${fraude.score} (${fraude.plafond_raison ?? 'sans raison'})`)
}

// Horizon de détention : une panne d'usure compte dans la note si son
// kilométrage typique tombe avant km actuel + 60 000 km ; au-delà elle est
// affichée avec la mention « au-delà d'une détention moyenne » et ne compte pas.
{
  const cas = [
    ['40 000 km, usure à 100 000 km → compte', 40000, 'dès 100 000 km', true],
    ['36 606 km, usure à 160 000 km → ne compte pas', 36606, 'dès environ 160 000 km', false],
    ['150 000 km, usure à 160 000 km → compte', 150000, 'dès environ 160 000 km', true],
    ['seuil non publié → compte toujours', 40000, null, true],
    ['kilométrage inconnu → compte toujours', null, '120 000 - 180 000 km', true],
  ]
  for (const [titre, km, kmTypique, attendu] of cas) {
    const ok = panneDansHorizon(km, seuilKmPanne(kmTypique)) === attendu
    if (!ok) ko++
    console.log(`${ok ? 'PASS' : 'FAIL'} — horizon : ${titre}`)
  }
}

console.log('\nAXE PRIX — RELEVÉ DE MARCHÉ (sprint 9)')
{
  const prix = (faits) => calculerAxes({ ...base, ...faits }).axes.prix
  const f = { p25: 13_000, mediane: 14_500, p75: 16_000 }

  const sansRien = prix({ fourchette: null, prix_affiche: 15_000 })
  verifiePrix('sans fourchette → non évalué, exclu du score',
    sansRien.note === null && /Non évalué/.test(sansRien.commentaire))
  const sansPrix = prix({ fourchette: f, prix_affiche: null, fourchette_n: 40 })
  verifiePrix('sans prix affiché → non évalué', sansPrix.note === null)

  const basse = prix({ fourchette: f, prix_affiche: 12_000, fourchette_n: 40 })
  verifiePrix('sous le P25 → quart le moins cher, meilleure note',
    basse.note === 18 && basse.commentaire.includes('dans le quart le moins cher'), basse.commentaire)
  const moyenne = prix({ fourchette: f, prix_affiche: 15_000, fourchette_n: 40 })
  verifiePrix('entre médiane et P75 → dans la moyenne',
    moyenne.note === 11 && moyenne.commentaire.includes('dans la moyenne'), moyenne.commentaire)
  const haute = prix({ fourchette: f, prix_affiche: 17_000, fourchette_n: 40 })
  verifiePrix('au-dessus du P75 → plus chère que 75 %',
    haute.note === 7 && haute.commentaire.includes('plus chère que 75 %'), haute.commentaire)

  verifiePrix('effectif du relevé affiché', ns(moyenne.commentaire).includes('sur 40 annonces relevées'))
  verifiePrix('mention « prix demandés, pas prix de vente » systématique',
    moyenne.commentaire.includes('Prix demandés, pas prix de vente'))
  verifiePrix('bornes AFFICHÉES = prix observés',
    ns(moyenne.commentaire).includes('P25 13 000 €') && ns(moyenne.commentaire).includes('P75 16 000 €'))

  // Correction kilométrique : elle déplace les bornes de NOTATION, pas celles
  // qui sont affichées. Un véhicule plus roulé que le segment voit la
  // référence baisser, donc son prix remonter dans le classement.
  const corrige = prix({ fourchette: f, prix_affiche: 15_000, fourchette_n: 40, fourchette_decalage_km: -2_000 })
  verifiePrix('référence corrigée vers le bas → le prix devient « plus cher »',
    corrige.note === 7 && corrige.commentaire.includes('plus chère que 75 %'), corrige.commentaire)
  verifiePrix('la correction est annoncée en clair',
    ns(corrige.commentaire).includes('référence corrigée de -2 000 € pour le kilométrage'), corrige.commentaire)
  verifiePrix('les bornes observées restent affichées malgré la correction',
    ns(corrige.commentaire).includes('médiane 14 500 €'), corrige.commentaire)
  const sansCorrection = prix({ fourchette: f, prix_affiche: 15_000, fourchette_n: 40, fourchette_decalage_km: 0 })
  verifiePrix('décalage nul → aucune mention de correction',
    !sansCorrection.commentaire.includes('corrigée'), sansCorrection.commentaire)

  // L'axe prix entre bien dans le score : la même annonce notée avec et sans
  // fourchette ne peut pas donner le même total.
  const faitsCommuns = { annee: 2019, kilometrage: 90_000, entretien_renseigne: true,
    signaux_entretien: 2, pannes: [panne('majeure')] }
  const avec = calculerAxes({ ...base, ...faitsCommuns, fourchette: f, prix_affiche: 12_000, fourchette_n: 40 })
  const sans = calculerAxes({ ...base, ...faitsCommuns, fourchette: null, prix_affiche: 12_000 })
  verifiePrix('le critère prix SORT du « non évalué » et pèse sur le score',
    avec.axes.prix.note === 18 && sans.axes.prix.note === null && avec.score !== sans.score,
    `avec=${avec.score} sans=${sans.score}`)
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
