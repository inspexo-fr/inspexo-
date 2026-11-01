// Identité légale de l'éditeur — SOURCE DE VÉRITÉ UNIQUE (sprint 7).
//
// Les mentions légales, les CGU/CGV, les CGV du Pass, la politique de
// confidentialité et le pied de page lisent TOUS ces champs : plus un seul
// numéro recopié à la main. Deux pages légales qui se contredisent sur le
// SIREN d'un vendeur, ce n'est pas un détail de présentation — c'est une
// mention obligatoire fausse (art. R123-237 du Code de commerce).
//
// Le pendant serveur (emails transactionnels, Deno) vit dans
// supabase/functions/_shared/identite.ts : les deux fichiers sont tenus
// identiques par tests/identite.test.mjs, chaîné dans `npm run eval`.
//
// Valeurs confirmées par Utku le 1er novembre 2026 (SIREN et SIRET du siège).
export const IDENTITE = {
  raison_sociale: 'DUPLEX SAS',
  forme_juridique: 'Société par actions simplifiée',
  capital: '30 000,00 €',
  adresse: '17 rue Pierre Deldi, 31100 Toulouse, France',
  ville: 'Toulouse',
  siren: '941 962 060',
  siret: '941 962 060 00013',
  rcs: 'RCS Toulouse 941 962 060',
  tva: 'FR33941962060',
  president: 'Boy Utku',
  email: 'contact@inspexo.io',
  site: 'https://inspexo.io',
  nom_commercial: 'Inspexo',
}

/** Une ligne compacte : « DUPLEX SAS · SIREN 941 962 060 · Toulouse ». */
export const IDENTITE_LIGNE =
  `${IDENTITE.raison_sociale} · SIREN ${IDENTITE.siren} · ${IDENTITE.ville}`
