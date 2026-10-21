// SPRINT 1.5 — Worker interne de génération de fiche famille moteur.
// Invoqué uniquement par la fonction `score` (service → service) : il dispose
// de son PROPRE budget wall-clock de 150 s, indépendant de celui de `score`.
// Auth stricte : Authorization doit porter exactement la service role key.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getOrCreateDefectSheet } from "../_shared/defectSheets.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

serve(async (req: Request) => {
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (auth !== `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const marque = typeof body?.marque === "string" ? body.marque.trim() : "";
    const famille = typeof body?.famille_moteur === "string" ? body.famille_moteur.trim() : "";
    if (!marque || !famille) {
      return new Response(JSON.stringify({ error: "invalid_input" }), { status: 400 });
    }

    const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const result = await getOrCreateDefectSheet(admin, ANTHROPIC_API_KEY!, {
      marque,
      famille_moteur: famille,
      moteur_label: typeof body?.moteur_label === "string" ? body.moteur_label : null,
      annee: typeof body?.annee === "number" ? body.annee : null,
    });

    return new Response(
      JSON.stringify({
        status: result.cacheStatus,
        pannes: result.sheet?.pannes?.length ?? 0,
        searches: result.searches,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("sheet-builder error:", err);
    return new Response(JSON.stringify({ error: "internal" }), { status: 500 });
  }
});
