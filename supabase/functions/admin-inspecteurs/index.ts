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
import { verifierAdmin } from "../_shared/adminAuth.ts";
import { emailInspecteurDecision } from "../_shared/notify.ts";
import { siretValide } from "../_shared/inspection.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
          .select("id, email, nom, telephone, siret, raison_sociale, rc_pro_assureur, rc_pro_numero, rc_pro_echeance, rc_pro_document, charte_version, charte_signee_le, departements, stripe_account_id, stripe_paiements_actifs, statut, motif_refus, valide_le, created_at")
          .order("created_at", { ascending: false }).limit(200),
        admin.from("inspections")
          .select("id, ref_num, statut, departement, code_postal, prix_cents, part_inspecteur_cents, creneau_souhaite, creneau_confirme, inspecteur_id, transfer_id, verse_le, rapport_rendu_le, created_at")
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

    return json({ error: "method_not_allowed" }, 405);
  } catch (error) {
    console.error("admin-inspecteurs error:", error);
    return json({ error: error?.message ?? "internal" }, 500);
  }
});
