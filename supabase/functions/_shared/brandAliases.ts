// ============================================================
// TABLE D'ALIAS DE MARQUES — fichier à maintenir à la main.
//
// Pourquoi : les sources externes n'écrivent pas les marques de la
// même façon. Exemples réels constatés dans RappelConso
// (`marque_produit`, toujours en minuscules) :
//   - "vw" (jamais "volkswagen")
//   - "mercedes-benz" (et non "mercedes")
//   - "citroen" ET "citroën" (les deux coexistent)
//   - "ds automobiles" / "opel/vauxhall"
// La liste Takata du ministère utilise elle "Mercedes", "DS", "Citroën"...
//
// Comment ajouter un cas :
//   1. Chaque ligne de BRAND_ALIAS_GROUPS est un groupe d'équivalence :
//      toutes les écritures d'une même marque, SANS se soucier des
//      accents ni des majuscules (tout est normalisé automatiquement).
//   2. Ajoutez simplement la nouvelle variante dans le groupe existant,
//      ou créez un nouveau groupe ["forme-canonique", "variante1", ...].
//   3. Pour la COMPARAISON interne (sameBrand/expandBrand), les accents
//      sont neutralisés automatiquement. MAIS pour les requêtes exactes
//      vers RappelConso (rawBrandVariants), les deux graphies doivent
//      figurer dans le groupe si elles coexistent dans le dataset
//      (ex : "citroen" ET "citroën" sont deux valeurs distinctes là-bas).
// ============================================================

export const BRAND_ALIAS_GROUPS: string[][] = [
  ["volkswagen", "vw"],
  ["mercedes", "mercedes-benz", "mercedes benz", "mb"],
  ["citroen", "citroën"], // les DEUX graphies existent dans RappelConso
  ["ds", "ds automobiles"],
  ["opel", "opel/vauxhall", "vauxhall"],
  ["alfa romeo", "alfa-romeo", "alfa"],
  ["land rover", "land-rover", "landrover"],
  ["rolls royce", "rolls-royce"],
  ["aston martin", "aston-martin"],
  ["skoda", "škoda"],
  ["seat", "cupra"], // Cupra = émanation Seat ; à séparer si besoin
  ["chevrolet", "chevy"],
  ["bmw", "bmw i", "bmw m"],
  ["mini", "mini (bmw)"],
  ["peugeot"],
  ["renault"],
  ["dacia"],
  ["toyota"],
  ["lexus"],
  ["audi"],
  ["porsche"],
  ["ford"],
  ["fiat"],
  ["lancia"],
  ["jeep"],
  ["dodge"],
  ["chrysler"],
  ["nissan"],
  ["infiniti"],
  ["honda"],
  ["mazda"],
  ["mitsubishi"],
  ["subaru"],
  ["suzuki"],
  ["daihatsu"],
  ["hyundai"],
  ["kia"],
  ["genesis"],
  ["volvo"],
  ["saab"],
  ["jaguar"],
  ["tesla"],
  ["ferrari"],
  ["maserati"],
  ["lamborghini"],
  ["lotus"],
  ["mclaren"],
  ["bentley"],
  ["cadillac"],
  ["gmc"],
  ["alpina"],
  ["alpine"],
];

/** Minuscules, accents retirés, espaces normalisés. */
export function normalizeBrand(input: string): string {
  return (input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Retourne toutes les écritures connues d'une marque (normalisées),
 * y compris l'entrée elle-même si elle n'est dans aucun groupe.
 */
export function expandBrand(input: string): string[] {
  const norm = normalizeBrand(input);
  for (const group of BRAND_ALIAS_GROUPS) {
    if (group.some((g) => normalizeBrand(g) === norm)) {
      return [...new Set(group.map(normalizeBrand))];
    }
  }
  return [norm];
}

/** true si deux écritures désignent la même marque. */
export function sameBrand(a: string, b: string): boolean {
  const ea = expandBrand(a);
  const nb = normalizeBrand(b);
  return ea.includes(nb) || expandBrand(b).includes(normalizeBrand(a));
}

/**
 * Variantes BRUTES (minuscules, accents conservés) pour les comparaisons
 * exactes côté source externe (ex : `marque_produit in (...)` RappelConso).
 * Inclut aussi les formes normalisées, au cas où.
 */
export function rawBrandVariants(input: string): string[] {
  const norm = normalizeBrand(input);
  const out = new Set<string>([norm, (input || "").toLowerCase().trim()]);
  for (const group of BRAND_ALIAS_GROUPS) {
    if (group.some((g) => normalizeBrand(g) === norm)) {
      for (const g of group) {
        out.add(g.toLowerCase().trim());
        out.add(normalizeBrand(g));
      }
      break;
    }
  }
  return [...out].filter(Boolean);
}
