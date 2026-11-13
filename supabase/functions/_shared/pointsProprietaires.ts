// SPRINT 24 — « POINTS SIGNALÉS PAR DES PROPRIÉTAIRES » (définition d'Utku du
// 13 nov. 2026).
//
//   - défauts récurrents connus des mécaniciens mais absents de la presse et
//     des constructeurs : ce sont des pannes NON PORTÉES dont les sources sont
//     des forums ou des garages ;
//   - retenus seulement si au moins 3 sources INDÉPENDANTES les citent : hôtes
//     différents, jamais deux pages du même site (sous-domaines compris) ;
//     même organe, même défaut, même moteur — c'est une même entrée de fiche ;
//   - formulés comme un CONTRÔLE : quoi regarder, quand (froid, chaud,
//     kilométrage), à quoi reconnaître le défaut, avec le nombre de sources ;
//     jamais « panne connue », jamais un montant ;
//   - JAMAIS d'effet sur la note : le décompte qui plafonne l'axe risques
//     (`pannes_non_verifiables`) est inchangé, et le barème n'importe pas ce
//     module (tests/points-proprietaires.test.mjs) ;
//   - le point REMPLACE la question générique de la même panne : il
//     n'apparaît qu'une fois dans le dossier.
//
// Module PUR.
import { rangSource } from "./atlasSource.ts";

export const SEUIL_SOURCES_PROPRIETAIRES = 3;
export const MENTION_PROPRIETAIRES = "Signalé par des propriétaires, non confirmé par une source indépendante.";

export type PointProprietaire = {
  titre: string;
  quoi: string;
  quand: string | null;
  signe: string | null;
  n_sources: number;
  sources: string[];
  mention: string;
};

// Domaines à deux niveaux publics : « forum.exemple.co.uk » ⇒ « exemple.co.uk ».
const SUFFIXES_DOUBLES = new Set(["co.uk", "org.uk", "com.au", "co.jp", "com.br", "co.nz"]);

/** Le SITE d'une URL, sous-domaines confondus. */
export function siteDe(url: string): string | null {
  let h: string;
  try { h = new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return null; }
  const p = h.split(".");
  if (p.length <= 2) return h;
  const deux = p.slice(-2).join(".");
  return SUFFIXES_DOUBLES.has(deux) ? p.slice(-3).join(".") : deux;
}

// ⚠️ Pas de `\b` après « € » ni avant « à » : en JavaScript ce ne sont pas
// des caractères de mot, et `\b` ne mord pas.
const SANS_MONTANT = /\d[\d\s.,]*\s?(?:€|euros?(?![a-z])|eur(?![a-z]))|€\s?\d/i;
const PANNE_CONNUE = /\bpannes?\s+connues?\b|\bdéfauts?\s+connus?\b/gi;

function nettoyer(t: string): string {
  return String(t ?? "")
    .split(/(?<=[.!?])\s+/)
    .filter((phrase) => !SANS_MONTANT.test(phrase))
    .join(" ")
    .replace(PANNE_CONNUE, "défaut signalé")
    .replace(/\s+/g, " ")
    .trim();
}

function quandDe(symptome: string, kmTypique: string | null): string | null {
  const s = symptome.toLowerCase();
  const morceaux: string[] = [];
  if (/(?:^|\s)à froid(?![a-zà-ÿ])|moteur froid/.test(s)) morceaux.push("à froid");
  if (/(?:^|\s)à chaud(?![a-zà-ÿ])|moteur chaud|après roulage|en température/.test(s)) morceaux.push("à chaud");
  if (kmTypique && /\d/.test(kmTypique)) morceaux.push(`vers ${kmTypique.replace(/\s+/g, " ").trim()}`);
  return morceaux.length ? morceaux.join(", ") : null;
}

/** Une panne non portée devient-elle un point « signalé par des
 *  propriétaires » ? null sinon (et elle reste une question). */
export function pointProprietaire(p: {
  titre?: unknown; organe?: unknown; symptome?: unknown; km_typique?: unknown; urls?: unknown;
}): PointProprietaire | null {
  const urls = Array.isArray(p.urls) ? p.urls.filter((u): u is string => typeof u === "string") : [];
  const parSite = new Map<string, string>();
  for (const u of urls) {
    const r = rangSource(u);
    if (r !== "forum" && r !== "vendeur") continue;
    const site = siteDe(u);
    if (site && !parSite.has(site)) parSite.set(site, u);
  }
  if (parSite.size < SEUIL_SOURCES_PROPRIETAIRES) return null;
  const titre = nettoyer(String(p.titre ?? "")).slice(0, 140);
  const symptome = nettoyer(String(p.symptome ?? ""));
  const organe = nettoyer(String(p.organe ?? ""));
  return {
    titre,
    quoi: organe || titre,
    quand: quandDe(symptome, typeof p.km_typique === "string" ? p.km_typique : null),
    signe: symptome ? symptome.slice(0, 240) : null,
    n_sources: parSite.size,
    sources: [...parSite.values()],
    mention: MENTION_PROPRIETAIRES,
  };
}
