// SPRINT 9 — PRIX DE MARCHÉ : agrégats uniquement, fonctions PURES.
//
// Pourquoi ce module existe : la règle « aucune ligne d'annonce conservée »
// était écrite au sprint 4B mais son code n'a jamais été mergé (la migration
// `20261028150000` avait créé `comparables_agregats`, vidé `comparables_prix`
// et déclaré que `score` écrirait dans les agrégats — ce dernier a continué
// d'insérer des lignes brutes). Ce module est le successeur de
// `comparables.ts` (branche sprint4b) et devient la SEULE voie d'écriture.
//
// Principe : chaque prix relevé est fondu dans un histogramme par segment
// (marque, modèle, génération, motorisation, cylindrée, boîte, année, tranche
// de km, région, mois → tranche de prix → effectif). Les histogrammes se
// FUSIONNENT par simple somme, ce qui permet de recalculer médiane / P25 / P75
// / effectif sur n'importe quelle combinaison de segments — impossible avec
// des quantiles stockés. Aucun titre, aucune URL, aucun lien vers une analyse.
//
// Testé hors ligne : tests/marche.test.mjs (chaîné dans `npm run eval`).

import { BRAND_ALIAS_GROUPS, expandBrand, normalizeBrand } from "./brandAliases.ts";

export const TRANCHE_KM = 20_000; // largeur des tranches de kilométrage
export const TRANCHE_PRIX = 250; // largeur des tranches de prix (± 125 €)
export const KM_INCONNU = -1;
export const ANNEE_INCONNUE = 0;
export const PRIX_MIN = 200;
export const PRIX_MAX = 1_000_000;
/** Seuil de publication d'une fourchette : en dessous, « non évalué ». */
export const SEUIL_FOURCHETTE = 15;
/** Fenêtre de relevé : une fourchette ne mélange pas des prix trop anciens. */
export const MOIS_FENETRE = 3;

export type SegmentMarche = {
  marque_norm: string;
  modele_norm: string;
  generation_norm: string; // '' si inconnue
  techno: string; // jeton de motorisation ('' si inconnu)
  cyl: string; // cylindrée « 1.2 » ('' si inconnue)
  boite: string; // 'manuelle' | 'automatique' | '' si inconnue
  annee: number; // ANNEE_INCONNUE si absente
  km_tranche: number; // KM_INCONNU si absent
  region: string; // code de région ('' si inconnue)
  mois: string; // 'YYYY-MM' (mois de relevé)
  prix_tranche: number; // floor(prix / 250) * 250
};

/** Écriture CANONIQUE d'une marque (premier membre de son groupe d'alias) :
 *  « VW » → « volkswagen », « Mercedes-Benz » → « mercedes ». À utiliser à
 *  l'écriture ET à la lecture, sans quoi un modèle se scinde en deux segments
 *  qui n'atteignent jamais le seuil. */
export const marqueCanonique = (m: unknown): string => {
  const n = normalizeBrand(String(m ?? ""));
  if (!n) return "";
  return expandBrand(n)[0] ?? n;
};

export const normaliserNom = (s: unknown): string =>
  String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ").trim();

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

// Boîte : seuls deux états sont exploitables sur un marché d'occasion
// (manuelle / automatique au sens large, DSG - EDC - EAT - CVT inclus). Le
// CODE de boîte n'est JAMAIS deviné ici — c'est une règle du projet, et il ne
// sert pas à segmenter un prix.
const BOITE_AUTO_RE =
  /\bauto(matique|matic)?\b|\bbva\b|\bdsg\b|\bs[- ]?tronic\b|\btiptronic\b|\bedc\b|\beat\d?\b|\bcvt\b|\bpdk\b|\bdct\b|\bzf\b|\bmulti(drive|tronic)\b|\brobotis[ée]e?\b|\bsequentielle?\b/;
const BOITE_MANU_RE = /\bmanuelle?\b|\bbvm\d?\b|\bmecanique\b|\bmt\b/;

/** 'manuelle' | 'automatique' | '' (jamais déduite d'autre chose que du mot). */
export function boiteDe(texte: unknown): string {
  const t = ` ${normaliserNom(texte)} `;
  if (BOITE_AUTO_RE.test(t)) return "automatique";
  if (BOITE_MANU_RE.test(t)) return "manuelle";
  return "";
}

// ---------------------------------------------------------------------------
// Génération : jamais inventée. On ne retient que ce qui est ÉCRIT dans le
// libellé (chiffre romain « III », « phase 2 », code de caisse « W177 »).
// ---------------------------------------------------------------------------
const ROMAIN_RE = /\b(i{1,3}|iv|v|vi{1,3}|ix|x)\b/;
const PHASE_RE = /\bphase\s?([12])\b/;
const CAISSE_RE = /\b([a-z]{1,2}\d{2,3})\b/; // W177, F30, 8V, MK7…

export function generationDe(texte: unknown): string {
  const t = normaliserNom(texte);
  const phase = t.match(PHASE_RE);
  if (phase) return `phase${phase[1]}`;
  const romain = t.match(ROMAIN_RE);
  if (romain) return romain[1];
  const caisse = t.match(CAISSE_RE);
  if (caisse) return caisse[1];
  return "";
}

