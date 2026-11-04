// SPRINT 11 — Tunnel de conversion, par semaine et par source.
//
// Mesure SANS traceur : les étapes sont reconstituées côté serveur à partir
// d'événements reliés par `analysis_id`. Aucun identifiant navigateur, aucun
// cookie, aucune IP — la source est une simple étiquette de campagne, et
// elle n'apparaît QU'EN AGRÉGÉ : jamais à côté d'une adresse email.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifierAdmin } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const acces = await verifierAdmin(req);
  if (!acces.ok) return json({ error: acces.error }, acces.status);
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  try {
    const semaines = Number(new URL(req.url).searchParams.get("semaines") ?? 12);
    const { data, error } = await admin.rpc("get_parcours", { p_semaines: semaines });
    if (error) throw error;
    // SPRINT 15 — Compteur de la liste d'attente pro, rendu avec le tunnel :
    // c'est une mesure de demande, elle vit au même endroit. Le compteur est
    // AGRÉGÉ — aucune adresse email ne remonte ici.
    const { data: pro } = await admin.rpc("get_leads_pro_compteur");
    return json({ ...(data ?? {}), leads_pro: pro ?? null });
  } catch (e) {
    console.error("admin-parcours:", e);
    return json({ error: "server_error" }, 500);
  }
});
