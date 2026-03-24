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

  try {
    const { mission_id } = await req.json();

    if (!mission_id) {
      return new Response(
        JSON.stringify({ error: "mission_id requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Init Supabase admin
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Récupérer la mission avec l'expert assigné
    const { data: mission, error: missionError } = await supabaseAdmin
      .from("missions")
      .select("*, experts(stripe_account_id)")
      .eq("id", mission_id)
      .single();

    if (missionError || !mission) {
      return new Response(
        JSON.stringify({ error: "Mission introuvable" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!mission.expert_id) {
      return new Response(
        JSON.stringify({ error: "Aucun expert assigné à cette mission" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!mission.experts?.stripe_account_id) {
      return new Response(
        JSON.stringify({ error: "L'expert n'a pas de compte Stripe Connect" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (mission.price_expert <= 0) {
      // Palier IA : pas de transfert nécessaire
      return new Response(
        JSON.stringify({ message: "Palier IA — aucun transfert expert nécessaire" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (mission.transfer_id) {
      return new Response(
        JSON.stringify({ error: "Transfert déjà effectué", transfer_id: mission.transfer_id }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Créer le transfert Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
      apiVersion: "2023-10-16",
    });

    const transfer = await stripe.transfers.create({
      amount: Math.round(mission.price_expert * 100), // en centimes
      currency: "eur",
      destination: mission.experts.stripe_account_id,
      transfer_group: `mission_${mission_id}`,
      metadata: {
        mission_id: mission_id,
        tier: mission.tier,
        expert_id: mission.expert_id,
      },
    });

    // Sauvegarder le transfer_id dans la mission
    await supabaseAdmin
      .from("missions")
      .update({
        transfer_id: transfer.id,
        status: "in_progress",
      })
      .eq("id", mission_id);

    return new Response(
      JSON.stringify({ success: true, transfer_id: transfer.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("create-transfer error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
