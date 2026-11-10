// SPRINT 22 — Le juge stable : vote majoritaire et cache des verdicts.
//
// Module SANS IMPORT, pour être testé hors ligne (`tests/juge-stable.test.mjs`) :
// `verifSource.ts` importe `npm:unpdf`, que Node ne sait pas charger. Il
// ré-exporte tout ce qui est ici — les appelants n'ont qu'une porte d'entrée.

export const VERDICTS_VALIDES = ["soutenue", "non_soutenue", "mauvais_moteur"] as const;

// ──────────────────────────────────────────────────────────────────────────
// SPRINT 22 — UN JUGE STABLE : même page + même affirmation = même verdict.
//
// ⚠️ LE CONSTAT QUI A DÉCLENCHÉ CE CHANTIER (8 nov. 2026). La campagne de
// re-sourcing a trouvé exactement la même page L'Argus qu'un appel de
// diagnostic pour la chaîne EP6 : « soutenue » à 14 h, « mauvais_moteur » une
// heure plus tard. Le juge est sévère à dessein, mais il n'était pas
// déterministe — et un verdict qui change à chaque lecture n'est pas une
// mesure.
//
// Deux mécanismes, dans cet ordre :
//   1. CACHE par couple (URL, affirmation normalisée, moteur), 180 jours.
//      Clé SANS empreinte du texte de la page (décision d'Utku) : une page
//      qui change ses publicités ne serait jamais en cache.
//   2. VOTE pour un couple nouveau : deux passages en parallèle ; s'ils
//      concordent, la majorité de trois est déjà acquise et un troisième ne
//      pourrait rien y changer ; sinon un troisième tranche. C'est EXACTEMENT
//      le résultat d'un vote à trois, sans le payer quand il est inutile.
//      Trois verdicts différents ⇒ « non_soutenue » : le doute tranche contre
//      l'affirmation, comme dans le prompt.
//
// Un verdict n'est mis en cache que s'il est FIABLE (au moins deux passages
// ont répondu). Une panne d'API ne doit pas se figer 180 jours.

export const VERIF_CACHE_JOURS = 180;

export type UsageJuge = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
};

export type ReponseJuge = {
  // deno-lint-ignore no-explicit-any
  verdicts: any[];
  usage: UsageJuge | null;
  modele: string | null;
} | null;

export type AppelJuge = (affirmations: Array<{ type: string; texte: string }>) => Promise<ReponseJuge>;

export type VerdictVote = {
  verdict: string;
  justification: string | null;
  votes: string[];
  /** false = moins de deux passages ont répondu : ne PAS mettre en cache. */
  fiable: boolean;
  modele: string | null;
};

/** Majorité stricte ; égalité ou dispersion ⇒ « non_soutenue ». */
export function majorite(votes: readonly string[]): string {
  const n = new Map<string, number>();
  for (const v of votes) n.set(v, (n.get(v) ?? 0) + 1);
  for (const [v, k] of n) if (k * 2 > votes.length) return v;
  return "non_soutenue";
}

/** Affirmation normalisée pour la clé : casse, accents, ponctuation et
 *  espaces ne doivent pas faire deux couples d'une même phrase. */
export function normAffirmation(t: string): string {
  return String(t ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9€]+/g, " ").trim();
}

