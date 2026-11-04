// Contrôle d'accès administrateur : le rôle est STOCKÉ EN BASE (table admins),
// plus jamais comparé à une liste d'emails codée en dur (sprint 3.1).
// Usage dans une fonction admin-* :
//   const acces = await verifierAdmin(req);
//   if (!acces.ok) return json({ error: acces.error }, acces.status);
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type AccesAdmin =
  | { ok: true; user: { id: string; email: string | null } }
  | { ok: false; status: number; error: string };

export async function verifierAdmin(req: Request): Promise<AccesAdmin> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return { ok: false, status: 401, error: "Missing token" };

  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error } = await anonClient.auth.getUser();
  if (error || !user) return { ok: false, status: 401, error: "Unauthorized" };

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { count } = await admin
    .from("admins")
    .select("user_id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) === 0) return { ok: false, status: 403, error: "Forbidden" };

  return { ok: true, user: { id: user.id, email: user.email ?? null } };
}

/** L'utilisateur déjà résolu est-il administrateur ?
 *
 * Variante de `verifierAdmin` pour les fonctions qui ont DÉJÀ un client
 * service role et l'identifiant de l'appelant (score, qui l'obtient de
 * `passDepuisReq`) : elle évite un second aller-retour `getUser`.
 * Le rôle reste lu en base — jamais déduit d'un email ni d'un en-tête. */
// deno-lint-ignore no-explicit-any
export async function estAdminUserId(admin: any, userId: string | null): Promise<boolean> {
  if (!userId) return false;
  try {
    const { count } = await admin
      .from("admins")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", userId);
    return (count ?? 0) > 0;
  } catch (err) {
    // Un échec de lecture ne doit JAMAIS ouvrir un passe-droit.
    console.error("estAdminUserId:", err);
    return false;
  }
}
