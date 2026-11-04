// SPRINT 8 — Actions de l'inspecteur sur une mission : accepter, refuser,
// consentir à la conservation des photos.
//
// L'acceptation elle-même est faite par la RPC `inspection_accepter`, appelée
// AVEC LE JETON DE L'INSPECTEUR (donc auth.uid() le désigne) : c'est elle qui
// garantit l'exclusivité (la première acceptation gagne, la seconde reçoit
// « deja_prise »). Cette fonction existe pour ce que la RPC ne peut pas
// faire : prévenir l'acheteur par email avec les coordonnées de l'inspecteur.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { emailInspectionAcceptee, alerteExploitant } from "../_shared/notify.ts";
import { capturer, executerDecision } from "../_shared/inspectionArgent.ts";
import { absenceConstatable, prestation } from "../_shared/inspection.ts";
import { creerSalle } from "../_shared/whereby.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

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
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // Client « à la place de l'inspecteur » : les RPC voient son auth.uid().
    const commeUtilisateur = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: u } = await admin.auth.getUser(authHeader.replace(/^Bearer\s+/i, ""));
    if (!u?.user) return json({ error: "unauthorized", message: "Connexion requise." }, 401);

    const body = await req.json().catch(() => null);
    const action = body?.action;
    const inspectionId = typeof body?.inspection_id === "string" ? body.inspection_id : null;
    if (!inspectionId || !/^[0-9a-f-]{36}$/i.test(inspectionId)) {
      return json({ error: "invalid_input", message: "inspection_id requis." }, 400);
    }

    if (action === "refuser") {
      const { error } = await commeUtilisateur.rpc("inspection_refuser", {
        p_inspection_id: inspectionId,
        p_motif: typeof body?.motif === "string" ? body.motif.slice(0, 300) : null,
      });
      if (error) return json({ error: "rpc", message: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "consentement_photos") {
      const { data, error } = await commeUtilisateur.rpc("inspection_consentement_photos", {
        p_inspection_id: inspectionId,
      });
      if (error) return json({ error: "rpc", message: error.message }, 400);
      return json(data ?? { ok: false });
    }

    if (action === "accepter") {
      const { data, error } = await commeUtilisateur.rpc("inspection_accepter", {
        p_inspection_id: inspectionId,
        p_creneau: typeof body?.creneau === "string" ? body.creneau : null,
      });
      if (error) return json({ error: "rpc", message: error.message }, 400);
      if (!data?.ok) {
        return json({
          ok: false,
          raison: data?.raison ?? "indisponible",
          message: "Un autre inspecteur vient de prendre cette mission.",
        }, 409);
      }

      // PAIEMENT EN DEUX TEMPS : c'est MAINTENANT que l'argent est débité.
      // L'ordre est volontaire — la transition d'état atomique (la RPC
      // ci-dessus) d'abord, pour qu'un seul inspecteur gagne la mission, puis
      // la capture. Si la capture échoue, la mission ne peut pas rester
      // « confirmée » sans argent encaissé : elle retourne à l'attribution.
      // Instant de la confirmation : il ouvre l'heure de grâce pendant
      // laquelle l'acheteur annule sans frais. `creneau_confirme` est le
      // RENDEZ-VOUS, pas l'instant de la confirmation — les confondre faisait
      // démarrer la grâce au mauvais moment.
      await admin.from("inspections")
        .update({ confirmee_le: new Date().toISOString() })
        .eq("id", inspectionId)
        .is("confirmee_le", null);

      const { data: pour_capture } = await admin
        .from("inspections")
        .select("stripe_payment_intent, capturee_le")
        .eq("id", inspectionId)
        .maybeSingle();
      if (pour_capture && !pour_capture.capturee_le) {
        const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });
        const cap = await capturer(stripe, admin, inspectionId, pour_capture.stripe_payment_intent);
        if (!cap.ok) {
          await admin.rpc("inspection_capture_echouee", { p_inspection_id: inspectionId });
          await alerteExploitant(
            "Inspexo — capture de paiement en échec",
            `<p>L'inspecteur a confirmé une mission mais le paiement n'a pas pu être débité.</p>
             <p>Inspection : ${inspectionId}<br />Erreur : ${cap.erreur ?? "inconnue"}</p>
             <p>La mission est repassée en attente d'attribution.</p>`,
          );
          return json({
            ok: false,
            raison: "paiement_indisponible",
            message:
              "Le paiement de l'acheteur n'a pas pu être débité : la mission est remise en attente. Vous n'avez rien à faire.",
          }, 409);
        }
      }

      // ---- Salle vidéo, pour une visio seulement -------------------------
      // Créée APRÈS la capture : une mission que personne n'a payée n'a pas de
      // salle. Un échec ici ne défait pas l'acceptation — l'inspecteur a pris
      // la mission, l'argent est encaissé — mais il est signalé, et la salle
      // peut être recréée. Se taire laisserait un rendez-vous sans lien.
      {
        const { data: m } = await admin
          .from("inspections")
          .select("type, creneau_confirme, visio_salle")
          .eq("id", inspectionId)
          .maybeSingle();
        if (m?.type === "visio" && !m.visio_salle && m.creneau_confirme) {
          const r = await creerSalle(new Date(m.creneau_confirme));
          if (r.ok) {
            await admin.from("inspections").update({
              visio_salle: r.salle.salle,
              visio_url_acheteur: r.salle.url_acheteur,
              visio_url_inspecteur: r.salle.url_inspecteur,
              maj_le: new Date().toISOString(),
            }).eq("id", inspectionId);
          } else {
            console.error("creerSalle:", r.raison);
            await alerteExploitant(
              "Inspexo — salle vidéo non créée",
              `<p>Une visio a été confirmée mais la salle n'a pas pu être créée.</p>
               <p>Mission : ${inspectionId}<br />Raison : ${r.raison}</p>
               <p>L'acheteur n'a pas de lien. À recréer avant le créneau.</p>`,
            );
          }
        }
      }

      // L'acheteur reçoit le nom et le téléphone de son inspecteur.
      const { data: insp } = await admin
        .from("inspections")
        .select("acheteur_id, analysis_id, creneau_confirme, inspecteur_id")
        .eq("id", inspectionId)
        .maybeSingle();
      if (insp) {
        const [{ data: inspecteur }, { data: analyse }, { data: acheteur }] = await Promise.all([
          admin.from("inspecteurs").select("nom, telephone").eq("id", insp.inspecteur_id).maybeSingle(),
          admin.from("analyses").select("marque, modele").eq("id", insp.analysis_id).maybeSingle(),
          admin.auth.admin.getUserById(insp.acheteur_id),
        ]);
        const email = acheteur?.user?.email;
        if (email && inspecteur) {
          await emailInspectionAcceptee(
            email,
            [analyse?.marque, analyse?.modele].filter(Boolean).join(" ") || "votre véhicule",
            inspecteur.nom ?? "Votre inspecteur",
            inspecteur.telephone ?? null,
            insp.creneau_confirme,
          );
        }
      }
      return json({ ok: true });
    }

    // ---- Vendeur absent / véhicule indisponible, constaté SUR PLACE ----
    // Une PHOTO horodatée est exigée par la RPC : la retenue de 40 € est
    // prélevée sur l'acheteur, elle ne peut pas reposer sur la seule parole
    // de celui qui la touche.
    if (action === "absence_vendeur") {
      // La photo arrive en data-URL et c'est le SERVEUR qui la dépose : une
      // décision d'accès ne se délègue pas à une policy storage, qui devrait
      // lire des tables volontairement fermées (leçon de l'audit du 2 nov.).
      // Pour une VISIO, aucune photo n'est demandée : l'inspecteur ne voit pas
      // la voiture. La preuve est le délai d'attente, vérifié juste au-dessus.
      const { data: typeM } = await admin
        .from("inspections").select("type").eq("id", inspectionId).maybeSingle();
      if (typeM?.type === "visio") {
        const { data, error } = await commeUtilisateur.rpc("inspection_constat_absence", {
          p_inspection_id: inspectionId,
          p_photo_path: "",
        });
        if (error) return json({ error: "rpc", message: error.message }, 400);
        if (!data?.ok) return json({ ok: false, raison: data?.raison ?? "refuse" }, 409);
        const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });
        const res = await executerDecision(stripe, admin, inspectionId, data);
        if (!res.ok) {
          await alerteExploitant(
            "Inspexo — indemnité de visio non versée",
            `<p>Absence constatée sur une visio, mais l'argent n'a pas suivi.</p>
             <p>Mission : ${inspectionId}<br />Erreur : ${res.erreur ?? "inconnue"}</p>`,
          );
        }
        return json({
          ok: true,
          indemnite_cents: data.retenue_cents,
          rembourse_cents: data.rembourse_cents,
          versee: res.ok && !res.erreur,
        });
      }

      const brut = typeof body?.photo === "string" ? body.photo : "";
      const m = brut.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/s);
      const b64 = m ? m[2].replace(/\s/g, "") : "";
      if (!m || b64.length < 100 || b64.length > 4_500_000 || !/^[A-Za-z0-9+/=]+$/.test(b64)) {
        return json({
          error: "photo_requise",
          message: "Prenez une photo horodatée sur place : sans preuve, aucune indemnité ne peut être retenue.",
        }, 400);
      }
      let octets: Uint8Array;
      try {
        octets = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      } catch (_) {
        return json({ error: "photo_requise", message: "Photo illisible." }, 400);
      }
      const ext = m[1] === "jpg" ? "jpeg" : m[1];
      const photo = `${inspectionId}/absence-${Date.now()}.${ext}`;

      // ⚠️ On DÉPOSE AVANT de muter l'état, contrairement à la règle habituelle
      // (transition d'abord). Ici la preuve conditionne la retenue de 40 € :
      // une annulation enregistrée sans sa photo laisserait une somme prélevée
      // sur l'acheteur sans justification. Un fichier orphelin en cas de
      // conflit est le moindre mal.
      const { error: upErr } = await admin.storage
        .from("rapports")
        .upload(photo, octets, { contentType: `image/${ext}`, upsert: false });
      if (upErr) {
        console.error("upload photo d'absence:", upErr);
        return json({ error: "upload", message: "Dépôt de la photo impossible. Réessayez." }, 500);
      }
      // ⚠️ Pour une visio, la retenue n'indemnise pas un déplacement mais un
      // CRÉNEAU BLOQUÉ : elle ne se justifie qu'après une attente réelle.
      // Quinze minutes après l'heure du rendez-vous, pas avant.
      {
        const { data: m } = await admin
          .from("inspections").select("type, creneau_confirme, creneau_souhaite")
          .eq("id", inspectionId).maybeSingle();
        const creneau = m?.creneau_confirme ?? m?.creneau_souhaite ?? null;
        const att = absenceConstatable(
          m?.type === "visio" ? "visio" : "inspection",
          creneau ? new Date(creneau) : null,
          new Date(),
        );
        if (!att.ok) {
          const p = prestation(m?.type === "visio" ? "visio" : "inspection");
          return json({
            error: "attente_insuffisante",
            message: att.raison === "creneau_inconnu"
              ? "Créneau inconnu : l'absence ne peut pas être constatée."
              : `Attendez encore ${att.minutes_restantes} minute(s) : une absence ne se constate qu'après ${p.attente_absence_minutes} minutes.`,
          }, 409);
        }
      }

      const { data, error } = await commeUtilisateur.rpc("inspection_constat_absence", {
        p_inspection_id: inspectionId,
        p_photo_path: photo,
      });
      if (error) return json({ error: "rpc", message: error.message }, 400);
      if (!data?.ok) return json({ ok: false, raison: data?.raison ?? "refuse" }, 409);

      const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });
      const res = await executerDecision(stripe, admin, inspectionId, data);
      if (!res.ok) {
        await alerteExploitant(
          "Inspexo — indemnité de déplacement non versée",
          `<p>Un constat d'absence a été enregistré mais l'argent n'a pas suivi.</p>
           <p>Inspection : ${inspectionId}<br />Erreur : ${res.erreur ?? "inconnue"}</p>`,
        );
      }
      return json({
        ok: true,
        indemnite_cents: data.retenue_cents,
        rembourse_cents: data.rembourse_cents,
        versee: res.ok && !res.erreur,
      });
    }

    return json({ error: "invalid_input", message: "Action inconnue." }, 400);
  } catch (error) {
    console.error("inspecteur-mission error:", error);
    return json({ error: "internal", message: "Erreur interne. Réessayez." }, 500);
  }
});
