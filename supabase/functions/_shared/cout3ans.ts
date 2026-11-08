// SPRINT 22 — Coût réel sur 3 ans.
//
// Module PUR, sans import, traduit pour le navigateur par
// `scripts/generer-miroir-revendeur.mjs` (src/data/cout3ans.gen.js) : quand
// l'utilisateur change son kilométrage annuel ou corrige une ligne, tout se
// recalcule sans aller-retour, avec le MÊME code que le serveur.
//
// Ce module ne CHERCHE aucune source : il reçoit des opérations dont la
// source a déjà été tranchée côté serveur (`_shared/cout3ansSources.ts`), et
// il projette. Séparer les deux est ce qui permet le miroir : le choix des
// sources lit `rangSource`, que le navigateur n'a pas à connaître.
//
// ⚠️ CE QUE CE CALCUL N'EST PAS. Ni une valeur du véhicule, ni une
// estimation de ce qu'il coûtera : il additionne le prix demandé, les
// opérations que le plan d'entretien PUBLIÉ rend dues, la carte grise et les
// contrôles techniques obligatoires. Carburant, assurance, pneus et pannes
// imprévues n'y sont pas — la mention le dit, toujours.
//
// ⚠️ UNE LIGNE SANS COÛT ADMIS N'EST JAMAIS CHIFFRÉE « FAUTE DE MIEUX ».
// Elle s'affiche « à chiffrer avec un garage », et le total dit combien de
// lignes il n'a pas pu compter. Un total qui tairait ses trous serait plus
// rassurant que la réalité.

export const KM_AN_DEFAUT = 15_000;
export const HORIZON_ANS = 3;
export const KM_AN_MIN = 1_000;
export const KM_AN_MAX = 80_000;

export const MENTION_COUT_3ANS =
  "Coût prévisible sur 3 ans à partir du prix demandé, du plan d'entretien publié pour ce moteur, " +
  "de la carte grise et des contrôles techniques obligatoires. Hors carburant, assurance, pneus et " +
  "pannes imprévues. Montants indicatifs, à faire confirmer par un garage.";

export const A_CHIFFRER = "à chiffrer avec un garage";

export type SourceCout = {
  /** portante : page officielle/presse/éditoriale ; comparateur : prix moyen
   *  affiché par des garages (opération prévue au plan uniquement) ;
   *  devis : devis validé par l'exploitant ; officiel : relevé public ;
   *  annonce : le chiffre vient de l'annonce ; utilisateur : saisi à l'écran. */
  via: "portante" | "comparateur" | "devis" | "officiel" | "annonce" | "utilisateur";
  libelle: string;
  urls: string[];
};

export type OperationSourcee = {
  operation: string;
  intervalle_km: number | null;
  intervalle_annees: number | null;
  cout_min: number | null;
  cout_max: number | null;
  /** null = aucun coût admis : la ligne sera « à chiffrer avec un garage ». */
  source_cout: SourceCout | null;
  /** La page qui établit que l'opération est due (source portante). */
  urls_echeance: string[];
};

export type TarifCt = {
  min: number;
  max: number;
  n_centres: number;
  maj: string;
  source: string;
};

export type EntreeCout3Ans = {
  prix_eur: number | null;
  kilometrage: number | null;
  /** Âge en années décimales à la date du calcul. */
  age_ans: number | null;
  age_base: "premiere_immatriculation" | "annee_modele" | null;
  /** Opérations dont l'échéance est établie par une source portante. */
  plan: OperationSourcee[];
  /** Dues dès l'achat : échéance passée sans justificatif, ou opération que
   *  l'annonce déclare elle-même non faite. */
  du_des_achat: Array<OperationSourcee & { motif: string }>;
  /** Opérations connues du plan dont l'intervalle n'est pas établi. */
  non_etablies: Array<{ operation: string; motif: string }>;
  ct: TarifCt | null;
  carte_grise: { montant_eur: number; region: string; cv: number; maj: string | null } | null;
  /** Pourquoi la carte grise n'est pas chiffrée, si elle ne l'est pas. */
  carte_grise_motif: string | null;
};

