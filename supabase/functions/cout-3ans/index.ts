// SPRINT 22 — Coût réel sur 3 ans d'un dossier.
//
// Calculé À LA LECTURE à partir du `result_json` déjà produit : aucun appel
// au modèle, et le score n'est pas touché. Toutes les analyses en profitent,
// anciennes comprises.
//
// ⚠️ VERROU SERVEUR, comme la négociation et le mode revendeur : sans Pass, la
// réponse ne porte que le TOTAL (et ce qu'il ne compte pas). Les lignes, leurs
// sources et l'entrée de recalcul ne quittent pas le serveur.
//
// Ouverte à anon : le total est gratuit. Rien n'est écrit en base.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { passDepuisReq } from "../_shared/passAuth.ts";
import { calculerCout3Ans, chargerContexteCout } from "../_shared/cout3ansSources.ts";
import { coutTroisAnsPublic } from "../_shared/cout3ans.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    // Le droit au détail se décide AVANT de lire la demande, depuis le jeton.
    const acces = await passDepuisReq(admin, req);

    const body = await req.json().catch(() => null);
    const id = typeof body?.analysis_id === "string" ? body.analysis_id : "";
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "invalid_input", message: "analysis_id requis." }, 400);

    const { data: a } = await admin.from("analyses").select("result_json").eq("id", id).maybeSingle();
    const rj = a?.result_json;
    if (!rj) return json({ error: "introuvable" }, 404);
    if (rj.statut_analyse === "en_cours") return json({ error: "en_cours" }, 409);
    if (!rj.vehicule) return json({ error: "sans_vehicule" }, 422);

    const ctx = await chargerContexteCout(admin);
    const { cout, entree } = calculerCout3Ans(rj, ctx, {
      km_an: body?.km_an,
      region: body?.region,
      cv: body?.cv,
    });

    if (!acces.passActif) return json({ pass: false, cout: coutTroisAnsPublic(cout) });
    // Avec Pass : l'ENTRÉE accompagne le résultat, pour que le navigateur
    // recalcule (kilométrage annuel, corrections) avec le même module.
    return json({ pass: true, cout, entree });
  } catch (e) {
    console.error("cout-3ans:", e);
    return json({ error: "internal" }, 500);
  }
});