// ---------------------------------------------------------------------------
// Région : dérivée du CODE POSTAL uniquement. Un nom de ville seul ne donne
// jamais de région (il faudrait un référentiel que nous n'avons pas) : la
// région reste alors inconnue. Imprécision assumée et documentée : le préfixe
// d'un code postal ne coïncide pas toujours avec le département (communes
// limitrophes). La région ne sert QU'À segmenter des prix agrégés ; elle n'est
// jamais affichée comme une affirmation sur une annonce précise.
// ---------------------------------------------------------------------------
const REGIONS: Record<string, string[]> = {
  "auvergne-rhone-alpes": ["01", "03", "07", "15", "26", "38", "42", "43", "63", "69", "73", "74"],
  "bourgogne-franche-comte": ["21", "25", "39", "58", "70", "71", "89", "90"],
  "bretagne": ["22", "29", "35", "56"],
  "centre-val-de-loire": ["18", "28", "36", "37", "41", "45"],
  "corse": ["2a", "2b"],
  "grand-est": ["08", "10", "51", "52", "54", "55", "57", "67", "68", "88"],
  "hauts-de-france": ["02", "59", "60", "62", "80"],
  "ile-de-france": ["75", "77", "78", "91", "92", "93", "94", "95"],
  "normandie": ["14", "27", "50", "61", "76"],
  "nouvelle-aquitaine": ["16", "17", "19", "23", "24", "33", "40", "47", "64", "79", "86", "87"],
  "occitanie": ["09", "11", "12", "30", "31", "32", "34", "46", "48", "65", "66", "81", "82"],
  "pays-de-la-loire": ["44", "49", "53", "72", "85"],
  "provence-alpes-cote-d-azur": ["04", "05", "06", "13", "83", "84"],
  "guadeloupe": ["971"],
  "martinique": ["972"],
  "guyane": ["973"],
  "la-reunion": ["974"],
  "mayotte": ["976"],
};

const DEPT_VERS_REGION: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const [region, depts] of Object.entries(REGIONS)) for (const d of depts) m[d] = region;
  return m;
})();

/** Département depuis un code postal français à 5 chiffres ('' si indécidable). */
export function departementDe(codePostal: unknown): string {
  const cp = String(codePostal ?? "").replace(/\D/g, "");
  if (cp.length !== 5) return "";
  // Outre-mer et collectivités : département sur 3 chiffres.
  if (cp.startsWith("97") || cp.startsWith("98")) return cp.slice(0, 3);
  // Corse : 200xx/201xx = Corse-du-Sud (2A), 202xx-206xx = Haute-Corse (2B).
  if (cp.startsWith("20")) {
    const t = Number(cp.slice(0, 3));
    if (t === 200 || t === 201) return "2a";
    if (t >= 202 && t <= 206) return "2b";
    return "";
  }
  const d = cp.slice(0, 2);
  return /^\d\d$/.test(d) && d !== "00" ? d : "";
}

/** Code de région depuis un code postal ('' si inconnue ou hors régions). */
export function regionDe(codePostal: unknown): string {
  return DEPT_VERS_REGION[departementDe(codePostal)] ?? "";
}

export const LIBELLES_REGION: Record<string, string> = {
  "auvergne-rhone-alpes": "Auvergne-Rhône-Alpes",
  "bourgogne-franche-comte": "Bourgogne-Franche-Comté",
  "bretagne": "Bretagne",
  "centre-val-de-loire": "Centre-Val de Loire",
  "corse": "Corse",
  "grand-est": "Grand Est",
  "hauts-de-france": "Hauts-de-France",
  "ile-de-france": "Île-de-France",
  "normandie": "Normandie",
  "nouvelle-aquitaine": "Nouvelle-Aquitaine",
  "occitanie": "Occitanie",
  "pays-de-la-loire": "Pays de la Loire",
  "provence-alpes-cote-d-azur": "Provence-Alpes-Côte d'Azur",
  "guadeloupe": "Guadeloupe",
  "martinique": "Martinique",
  "guyane": "Guyane",
  "la-reunion": "La Réunion",
  "mayotte": "Mayotte",
};

export const trancheKm = (km: number | null | undefined): number =>
  km != null && Number.isFinite(km) && km >= 0 ? Math.floor(km / TRANCHE_KM) : KM_INCONNU;

export const tranchePrix = (prix: number): number => Math.floor(prix / TRANCHE_PRIX) * TRANCHE_PRIX;

/** Milieu d'une tranche de km, en km (sert à la pente kilométrique). */
export const milieuTrancheKm = (tranche: number): number => tranche * TRANCHE_KM + TRANCHE_KM / 2;

export const moisDe = (d: Date): string =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

/** Les clés de mois couvrant la fenêtre de relevé (mois courant inclus). */
export function moisRecents(maintenant: Date, n = MOIS_FENETRE): string[] {
  const out: string[] = [];
  const d = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), 1));
  for (let i = 0; i < n; i++) {
    out.push(moisDe(d));
    d.setUTCMonth(d.getUTCMonth() - 1);
  }
  return out;
}

