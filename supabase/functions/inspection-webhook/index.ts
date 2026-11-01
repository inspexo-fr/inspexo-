// SPRINT 8 — Webhook Stripe des inspections. SEUL point qui met une
// inspection en attente d'attribution : signature vérifiée
// (INSPECTION_WEBHOOK_SECRET), idempotent sur le statut de la ligne.
//   - checkout.session.completed (metadata.produit = "inspection", payée) →
//     statut `a_attribuer` + emails (acheteur : commande reçue ; inspecteurs
//     de la zone : nouvelle mission).
//   - charge.refunded → statut `annulee`.
// ⚠️ Déployer avec --no-verify-jwt : Stripe ne porte pas de JWT Supabase.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { emailInspectionCommandee, emailNouvelleMission } from "../_shared/notify.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const WEBHOOK_SECRET = Deno.env.get("INSPECTION_WEBHOOK_SECRET") ?? "";

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });
const cryptoProvider = Stripe.createSubtleCryptoProvider();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    if (!signature || !WEBHOOK_SECRET) throw new Error("signature ou secret manquant");
    event = await stripe.webhooks.constructEventAsync(body, signature, WEBHOOK_SECRET, undefined, cryptoProvider);
  } catch (err) {
    console.error("inspection-webhook signature:", err?.message ?? err);
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
        if (session.metadata?.produit !== "inspection") break;
        if (session.payment_status !== "paid") break;
        const inspectionId = session.metadata?.inspection_id;
        if (!inspectionId) {
          console.error("inspection-webhook: session payée sans inspection_id", session.id);
          break;
        }

        const paymentIntentId = typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null;

        // La charge sert de source_transaction au versement : sans elle, un
        // transfert peut échouer faute de fonds disponibles sur le solde.
        let chargeId: string | null = null;
        if (paymentIntentId) {
          try {
            const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
            chargeId = typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge?.id ?? null;
          } catch (e) {
            console.error("récupération de la charge:", e);
          }
        }

        // Idempotence : seule une ligne encore `a_payer` bascule.
        const { data: maj, error: updErr } = await admin
          .from("inspections")
          .update({
            statut: "a_attribuer",
            stripe_payment_intent: paymentIntentId,
            stripe_charge: chargeId,
            maj_le: new Date().toISOString(),
          })
          .eq("id", inspectionId)
          .eq("statut", "a_payer")
          .select("id, ref_num, departement, creneau_souhaite, acheteur_id, analysis_id")
          .maybeSingle();
        if (updErr) {
          console.error("inspection-webhook update:", updErr);
          return json({ error: "db_error" }, 500); // Stripe réessaiera
        }
        if (!maj) break; // déjà traitée

        const { data: analyse } = await admin
          .from("analyses").select("marque, modele, annee").eq("id", maj.analysis_id).maybeSingle();
        const vehicule = [analyse?.marque, analyse?.modele, analyse?.annee]
          .filter(Boolean).join(" ") || "Véhicule";

        // Acheteur : accusé de commande.
        const { data: acheteur } = await admin.auth.admin.getUserById(maj.acheteur_id);
        if (acheteur?.user?.email) {
          await emailInspectionCommandee(
            acheteur.user.email, vehicule, maj.creneau_souhaite, maj.ref_num ?? null,
          );
        }

        // Inspecteurs validés de la zone : une mission est disponible.
        const { data: inspecteurs } = await admin
          .from("inspecteurs")
          .select("email, nom")
          .eq("statut", "valide")
          .eq("stripe_paiements_actifs", true)
          .contains("departements", [maj.departement])
          .limit(20);
        for (const i of inspecteurs ?? []) {
          if (i.email) await emailNouvelleMission(i.email, vehicule, maj.departement, maj.creneau_souhaite);
        }

        await admin.from("events").insert({
          name: "inspection_payee",
          analysis_id: maj.analysis_id,
          props_json: {
            inspection_id: maj.id,
            departement: maj.departement,
            inspecteurs_prevenus: (inspecteurs ?? []).length,
          },
        });
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const pi = typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id ?? null;
        if (!pi) break;
        const { data: maj } = await admin
          .from("inspections")
          .update({ statut: "annulee", rembourse_le: new Date().toISOString(), maj_le: new Date().toISOString() })
          .eq("stripe_payment_intent", pi)
          .neq("statut", "annulee")
          .select("id")
          .maybeSingle();
        if (maj) {
          await admin.from("events").insert({
            name: "inspection_remboursee",
            props_json: { inspection_id: maj.id, via: "stripe_webhook" },
          });
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("inspection-webhook handler:", err);
    return json({ error: "internal" }, 500);
  }

  return json({ received: true });
});
