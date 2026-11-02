// SPRINT 8 (correctif d'audit) — URL signée d'une photo de rapport.
//
// POURQUOI UNE FONCTION ET PAS UNE POLICY : la décision « cet appelant a-t-il
// le droit de voir cette photo ? » exige de lire inspection_photos,
// inspections et inspecteurs — trois tables dont la RLS est active SANS
// AUCUNE policy, donc invisibles au rôle authenticated. Une policy storage
// qui les interroge est toujours fausse : l'acheteur qui venait de payer
// 179 € ne voyait jamais les photos de son rapport, sans même un message
// d'erreur. La policy a été retirée ; la vérification se fait ici, en service
// role, puis l'URL est signée pour 5 minutes.
//
// Règle inchangée : seuls l'acheteur de CETTE inspection, l'inspecteur qui
// l'a faite, et les admins voient ces photos.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DUREE_SIGNATURE = 300; // 5 minutes

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = await admin.auth.getUser(jwt);
    const user = u?.user ?? null;
    if (!user) return json({ error: "unauthorized", message: "Connexion requise." }, 401);

    const body = await req.json().catch(() => null);
    const inspectionId = typeof body?.inspection_id === "string" ? body.inspection_id : null;
    if (!inspectionId || !/^[0-9a-f-]{36}$/i.test(inspectionId)) {
      return json({ error: "invalid_input", message: "inspection_id requis." }, 400);
    }

    const { data: insp } = await admin
      .from("inspections")
      .select("id, acheteur_id, inspecteur_id")
      .eq("id", inspectionId)
      .maybeSingle();
    if (!insp) return json({ error: "not_found" }, 404);

    let autorise = insp.acheteur_id === user.id;
    if (!autorise && insp.inspecteur_id) {
      const { data: ins } = await admin
        .from("inspecteurs").select("user_id").eq("id", insp.inspecteur_id).maybeSingle();
      autorise = ins?.user_id === user.id;
    }
    if (!autorise) {
      const { count } = await admin
        .from("admins").select("user_id", { count: "exact", head: true }).eq("user_id", user.id);
      autorise = (count ?? 0) > 0;
    }
    if (!autorise) return json({ error: "forbidden" }, 403);

    // Les chemins viennent de la base, jamais du client : impossible de faire
    // signer un objet qui n'appartient pas à cette inspection.
    const { data: photos } = await admin
      .from("inspection_photos")
      .select("chemin, organe, legende")
      .eq("inspection_id", inspectionId)
      .order("created_at");

    const signees: Array<{ url: string; organe: string | null; legende: string | null }> = [];
    for (const p of photos ?? []) {
      const { data: s } = await admin.storage
        .from("rapports").createSignedUrl(p.chemin, DUREE_SIGNATURE);
      if (s?.signedUrl) signees.push({ url: s.signedUrl, organe: p.organe, legende: p.legende });
    }

    return json({ photos: signees, expire_dans: DUREE_SIGNATURE });
  } catch (error) {
    console.error("inspection-photo error:", error);
    return json({ error: "internal", message: "Erreur interne." }, 500);
  }
});
