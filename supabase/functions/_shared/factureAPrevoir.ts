// SPRINT 24, LOT 2 — LA FACTURE À PRÉVOIR. Gratuite, déterministe, sur
// chaque dossier, calculée À LA LECTURE (fonction `cout-3ans`), HORS SCORE :
// aucun fichier du chemin de notation n'importe ce module
// (tests/facture-a-prevoir.test.mjs).
//
// Trois rubriques, dans cet ordre :
//   1. ENTRETIEN DÛ MAINTENANT, la distribution d'abord : ce que le calcul
//      sur 3 ans juge dû dès l'achat (échéance passée sans justificatif, ou
//      opération que l'annonce déclare non faite). Prix d'entretien : celui
//      du calcul sur 3 ans (comparateurs pour une opération prévue au plan).
//   2. DÉFAUTS CONNUS dont le kilométrage d'apparition couvre la voiture
//      (dans les 12 prochains mois à 15 000 km/an). Montant : SEULEMENT le
//      coût cité par une source portante, en euros, daté du relevé de la
//      fiche. Sinon pas de montant.
//   3. PRISES EN CHARGE : programmes publiés avec durée et kilométrage ⇒
//      VALABLE jusqu'au … ou EXPIRÉE ; campagnes et rappels publiés en France
//      ⇒ à vérifier avec le VIN. Une ligne qui nomme une autre version
//      (cylindrée, puissance) ou un autre véhicule n'est pas reprise.
//
// Sans source confirmée, PAS DE MONTANT : la ligne devient une question au
// vendeur. Chaque ligne donne la phrase à dire et le justificatif à demander.
//
// Module PUR.
import { coutUtilisable, rangSource, sourcesPortentLEntree } from "./atlasSource.ts";
import { seuilKmPanne } from "./bareme.ts";
import type { Cout3Ans } from "./cout3ans.ts";
import { decisionVariante, type Variante } from "./variantes.ts";
import type { WarrantyProgram } from "./warrantyPrograms.ts";

export const KM_DOUZE_MOIS = 15_000;
export const MENTION_FACTURE =
  "Montants indicatifs, à faire chiffrer par un garage. Une ligne sans source confirmée n'a pas de montant : c'est une question à poser au vendeur.";

export type SourceLigne = { libelle: string; url: string | null; date: string | null };
export type LigneFacture = {
  id: string;
  rubrique: "entretien" | "defaut" | "prise_en_charge";
  libelle: string;
  statut: "a_prevoir" | "question" | "valable" | "expiree" | "a_verifier";
  /** Euros. null ⇒ pas de montant (aucune source confirmée). */
  min: number | null;
  max: number | null;
  echeance: string | null;
  source: SourceLigne | null;
  phrase_vendeur: string;
  justificatif: string;
};
export type FactureAPrevoir = {
  lignes: LigneFacture[];
  total_min: number;
  total_max: number;
  /** Lignes sans montant (questions, à vérifier). */
  sans_montant: number;
  mention: string;
};

export type EntreeFacture = {
  aujourdhui: string; // AAAA-MM-JJ
  kilometrage: number | null;
  /** « AAAA » ou « AAAA-MM » ; sinon l'année-modèle. */
  premiere_immat: string | null;
  annee: number | null;
  version: Variante;
  cout3ans: Cout3Ans | null;
  pannes: unknown[];
  prises: unknown[];
  programmes: WarrantyProgram[];
  /** Date du relevé de la fiche moteur (date des coûts cités). */
  fiche_maj: string | null;
  /** Vrai si un texte nomme un autre véhicule que celui du dossier. */
  nommeUnAutreVehicule?: (texte: string) => boolean;
};

const hote = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
const jour = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : null);
const km = (n: number) => `${n.toLocaleString("fr-FR").replace(/ /g, " ")} km`;
const slug = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").slice(0, 60);
const DISTRIBUTION = /distribution|courroie|cha[îi]ne/i;
/** Libellé ramené à son nom (« Distribution — déclarée non faite… » ⇒
 *  « Distribution »), pour une phrase qu'on peut dire telle quelle. */
const court = (t: string) => {
  const n = String(t).split(/\s[—–:(]\s?|,\s/)[0].trim();
  return (n.length > 70 ? `${n.slice(0, 70).trimEnd()}…` : n) || t;
};
const REMPLACER_DISTRIBUTION = /^distribution\b|(?:remplacement|changement|remplacer|kit)[^.]{0,40}(?:courroie|distribution)/i;
// Une action en justice n'est pas une prise en charge du véhicule.
const PAS_UNE_PRISE = /action collective|actions? judiciaires?|plaintes?|contentieux|motorgate|référé|class action/i;
const motsSignificatifs = (t: string) => new Set(t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length >= 4));
/** Même prise en charge dite deux fois (programme curé et ligne de fiche) :
 *  au moins 3 mots significatifs communs. */
function memePrise(a: string, b: string): boolean {
  const A = motsSignificatifs(a); let n = 0;
  for (const w of motsSignificatifs(b)) if (A.has(w)) n++;
  return n >= 3;
}

