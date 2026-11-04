// SPRINT 13.1 — FILET DÉTERMINISTE SUR LES PANNES DU CATALOGUE.
//
// Le problème, mesuré sur un cas réel. Deux analyses du MÊME texte (Mercedes
// 220 d, OM654), même fiche moteur (`cache: hit`), zéro affirmation écartée par
// la critique : l'une retient 2 pannes du catalogue, l'autre AUCUNE. L'axe
// « risques mécaniques » passe de 13 à 16, et le score de 71 à 77.
//
// La cause n'est ni la fiche, ni la critique, ni l'entretien : c'est que le
// MODÈLE choisit quelles entrées du catalogue citer, et ce choix varie d'un
// appel à l'autre. Or les entrées du catalogue sont déjà filtrées pour CE
// véhicule (famille moteur, plage d'années) : leur applicabilité ne dépend plus
// d'un jugement, elle se décide par des règles.
//
// Ce module est donc le pendant d'`entretienDeclare.ts` : un filet appliqué
// APRÈS l'audit de la critique, pour qu'une entrée objectivement applicable ne
// puisse pas disparaître parce que le modèle l'a oubliée. Le modèle garde ce
// qu'il fait bien — formuler la pertinence et le geste de vérification ; le
// serveur garde ce qui doit être stable — la LISTE.
//
// Module PUR, testé hors ligne (`tests/pannes-applicables.test.mjs`).
import { panneDansHorizon, seuilKmPanne } from "./bareme.ts";

export type EntreeCatalogue = {
  ref: string;
  titre: string;
  organe: string | null;
  symptome: string | null;
  km_typique: string | null;
  gravite: string;
  rappel_code?: string | null;
};

export type MotifNonApplicable =
  | "atlas_de_marque"
  | "hors_horizon"
  | "boite_incompatible"
  | "moteur_incompatible"
  | "caisse_incompatible";

export type Applicabilite = {
  /** Entrées que le serveur GARANTIT dans la liste affichée. */
  applicables: EntreeCatalogue[];
  /** Entrées écartées, avec la raison — pour les events de mesure. */
  ecartees: Array<{ ref: string; motif: MotifNonApplicable }>;
};

/** Codes de boîte cités dans un titre ou un symptôme. Mêmes familles que le
 *  filtre existant de `score` : une panne qui NOMME une boîte ne s'applique
 *  qu'à ce véhicule-là. */
const RE_CODE_BOITE = /\b(DQ\d{3}|DL\d{3}|EAT\d?|BVM\d|BVA\d|MS6|MA6|HP\d{2}|TCT|DSG|S[- ]?tronic|EDC|MCT)\b/i;

/** Mots qui désignent une boîte à double embrayage sans la nommer. */
const RE_DOUBLE_EMBRAYAGE = /double embrayage|doubles? embrayages?/i;

