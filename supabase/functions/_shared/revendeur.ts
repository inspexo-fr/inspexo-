// SPRINT 19 — Mode revendeur : trois chiffres, et seulement trois.
//
// Module PUR, testé hors ligne, miroir côté client GÉNÉRÉ (`src/data/revendeur.gen.js`)
// pour que l'utilisateur puisse corriger un coût et tout voir se recalculer
// sans aller-retour serveur.
//
// ⚠️ CE QUE CE MODULE N'EST PAS. Il ne détermine aucune VALEUR de véhicule —
// réservé aux experts en automobile inscrits (art. L326-4 I-2° du code de la
// route). Il relève des PRIX OBSERVÉS sur des annonces comparables et les
// combine aux PARAMÈTRES DE L'UTILISATEUR. Changez les paramètres, les trois
// chiffres changent : c'est un calcul, pas une estimation.
//
// Vocabulaire proscrit dans tout ce qui sort d'ici : « valeur », « cote »,
// « estimation », « expertise ». Un test l'impose.

export const MENTION_REVENDEUR =
  "Calcul à partir de prix observés et de tes paramètres. Ce n'est ni une " +
  "valeur du véhicule ni une garantie de revente.";

/** Au-dessous de ce nombre de comparables retenus : aucun chiffre.
 *  ⚠️ Pas de demi-mesure, pas de fourchette élargie « faute de mieux ». Cinq
 *  annonces ne font pas un marché, et un chiffre calculé sur cinq annonces
 *  est plus dangereux que pas de chiffre du tout : il a l'air sérieux. */
export const SEUIL_COMPARABLES = 6;
export const ECART_ANNEES = 2;
export const ECART_KM = 40_000;

export type ParametresRevendeur = {
  /** Marge que l'acheteur final négociera sur le prix affiché (%). */
  marge_negociation_pct: number;
  /** Marge que le revendeur veut faire (€). */
  marge_voulue_eur: number;
  /** Imprévus : % des travaux chiffrés. */
  imprevus_pct_travaux: number;
  /** Imprévus : forfait pour un véhicule de plus de 10 ans (€). */
  imprevus_vehicule_ancien_eur: number;
  /** Décote si le véhicule est interdit dans la ZFE de revente (%). */
  decote_zfe_pct: number;
  /** Retrait appliqué au prix d'achat maximum pour l'offre d'ouverture (%). */
  offre_retrait_pct: number;
};

export const PARAMETRES_DEFAUT: ParametresRevendeur = {
  marge_negociation_pct: 8,
  marge_voulue_eur: 500,
  imprevus_pct_travaux: 15,
  imprevus_vehicule_ancien_eur: 150,
  decote_zfe_pct: 10,
  offre_retrait_pct: 15,
};

export type ComparableRevendeur = {
  prix: number;
  annee: number | null;
  km: number | null;
  modele: string;
  energie: string;
  boite?: string | null;
  finition?: string | null;
  titre?: string | null;
};

export type VehiculeRevendeur = {
  modele: string;
  energie: string;
  annee: number | null;
  km: number | null;
};