export type ParametresCout3Ans = {
  km_an: number;
  /** Corrections saisies à l'écran, par identifiant de ligne : montant unique. */
  corrections?: Record<string, number>;
};

export type LigneCout3Ans = {
  id: string;
  poste: "prix" | "entretien_du" | "entretien" | "controle_technique" | "carte_grise";
  libelle: string;
  /** Nombre de fois où l'opération tombe dans l'horizon (1 pour le prix). */
  occurrences: number;
  /** Quand : « dès l'achat », « vers 180 000 km », « à 4 ans »… */
  echeance: string;
  min: number | null;
  max: number | null;
  chiffree: boolean;
  source: SourceCout | null;
  /** Ce qui manque, quand la ligne n'est pas chiffrée. */
  motif: string | null;
  corrigee: boolean;
};

export type Cout3Ans = {
  km_an: number;
  horizon_ans: number;
  lignes: LigneCout3Ans[];
  total_min: number;
  total_max: number;
  /** Lignes comptées dans le total. */
  chiffrees: number;
  /** Lignes qui n'ont PAS pu entrer dans le total. */
  non_chiffrees: number;
  /** Opérations dont l'échéance n'a pas pu être établie (hors total). */
  non_etablies: Array<{ operation: string; motif: string }>;
  /** Le total est-il partiel ? (vrai dès qu'une ligne manque) */
  partiel: boolean;
  mention: string;
};

export function kmAnBorne(x: unknown): number {
  const n = Math.round(Number(x));
  if (!Number.isFinite(n) || n <= 0) return KM_AN_DEFAUT;
  return Math.min(KM_AN_MAX, Math.max(KM_AN_MIN, n));
}

const entier = (x: number) => Math.round(x);

/** Groupement des milliers sans `toLocaleString` : son résultat dépend de la
 *  version d'ICU, et ce module tourne à l'identique sous Deno et dans le
 *  navigateur (même raison que dans `revendeur.ts`). */
export function km(n: number): string {
  const s = String(Math.round(n));
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " km";
}

/** Combien de fois une opération périodique tombe dans l'horizon,
 *  STRICTEMENT après la situation actuelle. L'occurrence déjà échue sans
 *  justificatif est une ligne « dès l'achat », pas une de celles-ci.
 *
 *  « Au premier des deux termes atteint » : quand le plan donne un
 *  intervalle en km ET en années, c'est le plus contraignant qui compte. */
export function occurrences(
  kmActuel: number | null,
  kmAn: number,
  age: number | null,
  intervalleKm: number | null,
  intervalleAns: number | null,
  horizon = HORIZON_ANS,
): number | null {
  const iKm = typeof intervalleKm === "number" && intervalleKm > 0 ? intervalleKm : null;
  const iAns = typeof intervalleAns === "number" && intervalleAns > 0 ? intervalleAns : null;
  const nKm = iKm != null && kmActuel != null
    ? Math.floor((kmActuel + kmAn * horizon) / iKm) - Math.floor(kmActuel / iKm)
    : null;
  const nAns = iAns != null && age != null
    ? Math.floor((age + horizon) / iAns + 1e-9) - Math.floor(age / iAns + 1e-9)
    : null;
  if (nKm == null && nAns == null) return null;
  return Math.max(nKm ?? 0, nAns ?? 0);
}

/** La prochaine échéance, en clair. */
function echeancePlan(
  kmActuel: number | null,
  age: number | null,
  intervalleKm: number | null,
  intervalleAns: number | null,
): string {
  const parts: string[] = [];
  if (intervalleKm && kmActuel != null) {
    parts.push(`vers ${km((Math.floor(kmActuel / intervalleKm) + 1) * intervalleKm)}`);
  }
  if (intervalleAns && age != null) {
    const prochain = (Math.floor(age / intervalleAns + 1e-9) + 1) * intervalleAns;
    parts.push(`à ${prochain} ans`);
  }
  return parts.length ? parts.join(" ou ") : "dans les 3 ans";
}