// ---------------------------------------------------------------------------
// MODÈLE CANONIQUE — une seule écriture par modèle, partagée par toutes les
// voies d'écriture et de lecture.
//
// Le problème concret : l'identification d'une annonce rend « Clio IV », une
// page de résultats affiche « Clio IV 1.5 dCi 90 Business », un libellé de
// `famillesMoteur` dit « Clio III/IV ». Trois écritures, trois segments,
// aucun n'atteint le seuil de 15 : la fourchette n'apparaît jamais. Tout
// passe donc par cette fonction, à l'écriture comme à la lecture.
//
// Deux opérations, dans cet ordre :
//  1. retirer les marqueurs de GÉNÉRATION (chiffres romains, « phase 2 »,
//     « Mk4 », codes de caisse, chiffre arabe de génération) ;
//  2. s'arrêter au premier mot TECHNIQUE (cylindrée, motorisation, carburant,
//     boîte, désignation de puissance) — ce qui suit décrit le moteur, pas le
//     modèle.
//
// Ce qui est VOLONTAIREMENT conservé : les déclinaisons qui sont de vrais
// modèles (« Santa Fe », « C5 Aircross », « Discovery Sport ») et les
// finitions distinctes (« 308 GT », « Fiesta ST », « Sandero Stepway »). Elles
// forment leur propre segment : mieux vaut deux segments justes — dont l'un
// n'atteindra peut-être jamais le seuil — qu'un segment unique qui publierait
// le prix d'une 308 de base sous l'étiquette d'une 308 GT.
// ---------------------------------------------------------------------------

const ROMAINS = new Set(["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"]);
/** Code de caisse : F30, W177, 8V, B9, E210, R56, D (Corsa D/E)… */
const CODE_CAISSE_RE = /^(?:[a-z]{1,2}\d{1,3}|\d{1,2}[a-z]|[a-z])$/;
/** Modèles dont le deuxième mot fait partie du nom (Classe A, Série 3). */
const MODELES_DEUX_MOTS = new Set(["classe", "class", "serie", "series"]);
/** Mots de carburant, de boîte et de transmission : jamais un modèle. */
const MOT_TECHNIQUE = new Set([
  "diesel", "essence", "gpl", "gnv", "hybride", "hybrid", "electrique", "ev",
  "bva", "bvm", "dsg", "tronic", "stronic", "edc", "cvt", "tiptronic", "pdk",
  "dct", "manuelle", "manuel", "automatique", "auto", "robotisee", "sequentielle",
  "quattro", "xdrive", "4matic", "awd", "4x4", "4wd", "bluetec", "ch", "kw",
  "cv", "vvt", "ecoboost", "ecoblue", "multijet", "jtd", "cdti", "cdi", "blue",
]);
/** Nombre de mots de modèle au-delà duquel on s'arrête, par prudence. */
const MAX_MOTS_MODELE = 3;

const estGroupeRomain = (tok: string) => tok.split("/").every((part) => ROMAINS.has(part));
const estGroupeCaisse = (tok: string) => {
  const parts = tok.split("/");
  if (!parts.every((part) => CODE_CAISSE_RE.test(part))) return false;
  // Une lettre SEULE n'est jamais une génération : « Mercedes Classe A » et
  // « Mini Cooper S » gardent leur lettre. En groupe (« Corsa D/E »), si.
  if (parts.length === 1 && !/\d/.test(parts[0])) return false;
  return true;
};

/** Retire les marqueurs de génération d'une partie « modèle » normalisée. */
export function sansGeneration(modele: string): string {
  let toks = modele.replace(/\bphase\s?([12])\b/g, " ").replace(/\bmk\s?\d\b/g, " ")
    .split(/\s+/).filter(Boolean);
  toks = toks.filter((t) => !estGroupeRomain(t));
  // Code de caisse EN FIN de libellé seulement, et jamais s'il est tout ce qui
  // reste (« C3/C4 » a la forme d'un code de caisse : c'est le modèle).
  while (toks.length > 1 && estGroupeCaisse(toks[toks.length - 1])) toks.pop();
  // Code à deux lettres (Audi A1 GB) : seulement derrière un modèle « A1 »/« Q3 ».
  if (toks.length === 2 && /^[a-z]{2}$/.test(toks[1]) && /^[a-z]\d+$/.test(toks[0])) toks.pop();
  // Chiffre arabe de génération (« Golf 7 », « Clio 5 ») : un chiffre SEUL qui
  // n'est pas le premier mot. Exception : « Série 3 », « Classe 3 » — là, le
  // chiffre EST le modèle. « DS 7 Crossback » garde son 7, il est premier.
  toks = toks.filter((t, i) =>
    !(i > 0 && /^\d$/.test(t) && !MODELES_DEUX_MOTS.has(toks[i - 1]))
  );
  return toks.join(" ");
}

/** Ce mot décrit-il le moteur plutôt que le modèle ? (position > 0) */
function estTechnique(tok: string, position: number): boolean {
  if (CYL_RE.test(tok) || TECHNO_RE.test(tok)) return true;
  if (MOT_TECHNIQUE.has(tok)) return true;
  if (position === 0) return false;
  // Désignation de puissance ou de moteur après le nom du modèle :
  // « Classe A 180 », « Série 3 320d », « A3 35 TDI », « Discovery 2.0 TD4 ».
  if (/^\d{2,4}$/.test(tok)) return true;
  if (/\d/.test(tok) && /[a-z]/.test(tok)) return true;
  return false;
}

/** Écriture CANONIQUE d'un modèle ('' si rien d'exploitable). */
export function modeleCanonique(modele: unknown): string {
  const toks = sansGeneration(normaliserNom(modele)).split(/\s+/).filter(Boolean);
  if (toks.length === 0) return "";
  // Un premier mot qui n'est qu'une motorisation ou une cylindrée n'est pas un
  // modèle : mieux vaut ne rien écrire que polluer un segment.
  if (estTechnique(toks[0], 0)) return "";
  const garde: string[] = [toks[0]];
  let i = 1;
  // « Classe A », « Série 3 » : le deuxième mot fait partie du nom, même
  // quand c'est une lettre ou un chiffre isolé.
  if (MODELES_DEUX_MOTS.has(toks[0]) && toks[1]) {
    garde.push(toks[1]);
    i = 2;
  }
  for (; i < toks.length && garde.length < MAX_MOTS_MODELE; i++) {
    if (estTechnique(toks[i], i)) break;
    garde.push(toks[i]);
  }
  return garde.join(" ");
}

