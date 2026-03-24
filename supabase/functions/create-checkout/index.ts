import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIER_CONFIG: Record<string, { amount: number; label: string }> = {
  ia:          { amount: 990,   label: "IA Spécialisée — 9,90€" },
  visio:       { amount: 5900,  label: "Visio Test Drive — 59€" },
  inspection:  { amount: 24900, label: "Inspection Physique — 249€" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Vérifier l'authentification
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Non autorisé" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Init Supabase pour vérifier le JWT
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Utilisateur non authentifié" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { tier, vehicle_brand, vehicle_model, vehicle_year, vehicle_url } = await req.json();

    const tierConfig = TIER_CONFIG[tier];
    if (!tierConfig) {
      return new Response(
        JSON.stringify({ error: `Palier inconnu : ${tier}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!vehicle_brand || !vehicle_model) {
      return new Response(
        JSON.stringify({ error: "Marque et modèle obligatoires" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
      apiVersion: "2023-10-16",
    });

    const vehicleLabel = [vehicle_brand, vehicle_model, vehicle_year].filter(Boolean).join(" ");

    const paymentIntent = await stripe.paymentIntents.create({
      amount: tierConfig.amount,
      currency: "eur",
      automatic_payment_methods: { enabled: true },
      description: `Inspexo — ${tierConfig.label} — ${vehicleLabel}`,
      metadata: {
        user_id: user.id,
        user_email: user.email ?? "",
        tier,
        vehicle_brand,
        vehicle_model,
        vehicle_year: vehicle_year?.toString() ?? "",
        vehicle_url: vehicle_url ?? "",
      },
      // transfer_group lié au payment intent lui-même — utilisé pour relier
      // le Transfer expert lors de l'assignation (create-transfer)
      transfer_group: `pi_group_${user.id.slice(0, 8)}_${Date.now()}`,
    });

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("create-checkout error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