/** Contrôles techniques à la charge de l'ACHETEUR dans l'horizon.
 *
 *  Premier contrôle dans les 6 mois avant le 4e anniversaire de la première
 *  immatriculation, puis tous les 2 ans (service-public.gouv.fr, F2878).
 *  Pour un véhicule de plus de 4 ans, le contrôle de moins de 6 mois remis
 *  à la vente est à la charge du VENDEUR (art. R323-22 du code de la route) :
 *  le suivant tombe 2 ans plus tard. */
export function controlesTechniques(age: number | null, horizon = HORIZON_ANS): { n: number; echeance: string } | null {
  if (age == null || !Number.isFinite(age) || age < 0) return null;
  if (age >= 4) {
    const n = Math.floor(horizon / 2);
    return { n, echeance: n > 0 ? "2 ans après le contrôle remis à la vente" : "aucun dans l'horizon" };
  }
  const dates: number[] = [];
  for (let t = 4; t <= age + horizon; t += 2) if (t > age) dates.push(t);
  return { n: dates.length, echeance: dates.length ? dates.map((t) => `à ${t} ans`).join(", ") : "aucun dans l'horizon" };
}

function ligneOperation(
  id: string,
  poste: "entretien_du" | "entretien",
  op: OperationSourcee,
  n: number,
  echeance: string,
): LigneCout3Ans {
  const chiffree = op.source_cout != null && (op.cout_min != null || op.cout_max != null);
  const lo = op.cout_min ?? op.cout_max;
  const hi = op.cout_max ?? op.cout_min;
  return {
    id,
    poste,
    libelle: op.operation,
    occurrences: n,
    echeance,
    min: chiffree ? entier((lo as number) * n) : null,
    max: chiffree ? entier((hi as number) * n) : null,
    chiffree,
    source: chiffree ? op.source_cout : null,
    motif: chiffree ? null : A_CHIFFRER,
    corrigee: false,
  };
}

/** Identifiant stable d'une ligne : la correction saisie à l'écran doit
 *  retrouver SA ligne après un changement de kilométrage annuel. */
