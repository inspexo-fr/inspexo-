import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL        = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY            = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const ADMIN_EMAIL         = "contact@inspexo.io";

async function sendEmail(to: string, template: string, data: Record<string, unknown>) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": ANON_KEY,
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ to, template, data }),
    });
  } catch (err) {
    console.error(`sendEmail(${template}) failed:`, err);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
    apiVersion: "2023-10-16",
  });

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const signature    = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const body         = await req.text();

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
        console.log("payment_intent.succeeded:", paymentIntent.id);

        // 1. Mettre à jour le statut de la mission insérée côté client
        await supabaseAdmin
          .from("missions")
          .update({ status: "paid" })
          .eq("stripe_payment_intent_id", paymentIntent.id);

        // 2. Récupérer la mission pour l'auto-assignation
        const { data: mission } = await supabaseAdmin
          .from("missions")
          .select("id, tier, vehicle_brand, vehicle_model, vehicle_year, expert_id, user_id")
          .eq("stripe_payment_intent_id", paymentIntent.id)
          .maybeSingle();

        if (!mission) {
          // Race condition : le client n'a pas encore inséré la mission
          // L'admin peut assigner manuellement via le dashboard
          console.warn("Mission introuvable pour le PI:", paymentIntent.id, "— assignation ignorée");
          break;
        }

        // 3. Auto-assignation uniquement pour visio/inspection sans expert pré-choisi
        if (!mission.expert_id && (mission.tier === "visio" || mission.tier === "inspection")) {
          console.log("Auto-assignation pour mission:", mission.id, "marque:", mission.vehicle_brand);

          const { data: expert } = await supabaseAdmin
            .from("experts")
            .select("id, email, full_name, brands, avg_rating, review_count")
            .eq("status", "approved")
            .not("stripe_account_id", "is", null)
            .contains("brands", [mission.vehicle_brand])
            .order("review_count", { ascending: false })
            .order("avg_rating", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (expert) {
            // Assigner l'expert
            await supabaseAdmin
              .from("missions")
              .update({ expert_id: expert.id, status: "expert_assigned" })
              .eq("id", mission.id);

            console.log("Expert assigné:", expert.id, expert.full_name, "→ mission:", mission.id);

            const vehicleLabel = [mission.vehicle_brand, mission.vehicle_model, mission.vehicle_year]
              .filter(Boolean).join(" ");
            const tierLabel = mission.tier === "visio" ? "Visio Test Drive (59€)" : "Inspection Physique (249€)";

            // Email à l'expert
            if (expert.email) {
              await sendEmail(expert.email, "expert_new_mission", {
                expert_name: expert.full_name,
                brand:  mission.vehicle_brand,
                model:  mission.vehicle_model,
                year:   mission.vehicle_year,
                tier:   tierLabel,
                vehicle: vehicleLabel,
              });
            }

            // Email au client
            const { data: profile } = await supabaseAdmin
              .from("profiles")
              .select("email")
              .eq("id", mission.user_id)
              .maybeSingle();

            if (profile?.email) {
              await sendEmail(profile.email, "mission_assigned", {
                expert_name: expert.full_name,
                brand:  mission.vehicle_brand,
                model:  mission.vehicle_model,
                vehicle: vehicleLabel,
              });
            }

          } else {
            // Aucun expert disponible pour cette marque → alerte admin
            console.warn("Aucun expert pour:", mission.vehicle_brand, "— alerte admin");

            const vehicleLabel = [mission.vehicle_brand, mission.vehicle_model, mission.vehicle_year]
              .filter(Boolean).join(" ");

            await sendEmail(ADMIN_EMAIL, "admin_no_expert", {
              brand:      mission.vehicle_brand,
              model:      mission.vehicle_model,
              year:       mission.vehicle_year,
              vehicle:    vehicleLabel,
              tier:       mission.tier,
              mission_id: mission.id,
            });
          }
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

          await supabaseAdmin
            .from("experts")
            .update({ stripe_account_id: account.id, status: "approved" })
            .eq("id", expert_id);
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