export type ReleveMarche = {
  marque: string;
  modele: string;
  /** Libellé libre portant motorisation / cylindrée / boîte / génération. */
  libelle?: string | null;
  carburant?: string | null;
  boite?: string | null;
  annee?: number | null;
  km?: number | null;
  prix: number;
  code_postal?: string | null;
  date?: Date;
};

/** Segment d'agrégation d'un relevé (null si prix ou véhicule inexploitable). */
export function segmentDe(c: ReleveMarche): SegmentMarche | null {
  if (!Number.isFinite(c.prix) || c.prix < PRIX_MIN || c.prix > PRIX_MAX) return null;
  // Marque passée par la table d'alias : « VW » et « Volkswagen » doivent
  // tomber dans le MÊME seau, sinon un modèle se retrouve coupé en deux
  // segments qui n'atteignent jamais le seuil (même piège que les fiches
  // moteur dédoublées « Mercedes » / « Mercedes-Benz »).
  const marque_norm = marqueCanonique(c.marque);
  // Modèle canonisé À L'ÉCRITURE : « Clio IV », « Clio » et « Clio III/IV »
  // tombent dans le même segment (sans quoi aucun n'atteindrait le seuil).
  const modele_norm = modeleCanonique(c.modele);
  if (!marque_norm || !modele_norm) return null;
  // Le libellé porte la motorisation ; le carburant seul ne donne pas de jeton
  // techno (« diesel » n'est pas « bluehdi ») mais complète la recherche.
  const libelle = `${c.libelle ?? ""} ${c.carburant ?? ""}`;
  const { techno, cyl } = technoDe(libelle);
  return {
    marque_norm,
    modele_norm,
    generation_norm: generationDe(c.libelle ?? ""),
    techno,
    cyl,
    boite: boiteDe(`${c.boite ?? ""} ${c.libelle ?? ""}`),
    annee: c.annee != null && c.annee > 1980 && c.annee < 2100 ? Math.round(c.annee) : ANNEE_INCONNUE,
    km_tranche: trancheKm(c.km ?? null),
    region: regionDe(c.code_postal ?? ""),
    mois: moisDe(c.date ?? new Date()),
    prix_tranche: tranchePrix(c.prix),
  };
}

/** Fond une liste de relevés en lignes d'agrégat prêtes pour `agreger_marche`
 *  (clés fusionnées : un même segment n'apparaît qu'une fois, avec son effectif). */
export function fondreReleves(releves: ReleveMarche[]): Array<SegmentMarche & { n: number }> {
  const parCle = new Map<string, SegmentMarche & { n: number }>();
  for (const r of releves) {
    const s = segmentDe(r);
    if (!s) continue;
    const cle = [
      s.marque_norm, s.modele_norm, s.generation_norm, s.techno, s.cyl, s.boite,
      s.annee, s.km_tranche, s.region, s.mois, s.prix_tranche,
    ].join("|");
    const deja = parCle.get(cle);
    if (deja) deja.n += 1;
    else parCle.set(cle, { ...s, n: 1 });
  }
  return [...parCle.values()];
}

export type LigneAgregat = {
  generation_norm?: string;
  techno: string;
  cyl: string;
  boite?: string;
  annee: number;
  km_tranche: number;
  region?: string;
  mois?: string;
  prix_tranche: number;
  effectif: number;
  /** Ventilation {client_api → effectif} des SEULES contributions reçues par
   *  API. Absente ou vide dans le cas normal : le partage des prix est éteint
   *  par défaut, et les relevés publics de l'extension n'ont pas de client. */
  parts_api?: Record<string, number>;
};

export type VehiculeCible = {
  techno: string;
  cyl: string;
  boite?: string;
  generation?: string;
  annee: number | null;
  km: number | null;
  region?: string;
};

/** Une ligne d'agrégat décrit-elle un véhicule comparable à la cible ?
 *
 *  Asymétrie VOULUE entre techno et les autres jetons : la motorisation est
 *  EXIGÉE quand le véhicule en a une (règle historique — un 1.2 PureTech ne se
 *  compare pas à un 1.6 BlueHDi, et une ligne sans techno pourrait être l'un
 *  ou l'autre). Boîte et génération, elles, manquent dans la plupart des
 *  relevés : les exiger viderait le segment. Elles ne servent donc qu'à
 *  ÉCARTER une contradiction explicite. */
export function ligneCompatible(l: LigneAgregat, v: VehiculeCible): boolean {
  if (v.techno && l.techno && l.techno !== v.techno) return false;
  if (v.techno && !l.techno) return false;
  if (v.cyl && l.cyl && l.cyl !== v.cyl) return false;
  if (v.boite && l.boite && l.boite !== v.boite) return false;
  if (v.generation && l.generation_norm && l.generation_norm !== v.generation) return false;
  if (v.annee != null && l.annee !== ANNEE_INCONNUE && Math.abs(l.annee - v.annee) > 2) return false;
  if (v.km != null && l.km_tranche !== KM_INCONNU) {
    const min = Math.floor((v.km * 0.7) / TRANCHE_KM);
    const max = Math.floor((v.km * 1.3) / TRANCHE_KM);
    if (l.km_tranche < min || l.km_tranche > max) return false;
  }
  return true;
}

