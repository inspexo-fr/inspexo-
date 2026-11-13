// SPRINT 24 lot 3 — FORMULE PRO : abonnement Stripe mensuel (PRÉPARÉ, ÉTEINT).
//
//   GET  → configuration publique { actif, cgv_version }
//   POST → session d'abonnement Stripe (compte connecté, SIRET, CGV acceptées)
//
// ⚠️ La vente n'est ACTIVE que si les trois sont réunis : drapeau
// `formule_pro` ouvert, clé Stripe, et prix mensuel posé (secret
// PRO_PRICE_ID, un Price Stripe récurrent). Aujourd'hui : aucun des deux
// derniers n'est posé, le drapeau est éteint — rien ne peut être vendu.
// ⚠️ L'accès n'est ouvert que par le WEBHOOK (`pro-webhook`), jamais ici.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { siretValide } from "../_shared/inspection.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? null;
const PRO_PRICE_ID = (Deno.env.get("PRO_PRICE_ID") ?? "").trim();
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ORIGINE = "https://www.inspexo.io";
// Les CGV pro (docs/cgv-pro-v0.md) sont un BROUILLON non publié : la version
// estampillée est celle du brouillon, à remplacer à la publication.
export const CGV_PRO_VERSION = "brouillon-v0";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// deno-lint-ignore no-explicit-any
async function venteOuverte(req: Request): Promise<boolean> {
  if (!STRIPE_SECRET_KEY || !/^price_/.test(PRO_PRICE_ID)) return false;
  const commeAppelant = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data } = await commeAppelant.rpc("drapeau_actif", { p_cle: "formule_pro" });
  return data === true;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const ouverte = await venteOuverte(req);
    if (req.method === "GET") return json({ actif: ouverte, cgv_version: CGV_PRO_VERSION });
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    if (!ouverte) return json({ error: "pro_indisponible", message: "La formule pro n'est pas encore en vente." }, 409);

    // Compte obligatoire : l'abonnement est rattaché à l'utilisateur.
    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = await admin.auth.getUser(jwt).catch(() => ({ data: null }));
    const user = u?.user;
    if (!user?.id || !user.email) return json({ error: "connexion_requise" }, 401);

    const body = await req.json().catch(() => null);
    const siret = String(body?.siret ?? "").replace(/\s/g, "");
    if (!siretValide(siret)) return json({ error: "siret_invalide", message: "SIRET invalide." }, 400);
    if (body?.accepte_cgv !== true) return json({ error: "cgv_requises", message: "Vous devez accepter les CGV pro." }, 400);

    const stripe = new Stripe(STRIPE_SECRET_KEY!, { apiVersion: "2023-10-16" });
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: user.email,
      line_items: [{ price: PRO_PRICE_ID, quantity: 1 }],
      success_url: `${ORIGINE}/stock?abonnement=ok`,
      cancel_url: `${ORIGINE}/pro?abonnement=annule`,
      metadata: { produit: "pro", user_id: user.id, siret, cgv_version: CGV_PRO_VERSION },
      subscription_data: { metadata: { produit: "pro", user_id: user.id, siret } },
    });
    if (!session.url) throw new Error("session sans URL");
    return json({ url: session.url });
  } catch (e) {
    console.error("pro-checkout:", e);
    return json({ error: "internal" }, 500);
  }
});
