// Test hors ligne de la marge de négociation (aucun appel API).
// Vérifie : un poste n'est chiffré que si son coût est sourcé ; le total
// n'apparaît qu'à partir de 2 postes chiffrés ; priorité devis validé >
// fourchette sourcée > coût de fiche ; échéances < 15 000 km / 12 mois ;
// déterminisme.
// Usage : node tests/negociation.test.mjs
import {
  calculerNegociation,
  chercherCout,
  coutsApplicables,
  MENTION_NEGOCIATION,
} from '../supabase/functions/_shared/negociation.ts'
import { montantPresent } from '../supabase/functions/_shared/defectSheets.ts'
import { nettoyerCitationVendeur } from '../supabase/functions/_shared/negociation.ts'

let ko = 0
const verifie = (titre, ok, detail = '') => {
  if (!ok) ko++
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${titre}${ok || !detail ? '' : ` (${detail})`}`)
}

const base = {
  famille_moteur: 'EB2DT',
  boite_code: null,
  kilometrage: 85000,
  age_ans: 8,
  constats_photo: [],
  ct_defauts: [],
  defauts_annonce: [],
  entretien_du_non_prouve: [],
  operations_non_faites: [],
  plan_entretien: [],
  couts: [],
}

const coutEmbrayage = {
  operation: 'Remplacement embrayage (kit)',
  cout_min_eur: 600, cout_max_eur: 1200,
  urls: ['https://exemple.fr/embrayage'], statut: 'source', famille_norm: '',
}
const coutFreins = {
  operation: 'Plaquettes de frein avant',
  cout_min_eur: 80, cout_max_eur: 200,
  urls: ['https://exemple.fr/freins'], statut: 'source', famille_norm: '',
}

// ---------- Chiffrage et total ----------
{
  const r = calculerNegociation(base)
  verifie('aucun poste → pas de total ni d\'argumentaire',
    r.total_min_eur === null && r.postes.length === 0 && r.argumentaire === null)
  verifie('mention réglementaire présente', r.mention === MENTION_NEGOCIATION)
}
{
  const r = calculerNegociation({
    ...base,
    defauts_annonce: [{ description: 'embrayage fatigué, à prévoir', organe: 'embrayage' }],
    couts: [coutEmbrayage],
  })
  verifie('1 poste chiffré → poste affiché mais PAS de total (règle ≥ 2)',
    r.postes.length === 1 && r.postes[0].cout_max_eur === 1200 && r.total_min_eur === null)
}
{
  const r = calculerNegociation({
    ...base,
    defauts_annonce: [{ description: 'embrayage fatigué, à prévoir', organe: 'embrayage' }],
    constats_photo: [{ organe: 'pneus', constat: 'Plaquettes et disques avant très usés', signal: 'attention' }],
    couts: [coutEmbrayage, coutFreins],
  })
  verifie('2 postes chiffrés → total en fourchette (somme)',
    r.total_min_eur === 680 && r.total_max_eur === 1400,
    `total ${r.total_min_eur}-${r.total_max_eur}`)
  const argPlat = String(r.argumentaire ?? '').replace(/[\s  ]/g, '')
  verifie('argumentaire composé avec le total',
    argPlat.includes('680') && argPlat.includes('1400'))
}
{
  const r = calculerNegociation({
    ...base,
    defauts_annonce: [{ description: 'rayure profonde sur l\'aile arrière', organe: 'carrosserie' }],
    couts: [coutEmbrayage],
  })
  verifie('défaut sans coût sourcé → argument SANS montant, jamais chiffré',
    r.postes.length === 0 && r.arguments_sans_montant.length === 1 &&
    r.arguments_sans_montant[0].cout_min_eur === null)
}

// ---------- Priorité des sources ----------
{
  const devis = { ...coutEmbrayage, statut: 'valide_devis', cout_min_eur: 900, cout_max_eur: 950 }
  const fiche = { ...coutEmbrayage, statut: 'fiche', cout_min_eur: 100, cout_max_eur: 200 }
  const trouve = chercherCout('embrayage à prévoir', [fiche, coutEmbrayage, devis])
  verifie('devis validé prioritaire sur fourchette sourcée et fiche',
    trouve?.statut === 'valide_devis' && trouve.cout_min_eur === 900)
}
{
  const trouve = chercherCout('vanne de climatisation HS', [coutEmbrayage, coutFreins])
  verifie('aucun recoupement d\'organe → aucun coût (pas de montant forcé)', trouve === null)
}

// ---------- Filtre famille / boîte ----------
{
  const rows = [
    { ...coutEmbrayage, famille_norm: '' },
    { ...coutEmbrayage, operation: 'Courroie EB2', famille_norm: 'EB2' },
    { ...coutEmbrayage, operation: 'Mécatronique DQ200', famille_norm: 'DQ200' },
    { ...coutEmbrayage, operation: 'Chaîne N47', famille_norm: 'N47' },
  ]
  const applicables = coutsApplicables(rows, 'EB2DT', 'DQ200')
  verifie('famille compatible par préfixe + boîte + génériques, familles étrangères exclues',
    applicables.length === 3 && !applicables.some((r) => r.famille_norm === 'N47'))
}

// ---------- Entretien dû non prouvé + échéances ----------
{
  const r = calculerNegociation({
    ...base,
    entretien_du_non_prouve: [
      { operation: 'Courroie de distribution', cout_min_eur: 400, cout_max_eur: 700, critique: true },
    ],
    plan_entretien: [
      // Vidange tous les 30 000 km : à 85 000 km, prochaine à 90 000 → sous 15 000 km.
      { operation: 'Vidange moteur', intervalle_km: 30000, intervalle_annees: null, cout_min_eur: 90, cout_max_eur: 180, a_verifier_carnet: false },
      // Bougies tous les 120 000 km : prochaine à 120 000 → 35 000 km, trop loin.
      { operation: 'Bougies d\'allumage', intervalle_km: 120000, intervalle_annees: null, cout_min_eur: 60, cout_max_eur: 120, a_verifier_carnet: false },
      // Intervalle non sourcé : jamais un poste.
      { operation: 'Liquide de frein', intervalle_km: null, intervalle_annees: null, cout_min_eur: null, cout_max_eur: null, a_verifier_carnet: true },
    ],
  })
  const types = r.postes.map((p) => p.type).sort()
  verifie('entretien dû non prouvé + échéance < 15 000 km chiffrés ; échéance lointaine et intervalle non sourcé exclus',
    r.postes.length === 2 && types.join(',') === 'echeance_proche,entretien_non_prouve',
    JSON.stringify(types))
  verifie('total = somme des deux postes', r.total_min_eur === 490 && r.total_max_eur === 880,
    `${r.total_min_eur}-${r.total_max_eur}`)
}

// ---------- Opération déclarée non faite par l'annonce ----------
{
  const coutCourroie = {
    operation: 'Remplacement kit de courroie de distribution (pièces + main d\'œuvre)',
    cout_min_eur: 600, cout_max_eur: 800,
    urls: ['https://exemple.fr/courroie'], statut: 'source', famille_norm: '',
  }
  const r = calculerNegociation({
    ...base,
    operations_non_faites: ['Distribution jamais faite'],
    couts: [coutCourroie],
  })
  verifie('« distribution jamais faite » → poste chiffré via la fourchette sourcée',
    r.postes.length === 1 && r.postes[0].cout_min_eur === 600 && r.postes[0].type === 'entretien_non_prouve',
    JSON.stringify(r.postes[0] ?? null))
}

// ---------- Déduplication inter-canaux ----------
{
  const coutCourroie = {
    operation: 'Remplacement kit de courroie de distribution',
    cout_min_eur: 600, cout_max_eur: 800,
    urls: ['https://exemple.fr/courroie'], statut: 'source', famille_norm: '',
  }
  const r = calculerNegociation({
    ...base,
    defauts_annonce: [{ description: 'Distribution jamais faite', organe: 'distribution' }],
    operations_non_faites: ['Distribution (courroie) jamais remplacée'],
    couts: [coutCourroie],
  })
  verifie('même fait par deux canaux (défaut admis + op. non faite) → UN seul poste',
    r.postes.length + r.arguments_sans_montant.length === 1,
    `${r.postes.length} chiffrés + ${r.arguments_sans_montant.length} sans montant`)
}

// ---------- Compteur jamais en argument de remise ----------
{
  const r = calculerNegociation({
    ...base,
    constats_photo: [
      { organe: 'compteur', constat: 'Compteur à 188 452 km', signal: 'rouge' },
      { organe: 'carrosserie', constat: 'Enfoncement sur la portière droite', signal: 'rouge' },
    ],
  })
  verifie('constat compteur exclu des postes (signal de fuite, pas de remise)',
    r.postes.length + r.arguments_sans_montant.length === 1 &&
    r.arguments_sans_montant[0]?.poste.includes('portière'))
}

// ---------- Vérification littérale des montants (harvest repair_costs) ----------
{
  const page = "Le remplacement coûte entre 1 500 et 2 500 € ; certains devis montent à 6.000 euros, jamais 1800."
  verifie('montant avec espace fine (« 1 500 ») reconnu', montantPresent(page, 1500) === true)
  verifie('montant avec point (« 6.000 ») reconnu', montantPresent(page, 6000) === true)
  verifie('800 absent (1800 ne compte pas : frontière de chiffres)', montantPresent(page, 800) === false)
  verifie('montant jamais cité → rejeté', montantPresent(page, 4200) === false)
}

// ---------- Texte vendeur jamais recopié tel quel (sprint 3.1) ----------
{
  const sale = nettoyerCitationVendeur(
    'Embrayage à prévoir, super affaire voir https://arnaque.example/paiement ou appelez le 06 12 34 56 78 vite')
  verifie('liens et numéros de téléphone retirés des défauts admis',
    !/https?|arnaque|06 12/.test(sale) && sale.includes('Embrayage'), sale)
  const km = nettoyerCitationVendeur('courroie jamais remplacée à 84 500 km, prix 9 400 €')
  verifie('kilométrages et prix (≤ 6 chiffres) conservés',
    km.includes('84 500 km') && km.includes('9 400 €'), km)
  const long = nettoyerCitationVendeur(
    'un deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze quinze seize dix-sept')
  verifie('extrait plafonné à 15 mots avec ellipse',
    long.endsWith('…') && long.split(/\s+/).length === 15, long)
}

// ---------- Écart au prix médian du marché (sprint 9) ----------
{
  // Espace fine insécable des milliers (U+202F) ramenée à une espace simple.
  const ns = (t) => String(t).replace(/[\u202f\u00a0\u2009\u2007]/g, ' ')
  const marche = { ecart_eur: 1_400, mediane: 13_600, n: 42, date: '02/11', ajuste_km: true }
  const seul = calculerNegociation({ ...base, prix_marche: marche })
  const poste = seul.postes.find((p) => p.type === 'prix_marche')
  verifie('un poste « prix de marché » est créé quand l’annonce est au-dessus', !!poste)
  verifie('le poste porte l’écart au P50 comme montant',
    poste && poste.cout_min_eur === 1_400 && poste.cout_max_eur === 1_400)
  verifie('sa source est le relevé de marché, pas un tarif de garage',
    poste && poste.source_statut === 'marche')
  verifie('l’argument cite l’effectif et la date du relevé',
    poste && ns(poste.argument).includes('42 annonces') && poste.argument.includes('02/11'), poste?.argument)
  verifie('l’argument rappelle « prix demandés, pas prix de vente »',
    poste && /prix demandés/.test(poste.argument) && /pas des prix de vente/.test(poste.argument))
  verifie('l’argument signale la comparaison à kilométrage comparable',
    poste && poste.argument.includes('à kilométrage comparable'))
  verifie('un seul poste chiffré → toujours pas de total (règle des 2 postes)',
    seul.total_min_eur === null, String(seul.total_min_eur))

  const sansEcart = calculerNegociation({ ...base, prix_marche: { ...marche, ecart_eur: 0 } })
  verifie('annonce au niveau ou sous la médiane → aucun poste de marché',
    !sansEcart.postes.some((p) => p.type === 'prix_marche'))
  const absent = calculerNegociation({ ...base, prix_marche: null })
  verifie('pas de fourchette → aucun poste de marché',
    !absent.postes.some((p) => p.type === 'prix_marche'))

  // SPRINT 20 — la SOURCE de la médiane est dite, parce que l'argument
  // s'adresse à un vendeur : « vos 7 annonces » se vérifie en trois clics,
  // « notre relevé » demande de nous croire.
  const recherche = calculerNegociation({
    ...base,
    prix_marche: { ecart_eur: 900, mediane: 9_600, n: 7, date: '05/11', ajuste_km: false, source: 'recherche' },
  }).postes.find((p) => p.type === 'prix_marche')
  verifie('source « recherche » : l’argument dit « de votre recherche »',
    recherche && /de votre recherche/.test(recherche.argument), recherche?.argument)
  verifie('source « relevé » : l’argument ne s’attribue PAS la recherche de l’utilisateur',
    poste && !/de votre recherche/.test(poste.argument), poste?.argument)
  verifie('sans source déclarée, aucune attribution inventée',
    !/de votre recherche/.test(
      calculerNegociation({ ...base, prix_marche: { ...marche, source: undefined } })
        .postes.find((p) => p.type === 'prix_marche').argument,
    ))

  // Avec un second poste chiffré, l'écart au marché entre dans le total.
  const avecReparation = calculerNegociation({
    ...base,
    prix_marche: marche,
    defauts_annonce: [{ description: 'embrayage fatigué', organe: 'embrayage' }],
    couts: [coutEmbrayage],
  })
  verifie('l’écart au marché s’additionne aux réparations sourcées',
    avecReparation.total_min_eur !== null &&
    avecReparation.total_min_eur >= 1_400 + (coutEmbrayage.cout_min_eur ?? 0),
    `total ${avecReparation.total_min_eur}-${avecReparation.total_max_eur}`)
  verifie('l’argumentaire n’ajoute pas de parenthèse de tarif au poste de marché',
    ns(avecReparation.argumentaire).includes('médiane de 13 600 €') &&
    !/médiane de 13 600 €.*selon les/.test(ns(avecReparation.argumentaire)))
  const ordre = avecReparation.postes.map((p) => p.type)
  verifie('les postes restent triés par montant décroissant',
    JSON.stringify(ordre) === JSON.stringify([...avecReparation.postes]
      .sort((a, b) => (b.cout_max_eur ?? 0) - (a.cout_max_eur ?? 0)).map((p) => p.type)))
}

// ---------- Déterminisme ----------
{
  const entree = {
    ...base,
    defauts_annonce: [{ description: 'embrayage fatigué', organe: 'embrayage' }],
    constats_photo: [{ organe: 'pneus', constat: 'Pneus avant lisses', signal: 'attention' }],
    couts: [coutEmbrayage, coutFreins],
  }
  const resultats = new Set()
  for (let i = 0; i < 50; i++) resultats.add(JSON.stringify(calculerNegociation({ ...entree })))
  verifie('50 appels identiques → 1 résultat', resultats.size === 1)
}

console.log(ko === 0 ? '\n✓ négociation conforme' : `\n✗ ${ko} écart(s)`)
process.exit(ko === 0 ? 0 : 1)