// ⚠️ LA LEÇON QUI A FAILLI COÛTER CHER. Première version de ce filet : il ne
// filtrait que les codes de BOÎTE et l'horizon kilométrique. Résultat mesuré en
// production sur la Mercedes 220 d (OM654, 2025, 36 606 km) : il a injecté
// « Injecteurs Delphi OM651 », « Pignon de balancier M272/M273 » (V6 essence),
// « Plaque conductrice 7G-Tronic (722.9) » et « Corrosion structurelle W203,
// W211, W210 » — des défauts d'AUTRES moteurs, d'une AUTRE boîte et de caisses
// vieilles de vingt ans. Le score est tombé de 71 (vert) à 55 (orange).
//
// Autrement dit : le modèle faisait un vrai travail d'appariement, et le filet
// l'avait supprimé. Un catalogue de marque contient des entrées pour TOUTE la
// gamme ; une entrée qui NOMME un organe précis ne vaut que pour lui.
//
// D'où la règle généralisée : si une entrée nomme un code de famille moteur,
// de boîte ou de caisse, elle ne s'applique que si c'est celui de CE véhicule.
/** Codes de famille moteur (OM654, M272, EA288, B47, N47, DV6, EB2…). */
const RE_CODE_MOTEUR = /\b(OM\d{3}|M\d{3}|EA\d{3}|EB\d[A-Z]?|B\d{2}|N\d{2}|DV\d[A-Z]*|DW\d{2}|K9K|H[45]Ft?|TU\d|R9M|M9R|G9U|CR?DI|PSA\s?\d)\b/i;
/** Codes de caisse / plateforme (W203, E46, 8V, MQB, 997…). */
const RE_CODE_CAISSE = /\b(W\d{3}|[CE]\d{2}|F\d{2}|G\d{2}|8[A-Z]|MQB|PQ\d{2}|\d{3}[A-Z]?\s?phase)\b/;
/** Boîtes nommées par leur référence constructeur (722.9, 6HP26…). */
const RE_CODE_BOITE_REF = /\b(\d{3}\.\d|\dHP\d{2}|7G-?Tronic|9G-?Tronic|5G-?Tronic)\b/i;

export type VehiculeApplicabilite = {
  kilometrage: number | null;
  /** Code de boîte identifié pour CE véhicule, "" si inconnu. */
  boite_code: string;
  /** Boîte automatique identifiée ? */
  boite_automatique: boolean;
  /** Famille moteur de CE véhicule (ex. « OM654 »), "" si inconnue. */
  famille_moteur: string;
  /** Tout ce qui identifie le véhicule, pour reconnaître un code de caisse
   *  qui le désigne vraiment : modèle, génération, motorisation. */
  designation: string;
};

const nettoie = (t: string) => t.toUpperCase().replace(/[\s.-]/g, "");

/** Tous les codes d'un type cités dans un texte. */
function codesCites(texte: string, re: RegExp): string[] {
  const global = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
  return [...texte.matchAll(global)].map((m) => nettoie(m[1] ?? m[0]));
}

/** Un code cité par l'entrée désigne-t-il CE véhicule ? */
function codeConcorde(cites: string[], miens: string[]): boolean {
  if (cites.length === 0) return true; // rien de nommé : pas de contradiction
  const ref = miens.filter((m) => m.length > 0).map(nettoie);
  if (ref.length === 0) return false; // l'entrée nomme, nous ne savons pas → on n'affirme pas
  return cites.some((c) => ref.some((m) => m.includes(c) || c.includes(m)));
}

/** Une entrée du catalogue s'applique-t-elle à ce véhicule ?
 *
 *  Deux seuls motifs d'exclusion, les mêmes que ceux déjà appliqués par
 *  `score` — on ne crée pas de règle nouvelle, on rend DÉTERMINISTE
 *  l'application de celles qui existent :
 *
 *   1. hors horizon de détention : l'usure n'arrive qu'au-delà de
 *      km actuel + 60 000 km. L'entrée reste AFFICHÉE ailleurs, mais elle n'est
 *      pas garantie par ce filet ;
 *   2. boîte incompatible : une panne qui nomme un code de boîte ne vaut que
 *      pour ce code ; une panne de boîte à double embrayage sans code exige une
 *      boîte automatique identifiée. */
