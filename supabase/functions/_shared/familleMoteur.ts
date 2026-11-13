// SPRINT 20.1 — RENDRE L'IDENTIFICATION DU MOTEUR DÉTERMINISTE.
//
// ⚠️ LE DÉFAUT MESURÉ EN PRODUCTION LE 5 NOVEMBRE 2026. Quatre analyses du
// MÊME texte (Mercedes Classe C 220 d de 2025) : trois fois `code_famille =
// "OM654"`, une fois `null`. Sans famille, pas de fiche, pas de catalogue,
// donc axe `risques_mecaniques` exclu du score — et comme il pèse ×2, le
// verdict MONTAIT de 71 à 75. Le même texte donnait deux verdicts.
//
// La cause : le code famille est DÉDUIT par le modèle, à partir d'exemples qui
// ne citent pas l'OM654 (ils citent l'OM651, son prédécesseur), et RIEN côté
// serveur ne complétait sa réponse quand il n'en donnait pas.
//
// ⚠️ CE MODULE NE SECOND-DEVINE JAMAIS LE MODÈLE. Il ne fait que COMPLÉTER
// une réponse manquante, à partir de la table des 48 familles. Un code que le
// modèle propose et que la table connaît pour cette marque est conservé tel
// quel : le modèle fait un vrai travail d'appariement (leçon du sprint 13, où
// un filet trop zélé avait attribué à une Mercedes de 2025 des défauts
// d'OM651, de V6 essence et de caisses W203) et on ne le remplace pas.
//
// Module PUR. Testé hors ligne (tests/famille-moteur.test.mjs).

import { expandBrand } from "./brandAliases.ts";
import TABLE from "./famillesMoteur.json" with { type: "json" };

export type FamilleTable = {
  marque: string;
  famille: string;
  nom_commercial: string;
  /** Codes complets déclarés, ramenés à `famille` (sprint 24). */
  codes?: string[];
  modeles: string[];
  debut: number;
  /** Dernière année ATTESTÉE par la source, pas une fin de production. */
  derniere_attestee: number;
};

export const FAMILLES: FamilleTable[] = (TABLE as { familles: FamilleTable[] }).familles;

const norm = (s: unknown): string =>
  String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();

/** Jetons de GÉNÉRATION ou de caisse : « IV », « W205 », « C7 », « phase 2 ».
 *  Ils affinent un appariement, ils ne le conditionnent jamais — une annonce
 *  qui dit « Classe C » sans la caisse doit rester appariable. */
const EST_GENERATION = (j: string): boolean =>
  /^(?:i{1,3}|iv|v|vi{1,3}|ix|x|xi{1,2})$/.test(j) ||
  /^(?:mk)?\d{1,2}$/.test(j) ||
  /^[a-z]\d{2,3}$/.test(j) ||
  /^(?:w|c|x|d|h|b|f|e|g)\d{2,3}$/.test(j) ||
  j === "phase" || j === "generation" || j === "gen";

/** Les jetons d'un libellé de modèle, hors marque et hors génération. */
function jetonsModele(libelle: string, marque: string): string[] {
  const jetonsMarque = new Set(norm(marque).split(" ").filter(Boolean));
  return norm(libelle).split(" ")
    .filter((j) => j && !jetonsMarque.has(j) && !EST_GENERATION(j));
}

/** L'entrée de table décrit-elle le modèle annoncé ?
 *
 *  Règle : TOUS les jetons significatifs d'un des libellés de l'entrée doivent
 *  se retrouver dans le modèle annoncé. « Classe C » apparie « Classe C 220 d »
 *  et « Classe C W205 » ; il n'apparie pas « Classe E ». Un libellé comme
 *  « Clio III/IV » est éclaté sur la barre oblique. */
export function modeleApparie(entree: FamilleTable, modeleAnnonce: unknown): boolean {
  const cible = new Set(norm(modeleAnnonce).split(" ").filter(Boolean));
  if (cible.size === 0) return false;
  for (const libelle of entree.modeles ?? []) {
    for (const variante of String(libelle).split("/")) {
      const jetons = jetonsModele(variante, entree.marque);
      if (jetons.length === 0) continue;
      if (jetons.every((j) => cible.has(j))) return true;
    }
  }
  return false;
}

/** Le carburant qu'un nom commercial désigne, ou "" s'il ne le dit pas. */
export function carburantDuNom(nomCommercial: unknown): "diesel" | "essence" | "" {
  const n = norm(nomCommercial);
  if (/\b(diesel|cdi|hdi|dci|tdi|bluehdi|multijet|crdi|jtd|d4d|cdti|tdci)\b/.test(n)) return "diesel";
  if (/\b(essence|tfsi|tsi|thp|puretech|ecoboost|mpi|vti|tce|sce|firefly|twinair|gdi|t gdi|vvt|hybrid)\b/.test(n)) return "essence";
  return "";
}

/** Le carburant que l'annonce désigne, ou "" si elle ne le dit pas. */
export function carburantAnnonce(motorisation: unknown, carburant: unknown): "diesel" | "essence" | "" {
  const direct = norm(carburant);
  if (/diesel|gazole/.test(direct)) return "diesel";
  if (/essence|hybride|gpl|ethanol/.test(direct)) return "essence";
  return carburantDuNom(motorisation);
}

/** La cylindrée écrite dans un libellé (« 2.0 », « 1.5 »), ou "". */
export function cylindree(texte: unknown): string {
  const m = String(texte ?? "").match(/\b([0-9])[.,]([0-9])\b/);
  return m ? `${m[1]}.${m[2]}` : "";
}