export function normMoteur(m: string): string {
  return String(m ?? "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z0-9]+/g, "");
}

/** Texte de la clé. L'URL est prise telle quelle, fragment retiré. */
export function cleBrute(url: string, affirmation: string, moteur: string): string {
  const u = String(url ?? "").trim().replace(/#.*$/, "");
  return `${u}\n${normAffirmation(affirmation)}\n${normMoteur(moteur)}`;
}

export async function cleVerif(url: string, affirmation: string, moteur: string): Promise<string> {
  const octets = new TextEncoder().encode(cleBrute(url, affirmation, moteur));
  const h = await crypto.subtle.digest("SHA-256", octets);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// deno-lint-ignore no-explicit-any
// ⚠️ UN SILENCE N'EST PAS UN VOTE (défaut trouvé le 10 nov. 2026). Le modèle
// rend parfois une réponse sans verdict pour une affirmation (index absent,
// valeur hors des trois admises). Compté comme « non_soutenue », deux silences
// « s'accordaient », le verdict passait pour FIABLE et entrait au cache pour
// 180 jours : 19 affirmations du pilote K9K + EB2 y ont été figées en rejet
// sans qu'aucune page ait été réellement jugée. Désormais un silence est
// marqué `absent`, ne compte dans aucune majorité, et un verdict n'est fiable
// qu'avec au moins DEUX votes réels.
type Vote = { verdict: string; justification: string | null; absent?: true };

function verdictsParIndex(r: ReponseJuge, n: number): Vote[] | null {
  if (!r) return null;
  const out: Vote[] = [];
  for (let i = 0; i < n; i++) {
    // deno-lint-ignore no-explicit-any
    const v = (r.verdicts ?? []).find((x: any) => Number(x?.index) === i + 1);
    // Le silence ne vaut pas accord : une affirmation non notée n'est jamais
    // soutenue — et, depuis le 10 nov. 2026, elle n'est pas non plus un vote.
    out.push(v && (VERDICTS_VALIDES as readonly string[]).includes(v.verdict)
      ? { verdict: v.verdict, justification: typeof v.justification === "string" ? v.justification.slice(0, 600) : null }
      : { verdict: "non_soutenue", justification: "Aucun verdict rendu pour cette affirmation.", absent: true });
  }
  return out;
}

/** Deux passages, et un troisième sur les seules affirmations en désaccord. */
export async function voter(
  appel: AppelJuge,
  affirmations: Array<{ type: string; texte: string }>,
): Promise<{ resultats: VerdictVote[]; usages: UsageJuge[]; passages: number }> {
  const n = affirmations.length;
  const usages: UsageJuge[] = [];
  const [r1, r2] = await Promise.all([appel(affirmations), appel(affirmations)]);
  let passages = 2;
  for (const r of [r1, r2]) if (r?.usage) usages.push(r.usage);
  const v1 = verdictsParIndex(r1, n), v2 = verdictsParIndex(r2, n);
  const modele = r1?.modele ?? r2?.modele ?? null;

  const reels = (vs: Array<Vote | undefined>) => vs.filter((x): x is Vote => !!x && !x.absent);
  const resultats: VerdictVote[] = [];
  const desaccords: number[] = [];
  for (let i = 0; i < n; i++) {
    const votes = reels([v1?.[i], v2?.[i]]);
    if (votes.length === 2 && votes[0].verdict === votes[1].verdict) {
      resultats.push({ verdict: votes[0].verdict, justification: votes[0].justification, votes: votes.map((x) => x.verdict), fiable: true, modele });
    } else {
      resultats.push({
        verdict: "non_soutenue",
        justification: votes[0]?.justification ?? "Aucun verdict rendu pour cette affirmation.",
        votes: votes.map((x) => x.verdict),
        fiable: false,
        modele,
      });
      desaccords.push(i);
    }
  }

  if (desaccords.length > 0) {
    passages = 3;
    const r3 = await appel(desaccords.map((i) => affirmations[i]));
    if (r3?.usage) usages.push(r3.usage);
    const v3 = verdictsParIndex(r3, desaccords.length);
    desaccords.forEach((i, k) => {
      const tous = reels([v1?.[i], v2?.[i], v3?.[k]]);
      const verdict = tous.length ? majorite(tous.map((x) => x.verdict)) : "non_soutenue";
      resultats[i] = {
        verdict,
        justification: tous.find((x) => x.verdict === verdict)?.justification ?? tous[0]?.justification ??
          "Aucun verdict rendu pour cette affirmation.",
        votes: tous.map((x) => x.verdict),
        // Fiable seulement avec DEUX votes réels au moins : un silence ne se
        // fige jamais au cache.
        fiable: tous.length >= 2,
        modele: modele ?? r3?.modele ?? null,
      };
    });
  }
  return { resultats, usages, passages };
}

/** Lecture du cache : seuls les verdicts de moins de 180 jours comptent. */
// deno-lint-ignore no-explicit-any
export async function lireCacheVerif(db: any, cles: string[]): Promise<Map<string, { verdict: string; justification: string | null; modele: string | null }>> {
  const out = new Map<string, { verdict: string; justification: string | null; modele: string | null }>();
  if (cles.length === 0) return out;
  const depuis = new Date(Date.now() - VERIF_CACHE_JOURS * 86400_000).toISOString();
  const { data, error } = await db
    .from("verif_cache")
    .select("cle, verdict, justification, modele")
    .in("cle", cles)
    .gte("juge_le", depuis);
  if (error) {
    // Un cache illisible n'arrête rien : on vote, on paie, on le dit.
    console.error("verif_cache lecture:", error.message);
    return out;
  }
  // deno-lint-ignore no-explicit-any
  for (const r of (data ?? []) as any[]) out.set(r.cle, { verdict: r.verdict, justification: r.justification, modele: r.modele });
  return out;
}

// deno-lint-ignore no-explicit-any
export async function ecrireCacheVerif(db: any, lignes: Array<{
  cle: string; url: string; affirmation: string; moteur: string; verdict: string;
  justification: string | null; votes: string[]; modele: string | null;
}>): Promise<void> {
  if (lignes.length === 0) return;
  const { error } = await db.from("verif_cache").upsert(
    lignes.map((l) => ({ ...l, url: l.url.slice(0, 1000), affirmation: l.affirmation.slice(0, 1000), juge_le: new Date().toISOString() })),
    { onConflict: "cle" },
  );
  if (error) console.error("verif_cache écriture:", error.message);
}
