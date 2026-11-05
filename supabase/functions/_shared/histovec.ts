// SPRINT 13 — Lecture du Certificat de situation administrative détaillé
// (« CSA », le PDF qu'HistoVec produit par le bouton « Imprimer le CSA »).
//
// Module PUR : il prend du TEXTE et rend des faits. Aucun appel réseau, aucune
// IA, aucun stockage. Les règles de verdict qui s'en servent sont fixes.
//
// ⚠️ CE QUE LE CSA NE CONTIENT PAS : kilométrage, contrôles techniques, nombre
// de titulaires en clair, modèle, énergie. Le kilométrage est traité par
// `lectureCt.ts`, pas ici (décision du 3 novembre 2026). Le nombre de
// titulaires se DÉDUIT des opérations d'immatriculation de l'historique.
//
// ⚠️ APPARIEMENT POSITIONNEL. Mesuré sur des CSA produits par le générateur
// officiel : la mise en page à deux colonnes fait sortir les quatre libellés
// d'identification d'affilée, PUIS les quatre valeurs. Une règle
// « libellé : valeur sur la même ligne » ne trouve RIEN. On apparie donc par
// position — et comme une position est une hypothèse, chaque valeur est
// VALIDÉE PAR SON FORMAT avant d'être attribuée. Un format inattendu ne donne
// jamais une attribution approximative : il donne « format non reconnu ».
import { marqueCanonique } from "./marche.ts";
import { BRAND_ALIAS_GROUPS } from "./brandAliases.ts";

// ---------------------------------------------------------------------------
// Marqueurs attendus. Tirés des fixtures générées, pas d'une lecture du code
// source : six libellés administratifs n'apparaissent dans aucun littéral de
// `content.js`.
// ---------------------------------------------------------------------------
export const MARQUEURS_CSA = [
  "Certificat de situation administrative",
  "Identification du véhicule",
] as const;

