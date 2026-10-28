// Déduplication des défauts d'un catalogue — module PUR
// (tests/dedup-pannes.test.mjs).
//
// L'atlas « base Inspexo » et la fiche famille moteur décrivent souvent le
// MÊME défaut avec d'autres mots et d'autres gravités. Tant que les deux
// variantes étaient proposées au modèle, le verdict dépendait de celle qu'il
// citait : mesuré le 28/10/2026 sur la 308, 48 ou 55 selon le tirage, pour un
// seul et même défaut de courroie en bain d'huile.
//
// On fusionne donc AVANT de présenter le catalogue. Deux règles :
//  1. Même défaut = au moins deux mots SPÉCIFIQUES en commun. Les mots
//     génériques du vocabulaire mécanique (« fuite », « huile »,
//     « défaillance », « durite ») ne prouvent rien : « fuite de carburant »
//     et « fuite de liquide de refroidissement » sont deux défauts distincts.
//  2. La plus grave gagne, et hérite de ce que l'autre avait de plus précis
//     (coût, seuil kilométrique, rappel officiel, sources).

/** Mots trop courants dans les titres de pannes pour identifier un défaut. */
export const MOTS_GENERIQUES = new Set([
  "fuite", "fuites", "huile", "defaillance", "defaillances", "defaut",
  "defauts", "durite", "durites", "moteur", "probleme", "problemes",
  "usure", "premature", "prematuree", "prematurees", "casse", "bruit",
  "bruits", "panne", "pannes", "vehicule", "systeme", "remplacement",
  "anormal", "anormale", "excessive", "excessif", "exemplaires",
  "defectueuse", "defectueux", "associes", "associees",
]);

export const RANG_GRAVITE: Record<string, number> = {
  securite: 0,
  casse: 1,
  majeure: 2,
  mineure: 3,
};

/** Termes qui nomment réellement un organe ou un mécanisme. */
export function motsSpecifiques(texte: string): Set<string> {
  return new Set(
    String(texte ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .split(/[^a-z]+/)
      .filter((w) => w.length >= 5 && !MOTS_GENERIQUES.has(w)),
  );
}

/** Deux titres désignent-ils le même défaut ? (≥ 2 termes spécifiques communs) */
export function memeDefaut(a: string, b: string): boolean {
  const ma = motsSpecifiques(a);
  const mb = motsSpecifiques(b);
  let communs = 0;
  for (const m of ma) if (mb.has(m)) communs += 1;
  return communs >= 2;
}

type EntreeFusionnable = {
  titre: string;
  organe?: string | null;
  gravite: string;
  [k: string]: unknown;
};

/** La plus grave des deux gravités (sécurité < casse < majeure < mineure). */
export function plusGrave<T extends EntreeFusionnable>(a: T, b: T): T {
  return (RANG_GRAVITE[a.gravite] ?? 9) <= (RANG_GRAVITE[b.gravite] ?? 9) ? a : b;
}

/**
 * Fusionne les doublons d'un catalogue de défauts.
 * L'entrée conservée porte la gravité la plus sévère et hérite des champs que
 * l'autre renseignait seule. L'ordre d'origine est préservé.
 */
export function dedupliquerCatalogue<T extends EntreeFusionnable>(
  entrees: T[],
  fusionner: (garde: T, autre: T) => T,
): { gardees: T[]; fusions: number } {
  const gardees: T[] = [];
  const signatures: Array<Set<string>> = [];
  let fusions = 0;
  for (const e of entrees) {
    const sig = motsSpecifiques(`${e.titre} ${e.organe ?? ""}`);
    const idx = signatures.findIndex((s) => {
      let communs = 0;
      for (const m of sig) if (s.has(m)) communs += 1;
      return communs >= 2;
    });
    if (idx === -1) {
      gardees.push(e);
      signatures.push(sig);
      continue;
    }
    fusions += 1;
    const garde = plusGrave(gardees[idx], e);
    const autre = garde === gardees[idx] ? e : gardees[idx];
    gardees[idx] = fusionner(garde, autre);
  }
  return { gardees, fusions };
}
