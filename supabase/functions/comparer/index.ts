// SPRINT 22 — Comparateur de dossiers (Pass).
//
// 2 ou 3 analyses du DOSSIER de l'appelant, alignées, et une recommandation
// calculée PAR RÈGLES (`_shared/comparateur.ts`) — jamais par le modèle.
// Aucun appel IA, rien n'est écrit.
//
// ⚠️ Deux vérifications serveur, toutes deux avant toute lecture d'analyse :
//   1. un Pass actif (jeton utilisateur, `passDepuisReq`) ;
//   2. chaque identifiant figure dans le dossier de CET utilisateur. Une
//      analyse publique n'est pas pour autant comparable par n'importe qui :
//      le comparateur expose le détail Pass (travaux chiffrés, coût ligne à
//      ligne) qu'une analyse publique masque.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { passDepuisReq } from "../_shared/passAuth.ts";
import { calculerCout3Ans, chargerContexteCout } from "../_shared/cout3ansSources.ts";
import { ficheDepuisAnalyse, recommander } from "../_shared/comparateur.ts";

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
    const acces = await passDepuisReq(admin, req);
    if (!acces.userId) return json({ error: "connexion_requise" }, 401);
    if (!acces.passActif) return json({ error: "pass_requis" }, 403);

    const body = await req.json().catch(() => null);
    const ids: string[] = Array.isArray(body?.ids)
      ? [...new Set(body.ids.filter((x: unknown): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)))]
      : [];
    if (ids.length < 2 || ids.length > 3) {
      return json({ error: "invalid_input", message: "Choisissez 2 ou 3 dossiers." }, 400);
    }

    const { data: suivis } = await admin
      .from("dossier").select("analysis_id").eq("user_id", acces.userId).in("analysis_id", ids);
    // deno-lint-ignore no-explicit-any
    const autorises = new Set(((suivis ?? []) as any[]).map((r) => r.analysis_id));
    if (ids.some((id) => !autorises.has(id))) return json({ error: "hors_dossier" }, 403);

    const { data: lignes } = await admin
      .from("analyses").select("id, verdict, score, result_json").in("id", ids);
    const ctx = await chargerContexteCout(admin);

    const fiches = ids.map((id) => {
      // deno-lint-ignore no-explicit-any
      const l = ((lignes ?? []) as any[]).find((x) => x.id === id);
      const rj = l?.result_json;
      if (!rj?.vehicule || rj.statut_analyse === "en_cours") return null;
      const { cout } = calculerCout3Ans(rj, ctx, { km_an: body?.km_an, region: body?.region, cv: body?.cv });
      return ficheDepuisAnalyse(id, rj, { verdict: l.verdict, score: l.score }, cout);
    });
    if (fiches.some((f) => f == null)) return json({ error: "analyse_incomplete" }, 409);

    // deno-lint-ignore no-explicit-any
    const ok = fiches as any[];
    return json({ fiches: ok, recommandation: recommander(ok) });
  } catch (e) {
    console.error("comparer:", e);
    return json({ error: "internal" }, 500);
  }
});