const nombre = (x: unknown): number | null => {
  const n = typeof x === "number" ? x : Number(String(x ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
};

const norm = (s: unknown) =>
  String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();

/** Deux énergies sont-elles la même ? Diesel et essence ne se mélangent
 *  jamais : un diesel et une essence du même modèle ne se revendent pas au
 *  même prix, et c'est précisément ce qu'on mesure. */
export function memeEnergie(a: unknown, b: unknown): boolean {
  const f = (e: unknown) => {
    const s = norm(e);
    if (/electri|hydrog/.test(s)) return "elec";
    if (/diesel|gazole|hdi|dci|tdi|cdi|crdi|bluehdi/.test(s)) return "diesel";
    if (/hybride/.test(s)) return "hybride";
    if (/essence|gpl|e85|ethanol/.test(s)) return "essence";
    return "";
  };
  const x = f(a), y = f(b);
  return x !== "" && x === y;
}

export type Ecarte = { titre: string; raison: "modele" | "energie" | "annee" | "km" | "prix" };

/** Les comparables de SON dossier, filtrés. Aucun agrégat, aucun seuil de 15 :
 *  ce sont les annonces que l'utilisateur a lui-même sous les yeux. */
export function filtrerComparables(
  liste: readonly ComparableRevendeur[],
  v: VehiculeRevendeur,
): { retenus: ComparableRevendeur[]; ecartes: Ecarte[] } {
  const retenus: ComparableRevendeur[] = [];
  const ecartes: Ecarte[] = [];
  const modeleCible = norm(v.modele);
  for (const c of liste ?? []) {
    const titre = String(c?.titre ?? c?.modele ?? "").slice(0, 80);
    const prix = nombre(c?.prix);
    if (prix == null || prix < 200 || prix > 1_000_000) { ecartes.push({ titre, raison: "prix" }); continue; }
    if (!modeleCible || norm(c?.modele) !== modeleCible) { ecartes.push({ titre, raison: "modele" }); continue; }
    if (!memeEnergie(c?.energie, v.energie)) { ecartes.push({ titre, raison: "energie" }); continue; }
    const an = nombre(c?.annee);
    if (v.annee != null && (an == null || Math.abs(an - v.annee) > ECART_ANNEES)) {
      ecartes.push({ titre, raison: "annee" }); continue;
    }
    const km = nombre(c?.km);
    if (v.km != null && (km == null || Math.abs(km - v.km) > ECART_KM)) {
      ecartes.push({ titre, raison: "km" }); continue;
    }
    retenus.push({ ...c, prix, annee: an, km });
  }
  return { retenus, ecartes };
}

export const mediane = (xs: readonly number[]): number | null => {
  const v = [...xs].filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2);
};

/** Pente prix/km MESURÉE sur les comparables, par moindres carrés.
 *
 *  ⚠️ Rendue seulement si elle est mesurable ET plausible : au moins 6 points,
 *  au moins 3 kilométrages distincts, pente négative, et au plus 0,20 €/km.
 *  Sinon `null` — et aucun ajustement n'est appliqué. On ne décote jamais
 *  « au barème » : une pente inventée déplacerait le prix sans que rien ne
 *  l'appuie. Même règle qu'au sprint 9 pour le relevé agrégé. */
export function penteKm(c: readonly ComparableRevendeur[]): number | null {
  const pts = c.filter((x) => x.km != null && Number.isFinite(x.prix)) as Array<{ km: number; prix: number }>;
  if (pts.length < SEUIL_COMPARABLES) return null;
  if (new Set(pts.map((p) => Math.round(p.km / 10_000))).size < 3) return null;
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p.km, 0) / n;
  const my = pts.reduce((s, p) => s + p.prix, 0) / n;
  let num = 0, den = 0;
  for (const p of pts) { num += (p.km - mx) * (p.prix - my); den += (p.km - mx) ** 2; }
  if (den === 0) return null;
  const pente = num / den; // € par km, négatif attendu
  if (!(pente < 0) || pente < -0.2) return null;
  return pente;
}

export type PrixRevente = {
  valeur: number;
  mediane_observee: number;
  nb_comparables: number;
  ajustement_km_eur: number;
  retrait_negociation_eur: number;
  decote_zfe_eur: number;
  pente_eur_par_km: number | null;
};

/** PRIX DE REVENTE RÉALISTE.
 *  Médiane observée, ajustée du kilométrage quand la pente est mesurable,
 *  moins la marge que l'acheteur final négociera, moins la décote ZFE le cas
 *  échéant. Rend `null` sous le seuil de comparables. */
export function prixRevente(
  comparables: readonly ComparableRevendeur[],
  v: VehiculeRevendeur,
  p: ParametresRevendeur,
  interditZfe = false,
): PrixRevente | null {
  if (comparables.length < SEUIL_COMPARABLES) return null;
  const med = mediane(comparables.map((c) => c.prix));
  if (med == null) return null;

  const pente = penteKm(comparables);
  let ajustement = 0;
  if (pente != null && v.km != null) {
    const kmMedian = mediane(comparables.map((c) => c.km).filter((k): k is number => k != null));
    if (kmMedian != null) ajustement = Math.round(pente * (v.km - kmMedian));
  }
  const base = med + ajustement;
  const retrait = Math.round(base * (p.marge_negociation_pct / 100));
  const apresNego = base - retrait;
  const decote = interditZfe ? Math.round(apresNego * (p.decote_zfe_pct / 100)) : 0;
  return {
    valeur: Math.max(0, apresNego - decote),
    mediane_observee: med,
    nb_comparables: comparables.length,
    ajustement_km_eur: ajustement,
    retrait_negociation_eur: retrait,
    decote_zfe_eur: decote,
    pente_eur_par_km: pente,
  };
}

export type LigneCout = {
  cle: string;
  libelle: string;
  montant_eur: number;
  source?: string | null;
  /** Modifiable par l'utilisateur à l'écran. */
  modifiable: boolean;
};

export type PrixAchatMax = {
  valeur: number;
  revente_eur: number;
  lignes: LigneCout[];
  /** Vrai si un coût manque faute de donnée (région inconnue, par exemple). */
  incomplet: boolean;
  manquants: string[];
};

/** PRIX D'ACHAT MAXIMUM POUR LA MARGE VISÉE.
 *
 *  ⚠️ Ce n'est pas un conseil d'achat : c'est le résultat d'une soustraction
 *  dont chaque terme est affiché et modifiable. Si l'utilisateur change sa
 *  marge visée, le chiffre change — c'est tout ce qu'il signifie. */
