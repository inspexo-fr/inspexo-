// SPRINT 1.5 — Admin des fiches famille moteur.
// GET    : liste des fiches (?statut=generee|validee)
// PATCH  : { id, statut: "validee" } — relecture humaine (passe la fiche en
//          « base Inspexo ») ; accepte aussi { id, pannes } pour corriger la
//          liste avant validation.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sanitizePannes } from "../_shared/defectSheets.ts";

const ADMIN_EMAILS = ["contact@inspexo.io"];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing token" }), { status: 401, headers: cors });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });
    }
    if (!ADMIN_EMAILS.includes(user.email ?? "")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: cors });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (req.method === "GET") {
      const url = new URL(req.url);
      const statut = url.searchParams.get("statut");
      let query = admin.from("defect_sheets").select("*").order("created_at", { ascending: false }).limit(100);
      if (statut === "generee" || statut === "validee") query = query.eq("statut", statut);
      const { data, error } = await query;
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
      return new Response(JSON.stringify({ sheets: data }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (req.method === "PATCH") {
      const body = await req.json().catch(() => null);
      if (!body?.id) {
        return new Response(JSON.stringify({ error: "Missing id" }), { status: 400, headers: cors });
      }
      const fields: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.statut === "validee") {
        fields.statut = "validee";
        fields.validee_par = user.email;
        fields.validee_at = new Date().toISOString();
      }
      if (Array.isArray(body.pannes)) {
        // Règle d'or maintenue à la correction manuelle : URL obligatoire,
        // familles étrangères rejetées, champs typés/bornés.
        const { data: row } = await admin
          .from("defect_sheets")
          .select("famille_moteur, marque")
          .eq("id", body.id)
          .maybeSingle();
        if (!row) {
          return new Response(JSON.stringify({ error: "Sheet not found" }), { status: 404, headers: cors });
        }
        const { pannes: cleaned } = sanitizePannes(body.pannes, row.famille_moteur, row.marque);
        if (cleaned.length !== body.pannes.length) {
          return new Response(
            JSON.stringify({
              error: "pannes invalides",
              detail: `${body.pannes.length - cleaned.length} panne(s) rejetée(s) : URL source manquante, champs invalides ou famille moteur étrangère.`,
            }),
            { status: 400, headers: cors },
          );
        }
        fields.pannes = cleaned;
      }
      if (Object.keys(fields).length === 1) {
        return new Response(JSON.stringify({ error: "Nothing to update" }), { status: 400, headers: cors });
      }
      const { data, error } = await admin
        .from("defect_sheets")
        .update(fields)
        .eq("id", body.id)
        .select()
        .single();
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
      return new Response(JSON.stringify({ sheet: data }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: cors });
  } catch (err) {
    console.error("admin-defect-sheets error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: cors });
  }
});