/** Date de 1re mise en circulation (ou à défaut le 1er juillet de l'année-modèle). */
export function dateDepart(premiereImmat: string | null, annee: number | null): string | null {
  const m = String(premiereImmat ?? "").match(/^(\d{4})(?:-(\d{2}))?/);
  if (m) return `${m[1]}-${m[2] ?? "07"}-01`;
  return annee ? `${annee}-07-01` : null;
}

export function ajouterAns(iso: string, ans: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + Math.floor(ans));
  return d.toISOString().slice(0, 10);
}

/** Date de fin d'un programme (durée publiée), ou null. */
export function finProgramme(p: WarrantyProgram, depart: string | null): string | null {
  return p.age_max_ans != null && depart ? ajouterAns(depart, p.age_max_ans) : null;
}

export function factureAPrevoir(e: EntreeFacture): FactureAPrevoir {
  const lignes: LigneFacture[] = [];
  const kmV = e.kilometrage;

  // ---- 1. Entretien dû maintenant (distribution d'abord) -----------------
  const dues = (e.cout3ans?.lignes ?? []).filter((l) => l.poste === "entretien_du");
  const entretien: LigneFacture[] = dues.map((l) => ({
    id: `entretien-${slug(l.libelle)}`,
    rubrique: "entretien",
    libelle: l.libelle,
    statut: l.chiffree ? "a_prevoir" : "question",
    min: l.chiffree ? l.min : null,
    max: l.chiffree ? l.max : null,
    echeance: l.echeance,
    source: l.source ? { libelle: l.source.libelle, url: l.source.urls[0] ?? null, date: null } : null,
    phrase_vendeur: `${court(l.libelle)} : est-ce fait ? D'après l'annonce ou le plan d'entretien, c'est dû maintenant. Sinon, j'en tiendrai compte dans le prix.`,
    justificatif: `Facture de l'opération (date, kilométrage, garage)`,
  }));
  if (!entretien.some((l) => DISTRIBUTION.test(l.libelle))) {
    entretien.push({
      id: "entretien-distribution",
      rubrique: "entretien",
      libelle: "Distribution",
      statut: "question",
      min: null, max: null,
      echeance: null,
      source: null,
      phrase_vendeur: "Quand la distribution a-t-elle été faite pour la dernière fois, et à quel kilométrage ?",
      justificatif: "Facture de la distribution, ou carnet d'entretien tamponné",
    });
  }
  for (const n of e.cout3ans?.non_etablies ?? []) {
    if (entretien.some((l) => slug(l.libelle) === slug(n.operation))) continue;
    entretien.push({
      id: `entretien-${slug(n.operation)}`,
      rubrique: "entretien",
      libelle: n.operation,
      statut: "question",
      min: null, max: null,
      echeance: null,
      source: null,
      phrase_vendeur: `${court(n.operation)} : à quel kilométrage a-t-elle été faite pour la dernière fois ?`,
      justificatif: "Facture ou carnet d'entretien",
    });
  }
  entretien.sort((a, b) => Number(DISTRIBUTION.test(b.libelle)) - Number(DISTRIBUTION.test(a.libelle)));
  // Une seule ligne « remplacer la distribution » : le plan et l'annonce la
  // disent parfois chacun à leur manière.
  let distributionVue = false;
  lignes.push(...entretien.filter((l) => {
    if (!REMPLACER_DISTRIBUTION.test(l.libelle)) return true;
    if (distributionVue) return false;
    distributionVue = true;
    return true;
  }));

  // ---- 2. Défauts connus dont le kilométrage couvre la voiture -----------
  for (const brut of e.pannes) {
    // deno-lint-ignore no-explicit-any
    const p = brut as any;
    const titre = String(p?.titre ?? "").trim();
    if (!titre || p?.usure_lointaine) continue;
    const urls: string[] = Array.isArray(p?.urls) ? p.urls.filter((u: unknown): u is string => typeof u === "string") : [];
    if (!sourcesPortentLEntree(urls)) continue; // seules les pannes portées
    if (decisionVariante(`${titre} ${p?.symptome ?? ""}`, e.version).statut !== "applicable") continue;
    const seuil = seuilKmPanne(typeof p?.km_typique === "string" ? p.km_typique : null);
    if (seuil != null && kmV != null && seuil > kmV + KM_DOUZE_MOIS) continue; // pas dans les 12 mois
    const portante = urls.find((u) => sourcesPortentLEntree([u])) ?? null;
    const chiffre = coutUtilisable(urls) && typeof p?.cout_min_eur === "number" && typeof p?.cout_max_eur === "number";
    lignes.push({
      id: `defaut-${slug(titre)}`,
      rubrique: "defaut",
      libelle: titre,
      statut: chiffre ? "a_prevoir" : "question",
      min: chiffre ? p.cout_min_eur : null,
      max: chiffre ? p.cout_max_eur : null,
      echeance: seuil != null ? `à partir de ${km(seuil)}` : null,
      source: portante ? { libelle: `${hote(portante)} (${rangSource(portante)})`, url: portante, date: jour(e.fiche_maj) } : null,
      phrase_vendeur: `${court(titre)} : c'est un défaut connu de ce moteur${seuil != null ? ` à partir de ${km(seuil)}` : ""}. L'organe a-t-il déjà été contrôlé ou remplacé ?`,
      justificatif: "Facture du contrôle ou du remplacement (date, kilométrage, pièces)",
    });
  }

  // ---- 3. Prises en charge ----------------------------------------------
  const depart = dateDepart(e.premiere_immat, e.annee);
  for (const pr of e.programmes) {
    const fin = finProgramme(pr, depart);
    const kmDepasse = pr.km_max != null && kmV != null && kmV > pr.km_max;
    const dateDepassee = fin != null && fin < e.aujourdhui;
    const inconnu = (pr.age_max_ans != null && !depart) || (pr.km_max != null && kmV == null);
    const statut: LigneFacture["statut"] = kmDepasse || dateDepassee ? "expiree" : inconnu ? "a_verifier" : "valable";
    const limites = [fin ? `jusqu'au ${jour(fin)}` : null, pr.km_max != null ? `ou ${km(pr.km_max)}` : null].filter(Boolean).join(" ");
    lignes.push({
      id: `prise-${slug(pr.titre)}`,
      rubrique: "prise_en_charge",
      libelle: pr.titre,
      statut,
      min: null, max: null,
      echeance: statut === "expiree" ? `expirée${dateDepassee ? ` le ${jour(fin)}` : ` (plus de ${km(pr.km_max!)})`}` : limites || null,
      // La date d'un programme est sa date d'ENTRÉE EN VIGUEUR, pas un relevé.
      source: pr.url_source[0] ? { libelle: `${hote(pr.url_source[0])}${pr.date_vigueur ? `, programme en vigueur depuis le ${jour(pr.date_vigueur)}` : ""}`, url: pr.url_source[0], date: null } : null,
      phrase_vendeur: statut === "expiree"
        ? `La prise en charge « ${pr.titre} » ne couvre plus ce véhicule : les réparations concernées seraient à ma charge.`
        : `Le véhicule entre dans « ${pr.titre} »${limites ? ` (${limites})` : ""} : avez-vous ${pr.entretien_exige ?? "les justificatifs d'entretien exigés par le constructeur"} ?`,
      justificatif: pr.entretien_exige ?? "Justificatifs d'entretien exigés par le constructeur",
    });
  }
  for (const brut of e.prises) {
    // deno-lint-ignore no-explicit-any
    const x = brut as any;
    const texte = String(x?.texte ?? "").trim();
    if (!texte || x?.portee === "contexte") continue;
    if (decisionVariante(texte, e.version).statut !== "applicable") continue;
    if (e.nommeUnAutreVehicule?.(texte)) continue;
    if (PAS_UNE_PRISE.test(texte)) continue;
    if (lignes.some((l) => l.rubrique === "prise_en_charge" && (slug(l.libelle) === slug(texte) || memePrise(l.libelle, texte)))) continue;
    const garantie = x?.type === "garantie";
    const url = Array.isArray(x?.urls) && typeof x.urls[0] === "string" ? x.urls[0] : null;
    lignes.push({
      id: `prise-${slug(texte)}`,
      rubrique: "prise_en_charge",
      libelle: texte,
      statut: "a_verifier",
      min: null, max: null,
      echeance: x?.periode?.texte ? `période : ${x.periode.texte}` : null,
      source: url ? { libelle: hote(url), url, date: null } : null,
      phrase_vendeur: garantie
        ? `Le véhicule entre-t-il encore dans cette prise en charge ? Le réseau du constructeur peut le vérifier avec le numéro de série (VIN).`
        : `Cette campagne a-t-elle été faite sur le véhicule ? Le réseau du constructeur peut le vérifier avec le numéro de série (VIN).`,
      justificatif: garantie ? "Justificatifs d'entretien exigés par le constructeur" : "Attestation ou facture du passage en atelier pour cette campagne",
    });
  }

  const chiffrees = lignes.filter((l) => l.statut === "a_prevoir" && l.min != null && l.max != null);
  return {
    lignes,
    total_min: chiffrees.reduce((s, l) => s + (l.min ?? 0), 0),
    total_max: chiffrees.reduce((s, l) => s + (l.max ?? 0), 0),
    sans_montant: lignes.filter((l) => l.min == null).length,
    mention: MENTION_FACTURE,
  };
}

/** Palier d'alerte DÛ aujourd'hui : « 1_mois » dans le dernier mois, sinon
 *  « 6_mois » dans les six derniers mois, sinon rien. Un seul à la fois :
 *  on n'envoie jamais deux alertes le même jour pour la même fin. */
export function paliersAlerte(fin: string, aujourdhui: string): Array<"6_mois" | "1_mois"> {
  const jours = (Date.parse(`${fin}T00:00:00Z`) - Date.parse(`${aujourdhui}T00:00:00Z`)) / 86_400_000;
  if (jours < 0) return [];
  if (jours <= 31) return ["1_mois"];
  if (jours <= 183) return ["6_mois"];
  return [];
}
