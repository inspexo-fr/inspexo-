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
    const { expert_id } = await req.json();

    if (!expert_id) {
      return new Response(
        JSON.stringify({ error: "expert_id requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Vérifier que l'expert existe
    const { data: expert, error: expertError } = await supabaseAdmin
      .from("experts")
      .select("id, email, stripe_account_id")
      .eq("id", expert_id)
      .single();

    if (expertError || !expert) {
      return new Response(
        JSON.stringify({ error: "Expert introuvable" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
      apiVersion: "2023-10-16",
    });

    let accountId = expert.stripe_account_id;

    // Créer le compte Connect seulement s'il n'existe pas encore
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "FR",
        email: expert.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "individual",
        metadata: { expert_id },
      });

      accountId = account.id;

      // Sauvegarder le stripe_account_id
      const { error: updateError } = await supabaseAdmin
        .from("experts")
        .update({ stripe_account_id: accountId })
        .eq("id", expert_id);

      if (updateError) {
        console.error("Erreur update stripe_account_id:", updateError);
      }
    }

    // Générer le lien d'onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: "https://www.inspexo.io",
      return_url: "https://www.inspexo.io?stripe_onboarding=complete",
      type: "account_onboarding",
    });

    return new Response(
      JSON.stringify({ url: accountLink.url, account_id: accountId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("create-connect-account error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
