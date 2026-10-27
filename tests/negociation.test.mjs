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
