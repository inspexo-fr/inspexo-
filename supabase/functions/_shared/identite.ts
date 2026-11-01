// Identité légale de l'éditeur, côté serveur (emails transactionnels).
// COPIE EXACTE de src/data/identite.js — une edge function Deno ne peut pas
// importer le bundle React. Les deux fichiers sont comparés champ par champ
// par tests/identite.test.mjs (chaîné dans `npm run eval`) : une divergence
// fait échouer l'éval avant le déploiement.
//
// Valeurs confirmées par Utku le 1er novembre 2026 (SIREN et SIRET du siège).
export const IDENTITE = {
  raison_sociale: "DUPLEX SAS",
  forme_juridique: "Société par actions simplifiée",
  capital: "30 000,00 €",
  adresse: "17 rue Pierre Deldi, 31100 Toulouse, France",
  ville: "Toulouse",
  siren: "941 962 060",
  siret: "941 962 060 00013",
  rcs: "RCS Toulouse 941 962 060",
  tva: "FR33941962060",
  president: "Boy Utku",
  email: "contact@inspexo.io",
  site: "https://inspexo.io",
  nom_commercial: "Inspexo",
};

/** Pied d'un email de VENTE : le vendeur doit être identifiable sur le
 *  document de la transaction, pas seulement sur le site. */
export function piedIdentiteVendeur(): string {
  return `<p style="color:#6B7280;font-size:11px;line-height:1.6">
   ${IDENTITE.raison_sociale} — ${IDENTITE.forme_juridique} au capital de ${IDENTITE.capital}<br>
   ${IDENTITE.adresse} — SIREN ${IDENTITE.siren} — ${IDENTITE.rcs} — TVA ${IDENTITE.tva}<br>
   ${IDENTITE.email} — ${IDENTITE.site} (nom commercial ${IDENTITE.nom_commercial})</p>`;
}
