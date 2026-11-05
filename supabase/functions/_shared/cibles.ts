// SPRINT 19.1 — Alertes rentables : recherche à sauvegarder, et « Mes cibles ».
//
// Module PUR (aucun import, aucun réseau), miroir client GÉNÉRÉ
// (`src/data/cibles.gen.js`) par scripts/generer-miroir-revendeur.mjs.
//
// ⚠️ CE QUE CE MODULE NE FAIT PAS : interroger Leboncoin. Il COMPOSE une
// recherche — des filtres à régler, et au plus un lien de recherche libre.
// Aucune requête ne part de nos serveurs vers un site d'annonces ; c'est une
// promesse publique, vérifiée par tests/pas-de-scraping.test.mjs.
//
// ⚠️ VOCABULAIRE : « prix observés », « marge estimée ». Jamais « valeur »,
// « cote », « estimation de valeur » ni « expertise » — déterminer la valeur
// d'un véhicule est réservé aux experts en automobile inscrits
// (art. L326-4 I-2° du code de la route).

export const MENTION_CIBLES =
  "Marges estimées à partir des prix observés sur vos propres relevés et de " +
  "vos paramètres. Ce ne sont ni des valeurs de véhicule ni des promesses de " +
  "revente.";

/** Au-dessous de ce nombre de relevés dans un segment, aucune cible.
 *  Même seuil que le mode revendeur : ce sont les mêmes annonces. */
export const SEUIL_CIBLE = 6;

// ── Histogramme de prix (mêmes tranches que le relevé agrégé) ──────────────
//
// On stocke un histogramme plutôt que les prix bruts : il se fusionne par
// simple somme d'une session à l'autre, et il ne conserve aucune annonce.

export const TRANCHE_PRIX_CIBLE = 250;

export function histogrammeDePrix(prix: readonly number[]): Record<string, number> {
  const h: Record<string, number> = {};
  for (const p of prix ?? []) {
    const n = Number(p);
    if (!Number.isFinite(n) || n < 200 || n > 1_000_000) continue;
    const t = String(Math.floor(n / TRANCHE_PRIX_CIBLE) * TRANCHE_PRIX_CIBLE);
    h[t] = (h[t] ?? 0) + 1;
  }
  return h;
}

/** Fusion par somme. Découper les relevés en plusieurs sessions ne doit rien
 *  changer au résultat — c'est toute la raison d'être d'un histogramme. */
export function fusionnerHistogrammes(
  a: Record<string, number> | null | undefined,
  b: Record<string, number> | null | undefined,
): Record<string, number> {
  const out: Record<string, number> = { ...(a ?? {}) };
  for (const [t, n] of Object.entries(b ?? {})) {
    const v = Number(n);
    if (!Number.isFinite(v) || v <= 0) continue;
    out[t] = (out[t] ?? 0) + v;
  }
  return out;
}

export const effectifHistogramme = (h: Record<string, number> | null | undefined): number =>
  Object.values(h ?? {}).reduce((s, n) => s + (Number.isFinite(Number(n)) ? Number(n) : 0), 0);

// ── La cible d'un segment ──────────────────────────────────────────────────

export type Cible = {
  marque: string;
  modele: string;
  energie: string;
  n: number;
  /** Prix observés, en euros. */
  p25: number;
  p50: number;
  annee_mediane: number | null;
  km_median: number | null;
  /** Prix de revente réaliste pour un exemplaire type du segment. */
  revente: number;
  /** Prix d'achat maximum type : revente − coûts fixes − marge visée.
   *  AUCUN travaux : une cible est un véhicule qu'on n'a pas encore vu. */
  achat_max: number;
  /** Ce qui resterait en achetant au quart le moins cher des prix observés,
   *  AVANT la marge visée. C'est le critère de tri : où il y a de l'argent. */
  marge_estimee: number;
  /** Faux quand la marge visée n'est pas atteignable au P25 observé. */
  atteignable: boolean;
  maj: string | null;
};

export type ParametresCible = {
  marge_negociation_pct: number;
  marge_voulue_eur: number;
  imprevus_vehicule_ancien_eur: number;
};

/** Une cible à partir des quantiles d'un segment.
 *
 *  ⚠️ Les quantiles sont CALCULÉS AILLEURS, par l'unique implémentation du
 *  projet (`quantileHisto` dans _shared/marche.ts). Ce module les reçoit : en
 *  écrire une seconde ferait diverger deux chiffres qui doivent être le même.
 *
 *  ⚠️ Aucun coût de réparation n'entre ici, et c'est le point : une cible
 *  décrit un véhicule qu'on n'a pas encore vu. Les travaux se découvrent sur
 *  l'annonce, et c'est le mode revendeur qui les retranche. */