export type Fourchette = {
  p25: number;
  mediane: number;
  p75: number;
  n: number;
  /** Portée du relevé : 'region' si la région seule suffisait, sinon 'national'. */
  portee: "region" | "national";
  region: string | null;
};

export type Histo = Map<number, number>;

function histogramme(lignes: LigneAgregat[], prixBruts: number[]): { histo: Histo; total: number } {
  const histo: Histo = new Map();
  let total = 0;
  for (const l of lignes) {
    if (!Number.isFinite(l.effectif) || l.effectif <= 0) continue;
    histo.set(l.prix_tranche, (histo.get(l.prix_tranche) ?? 0) + l.effectif);
    total += l.effectif;
  }
  for (const prix of prixBruts) {
    if (!Number.isFinite(prix) || prix < PRIX_MIN || prix > PRIX_MAX) continue;
    const t = tranchePrix(prix);
    histo.set(t, (histo.get(t) ?? 0) + 1);
    total += 1;
  }
  return { histo, total };
}

/** Quantile lu sur un histogramme de tranches (point médian de la tranche).
 *
 *  ⚠️ EXPORTÉE, et c'est voulu : le mode « Mes cibles » (sprint 19.1) lit des
 *  quantiles sur l'histogramme PRIVÉ d'un utilisateur. En écrire une seconde
 *  implémentation ferait diverger deux chiffres qui doivent être le même.
 *
 *  ⚠️ `largeur` rend la fonction utilisable sur D'AUTRES séries que les prix
 *  — années (tranches de 1), kilométrages (tranches de 10 000). Par défaut
 *  c'est la tranche de prix, donc aucun appel existant ne change. C'est le
 *  prix à payer pour n'avoir qu'une implémentation : la généraliser plutôt
 *  que d'en recopier une variante. */
export function quantileHisto(histo: Histo, total: number, q: number, largeur = TRANCHE_PRIX): number {
  const tranches = [...histo.entries()].sort((a, b) => a[0] - b[0]);
  const cible = q * (total - 1) + 1;
  let cumul = 0;
  for (const [tranche, effectif] of tranches) {
    cumul += effectif;
    if (cumul >= cible) return tranche + largeur / 2;
  }
  return tranches[tranches.length - 1][0] + largeur / 2;
}

/** Part maximale qu'un seul client d'API peut peser dans un segment publié.
 *
 *  Miroir de `part_api_max()` côté base. Au-delà, le segment n'est pas publié :
 *  nous écririons « prix observés » sur ce qui serait, pour un cinquième et
 *  plus, le catalogue d'un seul acteur. Un relevé dominé par une source n'est
 *  plus une observation du marché, c'est le reflet de cette source. */
export const PART_API_MAX = 0.20;

/** Client d'API le plus lourd dans un ensemble de lignes, et son poids.
 *
 *  `total` est le total PUBLIÉ (il comprend les prix bruts fournis en mémoire,
 *  qui n'ont pas de client) : c'est bien de la population affichée que la part
 *  est calculée, pas d'un sous-ensemble choisi. */
export function partApiDominante(
  lignes: LigneAgregat[],
  total: number,
): { client: string | null; effectif: number; part: number } {
  const parClient = new Map<string, number>();
  for (const l of lignes) {
    if (!Number.isFinite(l.effectif) || l.effectif <= 0) continue;
    for (const [client, n] of Object.entries(l.parts_api ?? {})) {
      if (!Number.isFinite(n) || (n as number) <= 0) continue;
      parClient.set(client, (parClient.get(client) ?? 0) + (n as number));
    }
  }
  let client: string | null = null;
  let effectif = 0;
  for (const [c, n] of parClient) {
    if (n > effectif) { client = c; effectif = n; }
  }
  return { client, effectif, part: total > 0 ? effectif / total : 0 };
}

/** Un segment est-il publiable au regard du seul poids des clients d'API ? */
export function partApiAcceptable(lignes: LigneAgregat[], total: number): boolean {
  return partApiDominante(lignes, total).part <= PART_API_MAX;
}

/** Fourchette P25 / médiane / P75 depuis les agrégats d'un modèle.
 *
 *  La région est une PRÉFÉRENCE, pas un filtre : si le sous-ensemble régional
 *  atteint seul le seuil, il est plus pertinent et c'est lui qui est publié ;
 *  sinon on retombe sur le national. Filtrer d'office sur la région
 *  affamerait le segment et ferait disparaître la fourchette.
 *
 *  `prixBruts` : comparables fournis EN MÉMOIRE pour cette analyse
 *  (extension) — fondus dans l'histogramme, jamais stockés ici.
 *  null si moins de `minimum` relevés. */
