// SPRINT 24 (SEO, décision d'Utku du 13 nov. 2026) — Rendre chaque page
// /modele PROPRE au modèle, SANS IA, avant tout anti-doublon :
//   - les moteurs réellement montés sur ce modèle et leurs années ;
//   - la vignette Crit'Air de chacun selon les années, et les ZFE (liste datée)
//     qui interdisent cette vignette ;
//   - les rappels RappelConso de CE modèle ;
//   - les prix observés de CE segment (même seuil que partout : 15 relevés).
// Les prises en charge sont déjà filtrées par modèle (`modeles.ts`).
//
// Module PUR (tests/donnees-modele.test.mjs).
import { critair, libelleCritair, ZFE, ZFE_RELEVE_LE, type Critair } from "./critair.ts";

export type FamilleAnnees = { marque: string; famille: string; nom_commercial: string; debut?: number | null; derniere_attestee?: number | null };

/** Énergie d'une famille d'après son nom commercial ; « inconnu » plutôt
 *  qu'une supposition. */
export function energieFamille(nom: string): "diesel" | "essence" | "hybride" | "inconnu" {
  const n = String(nom ?? "").toLowerCase();
  if (/hybrid|hsd|e-tech/.test(n)) return "hybride";
  if (/\b(?:dci|blue\s?dci|tdi|hdi|bluehdi|e-?hdi|cdi|crdi|d-?4d|multijet|tdci|ecoblue|i-?dtec|diesel)\b|\b\d{3}d\b|\bd\d\b/.test(n)) return "diesel";
  if (/\b(?:tce|sce|puretech|vti|thp|tsi|tfsi|ecoboost|t-?gdi|gdi|mpi|firefly|twinair|essence|16v|vvt-?i|turbo)\b/.test(n)) return "essence";
  return "inconnu";
}

export type PlageCritair = { classe: Critair; libelle: string; de: number; a: number; zfe_interdites: string[] };

/** Vignette Crit'Air année par année (1re immatriculation = année), regroupée
 *  en plages, avec les villes dont la ZFE interdit cette vignette. */
export function critairParAnnees(energie: string, de: number, a: number): PlageCritair[] {
  if (energie === "inconnu" || !(de > 1950) || !(a >= de)) return [];
  const e = energie === "hybride" ? "essence" : energie;
  const out: PlageCritair[] = [];
  for (let y = de; y <= a; y++) {
    const c = critair(e, y);
    const der = out[out.length - 1];
    if (der && der.classe === c) der.a = y;
    else out.push({ classe: c, libelle: libelleCritair(c), de: y, a: y, zfe_interdites: ZFE.filter((z) => z.interdits.includes(c)).map((z) => z.ville) });
  }
  return out;
}

export type Rappel = { titre: string; date: string | null; lien: string | null };

/** Rappels du modèle publiés à partir de l'année où le plus ancien moteur de
 *  la page a commencé (un an de marge) ; 8 au plus, les plus récents d'abord. */
export function rappelsDuModele(liste: unknown, anneeMin: number | null): Rappel[] {
  const arr = Array.isArray(liste) ? liste : [];
  // deno-lint-ignore no-explicit-any
  return arr.map((r: any) => ({ titre: String(r?.titre ?? "").slice(0, 160), date: typeof r?.date === "string" ? r.date.slice(0, 10) : null, lien: typeof r?.lien === "string" ? r.lien : null }))
    .filter((r) => r.titre && (anneeMin == null || !r.date || Number(r.date.slice(0, 4)) >= anneeMin - 1))
    .sort((x, y) => String(y.date ?? "").localeCompare(String(x.date ?? "")))
    .slice(0, 8);
}

export type MoteurMonte = { nom: string; famille: string; marque: string; annees: string | null; energie: string; critair: PlageCritair[] };

export function moteursMontes(familles: FamilleAnnees[], anneeCourante: number): MoteurMonte[] {
  return familles.map((f) => {
    const energie = energieFamille(f.nom_commercial);
    const de = f.debut ?? null;
    const a = f.derniere_attestee ?? (de ? anneeCourante : null);
    return {
      nom: f.nom_commercial, famille: f.famille, marque: f.marque,
      annees: de ? `${de}–${f.derniere_attestee ?? ""}` : null,
      energie,
      critair: de && a ? critairParAnnees(energie, de, a) : [],
    };
  });
}

/** Année la plus récente d'apparition d'un moteur de la page : sert à dire
 *  quelle génération est la plus récente quand deux pages restent trop
 *  proches. null si aucune année n'est connue. */
export function anneeRecente(familles: FamilleAnnees[]): number | null {
  const ys = familles.map((f) => f.debut).filter((y): y is number => typeof y === "number");
  return ys.length ? Math.max(...ys) : null;
}

export const ZFE_DATE = ZFE_RELEVE_LE;