const LIBELLES_IDENTIFICATION = [
  { cle: "immatriculation", motif: /Num[ée]ro d'immatriculation du v[ée]hicule/i },
  { cle: "premiere_immatriculation", motif: /Date de premi[èe]re immatriculation du v[ée]hicule/i },
  { cle: "vin", motif: /Num[ée]ro VIN du v[ée]hicule/i },
  { cle: "marque", motif: /^Marque\s*:?\s*$/i },
] as const;

/** Section administrative : libellé → clé. Les libellés se replient sur deux
 *  lignes dans le PDF, donc on compare sur le texte REPLIÉ (blancs normalisés). */
const LIBELLES_ADMIN: Array<{ cle: string; motif: RegExp }> = [
  { cle: "reparation_controlee", motif: /Proc[ée]dure de r[ée]paration contr[ôo]l[ée]e/i },
  { cle: "ovei", motif: /Opposition v[ée]hicule [ée]conomiquement irr[ée]parable/i },
  // ⚠️ Le CSA écrit « Véhicule endommagé » là où le rapport web écrit
  // « Procédure de réparation contrôlée » : divergence assumée par la DSR,
  // documentée dans leur code. On reconnaît les deux formulations.
  { cle: "ove", motif: /Opposition v[ée]hicule endommag[ée]/i },
  { cle: "otci", motif: /Opposition au transfert du certificat/i },
  { cle: "saisie", motif: /D[ée]claration valant saisie/i },
  { cle: "gage", motif: /^-?\s*Gage\s*$/i },
  { cle: "suspension", motif: /Immatriculation suspendue/i },
  { cle: "annulation", motif: /Immatriculation annul[ée]e/i },
  { cle: "vol_vehicule", motif: /V[ée]hicule vol[ée]/i },
  { cle: "vol_titre", motif: /Certificat d'immatriculation vol[ée]/i },
  { cle: "perte_titre", motif: /Certificat d'immatriculation perdu/i },
  { cle: "duplicata", motif: /Certificat d'immatriculation duplicata/i },
];

/** Opérations d'immatriculation qui changent le détenteur
 *  (backend/src/constant/historique.js d'HistoVec). */
const OPERATIONS_TITULAIRE = [
  "IMMAT_NORMALE", "IMMAT_NORMALE_PREM_VO",
  "CHANG_TIT_NORMAL", "CHANG_TIT_NORMAL_CVN",
];
/** Passage en location : « changement de locataire ». */
const OPERATIONS_LOCATION = ["CHANG_LOC", "CHANG_LOC_CVN"];

// ---------------------------------------------------------------------------
// Formats. C'est la validation de format qui rend l'appariement positionnel
// honnête : sans elle, une position décalée attribuerait une valeur au mauvais
// champ, en silence.
// ---------------------------------------------------------------------------
/** SIV (AA-123-AA) ou FNI, l'ancien format (123 ABC 75 / 1234 AB 06). */
const RE_PLAQUE = /^(?:[A-Z]{2}-?\d{3}-?[A-Z]{2}|\d{1,4}\s?[A-Z]{2,3}\s?\d{2,3})$/;
const RE_DATE_FR = /^(\d{2})\/(\d{2})\/(\d{4})$/;
/** VIN : 17 caractères, sans I, O ni Q (norme ISO 3779). */
const RE_VIN = /^[A-HJ-NPR-Z0-9]{17}$/;
/** Marque plausible : lettres, chiffres, espaces et tirets, 2 à 24 caractères. */
const RE_MARQUE = /^[A-Z][A-Z0-9 \-.]{1,23}$/;

export const FORMATS_CSA = {
  immatriculation: (v: string) => RE_PLAQUE.test(v.toUpperCase()),
  premiere_immatriculation: (v: string) => dateFrValide(v),
  vin: (v: string) => RE_VIN.test(v.toUpperCase()),
  marque: (v: string) => RE_MARQUE.test(v.toUpperCase()) && marqueConnue(v),
} as const;

function dateFrValide(v: string): boolean {
  const m = v.match(RE_DATE_FR);
  if (!m) return false;
  const [, j, mo, a] = m.map(Number);
  if (mo < 1 || mo > 12 || j < 1 || j > 31) return false;
  if (a < 1900 || a > 2100) return false;
  const d = new Date(Date.UTC(a, mo - 1, j));
  return d.getUTCDate() === j && d.getUTCMonth() === mo - 1;
}

/** Marques réellement connues du projet.
 *
 *  ⚠️ `marqueCanonique` NORMALISE sans valider : elle rend « zzzzpasunemarque »
 *  pour une marque inventée. S'en servir comme contrôle laissait passer
 *  n'importe quelle chaîne à la position « marque » — défaut trouvé par le
 *  test. On s'appuie donc sur la table d'alias, qui est une vraie liste. */
/** Complément à la table d'alias, qui n'existe que pour les marques AYANT des
 *  alias : SMART n'y figurait pas, et un CSA de Smart était donc refusé à la
 *  position « marque ». La liste couvre les marques affichées par le site plus
 *  celles qu'on croise en France. Trop court ici = refuser un vrai document ;
 *  mieux vaut une liste large, le décalage étant déjà écarté par les formats
 *  des autres champs (date, VIN, plaque). */
const MARQUES_COMPLEMENT = [
  "smart", "cupra", "alpine", "abarth", "lancia", "chrysler", "ssangyong",
  "isuzu", "iveco", "man", "daihatsu", "rover", "saab", "lada", "mg",
  "byd", "polestar", "lynk", "ora", "aiways", "seres", "dr", "ineos",
  "maxus", "jaecoo", "omoda", "leapmotor", "xpeng", "nio", "zeekr",
  "ferrari", "lamborghini", "maserati", "bentley", "rolls-royce", "mclaren",
  "aston martin", "lotus", "genesis", "cadillac", "chevrolet", "dodge",
  "subaru", "mitsubishi", "jaguar", "lexus", "infiniti", "acura",
];

const MARQUES_CONNUES: Set<string> = new Set(
  [...BRAND_ALIAS_GROUPS.flat(), ...MARQUES_COMPLEMENT]
    .map((m) => marqueCanonique(m))
    .filter((m) => m !== ""),
);

function marqueConnue(v: string): boolean {
  const c = marqueCanonique(v);
  return c !== "" && MARQUES_CONNUES.has(c);
}

const normaliser = (t: string) => t.replace(/\s+/g, " ").trim();
const sansAccent = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// ---------------------------------------------------------------------------
// Faits retenus. AUCUNE identité : ni nom, ni adresse, ni code postal.
// VIN et plaque sont présents ICI parce que la règle 0 en a besoin — ils sont
// retirés juste après la concordance (`sansIdentifiants`).
// ---------------------------------------------------------------------------
export type FaitsCsa = {
  lisible: boolean;
  motif_illisible: string | null;
  /** Retirés après la concordance. */
  immatriculation: string | null;
  vin: string | null;
  marque: string | null;
  premiere_immatriculation: string | null; // AAAA-MM-JJ
  date_validite: string | null; // AAAA-MM-JJ
  certificat_annule: boolean;
  gage: boolean;
  opposition_otci: boolean;
  saisie: boolean;
  vol_vehicule: boolean;
  vol_titre: boolean;
  /** Procédure « véhicule gravement endommagé ». */
  vge_en_cours: boolean;
  vge_passee: boolean;
  suspension: boolean;
  /** Déduit des opérations d'immatriculation de l'historique. */
  nb_titulaires: number | null;
  ancienne_location: boolean;
  operations: Array<{ date: string | null; code: string }>;
};

const FAITS_VIDES: FaitsCsa = {
  lisible: false,
  motif_illisible: null,
  immatriculation: null,
  vin: null,
  marque: null,
  premiere_immatriculation: null,
  date_validite: null,
  certificat_annule: false,
  gage: false,
  opposition_otci: false,
  saisie: false,
  vol_vehicule: false,
  vol_titre: false,
  vge_en_cours: false,
  vge_passee: false,
  suspension: false,
  nb_titulaires: null,
  ancienne_location: false,
  operations: [],
};

/** Seuil de texte utile : sous ce volume, le document n'a pas de couche texte
 *  exploitable (cas du scan — mesuré : 9 pages d'images rendent 2 caractères). */
export const MIN_CARACTERES = 400;

const NEGATIFS = ["aucune", "aucun", "non"];
const estNegatif = (v: string) => NEGATIFS.includes(sansAccent(normaliser(v)));
const estPositif = (v: string) => sansAccent(normaliser(v)) === "oui";

const iso = (dateFr: string): string | null => {
  const m = dateFr.match(RE_DATE_FR);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

/** Le texte ressemble-t-il à un CSA HistoVec ? */
export function estCsa(texte: string): { ok: boolean; motif: string | null } {
  const t = normaliser(texte);
  if (t.length < MIN_CARACTERES) {
    return {
      ok: false,
      motif:
        "Ce document ne contient pas de texte lisible (c'est probablement une image ou un scan). "
        + "Téléchargez le certificat depuis HistoVec avec le bouton « Imprimer le CSA » plutôt que d'en photographier un.",
    };
  }
  const manquants = MARQUEURS_CSA.filter((m) => !sansAccent(t).includes(sansAccent(m)));
  if (manquants.length > 0) {
    return {
      ok: false,
      motif:
        "Ce document n'est pas un certificat de situation administrative HistoVec. "
        + "Sur histovec.interieur.gouv.fr, utilisez le bouton « Imprimer le CSA ».",
    };
  }
  return { ok: true, motif: null };
}

// ---------------------------------------------------------------------------
// Extraction.
// ---------------------------------------------------------------------------
export function extraireFaitsCsa(texte: string): FaitsCsa {
  const verdict = estCsa(texte);
  if (!verdict.ok) {
    return { ...FAITS_VIDES, operations: [], motif_illisible: verdict.motif };
  }

  const lignes = texte.split("\n").map(normaliser).filter((l) => l.length > 0);
  // ⚠️ `operations: []` EXPLICITE : un spread de FAITS_VIDES copierait la
  // RÉFÉRENCE du tableau, partagée entre tous les appels — chaque lecture
  // ajouterait aux précédentes. Défaut trouvé par le test (5 opérations là où
  // le document en porte 3).
  const faits: FaitsCsa = { ...FAITS_VIDES, lisible: true, operations: [] };

  // ---- Identification : appariement POSITIONNEL validé par format ----------
  // On repère la suite des libellés, puis on lit autant de valeurs qu'il y a
  // de libellés reconnus, dans le même ordre. Chaque valeur doit satisfaire le
  // format de SA position, sinon elle n'est pas attribuée.
  const positions: Array<{ cle: keyof typeof FORMATS_CSA; ligne: number }> = [];
  for (const [i, l] of lignes.entries()) {
    for (const def of LIBELLES_IDENTIFICATION) {
      if (def.motif.test(l)) positions.push({ cle: def.cle as keyof typeof FORMATS_CSA, ligne: i });
    }
  }
  if (positions.length > 0) {
    const dernierLibelle = Math.max(...positions.map((p) => p.ligne));
    const candidats = lignes.slice(dernierLibelle + 1, dernierLibelle + 1 + positions.length);
    const ordre = positions.sort((a, b) => a.ligne - b.ligne).map((p) => p.cle);
    for (const [i, cle] of ordre.entries()) {
      const valeur = candidats[i];
      if (valeur == null) continue;
      if (!FORMATS_CSA[cle](valeur)) continue; // position douteuse → rien
      if (cle === "premiere_immatriculation") faits.premiere_immatriculation = iso(valeur);
      else if (cle === "marque") faits.marque = normaliser(valeur).toUpperCase();
      else if (cle === "vin") faits.vin = normaliser(valeur).toUpperCase();
      else faits.immatriculation = normaliser(valeur).toUpperCase();
    }
  }

  // ---- Date de validité (format ISO dans le paragraphe d'en-tête) ----------
  const val = texte.match(/au plus tard jusqu'au\s+(\d{4}-\d{2}-\d{2})/i);
  if (val) faits.date_validite = val[1];

  // ---- Certificat annulé : la section détaillée disparaît -------------------
  if (/certificat demand[ée] a [ée]t[ée] annul[ée]/i.test(texte)) {
    faits.certificat_annule = true;
  }

  // ---- Section administrative : libellé (replié) puis valeur ---------------
  const admin = lireSectionAdmin(lignes);
  faits.gage = admin.gage === true;
  faits.opposition_otci = admin.otci === true;
  faits.saisie = admin.saisie === true;
  faits.vol_vehicule = admin.vol_vehicule === true;
  faits.vol_titre = admin.vol_titre === true;
  faits.suspension = admin.suspension === true;
  if (admin.annulation === true) faits.certificat_annule = true;
  // La procédure est EN COURS quand une opposition OVE/OVEI est active ;
  // « réparation contrôlée = oui » sans opposition active signale une
  // procédure PASSÉE, donc levée après contrôle de la réparation.
  const oppositionVge = admin.ove === true || admin.ovei === true;
  faits.vge_en_cours = oppositionVge;
  faits.vge_passee = admin.reparation_controlee === true && !oppositionVge;

  // ---- Historique : opérations d'immatriculation ---------------------------
  for (const l of lignes) {
    const m = l.match(/^(\d{2}\/\d{2}\/\d{4})\s+([A-Z][A-Z_]{3,40})$/);
    if (m) faits.operations.push({ date: iso(m[1]), code: m[2] });
  }
  if (faits.operations.length > 0) {
    const n = faits.operations.filter((o) => OPERATIONS_TITULAIRE.includes(o.code)).length;
    faits.nb_titulaires = n > 0 ? n : null;
    faits.ancienne_location = faits.operations.some((o) => OPERATIONS_LOCATION.includes(o.code));
  }

  return faits;
}

/** Lit la section administrative : pour chaque libellé reconnu, la valeur est
 *  la première ligne suivante qui est un oui/non/aucun(e) ou un détail daté.
 *  Un libellé sans valeur (cas d'« Immatriculation annulée ») reste indéfini. */
function lireSectionAdmin(lignes: string[]): Record<string, boolean | undefined> {
  const out: Record<string, boolean | undefined> = {};
  for (let i = 0; i < lignes.length; i++) {
    // Un libellé peut tenir sur deux lignes : on tente la ligne seule, puis
    // la ligne recollée à la suivante.
    const seule = lignes[i];
    const repliee = normaliser(`${lignes[i]} ${lignes[i + 1] ?? ""}`);
    const def = LIBELLES_ADMIN.find((d) => d.motif.test(seule)) ??
      LIBELLES_ADMIN.find((d) => d.motif.test(repliee));
    if (!def || out[def.cle] !== undefined) continue;

    // La valeur suit, éventuellement après la seconde moitié du libellé.
    for (let j = i + 1; j < Math.min(i + 5, lignes.length); j++) {
      const v = lignes[j];
      if (LIBELLES_ADMIN.some((d) => d.motif.test(v))) break; // libellé suivant
      if (estNegatif(v)) { out[def.cle] = false; break; }
      if (estPositif(v)) { out[def.cle] = true; break; }
      // Un détail (date, créancier, « PV(s) en attente ») vaut présence.
      if (/^-?\s*(Date|Nom|PV)/i.test(v) || /\d{2}\/\d{2}\/\d{4}/.test(v)) {
        out[def.cle] = true;
        break;
      }
    }
  }
  return out;
}

/** Retire VIN et plaque des faits, APRÈS la concordance. Rien d'autre ne doit
 *  jamais sortir de la mémoire avec ces deux champs. */
export function sansIdentifiants(f: FaitsCsa): FaitsCsa {
  return { ...f, vin: null, immatriculation: null };
}

// ---------------------------------------------------------------------------
// RÈGLE 0 — CONCORDANCE. Exécutée AVANT le retrait du VIN et de la plaque.
//
// Un rapport qui ne décrit pas le véhicule de l'annonce ne prouve rien, et
// pire : il rassurerait à tort. La concordance porte sur marque, date de
// première immatriculation, VIN et plaque ; modèle et énergie ne sont pas dans
// le CSA et ne sont comparés que s'ils sont fournis par ailleurs.
// ---------------------------------------------------------------------------
export type VehiculeAnnonce = {
  marque?: string | null;
  modele?: string | null;
  energie?: string | null;
  annee?: number | null;
  /** Première immatriculation si l'annonce la donne (AAAA-MM-JJ). */
  premiere_immatriculation?: string | null;
  /** VIN et plaque UNIQUEMENT si l'annonce les montre. */
  vin?: string | null;
  immatriculation?: string | null;
  /** SPRINT 20 — verdict de comparaison des VIN, DÉJÀ CALCULÉ par l'appelant.
   *
   *  ⚠️ Pourquoi un booléen et pas le VIN de l'annonce : celui-ci n'est jamais
   *  conservé en clair (le dossier est public), seulement sous forme
   *  d'empreinte salée. Comparer deux empreintes exige le sel, donc un secret
   *  et un appel asynchrone — ce module doit rester PUR et synchrone pour être
   *  testable hors ligne. L'appelant compare, ce module conclut.
   *
   *  ⚠️ Depuis le sprint 13, `vin` était TOUJOURS nul : rien n'extrayait le VIN
   *  d'une annonce. La comparaison existait et ne comparait rien. */
  vin_concorde?: boolean | null;
};

export type Concordance = {
  concorde: boolean;
  /** Champs réellement comparés (les deux côtés renseignés). */
  compares: string[];
  discordances: string[];
};

const memeJour = (a: string, b: string) => a.slice(0, 10) === b.slice(0, 10);

export function verifierConcordance(f: FaitsCsa, v: VehiculeAnnonce): Concordance {
  const compares: string[] = [];
  const discordances: string[] = [];

  if (f.marque && v.marque) {
    compares.push("marque");
    if (marqueCanonique(f.marque) !== marqueCanonique(v.marque)) {
      discordances.push(`marque : ${f.marque} sur le certificat, ${v.marque} dans l'annonce`);
    }
  }
  if (f.premiere_immatriculation && v.premiere_immatriculation) {
    compares.push("premiere_immatriculation");
    if (!memeJour(f.premiere_immatriculation, v.premiere_immatriculation)) {
      discordances.push("date de première immatriculation différente de celle de l'annonce");
    }
  } else if (f.premiere_immatriculation && v.annee) {
    // À défaut de date exacte, l'ANNÉE doit au moins coïncider. Tolérance d'un
    // an : un véhicule immatriculé en décembre est souvent annoncé en millésime
    // suivant, et l'inverse existe aussi.
    compares.push("annee");
    const anneeCsa = Number(f.premiere_immatriculation.slice(0, 4));
    if (Number.isFinite(anneeCsa) && Math.abs(anneeCsa - v.annee) > 1) {
      discordances.push(
        `année : première immatriculation en ${anneeCsa} sur le certificat, ${v.annee} dans l'annonce`,
      );
    }
  }
  if (typeof v.vin_concorde === "boolean") {
    // Verdict calculé en amont sur des empreintes salées : il fait foi, et il
    // n'exige pas que le VIN de l'annonce ait traversé le dossier en clair.
    compares.push("vin");
    if (!v.vin_concorde) discordances.push("le VIN du certificat n'est pas celui de l'annonce");
  } else if (f.vin && v.vin) {
    compares.push("vin");
    if (f.vin.toUpperCase() !== String(v.vin).toUpperCase().replace(/\s/g, "")) {
      discordances.push("le VIN du certificat n'est pas celui de l'annonce");
    }
  }
  if (f.immatriculation && v.immatriculation) {
    compares.push("immatriculation");
    const n = (x: string) => x.toUpperCase().replace(/[\s-]/g, "");
    if (n(f.immatriculation) !== n(String(v.immatriculation))) {
      discordances.push("l'immatriculation du certificat n'est pas celle de l'annonce");
    }
  }
  // Modèle et énergie : absents du CSA, comparés seulement si une autre source
  // les a fournis (lecture web, saisie). Jamais exigés.
  return { concorde: discordances.length === 0, compares, discordances };
}

// ---------------------------------------------------------------------------
// LES RÈGLES DE VERDICT — fixes, sans IA, quelle que soit la voie de lecture.
// ---------------------------------------------------------------------------
export type SignalHistovec = {
  cle: string;
  niveau: "rouge" | "orange" | "avertissement";
  texte: string;
  /** Un signal rouge est TOUJOURS montré, même sans Pass : on ne cache pas un
   *  danger derrière un paiement. */
  toujours_visible: boolean;
};

export type FaitsHistovecBareme = {
  /** Vol, gage, opposition ou saisie : rien ne doit être payé avant levée. */
  histovec_opposition: boolean;
  /** Procédure « véhicule gravement endommagé » non levée. */
  histovec_vge_en_cours: boolean;
  /** Rapport ne décrivant pas ce véhicule. */
  histovec_discordant: boolean;
};

export const JOURS_VALIDITE_CSA = 15;

export function reglesHistovec(
  f: FaitsCsa,
  v: VehiculeAnnonce,
  concordance: Concordance,
  aujourdhui: Date,
): { signaux: SignalHistovec[]; faits: FaitsHistovecBareme } {
  const signaux: SignalHistovec[] = [];

  // ---- Règle 0 : concordance -----------------------------------------------
  if (!concordance.concorde) {
    signaux.push({
      cle: "discordance",
      niveau: "rouge",
      toujours_visible: true,
      texte: `Ce rapport ne correspond pas à ce véhicule — ${
        concordance.discordances.join(" ; ")
      }. Demandez au vendeur le certificat du véhicule qu'il met en vente.`,
    });
    // Un rapport discordant ne dit rien du véhicule : on n'en tire AUCUN autre
    // signal, sinon on prêterait à cette voiture l'historique d'une autre.
    return {
      signaux,
      faits: { histovec_opposition: false, histovec_vge_en_cours: false, histovec_discordant: true },
    };
  }

  // ---- Règle : vol, gage, opposition, saisie -------------------------------
  const empechements: string[] = [];
  if (f.vol_vehicule) empechements.push("le véhicule est déclaré volé");
  if (f.gage) empechements.push("un gage est inscrit");
  if (f.opposition_otci) empechements.push("une opposition au transfert de la carte grise est inscrite");
  if (f.saisie) empechements.push("une déclaration valant saisie est inscrite");
  if (f.vol_titre) empechements.push("le certificat d'immatriculation est déclaré volé");
  if (empechements.length > 0) {
    signaux.push({
      cle: "opposition",
      niveau: "rouge",
      toujours_visible: true,
      texte: `${
        empechements.join(", ")
      } : ne rien payer avant levée. La carte grise ne pourra pas être mise à votre nom tant que la situation n'est pas levée.`,
    });
  }

  // ---- Règle : véhicule gravement endommagé --------------------------------
  if (f.vge_en_cours) {
    signaux.push({
      cle: "vge_en_cours",
      niveau: "rouge",
      toujours_visible: true,
      texte:
        "Procédure « véhicule gravement endommagé » NON LEVÉE : le véhicule n'est pas autorisé à circuler tant qu'un expert n'a pas validé la réparation. Ne rien payer avant la levée.",
    });
  } else if (f.vge_passee) {
    signaux.push({
      cle: "vge_levee",
      niveau: "orange",
      toujours_visible: false,
      texte:
        "Le véhicule a fait l'objet d'une procédure « véhicule gravement endommagé », aujourd'hui LEVÉE : la réparation a été contrôlée par un expert. Demandez le rapport de contrôle et les factures de réparation.",
    });
  }

  // ---- Règle : déclaration du vendeur contredite ---------------------------
  const texteAnnonce = `${v.modele ?? ""}`;
  if (f.nb_titulaires != null && f.nb_titulaires > 1) {
    signaux.push({
      cle: "titulaires",
      niveau: "orange",
      toujours_visible: false,
      texte: `Le certificat recense ${f.nb_titulaires} détenteurs successifs${
        texteAnnonce ? "" : ""
      } : une annonce « première main » serait inexacte.`,
    });
  }
  if (f.vge_passee || f.vge_en_cours) {
    signaux.push({
      cle: "accident",
      niveau: "orange",
      toujours_visible: false,
      texte:
        "Une procédure pour véhicule endommagé figure au certificat : une annonce « jamais accidentée » serait inexacte.",
    });
  }

  // ---- Règle : ancien véhicule de location --------------------------------
  if (f.ancienne_location) {
    signaux.push({
      cle: "location",
      niveau: "orange",
      toujours_visible: false,
      texte:
        "Le certificat porte un changement de locataire : ce véhicule a été loué. Un véhicule de location a souvent plus de conducteurs et un usage plus dur qu'une voiture de particulier.",
    });
  }

  // ---- Règle : certificat trop ancien --------------------------------------
  if (f.date_validite) {
    const fin = new Date(`${f.date_validite}T00:00:00Z`);
    if (!Number.isNaN(fin.getTime()) && aujourdhui.getTime() > fin.getTime()) {
      signaux.push({
        cle: "perime",
        niveau: "avertissement",
        toujours_visible: false,
        texte: `Ce certificat n'est plus valable (il l'était jusqu'au ${
          f.date_validite.split("-").reverse().join("/")
        }). Un certificat de situation administrative doit avoir moins de ${JOURS_VALIDITE_CSA} jours à la vente : demandez-en un nouveau le jour de la signature.`,
      });
    }
  }

  if (f.certificat_annule) {
    signaux.push({
      cle: "annule",
      niveau: "rouge",
      toujours_visible: true,
      texte:
        "Le certificat d'immatriculation de ce véhicule a été ANNULÉ : la vente ne peut pas se faire en l'état. Demandez au vendeur de régulariser avant tout paiement.",
    });
  }

  return {
    signaux,
    faits: {
      histovec_opposition: empechements.length > 0 || f.certificat_annule,
      histovec_vge_en_cours: f.vge_en_cours,
      histovec_discordant: false,
    },
  };
}

/** Projection PUBLIQUE : sans Pass, seuls les signaux rouges sont rendus.
 *  Miroir de `_histovec_publique` en SQL — un masquage côté client ne masque
 *  rien (leçon du sprint 7). */
export function histovecPublique(
  r: { signaux: SignalHistovec[] } | null,
): { signaux: SignalHistovec[]; masque: boolean; nb_masques: number } | null {
  if (!r) return null;
  const rouges = r.signaux.filter((s) => s.toujours_visible);
  return {
    signaux: rouges,
    masque: true,
    nb_masques: r.signaux.length - rouges.length,
  };
}
