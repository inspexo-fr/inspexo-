import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
    apiVersion: "2023-10-16",
  });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const body = await req.text();

  let event: Stripe.Event;

  try {
    if (!signature || !webhookSecret) {
      throw new Error("Signature ou secret webhook manquant");
    }
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return new Response(
      JSON.stringify({ error: `Webhook Error: ${err.message}` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  console.log(`Webhook event: ${event.type}`);

  try {
    switch (event.type) {

      // ── Paiement client réussi ─────────────────────────────────────────────
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const { user_id, tier, vehicle_brand, vehicle_model, vehicle_year, vehicle_url } =
          paymentIntent.metadata;

        console.log("payment_intent.succeeded:", paymentIntent.id, "user:", user_id);

        // Mettre à jour la mission si elle existe déjà (insérée côté client)
        const { error } = await supabaseAdmin
          .from("missions")
          .update({ status: "paid" })
          .eq("stripe_payment_intent_id", paymentIntent.id);

        if (error) {
          console.error("Erreur update mission status:", error);
        }
        break;
      }

      // ── Paiement échoué ────────────────────────────────────────────────────
      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log("payment_intent.payment_failed:", paymentIntent.id);

        await supabaseAdmin
          .from("missions")
          .update({ status: "payment_failed" })
          .eq("stripe_payment_intent_id", paymentIntent.id);
        break;
      }

      // ── Onboarding expert Stripe Connect complété ──────────────────────────
      case "account.updated": {
        const account = event.data.object as Stripe.Account;

        if (account.charges_enabled && account.payouts_enabled) {
          const expert_id = account.metadata?.expert_id;

          if (!expert_id) {
            console.warn("account.updated: pas d'expert_id dans metadata", account.id);
            break;
          }

          console.log("account.updated: expert onboarding complet", expert_id, account.id);

          const { error } = await supabaseAdmin
            .from("experts")
            .update({
              stripe_account_id: account.id,
              status: "approved",
            })
            .eq("id", expert_id);

          if (error) {
            console.error("Erreur update expert status:", error);
          }
        }
        break;
      }

      default:
        console.log(`Événement non géré : ${event.type}`);
    }
  } catch (err) {
    console.error("Erreur handler webhook:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
