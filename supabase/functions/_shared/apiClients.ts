// SPRINT 11 — Clés d'API et quotas. Module PUR, testé hors ligne
// (tests/api-clients.test.mjs).
//
// Trois choses qui doivent être vraies, et que ce module rend vérifiables :
//
//  1. UNE CLÉ N'EST JAMAIS STOCKÉE EN CLAIR. Seule son empreinte salée l'est.
//     Elle est montrée une fois à sa création, puis irrécupérable — comme un
//     mot de passe. Un vol de la base ne donne aucune clé utilisable.
//
//  2. LE DRAPEAU D'APPEL API EXIGE LES DEUX FACTEURS. L'en-tête
//     `x-api-client` ne vaut RIEN sans la clé de service role. Sinon
//     n'importe qui ajouterait cet en-tête depuis son navigateur et
//     contournerait la limite de 5 analyses par 24 heures et le captcha.
//     C'est la même construction que `isInternal` (extension), et c'est le
//     test `appelApiExigeLesDeuxFacteurs` qui l'atteste.
//
//  3. LES PLAFONDS SONT DEUX, PAS UN. Un plafond mensuel par client (ce
//     qu'il a acheté) et un plafond journalier GLOBAL du trafic API, séparé
//     du public : un client ne peut pas, à lui seul, faire exploser la note
//     d'API Anthropic, et l'ensemble des clients non plus.

/** Préfixe lisible : permet de reconnaître une clé Inspexo dans un journal
 *  ou un ticket sans révéler quoi que ce soit d'utilisable. */
export const PREFIXE_CLE = "ix_live_";
/** Longueur de la partie secrète (caractères base64url). */
export const LONGUEUR_SECRET = 43; // 32 octets en base64url
export const CLE_RE = /^ix_live_[A-Za-z0-9_-]{43}$/;

/** Plafond journalier GLOBAL du trafic API, toutes clés confondues.
 *  Séparé du public : une rafale côté API ne doit jamais fermer le service
 *  gratuit, et inversement. */
export const PLAFOND_JOUR_API = 500;
/** Quota mensuel par défaut d'un nouveau client, tant que rien n'est signé. */
export const QUOTA_MENSUEL_DEFAUT = 100;

/** Clé neuve. Non pure (aléa) : c'est le seul endroit qui en produit. */
export function genererCle(): string {
  const octets = new Uint8Array(32);
  crypto.getRandomValues(octets);
  let bin = "";
  for (const o of octets) bin += String.fromCharCode(o);
  const b64 = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${PREFIXE_CLE}${b64}`;
}

export const cleValide = (cle: unknown): boolean => CLE_RE.test(String(cle ?? ""));

/** Empreinte salée d'une clé. Le sel est un secret serveur (API_KEY_SALT) :
 *  sans lui, une base volée ne permet pas d'attaquer les clés par
 *  dictionnaire, et les clés sont de toute façon à 256 bits d'entropie. */
export async function hacherCle(cle: string, sel: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${sel}:${cle}`));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Les 8 premiers caractères du secret, pour l'affichage dans l'admin.
 *  Insuffisant pour reconstituer la clé (il en reste 35 inconnus). */
export function apercuCle(cle: string): string {
  return cleValide(cle) ? `${cle.slice(0, PREFIXE_CLE.length + 8)}…` : "";
}

/** Comparaison en TEMPS CONSTANT de deux empreintes hexadécimales.
 *  Une comparaison `===` fuite la position du premier octet différent, ce qui
 *  permet de reconstituer une empreinte octet par octet. */
export function memeEmpreinte(a: unknown, b: unknown): boolean {
  const x = String(a ?? ""), y = String(b ?? "");
  if (x.length !== y.length || x.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

/** Clé présentée dans l'en-tête Authorization: Bearer … ou X-API-Key. */
export function cleDepuisRequete(entetes: {
  get(nom: string): string | null;
}): string | null {
  const bearer = entetes.get("authorization") ?? entetes.get("Authorization") ?? "";
  const m = bearer.match(/^Bearer\s+(\S+)$/i);
  if (m && cleValide(m[1])) return m[1];
  for (const nom of ["x-api-key", "X-API-Key", "x-inspexo-key"]) {
    const brut = entetes.get(nom) ?? "";
    if (cleValide(brut)) return brut;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Le drapeau d'appel API, côté fonction `score`.
// ---------------------------------------------------------------------------

/** L'appel vient-il de la fonction API ?
 *
 *  ⚠️ LES DEUX FACTEURS SONT EXIGÉS. L'en-tête seul ne suffit jamais : il est
 *  trivial à ajouter depuis un navigateur, et il ferait alors sauter la
 *  limite de 5 analyses par 24 heures et le captcha. Seule la clé de service
 *  role, que seul notre propre serveur détient, autorise ce passage. */
export function estAppelApi(
  entetes: { get(nom: string): string | null },
  serviceRoleKey: string | null | undefined,
): boolean {
  const idClient = (entetes.get("x-api-client") ?? "").trim();
  if (!idClient) return false;
  const autorisation = entetes.get("Authorization") ?? entetes.get("authorization") ?? "";
  // Pas de clé de service role connue ⇒ on ne fait confiance à rien.
  if (!serviceRoleKey) return false;
  return memeEmpreinte(autorisation, `Bearer ${serviceRoleKey}`);
}

// ---------------------------------------------------------------------------
// Quotas.
// ---------------------------------------------------------------------------

export type EtatQuota = {
  ok: boolean;
  raison: "ok" | "cle_inconnue" | "cle_revoquee" | "quota_mensuel" | "plafond_journalier";
  message: string;
  restant_mois?: number;
};

export const moisDe = (d: Date): string =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

export const jourDe = (d: Date): string => d.toISOString().slice(0, 10);

/** Décision de quota, PURE : la fonction SQL applique la même logique de
 *  façon atomique, celle-ci sert aux tests et aux messages. */
export function evaluerQuota(e: {
  trouve: boolean;
  actif: boolean;
  quota_mensuel: number;
  appels_mois: number;
  appels_jour_global: number;
  plafond_jour_global?: number;
}): EtatQuota {
  if (!e.trouve) {
    return {
      ok: false,
      raison: "cle_inconnue",
      message:
        "Clé d'API inconnue. Vérifiez l'en-tête Authorization: Bearer ix_live_… " +
        "(une clé n'est affichée qu'à sa création et ne peut pas être retrouvée ensuite).",
    };
  }
  if (!e.actif) {
    return {
      ok: false,
      raison: "cle_revoquee",
      message: "Cette clé d'API a été révoquée. Contactez contact@inspexo.io.",
    };
  }
  const plafondJour = e.plafond_jour_global ?? PLAFOND_JOUR_API;
  if (e.appels_jour_global >= plafondJour) {
    return {
      ok: false,
      raison: "plafond_journalier",
      message:
        `Plafond journalier de l'API atteint (${plafondJour} analyses, toutes clés confondues). ` +
        "Réessayez demain ; écrivez à contact@inspexo.io si vous avez besoin d'un volume supérieur.",
    };
  }
  if (e.appels_mois >= e.quota_mensuel) {
    return {
      ok: false,
      raison: "quota_mensuel",
      message:
        `Quota mensuel atteint (${e.quota_mensuel} analyses sur le mois en cours). ` +
        "Il se réinitialise le 1er du mois ; écrivez à contact@inspexo.io pour l'augmenter.",
    };
  }
  return {
    ok: true,
    raison: "ok",
    message: "",
    restant_mois: Math.max(0, e.quota_mensuel - e.appels_mois - 1),
  };
}