export function prixAchatMax(
  revente: number,
  travaux: readonly LigneCout[],
  p: ParametresRevendeur,
  opts: {
    ct_a_refaire_eur?: number | null;
    carte_grise_eur?: number | null;
    region_connue?: boolean;
    age_vehicule_ans?: number | null;
  } = {},
): PrixAchatMax {
  const lignes: LigneCout[] = [...travaux];
  const manquants: string[] = [];

  const totalTravaux = travaux.reduce((s, l) => s + (Number(l.montant_eur) || 0), 0);

  if (opts.ct_a_refaire_eur != null && opts.ct_a_refaire_eur > 0) {
    lignes.push({ cle: "controle_technique", libelle: "Contrôle technique à refaire", montant_eur: opts.ct_a_refaire_eur, modifiable: true });
  }

  // ⚠️ Pas de moyenne nationale silencieuse : sans région, pas de chiffre.
  // Une carte grise va de la gratuité à plus de 1 000 € selon la région,
  // les chevaux fiscaux et l'énergie. Inventer une moyenne fausserait le
  // prix d'achat maximum sans que l'utilisateur sache d'où vient l'erreur.
  if (opts.carte_grise_eur != null && opts.carte_grise_eur >= 0) {
    lignes.push({ cle: "carte_grise", libelle: "Carte grise", montant_eur: opts.carte_grise_eur, modifiable: true });
  } else if (opts.region_connue === false) {
    manquants.push("carte_grise");
  }

  const imprevusTravaux = Math.round(totalTravaux * (p.imprevus_pct_travaux / 100));
  const imprevusAge = (opts.age_vehicule_ans ?? 0) > 10 ? p.imprevus_vehicule_ancien_eur : 0;
  if (imprevusTravaux + imprevusAge > 0) {
    lignes.push({
      cle: "imprevus",
      libelle: `Imprévus (${p.imprevus_pct_travaux} % des travaux${imprevusAge ? ` + ${imprevusAge} € véhicule de plus de 10 ans` : ""})`,
      montant_eur: imprevusTravaux + imprevusAge,
      modifiable: true,
    });
  }

  lignes.push({ cle: "marge_voulue", libelle: "Marge visée", montant_eur: p.marge_voulue_eur, modifiable: true });

  const total = lignes.reduce((s, l) => s + (Number(l.montant_eur) || 0), 0);
  return {
    valeur: Math.max(0, Math.round(revente - total)),
    revente_eur: revente,
    lignes,
    incomplet: manquants.length > 0,
    manquants,
  };
}

/** OFFRE D'OUVERTURE : prix d'achat maximum moins le retrait, arrondie à la
 *  cinquantaine INFÉRIEURE. Arrondir vers le haut ferait proposer plus que le
 *  calcul ne permet. */
export function offreOuverture(prixMax: number, p: ParametresRevendeur): number {
  const brut = prixMax * (1 - p.offre_retrait_pct / 100);
  return Math.max(0, Math.floor(brut / 50) * 50);
}

// ── Carte grise ────────────────────────────────────────────────────────────
//
// ⚠️ Le tarif vient de la CONFIG, jamais du code : le prix du cheval fiscal
// est voté chaque année par chaque région. Figé dans un déploiement, il
// deviendrait faux au 1er janvier sans que personne ne le voie.

export type TarifsCarteGrise = {
  maj: string;
  source: string;
  frais_fixes_eur: number;
  regions: Record<string, number>;
};

export type CoutCarteGrise =
  | { connu: true; montant_eur: number; cv: number; tarif_cv: number; region: string; maj: string }
  | { connu: false; motif: "region_inconnue" | "region_absente_du_bareme" | "cv_inconnus" | "bareme_absent" };

/** Coût de la carte grise : CV × tarif régional + frais fixes.
 *
 *  ⚠️ CE QUE CE CALCUL NE FAIT PAS : appliquer une exonération « véhicule
 *  propre ». Elle vaut 0 %, 50 % ou 100 % selon la région, et plusieurs l'ont
 *  supprimée depuis 2025. L'appliquer d'office donnerait un coût faux dans un
 *  sens, l'ignorer dans l'autre. La ligne reste MODIFIABLE à l'écran et
 *  renvoie au simulateur officiel : mieux vaut un chiffre que l'utilisateur
 *  corrige qu'un chiffre qu'il croit exact.
 *
 *  Et surtout : sans région ou sans puissance fiscale, AUCUN chiffre. */
export function coutCarteGrise(
  cv: number | null,
  region: string | null,
  bareme: TarifsCarteGrise | null,
): CoutCarteGrise {
  if (!bareme || !bareme.regions) return { connu: false, motif: "bareme_absent" };
  if (!region || !String(region).trim()) return { connu: false, motif: "region_inconnue" };
  const n = typeof cv === "number" ? cv : Number(cv);
  if (!Number.isFinite(n) || n <= 0 || n > 99) return { connu: false, motif: "cv_inconnus" };

  const cible = norm(region);
  const entree = Object.entries(bareme.regions).find(([r]) => norm(r) === cible);
  if (!entree) return { connu: false, motif: "region_absente_du_bareme" };

  const [nomRegion, tarif] = entree;
  const montant = Math.round((n * Number(tarif) + Number(bareme.frais_fixes_eur || 0)) * 100) / 100;
  return { connu: true, montant_eur: montant, cv: n, tarif_cv: Number(tarif), region: nomRegion, maj: bareme.maj };
}
