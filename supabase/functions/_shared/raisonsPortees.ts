// SPRINT 24 (audit de cohérence, 13 nov. 2026) — Une panne non confirmée par
// une source indépendante est une QUESTION au vendeur, jamais une raison du
// verdict ni un poste du budget.
//
// Constat sur les dossiers de référence du jour : la règle était appliquée au
// SCORE et à la liste des pannes, mais le modèle d'analyse voyait encore ces
// pannes sans distinction dans le catalogue, et deux raisons principales les
// affirmaient (Mercedes : « des défaillances d'injecteurs ont été
// rapportées » ; 308 : « risque de surconsommation d'huile »), ainsi qu'un
// poste du budget à 12 mois (308, 200-300 €).
//
// Module PUR (tests/raisons-portees.test.mjs).
import { memeDefaut } from "./dedupPannes.ts";

export type EntreeCatalogue = { ref: string; titre: string };

/** La raison (texte BRUT du modèle, références comprises) affirme-t-elle une
 *  panne non confirmée ? Oui si elle cite sa référence, ou si elle décrit le
 *  même défaut (≥ 2 mots spécifiques communs) sans décrire aussi une panne
 *  confirmée. */
export function affirmePanneNonConfirmee(
  raisonBrute: string,
  nonConfirmees: readonly EntreeCatalogue[],
  confirmees: readonly EntreeCatalogue[],
): boolean {
  const t = String(raisonBrute ?? "");
  for (const e of nonConfirmees) {
    const ref = String(e.ref ?? "").trim();
    if (ref && new RegExp(`(^|[^A-Za-z0-9])${ref.replace(/[^A-Za-z0-9]/g, "")}(?![0-9])`).test(t)) return true;
  }
  const decritNonConfirmee = nonConfirmees.some((e) => memeDefaut(t, e.titre));
  if (!decritNonConfirmee) return false;
  return !confirmees.some((e) => memeDefaut(t, e.titre));
}

export const CONSIGNE_NON_CONFIRMEE =
  "non confirmée par une source indépendante : ne la cite JAMAIS dans raisons_principales ni dans budget_12_mois ; " +
  "tu peux seulement en faire une question au vendeur ou un contrôle sur place, sans l'affirmer.";
