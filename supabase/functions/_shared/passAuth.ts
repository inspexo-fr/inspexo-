// SPRINT 7 — Pass achat : l'appelant a-t-il un Pass ACTIF ?
// Le déblocage est toujours décidé ICI, côté serveur, à partir du JWT
// utilisateur (Authorization) — jamais d'un drapeau envoyé par le client.
// L'anon key est elle-même un JWT : seuls les jetons d'utilisateur comptent.
// deno-lint-ignore-file no-explicit-any

const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

export type AccesPass = {
  userId: string | null;
  email: string | null;
  passActif: boolean;
};

export async function passDepuisReq(admin: any, req: Request): Promise<AccesPass> {
  const aucun: AccesPass = { userId: null, email: null, passActif: false };
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt || jwt === SUPABASE_ANON_KEY) return aucun;

  let userId: string | null = null;
  let email: string | null = null;
  try {
    const { data: u } = await admin.auth.getUser(jwt);
    userId = u?.user?.id ?? null;
    email = u?.user?.email ?? null;
  } catch (_) {
    return aucun; // jeton invalide → traité comme anonyme
  }
  if (!userId) return aucun;

  try {
    // Rattachement paresseux : un Pass acheté avec cet email avant la
    // première connexion n'a pas encore de user_id (même règle que
    // get_mon_pass côté RPC).
    if (email) {
      // Le webhook stocke l'email en minuscules : égalité stricte suffit
      // (jamais ilike — « _ » y est un joker d'un caractère).
      await admin
        .from("passes")
        .update({ user_id: userId })
        .is("user_id", null)
        .eq("email", email.trim().toLowerCase());
    }
    const nowIso = new Date().toISOString();
    const { count } = await admin
      .from("passes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("statut", "actif")
      .lte("debut", nowIso)
      .gt("fin", nowIso);
    return { userId, email, passActif: (count ?? 0) > 0 };
  } catch (err) {
    console.error("passDepuisReq:", err);
    return { userId, email, passActif: false };
  }
}