export function idLigne(poste: string, libelle: string): string {
  const s = `${poste}:${libelle}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9:]+/g, "-").replace(/^-+|-+$/g, "");
  return s.slice(0, 80);
}

export function coutTroisAns(e: EntreeCout3Ans, p: ParametresCout3Ans): Cout3Ans {
  const kmAn = kmAnBorne(p.km_an);
  const lignes: LigneCout3Ans[] = [];

  // 1) Prix demandé.
  lignes.push({
    id: "prix",
    poste: "prix",
    libelle: "Prix demandé",
    occurrences: 1,
    echeance: "à l'achat",
    min: e.prix_eur,
    max: e.prix_eur,
    chiffree: e.prix_eur != null,
    source: e.prix_eur != null ? { via: "annonce", libelle: "prix demandé dans l'annonce", urls: [] } : null,
    motif: e.prix_eur != null ? null : "prix absent de l'annonce",
    corrigee: false,
  });

  // 2) Dû dès l'achat.
  for (const op of e.du_des_achat) {
    lignes.push(ligneOperation(idLigne("du", op.operation), "entretien_du", op, 1, `dès l'achat — ${op.motif}`));
  }

  // 3) Échéances du plan dans l'horizon.
  for (const op of e.plan) {
    const n = occurrences(e.kilometrage, kmAn, e.age_ans, op.intervalle_km, op.intervalle_annees);
    if (n == null || n <= 0) continue;
    lignes.push(ligneOperation(
      idLigne("plan", op.operation),
      "entretien",
      op,
      n,
      echeancePlan(e.kilometrage, e.age_ans, op.intervalle_km, op.intervalle_annees),
    ));
  }

  // 4) Contrôles techniques.
  const ct = controlesTechniques(e.age_ans);
  if (ct && ct.n > 0) {
    const chiffree = e.ct != null;
    lignes.push({
      id: "controle-technique",
      poste: "controle_technique",
      libelle: ct.n > 1 ? `Contrôles techniques (${ct.n})` : "Contrôle technique",
      occurrences: ct.n,
      echeance: ct.echeance + (e.age_base === "annee_modele" ? " (déduit de l'année-modèle : à confirmer sur la carte grise)" : ""),
      min: chiffree ? entier(e.ct!.min * ct.n) : null,
      max: chiffree ? entier(e.ct!.max * ct.n) : null,
      chiffree,
      source: chiffree
        ? {
          via: "officiel",
          libelle: `${e.ct!.n_centres} tarifs déclarés par les centres (relevé officiel DGCCRF du ${e.ct!.maj}, du quart le moins cher au quart le plus cher), contre-visite non comprise`,
          urls: [e.ct!.source],
        }
        : null,
      motif: chiffree ? null : A_CHIFFRER,
      corrigee: false,
    });
  } else if (!ct) {
    lignes.push({
      id: "controle-technique",
      poste: "controle_technique",
      libelle: "Contrôle technique",
      occurrences: 0,
      echeance: "âge du véhicule inconnu",
      min: null,
      max: null,
      chiffree: false,
      source: null,
      motif: "date de première immatriculation inconnue",
      corrigee: false,
    });
  }

  // 5) Carte grise.
  if (e.carte_grise) {
    lignes.push({
      id: "carte-grise",
      poste: "carte_grise",
      libelle: "Carte grise",
      occurrences: 1,
      echeance: "à l'achat",
      min: entier(e.carte_grise.montant_eur),
      max: entier(e.carte_grise.montant_eur),
      chiffree: true,
      source: {
        via: "officiel",
        libelle: `${e.carte_grise.cv} CV × tarif régional ${e.carte_grise.region}` +
          (e.carte_grise.maj ? ` (tarifs du ${e.carte_grise.maj})` : "") +
          " — exonération « véhicule propre » non appliquée, à vérifier sur le simulateur officiel",
        urls: ["https://www.service-public.gouv.fr/simulateur/calcul/cout-certificat-immatriculation"],
      },
      motif: null,
      corrigee: false,
    });
  } else {
    lignes.push({
      id: "carte-grise",
      poste: "carte_grise",
      libelle: "Carte grise",
      occurrences: 1,
      echeance: "à l'achat",
      min: null,
      max: null,
      chiffree: false,
      source: null,
      motif: e.carte_grise_motif ?? "indiquez votre région et la puissance fiscale",
      corrigee: false,
    });
  }

  // Corrections saisies à l'écran : elles remplacent la ligne, et le disent.
  const corr = p.corrections ?? {};
  for (const l of lignes) {
    const v = corr[l.id];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      l.min = entier(v);
      l.max = entier(v);
      l.chiffree = true;
      l.corrigee = true;
      l.motif = null;
      l.source = { via: "utilisateur", libelle: "montant saisi par vous", urls: [] };
    }
  }

  let totalMin = 0, totalMax = 0, chiffrees = 0, nonChiffrees = 0;
  for (const l of lignes) {
    if (l.chiffree && l.min != null && l.max != null) {
      totalMin += l.min;
      totalMax += l.max;
      chiffrees++;
    } else {
      nonChiffrees++;
    }
  }

  return {
    km_an: kmAn,
    horizon_ans: HORIZON_ANS,
    lignes,
    total_min: entier(totalMin),
    total_max: entier(totalMax),
    chiffrees,
    non_chiffrees: nonChiffrees,
    non_etablies: e.non_etablies.slice(0, 12),
    partiel: nonChiffrees > 0,
    mention: MENTION_COUT_3ANS,
  };
}

export type Cout3AnsPublic = {
  masque: true;
  km_an: number;
  horizon_ans: number;
  total_min: number;
  total_max: number;
  non_chiffrees: number;
  partiel: boolean;
  nb_lignes_masquees: number;
  mention: string;
};

/** Ce qui sort SANS Pass : le total, et ce qu'il ne compte pas. Les lignes
 *  ne quittent pas le serveur — même construction que `revendeurPublique`. */
export function coutTroisAnsPublic(c: Cout3Ans): Cout3AnsPublic {
  return {
    masque: true,
    km_an: c.km_an,
    horizon_ans: c.horizon_ans,
    total_min: c.total_min,
    total_max: c.total_max,
    non_chiffrees: c.non_chiffrees,
    partiel: c.partiel,
    nb_lignes_masquees: c.lignes.length,
    mention: c.mention,
  };
}
