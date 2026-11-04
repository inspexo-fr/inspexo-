// SPRINT 8 — Administration des inspecteurs (rôle admin en base).
//   GET                        → candidatures et inspecteurs, + inspections en cours.
//   GET ?document=<id>         → URL signée de l'attestation RC pro (60 s).
//   POST { action: "valider" | "refuser" | "suspendre", id, motif? }
//
// Un inspecteur n'est VALIDÉ que si les pièces sont là : SIRET, assurance RC
// pro avec échéance future, charte signée. Le contrôle est fait ICI, côté
// serveur : l'interface d'admin ne peut pas passer outre.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { verifierAdmin } from "../_shared/adminAuth.ts";
import { emailInspectionAnnulee } from "../_shared/notify.ts";
import { emailInspecteurDecision } from "../_shared/notify.ts";
import { siretValide } from "../_shared/inspection.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  // PATCH : arbitrage d'une annulation contestée. Sans cette ligne, le
  // préflight du navigateur refuse la méthode et le bouton ne part jamais.
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const acces = await verifierAdmin(req);
  if (!acces.ok) return json({ error: acces.error }, acces.status);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    if (req.method === "GET") {
      // Preuve d'absence : on prend l'IDENTIFIANT de l'inspection et on lit le
      // chemin EN BASE. Signer un chemin fourni par l'appelant permettrait de
      // signer n'importe quel objet du bucket — même réservé aux admins, une
      // référence directe fournie par le client ne se signe pas.
      const preuveId = new URL(req.url).searchParams.get("preuve");
      if (preuveId && /^[0-9a-f-]{36}$/i.test(preuveId)) {
        const { data: ins } = await admin
          .from("inspections").select("absence_photo_path").eq("id", preuveId).maybeSingle();
        if (!ins?.absence_photo_path) return json({ error: "not_found" }, 404);
        const { data: signe, error } = await admin.storage
          .from("rapports").createSignedUrl(ins.absence_photo_path, 300);
        if (error) return json({ error: error.message }, 500);
        return json({ url: signe?.signedUrl ?? null });
      }

      const docId = new URL(req.url).searchParams.get("document");
      if (docId) {
        const { data: ins } = await admin
          .from("inspecteurs").select("rc_pro_document").eq("id", docId).maybeSingle();
        if (!ins?.rc_pro_document) return json({ error: "not_found" }, 404);
        const { data: signe, error } = await admin.storage
          .from("inspecteurs").createSignedUrl(ins.rc_pro_document, 60);
        if (error) return json({ error: error.message }, 500);
        return json({ url: signe?.signedUrl ?? null });
      }

      const [{ data: inspecteurs }, { data: inspections }] = await Promise.all([
        admin.from("inspecteurs")
          .select("id, email, nom, telephone, siret, raison_sociale, rc_pro_assureur, rc_pro_numero, rc_pro_echeance, rc_pro_document, charte_version, charte_signee_le, departements, visio, stripe_account_id, stripe_paiements_actifs, statut, motif_refus, valide_le, created_at")
          .order("created_at", { ascending: false }).limit(200),
        admin.from("inspections")
          .select("id, type, ref_num, statut, departement, code_postal, prix_cents, part_inspecteur_cents, creneau_souhaite, creneau_confirme, inspecteur_id, transfer_id, verse_le, rapport_rendu_le, created_at, annulee_par, annulee_le, annulation_motif, retenue_cents, retenue_transfer_id, absence_constatee_le, absence_photo_path, arbitrage_decision, arbitrage_note, arbitre_le, autorisee_le, capturee_le, rembourse_le, execution_immediate_le, cgv_version")
          .order("created_at", { ascending: false }).limit(200),
      ]);

      const aujourdhui = new Date().toISOString().slice(0, 10);
      const liste = (inspecteurs ?? []).map((i) => ({
        ...i,
        rc_pro_document: !!i.rc_pro_document,
        // Pièces complètes = condition de validation (vérifiée aussi au POST).
        pieces: {
          siret_valide: siretValide(i.siret ?? ""),
          rc_pro_valide: !!i.rc_pro_echeance && i.rc_pro_echeance >= aujourdhui,
          rc_pro_document: !!i.rc_pro_document,
          charte_signee: !!i.charte_signee_le,
          stripe_pret: i.stripe_paiements_actifs === true,
        },
      }));
      return json({ inspecteurs: liste, inspections: inspections ?? [] });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => null);
      const id = typeof body?.id === "string" ? body.id : null;
      const action = body?.action;
      if (!id || !["valider", "refuser", "suspendre"].includes(action)) {
        return json({ error: "invalid_input" }, 400);
      }

      const { data: ins } = await admin
        .from("inspecteurs")
        .select("id, email, siret, rc_pro_echeance, rc_pro_document, charte_signee_le, statut")
        .eq("id", id).maybeSingle();
      if (!ins) return json({ error: "not_found" }, 404);

      if (action === "valider") {
        // Garde-fou serveur : on ne valide pas un dossier incomplet, même
        // si l'interface le proposait.
        const manquant: string[] = [];
        if (!siretValide(ins.siret ?? "")) manquant.push("SIRET invalide");
        if (!ins.rc_pro_echeance || ins.rc_pro_echeance < new Date().toISOString().slice(0, 10)) {
          manquant.push("assurance RC pro absente ou expirée");
        }
        if (!ins.rc_pro_document) manquant.push("attestation RC pro non déposée");
        if (!ins.charte_signee_le) manquant.push("charte d'indépendance non signée");
        if (manquant.length > 0) {
          return json({ error: "dossier_incomplet", message: manquant.join(" · ") }, 409);
        }
        const { error } = await admin.from("inspecteurs").update({
          statut: "valide",
          motif_refus: null,
          valide_le: new Date().toISOString(),
          valide_par: acces.user.id,
        }).eq("id", id);
        if (error) throw error;
        await emailInspecteurDecision(ins.email, true, null);
      } else {
        const motif = typeof body?.motif === "string" ? body.motif.slice(0, 300) : null;
        const { error } = await admin.from("inspecteurs").update({
          statut: action === "refuser" ? "refuse" : "suspendu",
          motif_refus: motif,
        }).eq("id", id);
        if (error) throw error;
        if (action === "refuser") await emailInspecteurDecision(ins.email, false, motif);
      }

      await admin.from("events").insert({
        name: "inspecteur_decision",
        props_json: { action, inspecteur_id: id, par: acces.user.email },
      });
      return json({ ok: true });
    }

    // ---- Option « visio » d'un inspecteur -----------------------------
    // Guider un acheteur au téléphone n'est pas le même métier que de se
    // déplacer : tout inspecteur validé n'est pas d'office disponible pour ça.
    // L'option est donc éteinte par défaut et activée un par un.
    if (req.method === "PUT") {
      const body = await req.json().catch(() => null);
      const id = typeof body?.id === "string" ? body.id : null;
      if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
        return json({ error: "invalid_input", message: "id requis." }, 400);
      }
      const { error } = await admin.from("inspecteurs")
        .update({ visio: body?.visio === true })
        .eq("id", id);
      if (error) return json({ error: error.message }, 500);
      await admin.from("events").insert({
        name: "inspecteur_visio",
        props_json: { inspecteur_id: id, visio: body?.visio === true, par: acces.user.email },
      });
      return json({ ok: true, visio: body?.visio === true });
    }

    // ---- Arbitrage d'une annulation contestée -------------------------
    // Le barème est automatique ; il peut se tromper sur un cas réel (vendeur
    // qui conteste son absence, inspecteur qui s'est trompé d'adresse). Ce
    // bouton permet de rendre les 40 € à l'acheteur, ou de confirmer la
    // retenue. Une inspection ne s'arbitre QU'UNE FOIS : la décision est une
    // trace, elle ne se réécrit pas.
    if (req.method === "PATCH") {
      const body = await req.json().catch(() => null);
      const id = typeof body?.inspection_id === "string" ? body.inspection_id : null;
      const decision = body?.decision;
      if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
        return json({ error: "invalid_input", message: "inspection_id requis." }, 400);
      }
      if (decision !== "rembourser_integral" && decision !== "confirmer_retenue") {
        return json({ error: "invalid_input", message: "Décision inconnue." }, 400);
      }

      const { data, error } = await admin.rpc("inspection_arbitrer", {
        p_inspection_id: id,
        p_decision: decision,
        p_note: typeof body?.note === "string" ? body.note.slice(0, 500) : null,
      });
      if (error) return json({ error: "rpc", message: error.message }, 400);
      if (!data?.ok) return json({ ok: false, raison: data?.raison ?? "refuse" }, 409);

      let argent = { ok: true } as { ok: boolean; erreur?: string | null };
      if (decision === "rembourser_integral" && Number(data.retenue_cents ?? 0) > 0) {
        // Rendre les 40 € retenus : reprise du transfert s'il est parti, puis
        // remboursement du complément à l'acheteur.
        const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", { apiVersion: "2023-10-16" });
        try {
          if (data.retenue_transfer_id) {
            await stripe.transfers.createReversal(data.retenue_transfer_id, {
              amount: Number(data.retenue_cents),
              metadata: { inspection_id: id, motif: "arbitrage_admin" },
            }, { idempotencyKey: `inspection-arbitrage-reversal-${id}` });
          }
          if (data.payment_intent) {
            await stripe.refunds.create({
              payment_intent: data.payment_intent,
              amount: Number(data.retenue_cents),
              metadata: { inspection_id: id, motif: "arbitrage_admin" },
            }, { idempotencyKey: `inspection-arbitrage-refund-${id}` });
          }
        } catch (e) {
          argent = { ok: false, erreur: String(e?.message ?? e).slice(0, 200) };
        }
        if (argent.ok) {
          const { data: insp } = await admin
            .from("inspections").select("acheteur_id, analysis_id").eq("id", id).maybeSingle();
          if (insp?.acheteur_id) {
            const [{ data: acheteur }, { data: analyse }] = await Promise.all([
              admin.auth.admin.getUserById(insp.acheteur_id),
              admin.from("analyses").select("marque, modele").eq("id", insp.analysis_id).maybeSingle(),
            ]);
            if (acheteur?.user?.email) {
              await emailInspectionAnnulee(
                acheteur.user.email,
                [analyse?.marque, analyse?.modele].filter(Boolean).join(" ") || "votre véhicule",
                Number(data.prix_cents ?? 0),
                0,
                "Après examen de votre contestation, l'indemnité de déplacement vous est rendue : vous êtes remboursé intégralement.",
              );
            }
          }
        }
      }

      await admin.from("events").insert({
        name: "inspection_arbitree",
        props_json: { inspection_id: id, decision, par: acces.user.email, argent_ok: argent.ok },
      });
      return json({ ok: true, decision, argent_traite: argent.ok, erreur: argent.erreur ?? null });
    }

    return json({ error: "method_not_allowed" }, 405);
  } catch (error) {
    console.error("admin-inspecteurs error:", error);
    return json({ error: error?.message ?? "internal" }, 500);
  }
});