export function entreeApplicable(
  e: EntreeCatalogue,
  v: VehiculeApplicabilite,
): { ok: true } | { ok: false; motif: MotifNonApplicable } {
  // ⚠️ LE DISCRIMINANT PRINCIPAL : d'où vient l'entrée.
  //
  // Les réfs « F… » viennent de la FICHE MOTEUR, indexée par marque + famille
  // + plage d'années : elles sont déjà propres à CE moteur, et leur
  // applicabilité ne demande aucun jugement. Les réfs « A… » viennent de
  // l'ATLAS DE MARQUE : il couvre toute la gamme, et savoir si « Suspension
  // Airmatic » concerne cette voiture-là suppose de connaître son équipement.
  //
  // Ce filet ne garantit donc que les entrées de FICHE. Les entrées d'atlas
  // restent au jugement du modèle — c'est un travail qu'il fait réellement, et
  // la première version de ce filet, en le supprimant, a attribué à une
  // Mercedes de 2025 des défauts de W203 et de V6 essence.
  if (!/^F/i.test(e.ref)) return { ok: false, motif: "atlas_de_marque" };

  const texte = `${e.titre} ${e.symptome ?? ""}`;

  // Famille moteur nommée : elle doit être la nôtre.
  if (!codeConcorde(codesCites(texte, RE_CODE_MOTEUR), [v.famille_moteur])) {
    return { ok: false, motif: "moteur_incompatible" };
  }
  // Caisse ou plateforme nommée : elle doit désigner ce véhicule.
  if (!codeConcorde(codesCites(texte, RE_CODE_CAISSE), [v.designation, v.famille_moteur])) {
    return { ok: false, motif: "caisse_incompatible" };
  }
  // Référence de boîte constructeur nommée.
  if (!codeConcorde(codesCites(texte, RE_CODE_BOITE_REF), [v.boite_code, v.designation])) {
    return { ok: false, motif: "boite_incompatible" };
  }

  const codes = texte.match(RE_CODE_BOITE);
  if (codes) {
    const cite = codes[0].toUpperCase().replace(/[\s-]/g, "");
    const mien = v.boite_code.toUpperCase().replace(/[\s-]/g, "");
    if (!mien || mien !== cite) return { ok: false, motif: "boite_incompatible" };
  } else if (RE_DOUBLE_EMBRAYAGE.test(texte) && !v.boite_automatique) {
    return { ok: false, motif: "boite_incompatible" };
  }

  // Un rappel officiel ne s'efface jamais pour une question de kilométrage :
  // il porte sur une production, pas sur une usure.
  if (!e.rappel_code) {
    const seuil = seuilKmPanne(e.km_typique);
    if (v.kilometrage != null && !panneDansHorizon(v.kilometrage, seuil)) {
      return { ok: false, motif: "hors_horizon" };
    }
  }
  return { ok: true };
}

/** Partitionne le catalogue en applicables / écartées. */
export function pannesApplicables(
  catalogue: EntreeCatalogue[],
  v: VehiculeApplicabilite,
): Applicabilite {
  const applicables: EntreeCatalogue[] = [];
  const ecartees: Array<{ ref: string; motif: MotifNonApplicable }> = [];
  for (const e of catalogue) {
    const r = entreeApplicable(e, v);
    if (r.ok) applicables.push(e);
    else ecartees.push({ ref: e.ref, motif: r.motif });
  }
  return { applicables, ecartees };
}

/** Références que le serveur doit AJOUTER à la liste du modèle.
 *
 *  C'est le cœur du filet : l'écart entre ce qui s'applique et ce que le modèle
 *  a cité. Rendu séparément pour être mesurable (event `panne_reinjectee`) —
 *  si cet écart est souvent gros, c'est le prompt qu'il faut revoir, pas le
 *  filet qu'il faut élargir. */
export function refsManquantes(
  applicables: EntreeCatalogue[],
  refsCitees: string[],
): string[] {
  const citees = new Set(refsCitees.map((r) => r.toUpperCase()));
  return applicables.map((e) => e.ref).filter((ref) => !citees.has(ref.toUpperCase()));
}

