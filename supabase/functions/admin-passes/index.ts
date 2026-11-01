// SPRINT 7 — Administration des Pass achat (rôle admin en base, sprint 3.1).
//   GET  → liste complète des Pass (l'export CSV est composé côté front).
//   POST { action: "rembourser", id } → remboursement Stripe intégral en un
//        clic + statut "rembourse" + email de confirmation à l'acheteur.
// Le webhook charge.refunded repasserait de toute façon le statut : la mise à
// jour directe ici rend l'admin cohérent sans attendre Stripe.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifierAdmin } from "../_shared/adminAuth.ts";
import { emailPassRembourse } from "../_shared/notify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
  if (!acces.ok) return json({ error: acces.error }, acces.status);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    if (req.method === "GET") {
      const { data, error } = await admin
        .from("passes")
        .select("id, email, mode, statut, montant_cents, devise, retractation_renoncee, cgv_version, debut, fin, created_at, stripe_session, stripe_payment_intent, user_id")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const now = Date.now();
      const passes = (data ?? []).map((p) => ({
        ...p,
        actif: p.statut === "actif" &&
          now >= new Date(p.debut).getTime() && now < new Date(p.fin).getTime(),
      }));
      return json({ passes });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => null);
      if (body?.action !== "rembourser" || typeof body?.id !== "string") {
        return json({ error: "invalid_input" }, 400);
      }

      const { data: pass } = await admin
        .from("passes")
        .select("id, email, statut, montant_cents, stripe_payment_intent")
        .eq("id", body.id)
        .maybeSingle();
      if (!pass) return json({ error: "not_found" }, 404);
      if (pass.statut === "rembourse") return json({ error: "deja_rembourse" }, 409);
      if (!pass.stripe_payment_intent) return json({ error: "paiement_introuvable" }, 409);

      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
        apiVersion: "2023-10-16",
      });
      const refund = await stripe.refunds.create({
        payment_intent: pass.stripe_payment_intent,
      });

      const { error: updErr } = await admin
        .from("passes")
        .update({ statut: "rembourse" })
        .eq("id", pass.id);
      if (updErr) throw updErr;

      const emailEnvoye = await emailPassRembourse(pass.email, pass.montant_cents);
      await admin.from("events").insert({
        name: "pass_rembourse",
        props_json: { via: "admin", par: acces.user.email, email_envoye: emailEnvoye },
      });

      return json({ ok: true, refund_id: refund.id, refund_status: refund.status });
    }

    return json({ error: "method_not_allowed" }, 405);
  } catch (error) {
    console.error("admin-passes error:", error);
    return json({ error: error?.message ?? "internal" }, 500);
  }
});