export type Resolution = {
  famille: string | null;
  origine: "modele" | "table" | "table_apres_derniere_attestee" | "aucune";
  /** Pourquoi, en une phrase, pour les journaux d'exploitation. */
  motif: string;
  /** Candidats restants quand la table n'a pas pu trancher. */
  candidats: string[];
};

export type EntreeResolution = {
  marque: unknown;
  modele: unknown;
  motorisation: unknown;
  carburant: unknown;
  annee: unknown;
  /** Ce que le modèle a proposé ("" ou null s'il n'a rien donné). */
  propose: unknown;
};

/** La famille moteur, de façon REPRODUCTIBLE.
 *
 *  1. Le modèle a proposé un code que la table connaît pour cette marque ?
 *     on le garde. C'est le cas courant, et le modèle apparie mieux que nous.
 *  2. Sinon, la table tranche — mais seulement si elle ne laisse QU'UN
 *     candidat. Deux candidats possibles : on ne choisit pas.
 *  3. Sinon on garde ce que le modèle a dit, même inconnu de la table (elle ne
 *     couvre que 48 familles), et à défaut : null, assumé.
 */
export function resoudreFamille(e: EntreeResolution, familles: FamilleTable[] = FAMILLES): Resolution {
  const marques = new Set(expandBrand(String(e.marque ?? "")).map((m) => norm(m)));
  const propose = String(e.propose ?? "").trim().toUpperCase();
  const deLaMarque = familles.filter((f) => marques.has(norm(f.marque)));

  // 1. Proposition du modèle, connue de la table pour cette marque : gardée.
  if (propose && deLaMarque.some((f) => f.famille.toUpperCase() === propose)) {
    return { famille: propose, origine: "modele", motif: "code proposé et attesté pour cette marque", candidats: [] };
  }
  // 1 bis. Code complet DÉCLARÉ par une entrée (« 1AD-FTV » → « AD ») : la
  // fiche est rangée sous la famille, pas sous chacun de ses codes. Accepte
  // aussi le début d'un code déclaré (« 2AD »), jamais moins de 3 caractères.
  const cle = (x: string) => x.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const p = cle(propose);
  if (p.length >= 3) {
    const declaree = deLaMarque.find((f) => (f.codes ?? []).some((c) => cle(c) === p || cle(c).startsWith(p)));
    if (declaree) {
      return { famille: declaree.famille, origine: "modele", motif: `code proposé (${propose}) déclaré pour la famille ${declaree.famille}`, candidats: [] };
    }
  }

  // 2. La table tranche-t-elle ?
  const annee = typeof e.annee === "number" && Number.isFinite(e.annee) ? e.annee : null;
  const carb = carburantAnnonce(e.motorisation, e.carburant);
  const cyl = cylindree(e.motorisation);

  let candidats = deLaMarque.filter((f) => modeleApparie(f, e.modele));
  if (candidats.length > 1 && carb) {
    const parCarburant = candidats.filter((f) => {
      const c = carburantDuNom(f.nom_commercial);
      return c === "" || c === carb;
    });
    if (parCarburant.length > 0) candidats = parCarburant;
  }
  if (candidats.length > 1 && cyl) {
    const parCylindree = candidats.filter((f) => cylindree(f.nom_commercial) === cyl);
    if (parCylindree.length === 1) candidats = parCylindree;
  }

  const noms = () => candidats.map((f) => f.famille);

  if (annee != null && candidats.length > 1) {
    const dansLaPlage = candidats.filter((f) => annee >= f.debut && annee <= f.derniere_attestee);
    if (dansLaPlage.length === 1) {
      return { famille: dansLaPlage[0].famille, origine: "table", motif: "seule famille de ce modèle couvrant cette année", candidats: noms() };
    }
    // ⚠️ AU-DELÀ DE LA DERNIÈRE ANNÉE ATTESTÉE. La table a été dressée au
    // sprint 6 : beaucoup d'entrées s'arrêtent à 2022 parce que c'est la date
    // du relevé, pas une fin de production. Un véhicule plus récent que TOUTES
    // les plages se voit donc attribuer la famille la plus récente du modèle —
    // faute de successeur connu. C'est une règle, pas une date inventée, et
    // elle ne s'applique JAMAIS avant la première année attestée.
    const toutesDepassees = candidats.every((f) => annee > f.derniere_attestee);
    if (toutesDepassees) {
      const plusRecente = [...candidats].sort((a, b) => b.debut - a.debut);
      if (plusRecente.length > 0 && (plusRecente.length === 1 || plusRecente[0].debut > plusRecente[1].debut)) {
        return {
          famille: plusRecente[0].famille,
          origine: "table_apres_derniere_attestee",
          motif: `aucune plage ne couvre ${annee} : famille la plus récente de ce modèle retenue, faute de successeur attesté`,
          candidats: noms(),
        };
      }
    }
  }

  if (candidats.length === 1) {
    const f = candidats[0];
    if (annee == null || annee >= f.debut) {
      return { famille: f.famille, origine: "table", motif: "seule famille de ce modèle dans la table", candidats: noms() };
    }
  }

  // 3. Rien de tranché : la proposition du modèle, ou rien.
  if (propose) {
    return { famille: propose, origine: "modele", motif: "code proposé, hors table (48 familles seulement)", candidats: noms() };
  }
  return {
    famille: null,
    origine: "aucune",
    motif: candidats.length > 1
      ? `${candidats.length} familles possibles pour ce modèle, aucune ne tranche`
      : "aucune famille connue pour ce modèle",
    candidats: noms(),
  };
}
