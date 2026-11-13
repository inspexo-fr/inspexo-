// SPRINT 24 lot 3 — Accès à la FORMULE PRO (distincte du Pass).
// Un administrateur passe toujours (essais en production, drapeau
// `admin_uniquement`) ; sinon il faut un abonnement pro ACTIF dont la période
// n'est pas échue. Décidé CÔTÉ SERVEUR, depuis le jeton : jamais le client.
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

export type AccesPro = { userId: string | null; admin: boolean; proActif: boolean };

/** Statut Stripe d'un abonnement ⇒ notre statut. */
export function statutDepuisStripe(s: unknown): "actif" | "impaye" | "resilie" {
  const t = String(s ?? "");
  if (t === "active" || t === "trialing") return "actif";
  if (t === "past_due" || t === "unpaid" || t === "incomplete") return "impaye";
  return "resilie";
}

// deno-lint-ignore no-explicit-any
export async function accesProDepuisReq(admin: any, req: Request): Promise<AccesPro> {
  const aucun: AccesPro = { userId: null, admin: false, proActif: false };
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt || jwt === SUPABASE_ANON_KEY) return aucun;
  let userId: string | null = null;
  try {
    const { data: u } = await admin.auth.getUser(jwt);
    userId = u?.user?.id ?? null;
  } catch (_) {
    return aucun;
  }
  if (!userId) return aucun;
  const { count: nAdmin } = await admin.from("admins").select("user_id", { count: "exact", head: true }).eq("user_id", userId);
  if ((nAdmin ?? 0) > 0) return { userId, admin: true, proActif: true };
  const { count } = await admin.from("abonnements_pro").select("id", { count: "exact", head: true })
    .eq("user_id", userId).eq("statut", "actif").gt("periode_fin", new Date().toISOString());
  return { userId, admin: false, proActif: (count ?? 0) > 0 };
}