// ---------------------------------------------------------------------------
// ENTRÉES D'ATLAS : AFFICHÉES TOUJOURS, COMPTÉES SEULEMENT SI CONFIRMÉES.
//
// L'atlas est un catalogue de MARQUE : il couvre toute la gamme. Une entrée
// comme « Suspension Airmatic » ou « Corrosion W203 » ne concerne ce
// véhicule-ci que s'il a cet équipement, cette génération ou ce code — ce que
// nous ne pouvons pas savoir… sauf si l'annonce le dit.
//
// D'où la règle (décision d'Utku, 4 novembre 2026) : une entrée d'atlas ne
// pèse sur le score que si **l'annonce mentionne explicitement** ce qu'elle
// vise. Sinon elle reste AFFICHÉE et devient une QUESTION au vendeur.
//
// C'est ce qui rend le résultat déterministe sans encoder l'équipement : la
// décision ne dépend plus du jugement du modèle, mais de la présence d'un mot
// dans un texte — vérifiable, reproductible, et explicable à l'acheteur.
// ---------------------------------------------------------------------------

/** Mots à initiale majuscule qui ne désignent jamais un équipement : ils
 *  ouvrent une phrase ou sont des termes génériques. Sans cette liste, le
 *  premier mot de chaque titre deviendrait une « cible ». */
const MOTS_NON_CIBLES = new Set([
  "defaillances", "defaillance", "panne", "pannes", "probleme", "problemes",
  "usure", "casse", "fuite", "fuites", "corrosion", "bruit", "bruits",
  "vibrations", "tremblements", "rates", "demarrage", "moteur", "boite",
  "suspension", "direction", "freins", "frein", "embrayage", "distribution",
  "injecteurs", "injecteur", "turbo", "capteur", "capteurs", "vanne", "vannes",
  "pompe", "courroie", "chaine", "volant", "plaque", "pignon", "compresseur",
  "coussins", "structurelle", "electrique", "electronique", "premieres",
  "premiers", "motorisations", "motorisation", "versions", "version", "modeles",
  "modele", "sur", "les", "des", "une", "aux", "avec", "sans", "pour", "dans",
]);

const sansAccents = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Ce qu'une entrée d'atlas VISE : codes et noms d'équipement distinctifs. */
export function ciblesAtlas(e: EntreeCatalogue): string[] {
  const texte = `${e.titre} ${e.symptome ?? ""}`;
  const cibles = new Set<string>();

  for (const re of [RE_CODE_MOTEUR, RE_CODE_CAISSE, RE_CODE_BOITE_REF, RE_CODE_BOITE]) {
    for (const c of codesCites(texte, re)) cibles.add(c);
  }
  // Noms propres d'équipement : initiale majuscule ou tout en capitales, au
  // moins quatre lettres, hors mots génériques.
  for (const m of texte.matchAll(/\b([A-ZÀ-Þ][A-Za-zÀ-ÿ]{3,}|[A-Z]{4,})\b/g)) {
    const mot = sansAccents(m[1]);
    if (!MOTS_NON_CIBLES.has(mot)) cibles.add(nettoie(m[1]));
  }
  return [...cibles];
}

/** L'annonce mentionne-t-elle explicitement ce que vise cette entrée d'atlas ?
 *
 *  Une entrée qui ne vise RIEN de distinctif ne peut pas être confirmée : elle
 *  reste une question. C'est volontairement conservateur — mieux vaut une
 *  question de trop qu'un point de score pris sur une supposition. */
export function atlasConfirme(e: EntreeCatalogue, texteAnnonce: string): boolean {
  const cibles = ciblesAtlas(e);
  if (cibles.length === 0) return false;
  const annonce = nettoie(texteAnnonce);
  if (annonce.length === 0) return false;
  return cibles.some((c) => c.length >= 3 && annonce.includes(c));
}

/** Une panne doit-elle PESER sur le score ?
 *
 *  Fiche moteur → toujours (elle est propre à ce moteur).
 *  Atlas → seulement si l'annonce confirme ce qu'elle vise. */
export function panneCompteDansScore(
  e: EntreeCatalogue,
  texteAnnonce: string,
): { compte: boolean; motif: "fiche" | "atlas_confirme" | "atlas_non_confirme" } {
  if (/^F/i.test(e.ref)) return { compte: true, motif: "fiche" };
  return atlasConfirme(e, texteAnnonce)
    ? { compte: true, motif: "atlas_confirme" }
    : { compte: false, motif: "atlas_non_confirme" };
}

