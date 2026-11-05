// SPRINT 21 — PRIX PAYÉS DÉCLARÉS : lecture du relevé, SÉPARÉE des prix demandés.
//
// Tout ce que le projet publie depuis le sprint 9 porte sur des PRIX DEMANDÉS,
// et le libellé le dit chaque fois : « les prix de vente réels sont souvent
// inférieurs ». Les retours d'issue apportent l'autre chiffre — ce que
// l'acheteur a réellement payé.
//
// ⚠️ LES DEUX RELEVÉS NE SE MÉLANGENT JAMAIS. Fondre six prix payés dans une
// fourchette de prix demandés rendrait le libellé FAUX sans que rien ne le
// signale : l'effet serait invisible dans le chiffre et bien réel dans le sens.
// Deux relevés, deux lectures, deux affichages.
//
// ⚠️ ET AUCUN EFFET SUR LE SCORE. L'axe prix continue de porter sur les prix
// DEMANDÉS, parce que c'est ce qu'on peut vérifier : une annonce en ligne se
// relit, une déclaration ne se vérifie pas. `tests/prix-payes.test.mjs`
// contrôle statiquement que le barème et la négociation n'en reçoivent rien.
//
// Module PUR. Les quantiles passent par `quantileHisto` de `_shared/marche.ts` :
// il n'existe qu'UNE implémentation des quantiles dans le projet.

import { quantileHisto, TRANCHE_PRIX, type Histo } from "./marche.ts";

/** Six déclarations par segment. Miroir de `seuil_prix_payes()` côté base. */
export const SEUIL_PRIX_PAYES = 6;

/** Bornes du contrôle de cohérence, en part du prix de l'annonce. */
export const BORNE_BASSE = 0.5;
export const BORNE_HAUTE = 1.5;

/** Une déclaration est-elle exploitable ?
 *
 *  ⚠️ Miroir EXACT de `declaration_prix_acceptable()` en SQL — le contrôle qui
 *  fait foi est celui de la base, puisque c'est elle qui verse. Celui-ci sert
 *  aux tests et à l'affichage.
 *
 *  ⚠️ PRIX DE L'ANNONCE INCONNU ⇒ ÉCARTÉE. Le contrôle est défini par rapport
 *  à ce prix : sans lui il n'y a pas de contrôle, et publier une déclaration
 *  qu'on n'a pas pu vérifier serait publier sur rien. */
export function declarationAcceptable(
  prixPaye: unknown,
  prixAnnonce: unknown,
): boolean {
  const p = Number(prixPaye);
  const a = Number(prixAnnonce);
  if (!Number.isFinite(p) || p <= 0) return false;
  if (!Number.isFinite(a) || a <= 0) return false;
  return p >= a * BORNE_BASSE && p <= a * BORNE_HAUTE;
}

/** Un histogramme tel que la base le rend : { "9500": 3, "9750": 2 }. */
export type HistoJson = Record<string, number> | null | undefined;

function enHisto(j: HistoJson): { histo: Histo; total: number } {
  const histo: Histo = new Map();
  let total = 0;
  for (const [cle, valeur] of Object.entries(j ?? {})) {
    const t = Number(cle);
    const n = Number(valeur);
    if (!Number.isFinite(t) || !Number.isFinite(n) || n <= 0) continue;
    histo.set(t, (histo.get(t) ?? 0) + n);
    total += n;
  }
  return { histo, total };
}

export type FourchettePayes = {
  p25: number;
  mediane: number;
  p75: number;
  /** Nombre de VENTES déclarées, pas d'annonces. */
  n: number;
  /** Plage d'années des véhicules concernés, pour dire de quoi on parle. */
  annee_min: number | null;
  annee_max: number | null;
  libelle: string;
};

/** La fourchette des prix PAYÉS d'un segment, ou `null` sous le seuil.
 *
 *  ⚠️ Rien n'est publié sous six déclarations — pas une fourchette élargie
 *  « faute de mieux » : un prix payé calculé sur trois ventes a l'air d'un
 *  relevé et n'en est pas un. Même règle qu'au sprint 19 pour les comparables.
 *
 *  Le segment est volontairement LARGE (marque, modèle, énergie) : avec six
 *  déclarations, ajouter des dimensions reviendrait à n'en publier aucune.
 *  L'année est donc donnée comme CONTEXTE, pour que le lecteur sache que la
 *  médiane mélange plusieurs millésimes. */
export function fourchettePayes(
  ligne: { prix_histo?: HistoJson; annee_histo?: HistoJson; effectif?: number } | null | undefined,
  minimum: number = SEUIL_PRIX_PAYES,
): FourchettePayes | null {
  if (!ligne) return null;
  const { histo, total } = enHisto(ligne.prix_histo);
  // ⚠️ L'effectif qui compte est celui de l'HISTOGRAMME, pas la colonne : si
  // les deux divergeaient, la colonne pourrait annoncer six ventes sur un
  // histogramme qui n'en porte que trois.
  if (total < minimum) return null;

  const annees = Object.keys(ligne.annee_histo ?? {})
    .map(Number)
    .filter((a) => Number.isFinite(a) && a > 1950 && a < 2100);

  const n = total;
  return {
    p25: Math.round(quantileHisto(histo, total, 0.25, TRANCHE_PRIX)),
    mediane: Math.round(quantileHisto(histo, total, 0.5, TRANCHE_PRIX)),
    p75: Math.round(quantileHisto(histo, total, 0.75, TRANCHE_PRIX)),
    n,
    annee_min: annees.length ? Math.min(...annees) : null,
    annee_max: annees.length ? Math.max(...annees) : null,
    // ⚠️ LE LIBELLÉ DIT « PAYÉS » ET « DÉCLARÉS », les deux. « Payés » le
    // distingue des prix demandés ; « déclarés » rappelle que c'est l'acheteur
    // qui l'a écrit, et que nous ne l'avons pas vu payer.
    libelle: `Prix payés déclarés par ${n} acheteur${n > 1 ? "s" : ""} après l'achat — ` +
      `déclarations non vérifiées, et distinctes des prix demandés ci-dessus.`,
  };
}
