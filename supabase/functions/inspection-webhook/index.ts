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

      // Remboursement. Le handler d'origine était aveugle (audit du 2 nov.,
      // défaut majeur n° 3) : il passait TOUT en « annulee », y compris un
      // remboursement PARTIEL, y compris une inspection déjà « faite » — ce
      // qui faisait disparaître de l'écran de l'acheteur le rapport qu'il
      // avait payé — et ne reprenait jamais les 107,40 € déjà versés.
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const pi = typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id ?? null;
        if (!pi) break;

        const { data: insp } = await admin
          .from("inspections")
          .select("id, statut, transfer_id, part_inspecteur_cents")
          .eq("stripe_payment_intent", pi)
          .maybeSingle();
        if (!insp || insp.statut === "annulee") break;

        const total = charge.refunded === true || (charge.amount_refunded ?? 0) >= (charge.amount ?? 0);

        // Reprendre la part déjà versée à l'inspecteur, proportionnellement.
        let reversalId: string | null = null;
        let reversalErreur: string | null = null;
        if (insp.transfer_id) {
          const part = total
            ? insp.part_inspecteur_cents
            : Math.min(
              insp.part_inspecteur_cents,
              Math.round((charge.amount_refunded ?? 0) * (insp.part_inspecteur_cents / Math.max(charge.amount ?? 1, 1))),
            );
          if (part > 0) {
            try {
              const rev = await stripe.transfers.createReversal(insp.transfer_id, {
                amount: part,
                metadata: { inspection_id: insp.id, motif: "remboursement_acheteur" },
              }, { idempotencyKey: `inspection-reversal-${insp.id}-${charge.amount_refunded ?? 0}` });
              reversalId = rev.id;
            } catch (e) {
              // Le compte de l'inspecteur peut ne plus avoir le solde : on
              // trace une créance plutôt que de perdre l'information.
              reversalErreur = String(e?.message ?? e).slice(0, 200);
              console.error("reversal:", reversalErreur);
            }
          }
        }

        // Un rapport déjà rendu reste visible pour l'acheteur : on note le
        // remboursement sans écraser « faite ».
        const maj: Record<string, unknown> = {
          rembourse_le: new Date().toISOString(),
          maj_le: new Date().toISOString(),
        };
        if (total && insp.statut !== "faite") maj.statut = "annulee";
        await admin.from("inspections").update(maj).eq("id", insp.id);

        await admin.from("events").insert({
          name: "inspection_remboursee",
          props_json: {
            inspection_id: insp.id,
            via: "stripe_webhook",
            total,
            montant_rembourse_cents: charge.amount_refunded ?? 0,
            statut_conserve: insp.statut === "faite" ? "faite" : (total ? "annulee" : insp.statut),
            reversal_id: reversalId,
            reversal_erreur: reversalErreur,
          },
        });
        break;
      }

      // Litige : aucune trace n'était gardée. On le consigne (la décision de
      // contester appartient à l'exploitant, pas au code).
      case "charge.dispute.created":
      case "charge.dispute.funds_withdrawn": {
        const dispute = event.data.object as Stripe.Dispute;
        const pi = typeof dispute.payment_intent === "string"
          ? dispute.payment_intent
          : dispute.payment_intent?.id ?? null;
        if (!pi) break;
        const { data: insp } = await admin
          .from("inspections").select("id, statut").eq("stripe_payment_intent", pi).maybeSingle();
        await admin.from("events").insert({
          name: "inspection_litige",
          props_json: {
            inspection_id: insp?.id ?? null,
            statut: insp?.statut ?? null,
            type: event.type,
            montant_cents: dispute.amount ?? 0,
            motif: dispute.reason ?? null,
          },
        });
        break;
      }

      // Le compte de versement d'un inspecteur a changé d'état chez Stripe
      // (KYC terminé, ou au contraire restriction). Sans cet abonnement, le
      // drapeau ne bougeait que si l'inspecteur rouvrait lui-même son espace.
      case "account.updated": {
        const compte = event.data.object as Stripe.Account;
        const inspecteurId = compte.metadata?.inspecteur_id;
        if (!inspecteurId) break;
        const actifs = compte.charges_enabled === true && compte.payouts_enabled === true;
        await admin.from("inspecteurs")
          .update({ stripe_paiements_actifs: actifs })
          .eq("id", inspecteurId);
        await admin.from("events").insert({
          name: "inspecteur_connect_etat",
          props_json: { inspecteur_id: inspecteurId, paiements_actifs: actifs },
        });
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
