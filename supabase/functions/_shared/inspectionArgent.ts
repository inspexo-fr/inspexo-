// SPRINT 12 — Exécution du sort de l'argent d'une inspection annulée.
//
// UNE SEULE implémentation, appelée par les quatre chemins qui annulent :
// l'acheteur (`inspection-annuler`), l'inspecteur qui constate une absence
// (`inspecteur-mission`), le cron qui laisse expirer une autorisation
// (`alertes`), et l'arbitrage exploitant (`admin-inspecteurs`).
//
// Les RPC décident et verrouillent l'état ; ce module exécute. La séparation
// est volontaire : une transition d'état doit être atomique en base, un appel
// Stripe ne peut pas l'être.
//
// ⚠️ ORDRE DES OPÉRATIONS dans le cas « retenue » : le TRANSFERT PART D'ABORD,
// le remboursement ensuite. Deux raisons. Les fonds de la charge sont encore
// entiers, donc `source_transaction` ne peut pas manquer de disponible ; et si
// c'est le remboursement qui échoue, le montant dû à l'acheteur est
// déterministe et rattrapable depuis nos propres colonnes — alors qu'un
// transfert manqué après remboursement laisse l'inspecteur impayé pour un
// déplacement qu'il a réellement fait.
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

export type InstructionArgent = {
  action: "annuler_autorisation" | "rembourser_integral" | "retenue_deplacement" | "rien";
  payment_intent?: string | null;
  charge?: string | null;
  transfer_group?: string | null;
  inspecteur_id?: string | null;
  rembourse_cents?: number | null;
  retenue_cents?: number | null;
};

export type ResultatArgent = {
  ok: boolean;
  capturee?: boolean;
  autorisation_annulee?: boolean;
  rembourse?: boolean;
  retenue_transfer_id?: string | null;
  erreur?: string | null;
};

/** « Déjà dans cet état » n'est pas une erreur : un cron qui repasse, un
 *  double clic ou une reprise après timeout doivent converger, pas échouer. */
function dejaFait(e: unknown): boolean {
  const m = String((e as { message?: string })?.message ?? e).toLowerCase();
  return m.includes("already been canceled")
    || m.includes("already canceled")
    || m.includes("has already been refunded")
    || m.includes("already refunded");
}

