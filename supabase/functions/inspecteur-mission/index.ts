// SPRINT 8 — Actions de l'inspecteur sur une mission : accepter, refuser,
// consentir à la conservation des photos.
//
// L'acceptation elle-même est faite par la RPC `inspection_accepter`, appelée
// AVEC LE JETON DE L'INSPECTEUR (donc auth.uid() le désigne) : c'est elle qui
// garantit l'exclusivité (la première acceptation gagne, la seconde reçoit
// « deja_prise »). Cette fonction existe pour ce que la RPC ne peut pas
// faire : prévenir l'acheteur par email avec les coordonnées de l'inspecteur.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { emailInspectionAcceptee } from "../_shared/notify.ts";

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

    return json({ error: "invalid_input", message: "Action inconnue." }, 400);
  } catch (error) {
    console.error("inspecteur-mission error:", error);
    return json({ error: "internal", message: "Erreur interne. Réessayez." }, 500);
  }
});
