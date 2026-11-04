// SPRINT 15 — Quelles affirmations d'une analyse sont VÉRIFIABLES, et contre quoi.
//
// Module PUR (aucun réseau, aucune base) : il lit un `result_json` et rend la
// liste des affirmations avec la source que CHACUNE cite. C'est la matière du
// passage de vérification indépendante, et c'est testable hors ligne.
//
// ⚠️ Ce module ne rend JAMAIS le score, le verdict, les raisons ni le
// raisonnement : le passage de vérification ne doit pas savoir ce que
// l'analyse a conclu, sans quoi il ne vérifierait plus, il confirmerait.
// Seule l'IDENTITÉ du véhicule l'accompagne — c'est un fait de l'annonce, et
// sans elle le verdict « mauvais moteur » serait impossible à rendre.

export type TypeAffirmation = "panne" | "rappel" | "cout" | "entretien" | "prix" | "juridique";

export type Affirmation = {
  type: TypeAffirmation;
  texte: string;
  /** URL publique citée par CETTE affirmation. null = aucune (catalogue interne). */
  url: string | null;
  titre: string | null;
  empreinte: string;
};

export type IdentiteVehicule = {
  marque: string;
  modele: string;
  motorisation: string;
  annee: string;
  famille_moteur: string;
};

/** Empreinte stable d'une affirmation (FNV-1a 32 bits, en hexadécimal).
 *
 *  Pas de SHA : il est asynchrone dans Deno et ce module doit rester pur et
 *  synchrone pour être testable hors ligne. L'empreinte sert à ne pas
 *  vérifier deux fois la même affirmation, pas à résister à un adversaire. */
export function empreinteAffirmation(type: string, texte: string): string {
  const base = `${type}|${texte.toLowerCase().replace(/\s+/g, " ").trim()}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < base.length; i++) {
    h ^= base.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

const texteCourt = (t: unknown, max = 400): string =>
  typeof t === "string" ? t.replace(/\s+/g, " ").trim().slice(0, max) : "";

const estUrlPublique = (u: unknown): u is string =>
  typeof u === "string" && /^https?:\/\/[^\s]{5,500}$/i.test(u);

// deno-lint-ignore no-explicit-any
function titrePour(panne: any, url: string): string | null {
  const s = Array.isArray(panne?.sources) ? panne.sources : [];
  const t = s.find((x: { url?: string }) => x && x.url === url)?.title;
  return typeof t === "string" && t.trim() ? t.trim().slice(0, 300) : null;
}

/** L'identité du véhicule, telle que l'annonce la donne. */
// deno-lint-ignore no-explicit-any
export function identiteVehicule(result: any): IdentiteVehicule {
  const v = result?.vehicule ?? {};
  return {
    marque: texteCourt(v.marque, 60),
    modele: texteCourt(v.modele, 80),
    motorisation: texteCourt(v.motorisation, 80),
    annee: texteCourt(v.annee ?? v.annee_modele, 10),
    famille_moteur: texteCourt(v.famille_moteur, 40),
  };
}

/** Toutes les affirmations vérifiables d'une analyse, dédoublonnées.
 *
 *  Une affirmation SANS url n'est pas écartée : elle sort avec `url: null`,
 *  et c'est le relevé qui décidera de la compter à part. L'omettre
 *  reviendrait à ne mesurer que ce qui nous arrange. */
// deno-lint-ignore no-explicit-any
export function affirmationsDeAnalyse(result: any, max = 40): Affirmation[] {
  const out: Affirmation[] = [];
  const vues = new Set<string>();

  const pousser = (type: TypeAffirmation, texte: string, url: string | null, titre: string | null) => {
    const t = texteCourt(texte);
    if (t.length < 12) return; // une affirmation de trois mots n'est pas vérifiable
    const e = empreinteAffirmation(type, t);
    if (vues.has(e)) return;
    vues.add(e);
    out.push({ type, texte: t, url, titre, empreinte: e });
  };

  // ── Pannes du catalogue (fiche moteur sourcée, ou atlas sans URL) ────────
  for (const p of Array.isArray(result?.pannes_connues) ? result.pannes_connues : []) {
    const titre = texteCourt(p?.titre, 200);
    const symptome = texteCourt(p?.symptome, 300);
    if (!titre) continue;
    const urls = (Array.isArray(p?.urls) ? p.urls : []).filter(estUrlPublique);
    const texte = symptome ? `${titre} — ${symptome}` : titre;
    // Une panne peut citer plusieurs pages : on la vérifie contre la
    // PREMIÈRE, et les autres ne sont pas perdues — elles deviennent des
    // affirmations distinctes seulement si la première ne la soutient pas.
    // Ici on n'en garde qu'une : vérifier la même phrase contre quatre pages
    // multiplierait le coût sans rien apprendre de plus sur la justesse.
    pousser("panne", texte, urls[0] ?? null, urls[0] ? titrePour(p, urls[0]) : null);

    // Le rappel officiel porté par une panne est une affirmation À PART : il
    // nomme une campagne, des années et des modèles. C'est le genre de
    // précision qui se vérifie littéralement, ou pas du tout.
    const rappel = texteCourt(p?.rappel_officiel, 400);
    if (rappel) pousser("rappel", rappel, urls[0] ?? null, urls[0] ? titrePour(p, urls[0]) : null);
  }

  // ── Postes de négociation chiffrés (coût sourcé) ─────────────────────────
  for (const poste of Array.isArray(result?.negociation?.postes) ? result.negociation.postes : []) {
    const libelle = texteCourt(poste?.poste, 200);
    if (!libelle) continue;
    const min = typeof poste?.cout_min_eur === "number" ? poste.cout_min_eur : null;
    const maxi = typeof poste?.cout_max_eur === "number" ? poste.cout_max_eur : null;
    if (min === null && maxi === null) continue; // sans montant, rien à vérifier
    const fourchette = min !== null && maxi !== null ? `${min} à ${maxi} €` : `${min ?? maxi} €`;
    const url = estUrlPublique(poste?.url_source) ? poste.url_source : null;
    pousser("cout", `${libelle} : ${fourchette}`, url, null);
  }

  // ── Plan d'entretien : les opérations à exiger, avec leur échéance ───────
  for (const op of Array.isArray(result?.entretien?.a_exiger) ? result.entretien.a_exiger : []) {
    const texte = typeof op === "string" ? op : texteCourt(op?.operation ?? op?.libelle, 200);
    if (!texte) continue;
    const url = typeof op === "object" && estUrlPublique(op?.url_source) ? op.url_source : null;
    pousser("entretien", texte, url, null);
  }

  return out.slice(0, Math.max(1, max));
}

/** Regroupe les affirmations par page à lire : une page = un appel. */
export function parSource(affirmations: Affirmation[], maxSources = 8): Array<{
  url: string;
  titre: string | null;
  affirmations: Affirmation[];
}> {
  const parUrl = new Map<string, { url: string; titre: string | null; affirmations: Affirmation[] }>();
  for (const a of affirmations) {
    if (!a.url) continue;
    const g = parUrl.get(a.url) ?? { url: a.url, titre: a.titre, affirmations: [] };
    g.affirmations.push(a);
    parUrl.set(a.url, g);
  }
  // Les pages les plus citées d'abord : si le plafond coupe, il coupe ce qui
  // porte le moins d'affirmations.
  return [...parUrl.values()]
    .sort((a, b) => b.affirmations.length - a.affirmations.length)
    .slice(0, maxSources);
}