// ── SPRINT 15.1 — « source : base Inspexo » n'est pas une source ────────────
//
// Le Defect Atlas ne porte AUCUNE URL (vérifié : zéro dans
// `src/data/defectAtlas.js`). Ses entrées s'affichaient pourtant comme des
// pannes connues, sous la mention « source : base Inspexo » — c'est-à-dire
// nous-mêmes. Mesuré sur les 505 analyses de production : 55 % des
// affirmations d'une analyse ne citent aucune page publique.
//
// Décision d'Utku, 4 novembre 2026 : tant qu'une entrée d'atlas n'a pas d'URL
// publique, elle ne s'affiche plus comme une panne. Elle devient une QUESTION
// au vendeur, sans le mot « panne », et sans effet sur le score — même quand
// l'annonce mentionne ce qu'elle vise. La règle du sprint 13 (une entrée
// d'atlas ne pèse que si l'annonce la confirme) reste en vigueur pour les
// entrées d'atlas QUI AURONT une source.

/** L'entrée vient-elle de l'atlas de marque SANS citer la moindre page ? */
export function sansSourcePublique(ref: string, urls: readonly string[] | null | undefined): boolean {
  if (!/^A\d/i.test(String(ref ?? ""))) return false;
  return !(urls ?? []).some((u) => /^https?:\/\/\S+/i.test(String(u ?? "")));
}

/** La question posée à la place. Elle n'affirme RIEN : ni « panne », ni
 *  « défaut », ni « ce modèle connaît ». Nous n'avons pas de source — le dire
 *  est la seule formulation honnête. */
export function questionSansSource(titre: string): string {
  const sujet = String(titre ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
  return `Avez-vous rencontré quelque chose du côté de « ${sujet} » ? ` +
    `(point de vigilance relevé sur ce modèle, que nous n'avons pas pu rattacher ` +
    `à une source publique : à confirmer avec le carnet et les factures.)`;
}

// ── SPRINT 16 — Les codes incompatibles sortent du CATALOGUE ───────────────
//
// ⚠️ Risque créé par le sourcing de l'atlas. Jusqu'ici, une entrée d'atlas
// nommant un moteur étranger au véhicule — « Consommation d'huile 2.0 TFSI
// EA888 » proposée pour une S7 en EA824 — ne pouvait pas nuire : sans URL,
// elle était retirée de l'affichage par la règle du sprint 15.1. Maintenant
// qu'elle porte une source, elle redevient citable.
//
// `entreeApplicable` ne protège QUE la liste garantie, et ne juge jamais les
// entrées d'atlas. Le filtre doit donc être posé plus haut : sur le CATALOGUE,
// avant qu'il ne soit présenté au modèle. Ce qui n'est jamais montré ne peut
// pas être cité — même principe que le filtre de code de boîte, qui existe
// déjà à cet endroit depuis le sprint 2.

/** L'entrée nomme-t-elle un moteur ou une caisse qui n'est pas celui-là ?
 *
 *  Rend le motif, ou null si rien ne s'y oppose. Une entrée qui ne nomme
 *  aucun code n'est jamais écartée par cette règle : elle reste soumise à
 *  l'appréciation du modèle puis à `atlasConfirme`. */
export function codeEtranger(
  titre: string,
  symptome: string | null,
  v: { famille_moteur: string; designation: string },
): "moteur_incompatible" | "caisse_incompatible" | null {
  const texte = `${titre ?? ""} ${symptome ?? ""}`;
  if (!codeConcorde(codesCites(texte, RE_CODE_MOTEUR), [v.famille_moteur])) {
    return "moteur_incompatible";
  }
  if (!codeConcorde(codesCites(texte, RE_CODE_CAISSE), [v.designation, v.famille_moteur])) {
    return "caisse_incompatible";
  }
  return null;
}