export function cibleDepuisQuantiles(
  seg: {
    marque: string;
    modele: string;
    energie: string;
    n: number;
    p25: number;
    p50: number;
    annee_mediane?: number | null;
    km_median?: number | null;
    maj?: string | null;
  },
  p: ParametresCible,
  opts: { carte_grise_eur?: number | null; annee_courante?: number } = {},
): Cible | null {
  if (!seg || seg.n < SEUIL_CIBLE) return null;
  const p25 = Math.round(seg.p25);
  const p50 = Math.round(seg.p50);
  if (!(p50 > 0) || !(p25 > 0)) return null;

  const revente = Math.round(p50 * (1 - p.marge_negociation_pct / 100));

  const anneeCourante = opts.annee_courante ?? new Date().getUTCFullYear();
  const age = seg.annee_mediane ? anneeCourante - seg.annee_mediane : 0;
  const forfaitAge = age > 10 ? p.imprevus_vehicule_ancien_eur : 0;
  const carteGrise = opts.carte_grise_eur != null && opts.carte_grise_eur >= 0
    ? Math.round(opts.carte_grise_eur)
    : 0;
  const coutsFixes = forfaitAge + carteGrise;

  const achatMax = Math.round(revente - coutsFixes - p.marge_voulue_eur);
  // Acheter au quart le moins cher des prix observés : ce qui reste avant la
  // marge visée. C'est la question du revendeur, et c'est le critère de tri.
  const margeEstimee = Math.round(revente - coutsFixes - p25);

  return {
    marque: seg.marque,
    modele: seg.modele,
    energie: seg.energie,
    n: seg.n,
    p25,
    p50,
    annee_mediane: seg.annee_mediane ?? null,
    km_median: seg.km_median ?? null,
    revente,
    achat_max: achatMax,
    marge_estimee: margeEstimee,
    atteignable: achatMax >= p25,
    maj: seg.maj ?? null,
  };
}

/** Tri par marge estimée décroissante. Les inatteignables restent affichées,
 *  en bas : savoir qu'un modèle ne paie pas est une information. */
export function trierCibles(cibles: readonly Cible[]): Cible[] {
  return [...(cibles ?? [])].sort((a, b) => {
    if (a.atteignable !== b.atteignable) return a.atteignable ? -1 : 1;
    return b.marge_estimee - a.marge_estimee;
  });
}

// ── La recherche à sauvegarder ─────────────────────────────────────────────

export const ECART_ANNEES_CIBLE = 2;
export const ECART_KM_CIBLE = 40_000;

export type Filtre = { champ: string; valeur: string };
export type RechercheSauvegardee = {
  filtres: Filtre[];
  /** Lien de recherche, ou null. Voir l'avertissement ci-dessous. */
  url: string | null;
  /** Texte expliquant ce que le lien fait, et ce qu'il ne fait pas. */
  note: string;
  prix_max: number;
};

const ENERGIES_LBC: Record<string, string> = {
  diesel: "Diesel",
  essence: "Essence",
  hybride: "Hybride",
  electrique: "Électrique",
};

