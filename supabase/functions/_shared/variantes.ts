// SPRINT 24 (décision d'Utku du 13 nov. 2026) — UNE PANNE QUI NOMME UNE
// CYLINDRÉE OU UNE PUISSANCE DIFFÉRENTE DE CELLE DU VÉHICULE NE S'APPLIQUE PAS
// À CE VÉHICULE : ni au score, ni au dossier, ni à la page modèle.
// Si le véhicule n'a pas de puissance (ou de cylindrée) connue, la panne
// devient une QUESTION au vendeur — on n'affirme pas sur une supposition.
//
// Cas qui l'a montrée : la fiche FIREFLY porte des pannes du 1.0 FireFly
// turbo 120 ch et du 1.3 FireFly 150 ch, que la 500 Hybrid (1.0, 70 ch) ne
// monte pas.
//
// Lecture PRUDENTE, comme pour les codes de boîte : une cylindrée n'est
// reconnue que suivie d'un nom de moteur (« 1.3 FireFly », « 1.5 dCi »), jamais
// une valeur isolée (« 0,5 l/1 000 km » est une consommation) ; une puissance
// n'est reconnue qu'avec son unité (« 120 ch ») ou derrière une désignation
// commerciale qui la porte (« dCi 90 », « PureTech 130 »). Les désignations
// Mercedes et BMW (« 220 d », « 320d ») ne sont PAS des puissances.
//
// Module PUR (tests/variantes.test.mjs).

export type Variante = { cylindrees: string[]; puissances: number[] };

// Mot qui suit une cylindrée : un nom de moteur, pas une unité.
const UNITES = new Set(["l", "litre", "litres", "km", "kg", "bar", "mm", "an", "ans", "h", "mois", "et", "a", "à", "ou"]);
const CYL_RE = /(?<![\d.,])([0-6])[.,](\d)(?![\d.,])\s+([A-Za-zÀ-ÿ][\w-]*)/g;
const CH_RE = /(?<!\d)(\d{2,3})\s?(?:ch|cv|hp|PS)\b/gi;
// Désignations commerciales dont le nombre EST la puissance (en ch).
const DESIGNATION_RE = /\b(?:dci|blue\s?dci|tce|sce|puretech|bluehdi|e-?hdi|hdi|vti|thp|tdi|tsi|tfsi|crdi|multijet|ecoboost|t-?gdi|gdi|firefly|twinair|mpi|ecotsi)\s?(\d{2,3})\b/gi;

const norm = (c: string) => c.replace(",", ".");

export function lireVariante(texte: unknown): Variante {
  const t = String(texte ?? "");
  const cylindrees = new Set<string>();
  for (const m of t.matchAll(CYL_RE)) {
    if (UNITES.has(m[3].toLowerCase())) continue;
    cylindrees.add(norm(`${m[1]}.${m[2]}`));
  }
  const puissances = new Set<number>();
  for (const m of t.matchAll(CH_RE)) { const n = Number(m[1]); if (n >= 40 && n <= 700) puissances.add(n); }
  for (const m of t.matchAll(DESIGNATION_RE)) { const n = Number(m[1]); if (n >= 40 && n <= 700) puissances.add(n); }
  return { cylindrees: [...cylindrees], puissances: [...puissances] };
}

/** Variante du véhicule : la cylindrée identifiée (« 1.5 », « 1461 cm3 ») et
 *  ce que dit la motorisation. Une cylindrée en cm3 est ramenée au litre. */
export function varianteVehicule(v: { cylindree?: unknown; motorisation?: unknown; version?: unknown }): Variante {
  const lu = lireVariante([v.motorisation, v.version].filter(Boolean).join(" "));
  const cyl = new Set(lu.cylindrees);
  const c = String(v.cylindree ?? "").trim();
  const litre = c.match(/^([0-6])[.,](\d)\b/);
  const cm3 = c.match(/^(\d{3,4})\s*(?:cm3|cm³|cc)?$/i);
  if (litre) cyl.add(`${litre[1]}.${litre[2]}`);
  else if (cm3) cyl.add((Math.round(Number(cm3[1]) / 100) / 10).toFixed(1));
  // Cylindrée isolée en tête de motorisation (« 1.5 dCi 90 » est déjà lue ;
  // « 1.6 » seul aussi).
  const tete = String(v.motorisation ?? "").trim().match(/^([0-6])[.,](\d)(?![\d.,])/);
  if (tete) cyl.add(`${tete[1]}.${tete[2]}`);
  return { cylindrees: [...cyl], puissances: lu.puissances };
}

export type Decision = { statut: "applicable" | "exclue" | "question"; motif: string | null };

const TOLERANCE_CH = 3; // 130 et 131 ch désignent la même version

/** La panne s'applique-t-elle à ce véhicule ? Une seule discordance suffit
 *  à l'exclure ; une donnée manquante côté véhicule la rend question. */
export function decisionVariante(textePanne: string, vehicule: Variante): Decision {
  const p = lireVariante(textePanne);
  let inconnu: string | null = null;
  if (p.cylindrees.length > 0) {
    if (vehicule.cylindrees.length === 0) inconnu = `cylindrée ${p.cylindrees.join(" / ")}`;
    else if (!p.cylindrees.some((c) => vehicule.cylindrees.includes(c))) {
      return { statut: "exclue", motif: `cylindrée ${p.cylindrees.join(" / ")} ≠ ${vehicule.cylindrees.join(" / ")}` };
    }
  }
  if (p.puissances.length > 0) {
    if (vehicule.puissances.length === 0) inconnu = inconnu ?? `${p.puissances.join(" / ")} ch`;
    else if (!p.puissances.some((x) => vehicule.puissances.some((y) => Math.abs(x - y) <= TOLERANCE_CH))) {
      return { statut: "exclue", motif: `${p.puissances.join(" / ")} ch ≠ ${vehicule.puissances.join(" / ")} ch` };
    }
  }
  return inconnu ? { statut: "question", motif: inconnu } : { statut: "applicable", motif: null };
}

/** Question au vendeur quand la version n'est pas connue. */
export function questionVariante(titrePanne: string, motif: string): string {
  return `Quelle est la version exacte du moteur (cylindrée à la rubrique P.1 de la carte grise, puissance en ch, ou en kW à la rubrique P.2) ? Le défaut « ${String(titrePanne).slice(0, 90)} » ne concerne que la version ${motif}.`;
}
