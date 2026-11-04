// SPRINT 13 — Administration des drapeaux de fonctionnalité.
//
// GET  → la liste et l'état brut de chaque drapeau.
// POST → change un état parmi eteint / admin_uniquement / public.
//
// Rôle administrateur vérifié EN BASE (`verifierAdmin`, table `admins`), comme
// les autres fonctions admin-* : il n'existe plus aucun ADMIN_EMAILS côté
// serveur depuis le sprint 3.1.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifierAdmin } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const acces = await verifierAdmin(req);
  if (!acces.ok) return json({ error: "forbidden" }, 403);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    if (req.method === "GET") {
      const { data, error } = await admin.rpc("drapeaux_liste");
      if (error) return json({ error: error.message }, 500);
      return json({ drapeaux: data ?? [] });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => null);
      const cle = typeof body?.cle === "string" ? body.cle.slice(0, 80) : null;
      const etat = body?.etat;
      if (!cle) return json({ error: "invalid_input", message: "cle requise." }, 400);
      if (!["eteint", "admin_uniquement", "public"].includes(etat)) {
        return json({ error: "invalid_input", message: "État inconnu." }, 400);
      }
      const { data, error } = await admin.rpc("drapeau_definir", {
        p_cle: cle,
        p_etat: etat,
        p_par: acces.user.email ?? null,
      });
      if (error) return json({ error: error.message }, 500);
      if (data?.ok !== true) return json({ ok: false, raison: data?.raison ?? "refuse" }, 409);
      return json({ ok: true, cle, etat });
    }

    return json({ error: "method_not_allowed" }, 405);
  } catch (e) {
    console.error("admin-drapeaux:", e);
    return json({ error: "internal" }, 500);
  }
});