export function fourchetteDepuisAgregats(
  lignes: LigneAgregat[],
  vehicule: VehiculeCible,
  minimum = SEUIL_FOURCHETTE,
  prixBruts: number[] = [],
): Fourchette | null {
  const retenues = lignes.filter((l) => ligneCompatible(l, vehicule));

  const construire = (sousEnsemble: LigneAgregat[], portee: "region" | "national", bruts: number[]) => {
    const { histo, total } = histogramme(sousEnsemble, bruts);
    if (total < minimum) return null;
    // Second verrou, indépendant du premier : 15 relevés ne suffisent pas si
    // l'un d'eux pèse à lui seul plus d'un cinquième du segment.
    if (!partApiAcceptable(sousEnsemble, total)) return null;
    return {
      p25: Math.round(quantileHisto(histo, total, 0.25)),
      mediane: Math.round(quantileHisto(histo, total, 0.5)),
      p75: Math.round(quantileHisto(histo, total, 0.75)),
      n: total,
      portee,
      region: portee === "region" ? vehicule.region ?? null : null,
    } as Fourchette;
  };

  if (vehicule.region) {
    const regionales = retenues.filter((l) => l.region === vehicule.region);
    // Les prix bruts de l'extension viennent de la recherche de l'utilisateur :
    // ils n'ont pas de région connue, donc ils ne comptent qu'au national.
    const regionale = construire(regionales, "region", []);
    if (regionale) return regionale;
  }
  return construire(retenues, "national", prixBruts);
}

/** SPRINT 20 — Fourchette bâtie sur les comparables de la recherche de
 *  L'UTILISATEUR, et non sur le relevé collectif.
 *
 *  ⚠️ DEUX SOURCES, DEUX SEUILS, et ce n'est pas une incohérence. Le relevé
 *  agrégé publie à partir de 15 relevés parce qu'il mélange les contributions
 *  de tiers : il lui faut de quoi diluer une source dominante (verrou des
 *  20 %), une préférence régionale, une fenêtre de trois mois. Les
 *  comparables d'une page de recherche, eux, sont les annonces que
 *  l'utilisateur a sous les yeux À L'INSTANT, déjà filtrées sur le même
 *  modèle, la même énergie, ± 2 ans et ± 40 000 km. Six suffisent — c'est le
 *  seuil que le mode revendeur applique depuis le sprint 19, et c'est le même
 *  `SEUIL_COMPARABLES` qui est passé ici : ce module n'en garde AUCUNE copie,
 *  pour qu'il ne puisse pas exister deux seuils qui divergent.
 *
 *  ⚠️ Les quantiles passent par `quantileHisto`, comme partout ailleurs. Le
 *  prix est donc arrondi au milieu de sa tranche de 250 € — exactement la
 *  précision avec laquelle le relevé agrégé est déjà publié. Lire des
 *  quantiles « exacts » sur une liste aurait fait une SECONDE implémentation
 *  des quantiles dans le projet, ce qu'on refuse depuis le sprint 9.
 *
 *  `portee` vaut toujours 'national' : une page de résultats n'a pas de
 *  région, et en inventer une ferait écrire « relevé en Occitanie » sous des
 *  prix dont on ne sait pas d'où ils viennent. */
export function fourchetteDepuisComparables(
  prix: readonly number[],
  minimum: number,
): Fourchette | null {
  const retenus = prix.filter((p) => Number.isFinite(p) && p >= PRIX_MIN && p <= PRIX_MAX);
  if (retenus.length < minimum) return null;
  const histo: Histo = new Map();
  for (const p of retenus) {
    const t = tranchePrix(p);
    histo.set(t, (histo.get(t) ?? 0) + 1);
  }
  const total = retenus.length;
  return {
    p25: Math.round(quantileHisto(histo, total, 0.25)),
    mediane: Math.round(quantileHisto(histo, total, 0.5)),
    p75: Math.round(quantileHisto(histo, total, 0.75)),
    n: total,
    portee: "national",
    region: null,
  };
}

// ---------------------------------------------------------------------------
// Position de l'annonce dans la fourchette.
// ---------------------------------------------------------------------------
export type PositionPrix = {
  cle: "quart_moins_cher" | "moyenne" | "plus_cher_que_75";
  libelle: string;
};

export function positionPrix(prix: number, f: { p25: number; p75: number }): PositionPrix {
  if (prix <= f.p25) return { cle: "quart_moins_cher", libelle: "dans le quart le moins cher" };
  if (prix <= f.p75) return { cle: "moyenne", libelle: "dans la moyenne" };
  return { cle: "plus_cher_que_75", libelle: "plus chère que 75 % des annonces comparables" };
}

// ---------------------------------------------------------------------------
// Ajustement kilométrique, MESURÉ DANS LE SEGMENT.
//
// On ne « barème » aucune décote : la pente est lue sur les tranches de km
// réellement présentes dans le segment (médiane de prix par tranche, moindres
// carrés pondérés par l'effectif). Si le segment n'a pas de quoi la mesurer —
// moins de 3 tranches peuplées, pente positive (bruit), pente invraisemblable
// — il n'y a PAS d'ajustement. Aucune extrapolation hors segment.
// ---------------------------------------------------------------------------
export const MIN_TRANCHES_PENTE = 3;
export const MIN_EFFECTIF_TRANCHE = 3;
/** Garde-fous de vraisemblance d'une décote, en € par 10 000 km. */
export const PENTE_MIN = 10;
export const PENTE_MAX = 4000;
/** En dessous, l'ajustement ne vaut pas une ligne à l'écran (une tranche de prix). */
export const ECART_KM_SIGNIFICATIF = TRANCHE_PRIX;

export type AjustementKm = {
  /** € perdus pour 10 000 km de plus (valeur POSITIVE = décote). */
  decote_eur_10000km: number;
  km_median_segment: number;
  /** Correction à appliquer à la référence pour le km du véhicule (signé). */
  ecart_eur: number;
  n_tranches: number;
  n: number;
};

