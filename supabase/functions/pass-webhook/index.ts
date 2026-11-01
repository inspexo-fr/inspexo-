// SPRINT 7 — Webhook Stripe du Pass achat. SEUL point d'activation d'un Pass :
// signature vérifiée (PASS_WEBHOOK_SECRET, endpoint dédié créé par
// scripts/configurer-stripe-pass.mjs), idempotent sur stripe_session.
//   - checkout.session.completed (metadata.produit = "pass", payé) →
//     ligne passes (30 jours), compte créé ou rattaché par email (lien
//     magique ensuite), email de confirmation Resend.
//   - charge.refunded → statut "rembourse" (couvre aussi un remboursement
//     fait à la main dans le dashboard Stripe, pas seulement l'admin Inspexo).
// ⚠️ Déployer avec --no-verify-jwt : Stripe ne porte pas de JWT Supabase.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { emailPassActif } from "../_shared/notify.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const PASS_WEBHOOK_SECRET = Deno.env.get("PASS_WEBHOOK_SECRET") ?? "";
const DUREE_JOURS = 30;

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });
// Deno n'a pas le crypto synchrone de Node : vérification de signature en
// SubtleCrypto asynchrone.
const cryptoProvider = Stripe.createSubtleCryptoProvider();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    if (!signature || !PASS_WEBHOOK_SECRET) throw new Error("signature ou secret manquant");
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      PASS_WEBHOOK_SECRET,
      undefined,
      cryptoProvider,
    );
  } catch (err) {
    console.error("pass-webhook signature:", err?.message ?? err);
    return json({ error: "invalid_signature" }, 400);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.produit !== "pass") break;
        if (session.payment_status !== "paid") break;

        const email = (session.customer_details?.email ?? session.customer_email ?? "")
          .trim().toLowerCase();
        if (!email) {
          console.error("pass-webhook: session payée sans email", session.id);
          break;
        }

        // L'email Stripe crée ou rattache le compte du dossier d'achat :
        // création sans mot de passe (connexion par lien magique). Si le
        // compte existe déjà, get_mon_pass() rattachera par email au login.
        let userId: string | null = null;
        try {
          const { data: created, error: createErr } = await admin.auth.admin.createUser({
            email,
            email_confirm: true,
          });
          if (!createErr && created?.user) userId = created.user.id;
        } catch (err) {
          console.error("pass-webhook createUser:", err);
        }

        const debut = new Date();
        const fin = new Date(debut.getTime() + DUREE_JOURS * 24 * 3600 * 1000);
        const mode = session.metadata?.mode === "precommande" ? "precommande" : "vente";

        // Idempotence : Stripe peut livrer l'événement plusieurs fois.
        const { data: inserted, error: insertErr } = await admin
          .from("passes")
          .upsert({
            email,
            user_id: userId,
            stripe_session: session.id,
            stripe_payment_intent: typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id ?? null,
            montant_cents: session.amount_total ?? 0,
            devise: session.currency ?? "eur",
            mode,
            statut: "actif",
            retractation_renoncee: session.metadata?.renonce_retractation === "oui",
            cgv_version: session.metadata?.cgv_version ?? null,
            debut: debut.toISOString(),
            fin: fin.toISOString(),
          }, { onConflict: "stripe_session", ignoreDuplicates: true })
          .select("id")
          .maybeSingle();
        if (insertErr) {
          console.error("pass-webhook insert:", insertErr);
          // 500 → Stripe réessaie : l'activation ne doit jamais se perdre.
          return json({ error: "db_error" }, 500);
        }

        if (inserted) {
          const envoye = await emailPassActif(email, fin, mode);
          await admin.from("events").insert({
            name: "pass_active",
            props_json: {
              mode,
              montant_cents: session.amount_total ?? 0,
              email_envoye: envoye,
              compte_cree: userId != null,
              retractation_renoncee: session.metadata?.renonce_retractation === "oui",
            },
          });
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const pi = typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id ?? null;
        if (!pi) break;
        const { data: updated } = await admin
          .from("passes")
          .update({ statut: "rembourse" })
          .eq("stripe_payment_intent", pi)
          .neq("statut", "rembourse")
          .select("id, email")
          .maybeSingle();
        if (updated) {
          await admin.from("events").insert({
            name: "pass_rembourse",
            props_json: { via: "stripe_webhook" },
          });
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("pass-webhook handler:", err);
    return json({ error: "internal" }, 500);
  }

  return json({ received: true });
});
