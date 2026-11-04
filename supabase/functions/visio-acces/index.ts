// SPRINT 14 — Accès au lien vidéo d'une visio.
//
// ⚠️ C'EST ICI QUE L'ACCÈS SE DÉCIDE, pas dans l'URL. La salle Whereby porte
// bien un `endDate`, mais un lien recopié dans un email ou une capture d'écran
// resterait un lien : la fenêtre est donc vérifiée SERVEUR à chaque demande
// (`fenetreVisio` — 15 min avant, 90 min après le créneau).
//
// Deux appelants, deux liens : l'acheteur reçoit l'URL participant, avec la
// caméra arrière par défaut ; l'inspecteur l'URL hôte. Personne ne reçoit
// celle de l'autre.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fenetreVisio, pointsNonVerifiables } from "../_shared/visio.ts";

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
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const authHeader = req.headers.get("Authorization") ?? "";
    const { data: u } = await admin.auth.getUser(authHeader.replace(/^Bearer\s+/i, ""));
    if (!u?.user) return json({ error: "unauthorized", message: "Connexion requise." }, 401);

    const body = await req.json().catch(() => null);
    const id = typeof body?.inspection_id === "string" ? body.inspection_id : null;
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return json({ error: "invalid_input", message: "inspection_id requis." }, 400);
    }

    const { data: m } = await admin
      .from("inspections")
      .select(
        "id, type, statut, acheteur_id, inspecteur_id, creneau_confirme, creneau_souhaite, " +
          "visio_url_acheteur, visio_url_inspecteur, captures_consentement_le, analysis_id",
      )
      .eq("id", id)
      .maybeSingle();
    if (!m || m.type !== "visio") return json({ error: "not_found" }, 404);

    // Qui demande ? L'acheteur, ou l'inspecteur qui a pris la mission.
    const estAcheteur = m.acheteur_id === u.user.id;
    let estInspecteur = false;
    if (!estAcheteur && m.inspecteur_id) {
      const { data: insp } = await admin
        .from("inspecteurs").select("id").eq("user_id", u.user.id).maybeSingle();
      estInspecteur = insp?.id === m.inspecteur_id;
    }
    if (!estAcheteur && !estInspecteur) return json({ error: "forbidden" }, 403);

    if (m.statut !== "acceptee") {
      return json({
        error: "pas_confirmee",
        message: m.statut === "faite"
          ? "Cet appel a eu lieu : le compte rendu est dans votre dossier."
          : "Aucun inspecteur n'a encore confirmé ce créneau.",
      }, 409);
    }

    const creneau = m.creneau_confirme ?? m.creneau_souhaite;
    const f = fenetreVisio(creneau ? new Date(creneau) : null, new Date());
    if (!f.ouverte) {
      const messages: Record<string, string> = {
        trop_tot: `L'appel s'ouvre 15 minutes avant l'heure du rendez-vous. Revenez dans ${
          f.raison === "trop_tot" ? f.minutes_restantes : 0
        } minute(s).`,
        trop_tard: "La fenêtre de cet appel est passée. Contactez-nous si l'appel n'a pas pu avoir lieu.",
        creneau_inconnu: "Créneau inconnu : l'appel ne peut pas s'ouvrir.",
      };
      return json({ error: "hors_fenetre", raison: f.raison, message: messages[f.raison] }, 409);
    }

    // La checklist du véhicule — MÊME SOURCE que le mode visite, jamais une
    // copie : c'est ce qui garantit que l'inspecteur et l'acheteur parlent de
    // la même liste.
    const { data: a } = await admin
      .from("analyses").select("result_json").eq("id", m.analysis_id).maybeSingle();
    const result = (a?.result_json ?? {}) as Record<string, unknown>;
    const checklist = Array.isArray(result.checklist_sur_place) ? result.checklist_sur_place : [];

    await admin.from("inspections")
      .update({ visio_ouverte_le: new Date().toISOString() })
      .eq("id", id)
      .is("visio_ouverte_le", null);

    return json({
      ok: true,
      role: estAcheteur ? "acheteur" : "inspecteur",
      url: estAcheteur ? m.visio_url_acheteur : m.visio_url_inspecteur,
      creneau,
      checklist,
      // Les points hors de portée sont calculés DÈS L'OUVERTURE : l'inspecteur
      // sait ce qu'il ne pourra pas vérifier avant de commencer, plutôt que de
      // le découvrir en rédigeant.
      non_verifiables: pointsNonVerifiables(checklist as never[]),
      captures_autorisees: m.captures_consentement_le != null,
    });
  } catch (e) {
    console.error("visio-acces:", e);
    return json({ error: "internal", message: "Erreur interne." }, 500);
  }
});
