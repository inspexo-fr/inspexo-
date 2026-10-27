// SPRINT 3 — Audit de justesse (admin uniquement).
// GET  ?mode=random : une analyse tirée au hasard (non auditée en priorité)
//                     avec son texte d'annonce et son résultat complet.
// GET  ?mode=stats  : agrégats par type d'affirmation (juste/faux/discutable).
// POST { analysis_id, verdicts: [{claim_type, claim_text, verdict}] } :
//      enregistre la relecture humaine. La page publique /fiabilite lit les
//      agrégats via la RPC get_fiabilite (rien avant 50 analyses auditées).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifierAdmin } from "../_shared/adminAuth.ts";

const CLAIM_TYPES = [
  "panne", "rappel", "incoherence", "juridique", "photo", "prix", "cout", "raison", "entretien", "checklist",
];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    // Rôle admin vérifié en base (table admins) — sprint 3.1.
    const acces = await verifierAdmin(req);
    if (!acces.ok) {
      return new Response(JSON.stringify({ error: acces.error }), { status: acces.status, headers: cors });
    }
    const user = acces.user;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (req.method === "GET") {
      const mode = new URL(req.url).searchParams.get("mode") ?? "random";

      if (mode === "stats") {
        const { data: rows } = await admin
          .from("audits")
          .select("analysis_id, claim_type, verdict")
          .limit(10000);
        const parType: Record<string, { total: number; justes: number; fausses: number; discutables: number }> = {};
        const analyses = new Set<string>();
        for (const r of rows ?? []) {
          analyses.add(r.analysis_id);
          const t = parType[r.claim_type] ??= { total: 0, justes: 0, fausses: 0, discutables: 0 };
          t.total += 1;
          if (r.verdict === "juste") t.justes += 1;
          else if (r.verdict === "faux") t.fausses += 1;
          else t.discutables += 1;
        }
        return new Response(
          JSON.stringify({ analyses_auditees: analyses.size, seuil_publication: 50, par_type: parType }),
          { headers: { ...cors, "Content-Type": "application/json" } },
        );
      }

      // mode=random : analyse véhicule RÉELLE (jamais d'éval/test) terminée,
      // non auditée en priorité.
      const { count } = await admin
        .from("analyses")
        .select("id", { count: "exact", head: true })
        .eq("is_eval", false);
      if (!count) {
        return new Response(JSON.stringify({ analysis: null }), { headers: { ...cors, "Content-Type": "application/json" } });
      }
      // Tirage au hasard par offset ; une analyse déjà auditée n'est servie
      // qu'en dernier recours (si 12 tirages n'ont rien donné d'autre).
      let choisie = null;
      let secours = null;
      let dejaAuditee = false;
      for (let essai = 0; essai < 12 && !choisie; essai++) {
        const offset = Math.floor(Math.random() * count);
        const { data: rows } = await admin
          .from("analyses")
          .select("id, created_at, marque, modele, annee, verdict, score, input_text, result_json")
          .eq("is_eval", false)
          .order("created_at", { ascending: false })
          .range(offset, offset);
        const cand = rows?.[0];
        if (!cand) continue;
        if (cand.result_json?.type !== "vehicule") continue;
        if (cand.result_json?.statut_analyse === "en_cours" || cand.result_json?.etape === "erreur") continue;
        const { count: nAudits } = await admin
          .from("audits")
          .select("id", { count: "exact", head: true })
          .eq("analysis_id", cand.id);
        if ((nAudits ?? 0) > 0) {
          secours = secours ?? cand;
          continue;
        }
        choisie = cand;
      }
      if (!choisie && secours) {
        choisie = secours;
        dejaAuditee = true;
      }
      return new Response(
        JSON.stringify({ analysis: choisie, deja_auditee: dejaAuditee }),
        { headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => null);
      const analysisId = typeof body?.analysis_id === "string" ? body.analysis_id : null;
      // deno-lint-ignore no-explicit-any
      const verdicts: any[] = Array.isArray(body?.verdicts) ? body.verdicts.slice(0, 100) : [];
      if (!analysisId || verdicts.length === 0) {
        return new Response(JSON.stringify({ error: "analysis_id et verdicts requis" }), { status: 400, headers: cors });
      }
      const { data: existe } = await admin.from("analyses").select("id").eq("id", analysisId).maybeSingle();
      if (!existe) {
        return new Response(JSON.stringify({ error: "analyse introuvable" }), { status: 404, headers: cors });
      }
      const rows = verdicts
        .map((v) => ({
          analysis_id: analysisId,
          claim_type: CLAIM_TYPES.includes(v?.claim_type) ? v.claim_type : null,
          claim_text: typeof v?.claim_text === "string" ? v.claim_text.slice(0, 500) : "",
          verdict: ["juste", "faux", "discutable"].includes(v?.verdict) ? v.verdict : null,
          auditeur: user.email,
        }))
        .filter((r) => r.claim_type && r.claim_text && r.verdict);
      if (rows.length === 0) {
        return new Response(JSON.stringify({ error: "aucun verdict valide" }), { status: 400, headers: cors });
      }
      const { error } = await admin.from("audits").insert(rows);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
      }
      return new Response(JSON.stringify({ inserted: rows.length }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: cors });
  } catch (err) {
    console.error("admin-audit error:", err);
    return new Response(JSON.stringify({ error: "internal" }), { status: 500, headers: cors });
  }
});