export function ajustementKm(
  lignes: LigneAgregat[],
  vehicule: VehiculeCible,
): AjustementKm | null {
  if (vehicule.km == null) return null;
  const retenues = lignes.filter((l) => ligneCompatible(l, vehicule) && l.km_tranche !== KM_INCONNU);
  if (retenues.length === 0) return null;

  // Histogramme par tranche de km → médiane de prix de la tranche.
  const parTranche = new Map<number, { histo: Histo; total: number }>();
  for (const l of retenues) {
    if (!Number.isFinite(l.effectif) || l.effectif <= 0) continue;
    let e = parTranche.get(l.km_tranche);
    if (!e) { e = { histo: new Map(), total: 0 }; parTranche.set(l.km_tranche, e); }
    e.histo.set(l.prix_tranche, (e.histo.get(l.prix_tranche) ?? 0) + l.effectif);
    e.total += l.effectif;
  }
  const points = [...parTranche.entries()]
    .filter(([, e]) => e.total >= MIN_EFFECTIF_TRANCHE)
    .map(([tranche, e]) => ({
      km: milieuTrancheKm(tranche),
      prix: quantileHisto(e.histo, e.total, 0.5),
      poids: e.total,
    }))
    .sort((a, b) => a.km - b.km);
  if (points.length < MIN_TRANCHES_PENTE) return null;

  // Moindres carrés pondérés : pente en € par km.
  const sommePoids = points.reduce((s, p) => s + p.poids, 0);
  const moyX = points.reduce((s, p) => s + p.poids * p.km, 0) / sommePoids;
  const moyY = points.reduce((s, p) => s + p.poids * p.prix, 0) / sommePoids;
  let num = 0, den = 0;
  for (const p of points) {
    num += p.poids * (p.km - moyX) * (p.prix - moyY);
    den += p.poids * (p.km - moyX) ** 2;
  }
  if (den === 0) return null;
  const penteParKm = num / den;
  const decote = -penteParKm * 10_000; // positive si le prix baisse avec les km
  if (!(decote >= PENTE_MIN && decote <= PENTE_MAX)) return null;

  // Km médian du segment (pondéré par l'effectif des tranches).
  const ordonnees = [...points].sort((a, b) => a.km - b.km);
  const cible = sommePoids / 2;
  let cumul = 0;
  let kmMedian = ordonnees[ordonnees.length - 1].km;
  for (const p of ordonnees) {
    cumul += p.poids;
    if (cumul >= cible) { kmMedian = p.km; break; }
  }

  const ecart = Math.round((-decote * (vehicule.km - kmMedian) / 10_000) / 50) * 50;
  return {
    decote_eur_10000km: Math.round(decote / 10) * 10,
    km_median_segment: Math.round(kmMedian),
    ecart_eur: ecart,
    n_tranches: points.length,
    n: sommePoids,
  };
}

// ---------------------------------------------------------------------------
// Référence de prix publiée : la fourchette OBSERVÉE (le libellé « prix
// demandés relevés le … » doit rester littéralement vrai) + une référence
// corrigée du kilométrage, utilisée pour la POSITION et la NÉGOCIATION.
// ---------------------------------------------------------------------------
export type ReferencePrix = {
  fourchette: Fourchette;
  /** Médiane servant de référence : observée, ou corrigée du km si mesurable. */
  mediane_reference: number;
  ajustement: AjustementKm | null;
  position: PositionPrix | null;
  /** Écart au-dessus de la référence (0 si au niveau ou en dessous). */
  ecart_au_dessus_eur: number;
};

export function referencePrix(
  lignes: LigneAgregat[],
  vehicule: VehiculeCible,
  prixAffiche: number | null,
  minimum = SEUIL_FOURCHETTE,
  prixBruts: number[] = [],
): ReferencePrix | null {
  const fourchette = fourchetteDepuisAgregats(lignes, vehicule, minimum, prixBruts);
  if (!fourchette) return null;
  return referenceDepuisFourchette(fourchette, ajustementKm(lignes, vehicule), prixAffiche);
}

/** SPRINT 20 — la queue commune aux DEUX sources de fourchette : décalage
 *  kilométrique, référence, position de l'annonce, écart au-dessus.
 *
 *  ⚠️ EXTRAITE, pas recopiée. Le relevé agrégé et les comparables d'une
 *  recherche n'ont ni le même seuil ni la même façon de mesurer la pente,
 *  mais ce qu'on en DÉDUIT doit être identique au centime : sans quoi la même
 *  annonce serait « dans la moyenne » par un chemin et « plus chère que 75 % »
 *  par l'autre. */
export function referenceDepuisFourchette(
  fourchette: Fourchette,
  ajustementBrut: AjustementKm | null,
  prixAffiche: number | null,
): ReferencePrix {
  // Un ajustement sous la largeur d'une tranche de prix n'apporte rien.
  const ajustement = ajustementBrut && Math.abs(ajustementBrut.ecart_eur) >= ECART_KM_SIGNIFICATIF ? ajustementBrut : null;
  const decalage = ajustement?.ecart_eur ?? 0;
  const mediane_reference = Math.max(PRIX_MIN, fourchette.mediane + decalage);
  const position = prixAffiche != null
    ? positionPrix(prixAffiche, { p25: fourchette.p25 + decalage, p75: fourchette.p75 + decalage })
    : null;
  const ecart = prixAffiche != null ? prixAffiche - mediane_reference : 0;
  return {
    fourchette,
    mediane_reference,
    ajustement,
    position,
    // Valeur EXACTE (jamais arrondie) : elle doit vérifier
    // ecart_au_dessus_eur === prix_affiche − mediane_reference. L'arrondi
    // d'affichage se fait côté appelant.
    ecart_au_dessus_eur: ecart > 0 ? ecart : 0,
  };
}

