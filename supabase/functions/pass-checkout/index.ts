// SPRINT 7 — Pass achat : création de la session Stripe Checkout.
// GET  → configuration publique { actif, mode, prix_cents, mediateur } :
//        la vente ne s'active que si MEDIATEUR_NOM est renseigné (obligation
//        de médiation de la consommation) ET que la clé Stripe existe.
// POST → { email, accepte_cgv, renonce_retractation, analysis_id? }
//        → { url } : page de paiement hébergée Stripe. Le paiement n'accorde
//        RIEN ici : l'activation du Pass se fait exclusivement dans
//        pass-webhook, à réception de checkout.session.completed signé.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? null;
const MEDIATEUR_NOM = (Deno.env.get("MEDIATEUR_NOM") ?? "").trim();
const PASS_MODE = Deno.env.get("PASS_MODE") === "precommande" ? "precommande" : "vente";
const IP_HASH_SALT = Deno.env.get("IP_HASH_SALT");
if (!IP_HASH_SALT) throw new Error("IP_HASH_SALT manquant — configurez le secret.");

const ORIGINE = "https://www.inspexo.io";
const CGV_VERSION = "2026-10-30";
const PRIX_CENTS: Record<string, number> = { vente: 2900, precommande: 1900 };
const SESSIONS_MAX_PAR_IP = 10; // par 24 h — borne les créations de session

// Un Pass ne se vend pas sans médiateur de la consommation désigné ni clé de
// paiement : la page /pass reste alors en « bientôt » + capteur email.
const ACTIF = MEDIATEUR_NOM.length > 0 && !!STRIPE_SECRET_KEY;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function clientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const first = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip") || "unknown";
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method === "GET") {
    return json({
      actif: ACTIF,
      mode: PASS_MODE,
      prix_cents: PRIX_CENTS[PASS_MODE],
      duree_jours: 30,
      mediateur: ACTIF ? MEDIATEUR_NOM : null,
      cgv_version: CGV_VERSION,
    });
  }

  try {
    if (!ACTIF) {
      return json({
        error: "pass_indisponible",
        message: "Le Pass achat n'est pas encore en vente. Laissez votre email pour être prévenu.",
      }, 409);
    }

    const body = await req.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase().slice(0, 254) : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return json({ error: "invalid_input", message: "Adresse email invalide." }, 400);
    }
    // Case CGV obligatoire AVANT paiement (la page /pass la présente avec le
    // lien /cgv-pass) ; la renonciation à la rétractation est une case
    // DISTINCTE et facultative — sans elle, l'accès ouvre après 14 jours ou
    // à la première utilisation volontaire.
    if (body?.accepte_cgv !== true) {
      return json({ error: "cgv_requises", message: "Vous devez accepter les CGV du Pass pour payer." }, 400);
    }
    const renonce = body?.renonce_retractation === true;
    const analysisId = typeof body?.analysis_id === "string" && /^[0-9a-f-]{36}$/i.test(body.analysis_id)
      ? body.analysis_id
      : null;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const ipHash = await sha256Hex(IP_HASH_SALT + clientIp(req));

    // Rate limit anti-TOCTOU : tentative insérée AVANT le comptage.
    await admin.from("events").insert({
      name: "pass_checkout",
      analysis_id: analysisId,
      ip_hash: ipHash,
      props_json: { mode: PASS_MODE },
    });
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count } = await admin
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("name", "pass_checkout")
      .eq("ip_hash", ipHash)
      .gte("created_at", since);
    if ((count ?? 0) > SESSIONS_MAX_PAR_IP) {
      return json({ error: "rate_limited", message: "Trop de tentatives de paiement. Réessayez demain." }, 429);
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY!, { apiVersion: "2023-10-16" });
    const libelle = PASS_MODE === "precommande"
      ? "Pass achat Inspexo — précommande (30 jours, annonces illimitées)"
      : "Pass achat Inspexo — 30 jours, annonces illimitées";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: PRIX_CENTS[PASS_MODE],
          product_data: {
            name: libelle,
            description:
              "Analyses illimitées, visite guidée complète, négociation détaillée, lecture du PV de contrôle technique, kit signature. Prix TTC.",
          },
        },
      }],
      success_url: `${ORIGINE}/pass?paiement=ok&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${ORIGINE}/pass?paiement=annule`,
      payment_intent_data: { description: `Inspexo — ${libelle}` },
      metadata: {
        produit: "pass",
        mode: PASS_MODE,
        renonce_retractation: renonce ? "oui" : "non",
        cgv_version: CGV_VERSION,
        analysis_id: analysisId ?? "",
      },
    });

    if (!session.url) throw new Error("session Stripe sans URL");
    return json({ url: session.url });
  } catch (error) {
    console.error("pass-checkout error:", error);
    return json({ error: "internal", message: "Création du paiement impossible. Réessayez." }, 500);
  }
});
