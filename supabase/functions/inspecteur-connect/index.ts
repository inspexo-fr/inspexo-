// SPRINT 8 — Stripe Connect de l'inspecteur, AUTHENTIFIÉ.
// Remplace create-connect-account, qui délivrait un lien d'onboarding à
// quiconque connaissait un identifiant d'expert (aucune authentification).
// Ici, le compte visé est TOUJOURS celui de l'appelant : il est retrouvé par
// son JWT, jamais par un identifiant reçu du client.
//
//   POST {}                 → crée le compte Express si besoin et rend un
//                             lien d'onboarding valable quelques minutes.
//   POST { action: "etat" } → rafraîchit charges/payouts depuis Stripe et
//                             met à jour stripe_paiements_actifs.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const ORIGINE = "https://www.inspexo.io";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    if (!STRIPE_SECRET_KEY) return json({ error: "stripe_absent" }, 503);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = await admin.auth.getUser(jwt);
    const user = u?.user ?? null;
    if (!user) return json({ error: "unauthorized", message: "Connexion requise." }, 401);

    // Le compte Connect est celui de L'APPELANT, retrouvé par son JWT.
    const { data: insp } = await admin
      .from("inspecteurs")
      .select("id, email, nom, siret, stripe_account_id, statut")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!insp) {
      return json({ error: "candidature_absente", message: "Remplissez d'abord votre candidature." }, 404);
    }
    if (insp.statut === "refuse" || insp.statut === "suspendu") {
      return json({ error: "forbidden", message: "Compte non actif." }, 403);
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });
    const body = await req.json().catch(() => ({}));

    // ---- Rafraîchissement de l'état ----
    if (body?.action === "etat") {
      if (!insp.stripe_account_id) return json({ connecte: false, paiements_actifs: false });
      const compte = await stripe.accounts.retrieve(insp.stripe_account_id);
      const actifs = compte.charges_enabled === true && compte.payouts_enabled === true;
      await admin.from("inspecteurs")
        .update({ stripe_paiements_actifs: actifs })
        .eq("id", insp.id);
      return json({
        connecte: true,
        paiements_actifs: actifs,
        informations_requises: (compte.requirements?.currently_due ?? []).length,
      });
    }

    // ---- Création du compte + lien d'onboarding ----
    let accountId = insp.stripe_account_id;
    if (!accountId) {
      const compte = await stripe.accounts.create({
        type: "express",
        country: "FR",
        email: insp.email,
        capabilities: { transfers: { requested: true } },
        business_type: "individual",
        business_profile: {
          mcc: "7538", // services d'entretien automobile
          product_description: "Inspection de véhicules d'occasion pour le compte d'acheteurs particuliers",
        },
        metadata: { inspecteur_id: insp.id, siret: insp.siret ?? "" },
      });
      accountId = compte.id;
      await admin.from("inspecteurs").update({ stripe_account_id: accountId }).eq("id", insp.id);
    }

    // ⚠️ Le retour DOIT pointer vers /inspecteur/inscription : c'est le seul
    // écran qui rappelle `etatConnect`, donc le seul qui repasse
    // stripe_paiements_actifs à true après le KYC. Avec l'ancien retour vers
    // /inspecteur, un inspecteur terminait son onboarding sans que le drapeau
    // ne change : il acceptait des missions, se déplaçait, et le versement
    // était silencieusement sauté (audit du 2 nov., défaut majeur n° 2).
    const lien = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${ORIGINE}/inspecteur/inscription?stripe=retour`,
      return_url: `${ORIGINE}/inspecteur/inscription?stripe=ok`,
      type: "account_onboarding",
    });

    return json({ url: lien.url });
  } catch (error) {
    console.error("inspecteur-connect error:", error);
    return json({ error: "internal", message: "Connexion Stripe impossible. Réessayez." }, 500);
  }
});