/** SPRINT 20 — ajustement kilométrique mesuré sur une LISTE de comparables.
 *
 *  La pente est passée en argument (`penteKm` de `_shared/revendeur.ts`, qui
 *  l'exige mesurable ET plausible : ≥ 6 points, ≥ 3 kilométrages distincts,
 *  négative, au plus 0,20 €/km). Ce module ne la recalcule pas — il n'existe
 *  qu'une implémentation de cette pente dans le projet, et elle est déjà
 *  testée hors ligne.
 *
 *  Rend `null` dès qu'un élément manque : pas de pente, pas de kilométrage du
 *  véhicule, pas de kilométrage médian. On ne décote jamais « au barème ». */
export function ajustementKmListe(
  comparables: readonly { prix: number; km?: number | null }[],
  kmVehicule: number | null,
  pente: number | null,
): AjustementKm | null {
  if (pente == null || kmVehicule == null) return null;
  const kms = comparables.map((c) => c.km).filter((k): k is number => typeof k === "number" && Number.isFinite(k));
  if (kms.length === 0) return null;
  const tries = [...kms].sort((a, b) => a - b);
  const m = Math.floor(tries.length / 2);
  const kmMedian = tries.length % 2 ? tries[m] : Math.round((tries[m - 1] + tries[m]) / 2);
  const tranches = new Set(kms.map((k) => Math.round(k / 10_000))).size;
  return {
    decote_eur_10000km: Math.round(-pente * 10_000),
    km_median_segment: kmMedian,
    ecart_eur: Math.round(pente * (kmVehicule - kmMedian)),
    n_tranches: tranches,
    n: comparables.length,
  };
}

// ---------------------------------------------------------------------------
// Pages /moteur : un libellé de modèle de `famillesMoteur.js` → les couples
// (marque, modèle) interrogeables dans les agrégats.
//
// Les libellés sont écrits pour un lecteur humain (« Renault Clio III/IV »,
// « BMW Série 3 F30/G20 », « Peugeot 207/208 ») alors que les agrégats portent
// le modèle canonique. Il faut donc reconnaître la marque, séparer les
// libellés qui désignent réellement DEUX modèles, et canoniser chaque modèle.
//
// Discipline du projet : en cas de doute, on ne devine pas. Un libellé dont la
// marque n'est pas reconnue, ou dont il ne reste rien après nettoyage, rend un
// tableau vide — la page n'affichera simplement pas de prix pour ce modèle.
// ---------------------------------------------------------------------------

/** Toutes les écritures de marque connues, les plus longues d'abord
 *  (« land rover » doit gagner sur « land »). */
const ECRITURES_MARQUE: string[] = BRAND_ALIAS_GROUPS
  .flat()
  .map((m) => normaliserNom(m))
  .filter(Boolean)
  .sort((a, b) => b.length - a.length);

/** Marque reconnue EN TÊTE d'un libellé, et ce qui reste après elle. */
function separerMarque(libelle: unknown): { marque: string; reste: string } | null {
  const t = normaliserNom(libelle);
  if (!t) return null;
  const ecriture = ECRITURES_MARQUE.find((m) => t === m || t.startsWith(`${m} `));
  if (!ecriture) return null;
  return { marque: marqueCanonique(ecriture), reste: t.slice(ecriture.length).trim() };
}

/** Un libellé « C3/C4 » désigne-t-il deux modèles distincts ? */
function eclaterModeles(modele: string): string[] {
  if (!modele.includes("/")) return [modele];
  const parts = modele.split("/").map((p) => p.trim()).filter(Boolean);
  // Deux vrais modèles : chaque membre fait au moins 2 caractères (« d/e » et
  // « i/ii » ont déjà été retirés comme générations).
  if (parts.length >= 2 && parts.every((p) => p.length >= 2)) return parts;
  return [modele.replace(/\s*\/\s*/g, " ").trim()];
}

/** Couples (marque, modèle) interrogeables pour un libellé de `famillesMoteur`. */
export function segmentsDepuisLibelleModele(libelle: unknown): Array<{ marque: string; modele: string }> {
  const sep = separerMarque(libelle);
  if (!sep || !sep.reste) return [];
  const vus = new Set<string>();
  const out: Array<{ marque: string; modele: string }> = [];
  for (const brut of eclaterModeles(sansGeneration(sep.reste))) {
    const modele = modeleCanonique(brut);
    if (!modele || vus.has(modele)) continue;
    vus.add(modele);
    out.push({ marque: sep.marque, modele });
  }
  return out;
}

/** Couple (marque, modèle) depuis un TITRE D'ANNONCE libre, tel que
 *  l'extension le lit sur une page de résultats (« Renault Clio IV 1.5 dCi
 *  90 Business »). null dès que la marque n'est pas reconnue en tête ou que
 *  le modèle n'est pas identifiable : un modèle deviné polluerait durablement
 *  un segment de prix, et un relevé perdu ne coûte rien. */
export function segmentDepuisTitreAnnonce(titre: unknown): { marque: string; modele: string } | null {
  const sep = separerMarque(titre);
  if (!sep || !sep.reste) return null;
  const modele = modeleCanonique(sep.reste);
  return modele ? { marque: sep.marque, modele } : null;
}
