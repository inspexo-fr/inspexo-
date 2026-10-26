// SPRINT 1.5 — Worker interne de génération de fiche famille moteur.
// Invoqué uniquement par la fonction `score` (service → service) : il dispose
// de son PROPRE budget wall-clock de 150 s, indépendant de celui de `score`.
// Auth stricte : Authorization doit porter exactement la service role key.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getOrCreateDefectSheet, refreshProgrammes } from "../_shared/defectSheets.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const EVAL_BYPASS_SECRET = Deno.env.get("EVAL_BYPASS_SECRET") ?? null;
/** Secret d'éval accepté pour les opérations internes (temps constant). */
async function evalSecretMatches(req: Request): Promise<boolean> {
  if (!EVAL_BYPASS_SECRET) return false;
  const given = req.headers.get("x-eval-secret");
  if (!given) return false;
  const digest = async (v: string) =>
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)));
  const [a, b] = await Promise.all([digest(given), digest(EVAL_BYPASS_SECRET)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

serve(async (req: Request) => {
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const evalOk = await evalSecretMatches(req);
    if (auth !== `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` && !evalOk) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const marque = typeof body?.marque === "string" ? body.marque.trim() : "";
    const famille = typeof body?.famille_moteur === "string" ? body.famille_moteur.trim() : "";
    if (!marque || !famille) {
      return new Response(JSON.stringify({ error: "invalid_input" }), { status: 400 });
    }

    const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Mode « programmes » : rejoue UNIQUEMENT la recherche d'extensions de
    // garantie sur une fiche existante (régénération ciblée).
    if (body?.mode === "programmes") {
      const out = await refreshProgrammes(admin, ANTHROPIC_API_KEY!, marque, famille);
      return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json" } });
    }

    // Mode « regenerer » : relance une génération complète (seuil qualité inclus)
    // hors cache et hors cooldown. L'ancienne fiche n'est JAMAIS supprimée au
    // préalable : si la nouvelle génération échoue, la fiche existante reste en
    // place (c'est getOrCreateDefectSheet qui remplace l'ancienne, et seulement
    // après une génération réussie).
    const force = body?.mode === "regenerer";

    const result = await getOrCreateDefectSheet(admin, ANTHROPIC_API_KEY!, {
      force,
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