const normEnergie = (e: unknown): string => {
  const s = String(e ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (/electri|hydrog/.test(s)) return "electrique";
  if (/diesel|gazole|hdi|dci|tdi|cdi|crdi|bluehdi/.test(s)) return "diesel";
  if (/hybride/.test(s)) return "hybride";
  if (/essence|gpl|e85|ethanol/.test(s)) return "essence";
  return "";
};

/** Arrondi du plafond de prix pour une RECHERCHE.
 *
 *  ⚠️ Arrondi à la centaine SUPÉRIEURE, à l'inverse de l'offre d'ouverture
 *  (arrondie vers le bas). Ce n'est pas une incohérence : une offre arrondie
 *  vers le haut proposerait plus que le calcul ne permet, tandis qu'un
 *  plafond de recherche arrondi vers le bas CACHERAIT des annonces qui se
 *  négocient de cinquante euros. Les deux arrondis vont dans le sens de
 *  l'utilisateur. */
export const plafondRecherche = (achatMax: number): number =>
  Math.max(0, Math.ceil(achatMax / 100) * 100);

/** Compose la recherche à sauvegarder chez Leboncoin.
 *
 *  ⚠️ LE LIEN NE PORTE QUE LA RECHERCHE TEXTE, VOLONTAIREMENT. Nous ne
 *  pouvons pas vérifier le nom des paramètres d'URL de Leboncoin sans
 *  l'interroger — ce que nous ne faisons jamais. Un lien qui appliquerait un
 *  mauvais filtre de prix ou d'année est PIRE que pas de lien : il écarterait
 *  en silence les annonces qui comptent, et l'utilisateur nous croirait.
 *  Les filtres sont donc donnés en clair, à régler sur place. */
export function rechercheSauvegardee(
  seg: { marque: string; modele: string; energie: string; annee_mediane?: number | null; km_median?: number | null },
  achatMax: number,
): RechercheSauvegardee {
  const prixMax = plafondRecherche(achatMax);
  const filtres: Filtre[] = [];

  const titre = [seg.marque, seg.modele].filter(Boolean).join(" ").trim();
  if (titre) filtres.push({ champ: "Modèle", valeur: titre });

  const e = normEnergie(seg.energie);
  if (e) filtres.push({ champ: "Carburant", valeur: ENERGIES_LBC[e] });

  if (seg.annee_mediane) {
    filtres.push({
      champ: "Année",
      valeur: `de ${seg.annee_mediane - ECART_ANNEES_CIBLE} à ${seg.annee_mediane + ECART_ANNEES_CIBLE}`,
    });
  }
  if (seg.km_median != null) {
    filtres.push({
      champ: "Kilométrage",
      valeur: `jusqu'à ${seg.km_median + ECART_KM_CIBLE} km`,
    });
  }
  filtres.push({ champ: "Prix maximum", valeur: `${prixMax} €` });

  const url = titre
    ? `https://www.leboncoin.fr/recherche?text=${encodeURIComponent([titre, ENERGIES_LBC[e] ?? ""].filter(Boolean).join(" "))}`
    : null;

  return {
    filtres,
    url,
    note:
      "Le lien ouvre la recherche par texte. Les filtres ci-dessus se règlent " +
      "sur la page : nous ne devinons pas les paramètres d'URL de Leboncoin, " +
      "et nous ne l'interrogeons jamais depuis nos serveurs.",
    prix_max: prixMax,
  };
}

// ── Profil revendeur mémorisé ──────────────────────────────────────────────

export type ProfilRevendeur = {
  region: string;
  ville_revente: string;
  cv: number | null;
  marge_voulue_eur: number | null;
  imprevus_pct_travaux: number | null;
  marge_negociation_pct: number | null;
};

export const PROFIL_VIDE: ProfilRevendeur = {
  region: "",
  ville_revente: "",
  cv: null,
  marge_voulue_eur: null,
  imprevus_pct_travaux: null,
  marge_negociation_pct: null,
};

const borne = (v: unknown, min: number, max: number): number | null => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return n < min ? min : n > max ? max : Math.round(n);
};

/** Nettoie un profil reçu (navigateur ou base). Tout champ hors bornes est
 *  ramené à null plutôt qu'au défaut : un profil à moitié lu ne doit pas se
 *  faire passer pour un profil renseigné. */
export function profilValide(brut: unknown): ProfilRevendeur {
  const o = (brut ?? {}) as Record<string, unknown>;
  return {
    region: String(o.region ?? "").slice(0, 60),
    ville_revente: String(o.ville_revente ?? "").slice(0, 60),
    cv: borne(o.cv, 1, 99),
    marge_voulue_eur: borne(o.marge_voulue_eur, 0, 50_000),
    imprevus_pct_travaux: borne(o.imprevus_pct_travaux, 0, 100),
    marge_negociation_pct: borne(o.marge_negociation_pct, 0, 50),
  };
}

/** Le profil est-il assez renseigné pour afficher les trois chiffres SANS
 *  poser de question ? La région et la puissance fiscale sont les seules
 *  informations que le calcul ne peut pas deviner. */
export function profilComplet(p: ProfilRevendeur): boolean {
  return !!p.region && p.cv != null;
}

/** Applique le profil aux paramètres par défaut. Un champ non renseigné garde
 *  la valeur par défaut — on ne remplace jamais un défaut par un null. */
export function parametresDepuisProfil<T extends Record<string, number>>(
  defauts: T,
  profil: ProfilRevendeur,
): T {
  const out = { ...defauts };
  for (const cle of ["marge_voulue_eur", "imprevus_pct_travaux", "marge_negociation_pct"] as const) {
    const v = profil[cle];
    if (v != null) (out as Record<string, number>)[cle] = v;
  }
  return out;
}
