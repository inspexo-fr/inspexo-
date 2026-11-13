// SPRINT 24 lot 3 — Webhook de la FORMULE PRO (endpoint Stripe DÉDIÉ, secret
// PRO_WEBHOOK_SECRET). Déployé --no-verify-jwt : l'authentification est la
// SIGNATURE Stripe, vérifiée AVANT tout effet de bord.
//   checkout.session.completed (mode subscription, metadata produit=pro)
//       → ligne `abonnements_pro` (idempotente : unique stripe_subscription)
//   customer.subscription.updated / deleted → statut et fin de période
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { statutDepuisStripe } from "../_shared/proAuth.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const PRO_WEBHOOK_SECRET = Deno.env.get("PRO_WEBHOOK_SECRET") ?? "";
const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });
const cryptoProvider = Stripe.createSubtleCryptoProvider();

serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("method_not_allowed", { status: 405 });
  if (!PRO_WEBHOOK_SECRET || !STRIPE_SECRET_KEY) return new Response("non configuré", { status: 503 });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("signature manquante", { status: 400 });
  const brut = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(brut, signature, PRO_WEBHOOK_SECRET, undefined, cryptoProvider);
  } catch (_) {
    return new Response("signature invalide", { status: 400 });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.mode !== "subscription" || s.metadata?.produit !== "pro" || !s.subscription) break;
        const sub = await stripe.subscriptions.retrieve(String(s.subscription));
        const { error } = await admin.from("abonnements_pro").upsert({
          user_id: s.metadata?.user_id || null,
          email: (s.customer_details?.email ?? s.customer_email ?? "").toLowerCase(),
          siret: String(s.metadata?.siret ?? ""),
          stripe_customer: typeof s.customer === "string" ? s.customer : null,
          stripe_subscription: sub.id,
          stripe_session: s.id,
          statut: statutDepuisStripe(sub.status),
          periode_fin: new Date(sub.current_period_end * 1000).toISOString(),
          cgv_version: String(s.metadata?.cgv_version ?? ""),
          updated_at: new Date().toISOString(),
        }, { onConflict: "stripe_subscription" });
        if (error) throw error;
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        if (sub.metadata?.produit !== "pro") break;
        const statut = event.type === "customer.subscription.deleted" ? "resilie" : statutDepuisStripe(sub.status);
        await admin.from("abonnements_pro").update({
          statut,
          periode_fin: new Date(sub.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("stripe_subscription", sub.id);
        break;
      }
    }
    return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("pro-webhook:", e);
    return new Response("erreur", { status: 500 });
  }
});
