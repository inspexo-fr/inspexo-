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
  // ⚠️ MOTEUR NON IDENTIFIÉ — le défaut mesuré le 5 nov. 2026 en production.
  // Sur la Classe C 220 d, quand l'identification ne déduisait pas l'OM654,
  // `catalogue_vide` passait à true, l'axe risques sortait du score — et comme
  // il pèse ×2, le verdict MONTAIT de 71 à 75. Un véhicule sur lequel on ne
  // sait rien était mieux noté qu'un véhicule documenté.
  const sain = {
    annee_courante: 2026, statut_vendeur: 'particulier', annee: 2025, kilometrage: 36606,
    prix_affiche: 41490, fourchette: null, comparables_count: 0,
    entretien_renseigne: true, signaux_entretien: 2, contradictions_entretien: 0,
    operations_critiques_non_faites: 0, incoherences: 0,
  }
  // Référence : moteur identifié, deux défauts majeurs documentés.
  const documente = calculerAxes({
    ...sain, catalogue_vide: false, famille_identifiee: true,
    pannes: [{ gravite: 'majeure', rappel_officiel: false, rappel_confirme_effectue: false },
             { gravite: 'majeure', rappel_officiel: false, rappel_confirme_effectue: false }],
  })
  // Le cas fautif : AUCUNE famille identifiée.
  const inconnu = calculerAxes({ ...sain, catalogue_vide: true, famille_identifiee: false, pannes: [] })

  affirme('moteur non identifié : l’axe risques est COMPTÉ, pas exclu',
    inconnu.axes.risques_mecaniques.note === 10, JSON.stringify(inconnu.axes.risques_mecaniques))
  affirme('et son commentaire nomme la cause',
    /non identifié/i.test(inconnu.axes.risques_mecaniques.commentaire))
  affirme('le verdict est plafonné à ORANGE BAS (55)',
    inconnu.verdict === 'orange' && inconnu.score <= 55, `${inconnu.verdict} ${inconnu.score}`)
  affirme('le motif du plafond est celui demandé',
    /moteur non identifié/i.test(inconnu.plafond_raison ?? ''), inconnu.plafond_raison)
  // ⚠️ L'INVARIANT QUI COMPTE, ET IL PORTE SUR LE MÊME VÉHICULE : ne pas
  // identifier le moteur ne doit JAMAIS faire monter le score de CE véhicule.
  // C'est la forme exacte du défaut mesuré (la même Mercedes à 75 puis 71), et
  // c'est la seule formulation qui se tienne.
  //
  // ⚠️ Une lecture plus large — « jamais mieux noté qu'un AUTRE véhicule
  // documenté » — n'est PAS satisfaisable sans inventer une pénalité : un
  // moteur dont une source documente un défaut majeur vaut 9/20, donc moins
  // que la note neutre de 10. Descendre l'inconnu sous 9 reviendrait à
  // affirmer un défaut qu'on n'a pas trouvé, ce que ce projet refuse depuis le
  // sprint 2 (« l'absence d'information n'est JAMAIS pénalisée »). Le garde-fou
  // est le PLAFOND : l'inconnu ne peut pas être vert, quoi qu'il arrive.
  {
    let scoresQuiMontent = 0
    let vertsInterdits = 0
    const profils = [
      { annee: 2025, kilometrage: 36606, prix_affiche: 41490, pannes: [] },
      { annee: 2019, kilometrage: 120000, prix_affiche: 9000, pannes: [{ gravite: 'mineure', rappel_officiel: false, rappel_confirme_effectue: false }] },
      { annee: 2016, kilometrage: 84500, prix_affiche: 9400, pannes: [{ gravite: 'majeure', rappel_officiel: false, rappel_confirme_effectue: false }] },
      { annee: 2012, kilometrage: 142000, prix_affiche: 11900, pannes: [{ gravite: 'casse', rappel_officiel: false, rappel_confirme_effectue: false }] },
      { annee: 2015, kilometrage: 159000, prix_affiche: 31990, pannes: [{ gravite: 'securite', rappel_officiel: true, rappel_confirme_effectue: false }] },
      { annee: 2022, kilometrage: 40000, prix_affiche: 18000, pannes: [], fourchette: { p25: 17000, mediane: 18500, p75: 20000 }, comparables_count: 20, fourchette_n: 20 },
    ]
    for (const prof of profils) {
      const base = { ...sain, ...prof }
      const avec = calculerAxes({ ...base, catalogue_vide: prof.pannes.length === 0, famille_identifiee: true })
      // Le MÊME véhicule, moteur non identifié : plus de catalogue, donc plus
      // de pannes — c'est précisément ce que l'échec d'identification produit.
      const sans = calculerAxes({ ...base, pannes: [], catalogue_vide: true, famille_identifiee: false })
      if (sans.score > avec.score) {
        scoresQuiMontent++
        console.log(`   · limite : profil ${prof.annee}/${prof.kilometrage} km — identifié ${avec.score}, non identifié ${sans.score} (+${sans.score - avec.score})`)
      }
      if (sans.verdict === 'vert') vertsInterdits++
    }
    // ⚠️ LIMITE CONNUE, MESURÉE, ÉPINGLÉE — et ARBITRÉE le 5 nov. 2026.
    //
    // La note neutre de 10/20 ne peut pas, à elle seule, tenir la règle « un
    // véhicule sur lequel on ne sait rien n'est jamais mieux noté » : elle est
    // au-dessus de la note d'un moteur dont une source documente un défaut
    // majeur (9/20), une casse (5/20) ou un défaut de sécurité (4/20).
    //
    // Arbitrage d'Utku : BORNER PLUS BAS plutôt qu'inventer une note. Le
    // plafond est passé de 69 (orange haut) à 55 — le rang déjà retenu pour
    // « une opération d'entretien critique déclarée non faite ».
    //
    // Effet mesuré de ce choix, sur les six profils :
    //   · défaut majeur   : +2  →  l'écart est REFERMÉ (62 contre 55)
    //   · casse           : +10 →  +5  (50 contre 55)
    //   · défaut sécurité : +16 →  +11 (44 contre 55)
    // Les deux derniers subsistent : les refermer demanderait un plafond sous
    // 44, c'est-à-dire plus sévère qu'un défaut de sécurité DOCUMENTÉ — une
    // pénalité déguisée en plafond. Le projet refuse d'affirmer un défaut
    // qu'il n'a pas trouvé (règle du sprint 2).
    //
    // Garanti sans réserve : le verdict n'est JAMAIS vert, et jamais au-dessus
    // de 55. Le résidu est épinglé à 2 : s'il bouge, dans un sens ou dans
    // l'autre, ce test échoue et force une décision. On n'enfouit pas une
    // limite connue derrière un contrôle qui ne mord pas.
    affirme('aucun véhicule au moteur non identifié n’obtient un verdict vert',
      vertsInterdits === 0, `${vertsInterdits} verdict(s) vert`)
    affirme('⚠️ limite épinglée : 2 profils sur 6 où l’ignorance paie encore (casse et sécurité)',
      scoresQuiMontent === 2, `${scoresQuiMontent} profil(s) — la limite a bougé, décision requise`)
  }
  // Et une garantie ne nous apprend pas quel moteur c'est : le plafond tient
  // aussi dans le conditionnel.
  const avecGarantie = calculerAxes({
    ...sain, catalogue_vide: true, famille_identifiee: false, pannes: [],
    condition_garantie: 'garantie constructeur en cours',
  })
  affirme('le conditionnel de garantie ne lève pas ce plafond',
    (avecGarantie.verdict_conditionnel?.score ?? 0) <= 55,
    JSON.stringify(avecGarantie.verdict_conditionnel))

  // ⚠️ CONTRE-ÉPREUVE : sans le champ, RIEN ne change. Le drapeau est
  // optionnel exprès — un appelant qui ne le renseigne pas (ancien client,
  // recalcul d'un dossier produit avant ce correctif) doit obtenir exactement
  // le score d'avant.
  const absent = calculerAxes({ ...sain, catalogue_vide: true, pannes: [] })
  const ancien = calculerAxes({ ...sain, catalogue_vide: true, famille_identifiee: true, pannes: [] })
  affirme('champ absent ≡ famille identifiée : aucun score ne bouge',
    absent.score === ancien.score && absent.axes.risques_mecaniques.note === null,
    `${absent.score} contre ${ancien.score}`)
  affirme('le test MORD : avec le drapeau à false, le score diffère',
    inconnu.score !== absent.score, `${inconnu.score} contre ${absent.score}`)
  // Et le cas « famille connue, aucune donnée » garde son « non évalué » :
  // c'est une situation DIFFÉRENTE, et elle n'a pas été arbitrée.
  affirme('famille connue mais catalogue vide : toujours « non évalué »',
    ancien.axes.risques_mecaniques.note === null)
}
{
  // 11.6 — SPRINT 20.1 : un moteur non identifié vaut 10/20 et plafonne le
  // verdict en orange, au lieu de sortir du score (ce qui le faisait monter).
  // 11.5 — SPRINT 20. Les comparables de la recherche de l'utilisateur
  // alimentent l'axe prix dès 6 retenus, là où seul le relevé agrégé le
  // faisait dès 15 : un dossier dont l'axe prix était « non évalué », donc
  // exclu du score, est désormais noté. Le barème lui-même n'a pas changé,
  // mais ce qu'il reçoit oui — et les clients d'API suivent ce numéro.
  affirme('BAREME_VERSION passée à 11.7', BAREME_VERSION === '11.7', BAREME_VERSION)
}
{
  // ⚠️ L'INVARIANT DU SPRINT 20 : le barème est AVEUGLE à la source de la
  // fourchette. Il ne reçoit que des nombres — p25, médiane, p75, effectif,
  // décalage kilométrique — et doit rendre exactement le même axe qu'ils
  // viennent de six annonces vues par l'utilisateur ou de quinze relevés
  // collectifs. Sans cela, la même annonce aurait deux notes selon le chemin,
  // et il n'y aurait plus de verdict reproductible.
  const commun = {
    annee_courante: 2026, statut_vendeur: 'particulier', annee: 2018, kilometrage: 95000,
    prix_affiche: 11000, entretien_renseigne: true, signaux_entretien: 2,
    contradictions_entretien: 0, operations_critiques_non_faites: 0,
    catalogue_vide: false, pannes: [], incoherences: 0,
    fourchette: { p25: 9500, mediane: 10500, p75: 11500 }, fourchette_decalage_km: -250,
  }
  // Seul l'effectif diffère : 6 (recherche) contre 20 (relevé). L'axe prix ne
  // doit pas dépendre de l'effectif, qui ne sert qu'au LIBELLÉ.
  const recherche = calculerAxes({ ...commun, fourchette_n: 6, comparables_count: 6 })
  const releve = calculerAxes({ ...commun, fourchette_n: 20, comparables_count: 20 })
  affirme('axe prix identique quelle que soit la source de la fourchette',
    recherche.axes.prix.note === releve.axes.prix.note,
    `${recherche.axes.prix.note} contre ${releve.axes.prix.note}`)
  affirme('score identique quelle que soit la source de la fourchette',
    recherche.score === releve.score, `${recherche.score} contre ${releve.score}`)

  // Et la contre-épreuve, sans laquelle le test serait vrai pour la mauvaise
  // raison : SANS fourchette, l'axe prix sort du score, donc le score CHANGE.
  // C'est précisément l'effet que le sprint 20 produit sur les dossiers
  // accompagnés de six comparables.
  const sans = calculerAxes({ ...commun, fourchette: null, fourchette_n: 0, comparables_count: 0, fourchette_decalage_km: 0 })
  affirme('sans fourchette, l’axe prix n’est pas évalué',
    sans.axes.prix.note === null && /Non évalué/.test(sans.axes.prix.commentaire),
    JSON.stringify(sans.axes.prix))
  affirme('le message de « non évalué » nomme les DEUX chemins réels (6 ou 15), plus « collez 3 »',
    /6 annonces comparables/.test(sans.axes.prix.commentaire) && !/collez 3/.test(sans.axes.prix.commentaire),
    sans.axes.prix.commentaire)
  affirme('le test mord : le score diffère entre « avec fourchette » et « sans »',
    sans.score !== recherche.score, `${sans.score} contre ${recherche.score}`)
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
