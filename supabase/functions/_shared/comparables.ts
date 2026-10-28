// SPRINT 4B — Comparables de prix : AGRÉGATS UNIQUEMENT.
// La base ne conserve AUCUNE ligne d'annonce : chaque comparable est fondu à
// l'écriture dans un histogramme de prix par segment (marque, modèle, techno,
// cylindrée, année, tranche de km, mois, tranche de prix → effectif). Les
// histogrammes se FUSIONNENT par simple somme, ce qui permet de recalculer
// médiane / P25 / P75 / effectif sur n'importe quelle combinaison de segments
// (±2 ans, ±30 % km, < 3 mois) — chose impossible avec des quantiles stockés.
// Fonctions PURES, testables hors ligne (tests/comparables.test.mjs).

export const TRANCHE_KM = 20_000; // largeur des tranches de kilométrage
export const TRANCHE_PRIX = 250; // largeur des tranches de prix (± 125 €)
export const KM_INCONNU = -1;
export const ANNEE_INCONNUE = 0;

export type SegmentAgregat = {
  marque_norm: string;
  modele_norm: string;
  techno: string; // jeton de motorisation ('' si inconnu)
  cyl: string; // cylindrée "1.2" ('' si inconnue)
  annee: number; // ANNEE_INCONNUE si absente
  km_tranche: number; // KM_INCONNU si absent
  mois: string; // 'YYYY-MM' (mois de relevé)
  prix_tranche: number; // floor(prix/250)*250
};

export const normaliserNom = (s: unknown): string =>
  String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

const TECHNO_RE =
  /puretech|bluehdi|\bhdi\b|\btdi\b|\btsi\b|\btfsi\b|\btce\b|\bdci\b|\bcrdi\b|\bvti\b|\bthp\b|hybride|[ée]lectrique/;
const CYL_RE = /\b\d\.\d\b/;

/** Jeton de motorisation + cylindrée depuis un libellé libre (titre, motorisation). */
export function technoDe(texte: unknown): { techno: string; cyl: string } {
  const t = normaliserNom(texte);
  return {
    techno: t.match(TECHNO_RE)?.[0]?.trim() ?? "",
    cyl: t.match(CYL_RE)?.[0] ?? "",
  };
}

export const trancheKm = (km: number | null): number =>
  km != null && Number.isFinite(km) && km >= 0 ? Math.floor(km / TRANCHE_KM) : KM_INCONNU;

export const tranchePrix = (prix: number): number => Math.floor(prix / TRANCHE_PRIX) * TRANCHE_PRIX;

export const moisDe = (d: Date): string =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

/** Les clés de mois couvrant « moins de 3 mois » (mois courant inclus). */
export function moisRecents(maintenant: Date, n = 3): string[] {
  const out: string[] = [];
  const d = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), 1));
  for (let i = 0; i < n; i++) {
    out.push(moisDe(d));
    d.setUTCMonth(d.getUTCMonth() - 1);
  }
  return out;
}

/** Segment d'agrégation d'un comparable (null si prix inexploitable). */
export function segmentDe(c: {
  marque: string;
  modele: string;
  libelle_motorisation?: string | null; // motorisation OU titre (porte techno/cyl)
  annee: number | null;
  km: number | null;
  prix: number;
  date?: Date;
}): SegmentAgregat | null {
  if (!Number.isFinite(c.prix) || c.prix < 200 || c.prix > 1_000_000) return null;
  const { techno, cyl } = technoDe(c.libelle_motorisation ?? "");
  return {
    marque_norm: normaliserNom(c.marque),
    modele_norm: normaliserNom(c.modele),
    techno,
    cyl,
    annee: c.annee != null && c.annee > 1980 && c.annee < 2100 ? Math.round(c.annee) : ANNEE_INCONNUE,
    km_tranche: trancheKm(c.km),
    mois: moisDe(c.date ?? new Date()),
    prix_tranche: tranchePrix(c.prix),
  };
}

export type LigneAgregat = {
  techno: string;
  cyl: string;
  annee: number;
  km_tranche: number;
  mois: string;
  prix_tranche: number;
  effectif: number;
};

/** Fourchette P25 / médiane / P75 depuis les agrégats d'un modèle, en rejouant
 *  les règles de correspondance historiques : même techno, cylindrée compatible,
 *  ±2 ans, ±30 % de km (les segments « inconnus » passent, comme avant).
 *  null si moins de `minimum` comparables. */
export function fourchetteDepuisAgregats(
  lignes: LigneAgregat[],
  vehicule: { techno: string; cyl: string; annee: number | null; km: number | null },
  minimum = 15,
  // Comparables fournis EN MÉMOIRE pour cette analyse (extension) : fondus
  // dans l'histogramme, jamais stockés.
  prixBruts: number[] = [],
): { p25: number; mediane: number; p75: number; n: number } | null {
  const kmMin = vehicule.km != null ? Math.floor((vehicule.km * 0.7) / TRANCHE_KM) : null;
  const kmMax = vehicule.km != null ? Math.floor((vehicule.km * 1.3) / TRANCHE_KM) : null;

  const retenues = lignes.filter((l) => {
    if (vehicule.techno && l.techno && l.techno !== vehicule.techno) return false;
    if (vehicule.techno && !l.techno) return false; // techno exigée quand le véhicule en a une (règle historique)
    if (vehicule.cyl && l.cyl && l.cyl !== vehicule.cyl) return false;
    if (vehicule.annee != null && l.annee !== ANNEE_INCONNUE && Math.abs(l.annee - vehicule.annee) > 2) return false;
    if (kmMin != null && l.km_tranche !== KM_INCONNU && (l.km_tranche < kmMin || l.km_tranche! > kmMax!)) return false;
    return true;
  });

  // Fusion des histogrammes : somme des effectifs par tranche de prix.
  const histo = new Map<number, number>();
  let total = 0;
  for (const l of retenues) {
    histo.set(l.prix_tranche, (histo.get(l.prix_tranche) ?? 0) + l.effectif);
    total += l.effectif;
  }
  for (const prix of prixBruts) {
    if (!Number.isFinite(prix) || prix < 200 || prix > 1_000_000) continue;
    const t = tranchePrix(prix);
    histo.set(t, (histo.get(t) ?? 0) + 1);
    total += 1;
  }
  if (total < minimum) return null;

  const tranches = [...histo.entries()].sort((a, b) => a[0] - b[0]);
  const quantile = (q: number): number => {
    const cible = q * (total - 1) + 1;
    let cumul = 0;
    for (const [tranche, effectif] of tranches) {
      cumul += effectif;
      if (cumul >= cible) return tranche + TRANCHE_PRIX / 2; // point médian de la tranche
    }
    return tranches[tranches.length - 1][0] + TRANCHE_PRIX / 2;
  };
  return {
    p25: Math.round(quantile(0.25)),
    mediane: Math.round(quantile(0.5)),
    p75: Math.round(quantile(0.75)),
    n: total,
  };
}
