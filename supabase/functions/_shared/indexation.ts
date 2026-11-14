// SPRINT 24 — SEUIL D'INDEXATION des pages générées (/moteur, /modele).
//
// Décision d'Utku du 13 nov. 2026, contre la règle de Google sur le contenu
// produit à grande échelle : une page n'est INDEXABLE (sitemap, pas de
// noindex) que si elle apporte une valeur propre :
//
//     pannes portées + prises en charge datées propres ≥ 3,
//     dont au moins 1 panne portée.
//
// Sinon : noindex et hors sitemap, la page restant accessible.
// « Propre » : publiée en France (pas une information de contexte), datée
// (période écrite), et de la même version que la page (cylindrée, puissance).
//
// Module PUR (tests/indexation.test.mjs).
import { sourcesPortentLEntree, urlsDeLaPanne } from "./atlasSource.ts";
import { sanitizePrisesEnCharge } from "./prisesEnCharge.ts";
import { decisionVariante, varianteVehicule } from "./variantes.ts";

export const SEUIL_INDEXATION = 3;

export type FamilleMoteur = { marque: string; famille: string; nom_commercial: string; modeles?: string[] };

/** La règle elle-même, partagée par les pages moteur et modèle. */
export function estIndexable(nPortees: number, nPrisesDatees: number): boolean {
  return nPortees >= 1 && nPortees + nPrisesDatees >= SEUIL_INDEXATION;
}

/** Prises en charge datées, publiées en France, de cette version. */
export function prisesDateesPropres(brut: unknown, nomCommercial: string): number {
  const version = varianteVehicule({ motorisation: nomCommercial });
  return sanitizePrisesEnCharge(brut)
    // Masquée ou restreinte à certains modèles : pas « propre » à la page moteur.
    .filter((x) => !x.masquee && !(x.restreinte_a && x.restreinte_a.length))
    .filter((x) => x.periode !== null && x.pays.includes("FR"))
    .filter((x) => decisionVariante(x.texte, version).statut === "applicable")
    .length;
}

/** Page principale d'un code moteur présent sous plusieurs marques (VRAI
 *  doublon, ex. EA288 Audi / Volkswagen) : la première de la table. */
export function principale(fam: FamilleMoteur, familles: FamilleMoteur[]): FamilleMoteur | null {
  const code = fam.famille.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const p = familles.find((f) => f.famille.toUpperCase().replace(/[^A-Z0-9]/g, "") === code);
  return p && p.marque !== fam.marque ? p : null;
}

// deno-lint-ignore no-explicit-any
export function verdictIndexationMoteur(fam: FamilleMoteur, fiche: any, familles: FamilleMoteur[]) {
  const brutes: unknown[] = Array.isArray(fiche?.pannes) ? fiche.pannes : [];
  // Existence de la page : critère inchangé (au moins 3 pannes, chacune
  // citant une source) — une page qui existait reste accessible.
  const publiee = brutes.length >= 3 && brutes.every((p) => urlsDeLaPanne(p).length > 0);
  const version = varianteVehicule({ motorisation: fam.nom_commercial });
  const pannes = brutes.filter((p) => {
    // deno-lint-ignore no-explicit-any
    const q = p as any;
    return decisionVariante(`${q?.titre ?? ""} ${q?.symptomes ?? q?.symptome ?? ""}`, version).statut === "applicable";
  });
  const nPortees = pannes.filter((p) => sourcesPortentLEntree(urlsDeLaPanne(p))).length;
  const nPrises = prisesDateesPropres(fiche?.prises_en_charge, fam.nom_commercial);
  const sources = new Set(pannes.flatMap((p) => urlsDeLaPanne(p)));
  const p = principale(fam, familles);
  return {
    publiee,
    pannes,
    resume: {
      indexable: !p && estIndexable(nPortees, nPrises),
      n_portees: nPortees,
      n_prises_datees: nPrises,
      n_sources: sources.size,
      pannes_autre_version: brutes.length - pannes.length,
      canonique: p ? { marque: p.marque, nom_commercial: p.nom_commercial } : null,
      maj: fiche?.updated_at ?? null,
    },
  };
}

/** Pour une page modèle composée par `composerPage`. */
export function verdictIndexationModele(sections: Array<{ pannes: unknown[]; prises: Array<{ portee: string }> }>) {
  const nPortees = sections.reduce((s, x) => s + x.pannes.length, 0);
  const nPrises = sections.reduce((s, x) => s + x.prises.filter((p) => p.portee === "france").length, 0);
  return { indexable: estIndexable(nPortees, nPrises), n_portees: nPortees, n_prises_datees: nPrises };
}
