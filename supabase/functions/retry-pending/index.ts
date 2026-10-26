// Reprise des analyses mises en attente pendant une indisponibilité de l'IA.
// Déclenchée : (a) automatiquement par `score` dès qu'une analyse réussit
// (signal fiable que le service est revenu), (b) manuellement avec le secret
// d'éval. Chaque demande traitée déclenche l'envoi du verdict par email.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { envoyerVerdict } from "../_shared/notify.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const EVAL_BYPASS_SECRET = Deno.env.get("EVAL_BYPASS_SECRET") ?? null;

const MAX_TENTATIVES = 5;
const LOT = 5; // demandes traitées par appel (budget wall-clock 150 s)

async function secretOk(req: Request): Promise<boolean> {
  if (req.headers.get("Authorization") === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) return true;
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
  if (!(await secretOk(req))) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
  }
  const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
  const resultats = { traitees: 0, echecs: 0, restantes: 0 };

  try {
    const { data: pending } = await admin
      .from("pending_analyses")
      .select("id, email, input_text, usage_vehicule, tentatives")
      .eq("statut", "en_attente")
      .lt("tentatives", MAX_TENTATIVES)
      .order("created_at", { ascending: true })
      .limit(LOT);

    for (const p of (pending ?? [])) {
      await admin
        .from("pending_analyses")
        .update({ tentatives: p.tentatives + 1, derniere_tentative: new Date().toISOString() })
        .eq("id", p.id);

      const res = await fetch(`${SUPABASE_URL}/functions/v1/score`, {
        method: "POST",
        signal: AbortSignal.timeout(170_000),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          // Demande déjà comptabilisée au dépôt : on ne redébite pas le quota.
          "x-intake-ip-hash": "retry:pending",
        },
        body: JSON.stringify({
          text: p.input_text,
          ...(p.usage_vehicule ? { usage: p.usage_vehicule } : {}),
        }),
      });
      const body = await res.json().catch(() => null);

      if (res.ok && body?.id) {
        const vh = body.result?.vehicule ?? {};
        const label = [vh.marque, vh.modele, vh.motorisation, vh.annee].filter(Boolean).join(" · ") ||
          "Véhicule";
        const envoye = await envoyerVerdict(p.email, body.id, body.result.verdict, body.result.score, label);
        await admin
          .from("pending_analyses")
          .update({ statut: "traitee", analysis_id: body.id })
          .eq("id", p.id);
        await admin.from("events").insert({
          name: "pending_analysis_traitee",
          analysis_id: body.id,
          props_json: { pending_id: p.id, email_envoye: envoye },
        });
        resultats.traitees += 1;
      } else {
        resultats.echecs += 1;
        if (p.tentatives + 1 >= MAX_TENTATIVES) {
          await admin.from("pending_analyses").update({ statut: "echec_definitif" }).eq("id", p.id);
          await admin.from("events").insert({
            name: "pending_analysis_abandonnee",
            props_json: { pending_id: p.id, tentatives: p.tentatives + 1 },
          });
        }
        break; // service toujours indisponible : inutile d'insister sur ce lot
      }
    }

    const { count } = await admin
      .from("pending_analyses")
      .select("id", { count: "exact", head: true })
      .eq("statut", "en_attente");
    resultats.restantes = count ?? 0;

    return new Response(JSON.stringify(resultats), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("retry-pending error:", err);
    return new Response(JSON.stringify({ error: "internal" }), { status: 500 });
  }
});