export async function executerDecision(
  stripe: Stripe,
  // deno-lint-ignore no-explicit-any
  admin: any,
  inspectionId: string,
  instr: InstructionArgent,
): Promise<ResultatArgent> {
  if (instr.action === "rien") return { ok: true };

  try {
    // ---- Autorisation jamais encaissée : on relâche ---------------------
    if (instr.action === "annuler_autorisation") {
      if (instr.payment_intent) {
        try {
          await stripe.paymentIntents.cancel(instr.payment_intent);
        } catch (e) {
          if (!dejaFait(e)) throw e;
        }
      }
      await admin.rpc("inspection_noter_argent", {
        p_inspection_id: inspectionId,
        p_autorisation_annulee: true,
      });
      return { ok: true, autorisation_annulee: true };
    }

    // ---- Remboursement intégral ----------------------------------------
    if (instr.action === "rembourser_integral") {
      if (instr.payment_intent) {
        try {
          await stripe.refunds.create({
            payment_intent: instr.payment_intent,
            metadata: { inspection_id: inspectionId, motif: "annulation_integrale" },
          }, { idempotencyKey: `inspection-refund-total-${inspectionId}` });
        } catch (e) {
          if (!dejaFait(e)) throw e;
        }
      }
      await admin.rpc("inspection_noter_argent", {
        p_inspection_id: inspectionId,
        p_rembourse: true,
      });
      return { ok: true, rembourse: true };
    }

    // ---- Retenue de déplacement : 40 € à l'inspecteur, le reste rendu ---
    const retenue = Number(instr.retenue_cents ?? 0);
    const rembourse = Number(instr.rembourse_cents ?? 0);
    if (retenue <= 0 || rembourse < 0) {
      return { ok: false, erreur: "montants de retenue invalides" };
    }

    let transferId: string | null = null;
    if (instr.inspecteur_id) {
      const { data: inspecteur } = await admin
        .from("inspecteurs")
        .select("stripe_account_id, stripe_paiements_actifs")
        .eq("id", instr.inspecteur_id)
        .maybeSingle();
      if (inspecteur?.stripe_account_id && inspecteur.stripe_paiements_actifs) {
        const t = await stripe.transfers.create({
          amount: retenue,
          currency: "eur",
          destination: inspecteur.stripe_account_id,
          transfer_group: instr.transfer_group ?? `inspection_${inspectionId}`,
          ...(instr.charge ? { source_transaction: instr.charge } : {}),
          metadata: { inspection_id: inspectionId, motif: "indemnite_deplacement" },
        }, { idempotencyKey: `inspection-retenue-${inspectionId}` });
        transferId = t.id;
      } else {
        // Compte de versement incomplet : l'acheteur ne doit PAS attendre.
        // On le rembourse intégralement et l'indemnité se régularise à la
        // main — mieux vaut une indemnité en retard qu'un acheteur bloqué.
        console.error("retenue impossible, compte Connect incomplet:", instr.inspecteur_id);
        if (instr.payment_intent) {
          try {
            await stripe.refunds.create({
              payment_intent: instr.payment_intent,
              metadata: { inspection_id: inspectionId, motif: "retenue_impossible" },
            }, { idempotencyKey: `inspection-refund-total-${inspectionId}` });
          } catch (e) {
            if (!dejaFait(e)) throw e;
          }
        }
        await admin.rpc("inspection_noter_argent", {
          p_inspection_id: inspectionId,
          p_rembourse: true,
        });
        return { ok: true, rembourse: true, erreur: "retenue_non_versee" };
      }
    }

    if (rembourse > 0 && instr.payment_intent) {
      try {
        await stripe.refunds.create({
          payment_intent: instr.payment_intent,
          amount: rembourse,
          metadata: { inspection_id: inspectionId, motif: "annulation_avec_retenue" },
        }, { idempotencyKey: `inspection-refund-partiel-${inspectionId}` });
      } catch (e) {
        if (!dejaFait(e)) throw e;
      }
    }

    await admin.rpc("inspection_noter_argent", {
      p_inspection_id: inspectionId,
      p_rembourse: true,
      p_retenue_transfer_id: transferId,
    });
    return { ok: true, rembourse: true, retenue_transfer_id: transferId };
  } catch (e) {
    const erreur = String((e as { message?: string })?.message ?? e).slice(0, 200);
    console.error("executerDecision:", inspectionId, erreur);
    return { ok: false, erreur };
  }
}

/** Capture d'une autorisation, au moment où un inspecteur confirme. */
export async function capturer(
  stripe: Stripe,
  // deno-lint-ignore no-explicit-any
  admin: any,
  inspectionId: string,
  paymentIntentId: string | null,
): Promise<{ ok: boolean; charge?: string | null; erreur?: string }> {
  if (!paymentIntentId) return { ok: false, erreur: "aucune autorisation à capturer" };
  try {
    const pi = await stripe.paymentIntents.capture(paymentIntentId);
    const charge = typeof pi.latest_charge === "string"
      ? pi.latest_charge
      : pi.latest_charge?.id ?? null;
    await admin.from("inspections")
      .update({ capturee_le: new Date().toISOString(), stripe_charge: charge, maj_le: new Date().toISOString() })
      .eq("id", inspectionId);
    return { ok: true, charge };
  } catch (e) {
    const m = String((e as { message?: string })?.message ?? e);
    // Déjà capturée : l'état visé est atteint, on ne traite pas ça en échec.
    if (m.toLowerCase().includes("already been captured")) {
      await admin.rpc("inspection_noter_argent", { p_inspection_id: inspectionId, p_capturee: true });
      return { ok: true };
    }
    console.error("capturer:", inspectionId, m.slice(0, 200));
    return { ok: false, erreur: m.slice(0, 200) };
  }
}
