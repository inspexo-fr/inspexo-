// SPRINT 15 — Pilotage de la vérification indépendante (admin).
//
// GET  → état : analyses vérifiées, compteurs, analyses en attente de
//        vérification, et la liste des affirmations NON SOUTENUES à traiter.
// POST → marque une affirmation comme corrigée (`corrigee_le` + note).
//
// ⚠️ « Corrigée » veut dire que le défaut a été traité À LA SOURCE : panne
// retirée de la fiche, coût invalidé, source remplacée. Cocher sans agir
// ferait monter un compteur publié sur la page /fiabilite — c'est-à-dire
// publier un chiffre faux. La note est obligatoire pour cette raison : elle
// oblige à dire CE QUI a été fait.
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

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    if (req.method === "GET") {
      const limite = Math.min(50, Math.max(1, Number(new URL(req.url).searchParams.get("limite") ?? 20)));
      const [{ data: stats }, { data: aFaire }, { data: aTraiter }] = await Promise.all([
        admin.rpc("get_fiabilite"),
        admin.rpc("analyses_a_verifier", { p_limite: limite }),
        admin
          .from("verifications")
          .select("id, analysis_id, claim_type, claim_text, source_url, verdict, justification, corrigee_le, corrigee_note, created_at")
          .in("verdict", ["non_soutenue", "mauvais_moteur"])
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
      return json({
        stats: stats ?? null,
        a_verifier: aFaire ?? [],
        a_traiter: aTraiter ?? [],
      });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => null);
      const id = typeof body?.id === "string" && /^[0-9a-f-]{36}$/i.test(body.id) ? body.id : null;
      const note = typeof body?.note === "string" ? body.note.trim().slice(0, 500) : "";
      if (!id) return json({ error: "invalid_input", message: "id requis." }, 400);
      // La note est OBLIGATOIRE : voir l'en-tête de ce fichier.
      if (note.length < 8) {
        return json({ error: "note_requise", message: "Dites ce qui a été corrigé (8 caractères minimum)." }, 400);
      }
      const { error } = await admin
        .from("verifications")
        .update({ corrigee_le: new Date().toISOString(), corrigee_note: note })
        .eq("id", id)
        .is("corrigee_le", null); // une correction ne se réécrit pas : c'est une trace
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: "method_not_allowed" }, 405);
  } catch (e) {
    console.error("admin-fiabilite:", e);
    return json({ error: "server_error" }, 500);
  }
});
