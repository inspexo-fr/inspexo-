// SPRINT 23 (f) — PRISES EN CHARGE CONNUES D'UN MOTEUR : garanties étendues,
// campagnes, rappels relevés dans les sources confirmées par le juge.
//
// ⚠️ AFFICHAGE SEULEMENT (décision d'Utku du 11 nov. 2026). Ce module n'est
// importé par AUCUN fichier du chemin de notation : `tests/independance-score
// .test.mjs` l'interdit. Le verdict conditionnel continue de venir de
// `warrantyPrograms` (liste curée) et de l'âge du véhicule, jamais d'ici.
//
// ⚠️ JAMAIS « votre voiture est couverte » : une prise en charge publiée pour
// un moteur ne dit rien de l'éligibilité d'UN véhicule (VIN, date de
// production, entretien, kilométrage). Source française : programme à
// vérifier avec le VIN ; source d'un autre pays : information de contexte.
//
// Module PUR : aucun import (tests hors ligne).

export type PriseEnCharge = {
  type: "garantie" | "campagne" | "rappel";
  texte: string;
  periode: { debut: number; fin: number; texte: string } | null;
  pays: string[];
  urls: string[];
  /** SPRINT 24, campagne 2 — dernière vérification (juge sans cache). Une
   *  prise n'est jamais retirée : « a_reverifier » la signale. */
  verification?: { statut: "a_jour" | "a_reverifier"; le: string; motif: string | null };
  /** Décision d'Utku du 14 nov. 2026 : une prise que plus aucune source
   *  portante n'atteste est MASQUÉE partout, jamais supprimée. */
  masquee?: { le: string; motif: string };
  /** Prise restreinte aux véhicules que la page source NOMME (ex. DW10 :
   *  Xsara Picasso seulement). Vide ou absent : pas de restriction. */
  restreinte_a?: string[];
};

const normV = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/** La prise s'affiche-t-elle pour ce modèle ? Masquée : jamais. Restreinte :
 *  seulement si le modèle est connu et nommé par la restriction. */
export function priseVisible(x: PriseEnCharge, modele: string | null | undefined): boolean {
  if (x.masquee) return false;
  if (x.restreinte_a && x.restreinte_a.length > 0) {
    const m = normV(String(modele ?? ""));
    return m.length > 0 && x.restreinte_a.some((r) => { const n = normV(r); return n.length > 0 && ` ${m} `.includes(` ${n} `); });
  }
  return true;
}

const TYPES = new Set(["garantie", "campagne", "rappel"]);
const anneeOk = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 1980 && n <= 2035;

/** Nettoie une liste reçue (écriture admin) : types connus, texte borné,
 *  période plausible, URL https, doublons de texte retirés. Les URL ont déjà
 *  été filtrées par rang (portant) côté appelant ; on ne garde ici que la
 *  forme. */
export function sanitizePrisesEnCharge(brut: unknown): PriseEnCharge[] {
  const out: PriseEnCharge[] = [];
  const vus = new Set<string>();
  for (const x of Array.isArray(brut) ? brut.slice(0, 60) : []) {
    // deno-lint-ignore no-explicit-any
    const e = x as any;
    if (!TYPES.has(e?.type)) continue;
    const texte = String(e?.texte ?? "").replace(/\s+/g, " ").trim().slice(0, 400);
    if (texte.length < 10) continue;
    const urls = (Array.isArray(e?.urls) ? e.urls : [])
      .filter((u: unknown): u is string => typeof u === "string" && /^https:\/\/\S{8,500}$/i.test(u)).slice(0, 4);
    if (urls.length === 0) continue;
    const p = e?.periode;
    const periode = p && anneeOk(p.debut) && anneeOk(p.fin) && p.debut <= p.fin
      ? { debut: p.debut, fin: p.fin, texte: String(p.texte ?? "").slice(0, 120) }
      : null;
    const pays = (Array.isArray(e?.pays) ? e.pays : [])
      .filter((c: unknown): c is string => typeof c === "string" && /^[A-Z]{2,4}$/.test(c)).slice(0, 8);
    const cle = texte.toLowerCase();
    if (vus.has(cle)) continue;
    vus.add(cle);
    const v = e?.verification;
    const verification = v && (v.statut === "a_jour" || v.statut === "a_reverifier") && /^\d{4}-\d{2}-\d{2}$/.test(String(v.le ?? ""))
      ? { statut: v.statut, le: String(v.le), motif: v.motif ? String(v.motif).slice(0, 200) : null }
      : undefined;
    const m = e?.masquee;
    const masquee = m && /^\d{4}-\d{2}-\d{2}$/.test(String(m.le ?? "")) ? { le: String(m.le), motif: String(m.motif ?? "").slice(0, 200) } : undefined;
    const restreinte_a = (Array.isArray(e?.restreinte_a) ? e.restreinte_a : [])
      .filter((r: unknown): r is string => typeof r === "string" && r.trim().length > 1).map((r: string) => r.trim().slice(0, 60)).slice(0, 8);
    out.push({ type: e.type, texte, periode, pays, urls, ...(verification ? { verification } : {}), ...(masquee ? { masquee } : {}), ...(restreinte_a.length ? { restreinte_a } : {}) });
  }
  return out;
}

/** Ajoute sans rien retirer (même philosophie qu'`ajouter_sources`). */
export function fusionnerPrisesEnCharge(avant: unknown, ajouts: unknown): { liste: PriseEnCharge[]; ajoutees: number } {
  const base = sanitizePrisesEnCharge(avant);
  const vus = new Set(base.map((x) => x.texte.toLowerCase()));
  let ajoutees = 0;
  for (const x of sanitizePrisesEnCharge(ajouts)) {
    if (vus.has(x.texte.toLowerCase())) continue;
    base.push(x); vus.add(x.texte.toLowerCase()); ajoutees++;
  }
  return { liste: base.slice(0, 60), ajoutees };
}

export type PriseAffichee = PriseEnCharge & { portee: "france" | "contexte"; mention: string; periode_inconnue: boolean };

export const MENTION_FRANCE = "Programme publié en France : l'éligibilité de ce véhicule se vérifie avec son numéro de série (VIN) auprès du réseau du constructeur.";
export const MENTION_CONTEXTE = "Information de contexte publiée hors de France : elle ne dit rien de la prise en charge de ce véhicule en France.";

/** Ce que l'acheteur voit : uniquement si l'année du véhicule tombe dans la
 *  période écrite (une période absente est dite comme telle). */
export function prisesAffichables(liste: unknown, annee: number | null, modele: string | null = null): PriseAffichee[] {
  return sanitizePrisesEnCharge(liste)
    .filter((x) => priseVisible(x, modele))
    .filter((x) => !x.periode || (annee != null && annee >= x.periode.debut && annee <= x.periode.fin))
    .map((x) => {
      const france = x.pays.includes("FR");
      return { ...x, portee: france ? "france" : "contexte", mention: france ? MENTION_FRANCE : MENTION_CONTEXTE, periode_inconnue: !x.periode };
    })
    .slice(0, 12);
}
