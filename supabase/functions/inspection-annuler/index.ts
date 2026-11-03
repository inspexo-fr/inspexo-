// SPRINT 12 — Annulation d'une inspection par l'ACHETEUR.
//
// La RPC `inspection_annuler` décide et verrouille (transition atomique, avec
// le jeton de l'acheteur, donc auth.uid() le désigne) ; ce module exécute le
// mouvement d'argent via `_shared/inspectionArgent.ts`.
//
// Le barème lui-même n'est écrit ni ici ni dans la RPC seule : il vient de
// `decisionAnnulation` dans `_shared/inspection.ts`, fonction pure testée hors
// ligne, dont la RPC est la transcription SQL. Les deux sont vérifiées
// concordantes par `tests/inspection.test.mjs`.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { alerteExploitant, emailInspectionAnnulee } from "../_shared/notify.ts";
import { executerDecision } from "../_shared/inspectionArgent.ts";

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
    const commeUtilisateur = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: u } = await admin.auth.getUser(authHeader.replace(/^Bearer\s+/i, ""));
    if (!u?.user) return json({ error: "unauthorized", message: "Connexion requise." }, 401);

    const body = await req.json().catch(() => null);
    const inspectionId = typeof body?.inspection_id === "string" ? body.inspection_id : null;
    if (!inspectionId || !/^[0-9a-f-]{36}$/i.test(inspectionId)) {
      return json({ error: "invalid_input", message: "inspection_id requis." }, 400);
    }

    const { data, error } = await commeUtilisateur.rpc("inspection_annuler", {
      p_inspection_id: inspectionId,
    });
    if (error) return json({ error: "rpc", message: error.message }, 400);
    if (!data?.ok) {
      const messages: Record<string, string> = {
        introuvable: "Inspection introuvable.",
        deja_faite: "L'inspection a déjà été réalisée : elle ne peut plus être annulée.",
        deja_annulee: "Cette inspection est déjà annulée.",
        conflit: "L'inspection vient de changer d'état. Rechargez la page.",
      };
      return json({
        ok: false,
        raison: data?.raison ?? "refuse",
        message: messages[data?.raison ?? ""] ?? "Annulation impossible.",
      }, 409);
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });
    const res = await executerDecision(stripe, admin, inspectionId, data);

    // L'état en base est déjà « annulée » : un mouvement d'argent en échec
    // doit se voir et se rattraper, il ne doit pas se taire. L'acheteur, lui,
    // a bien annulé — on ne lui renvoie pas une erreur pour un problème qui
    // est le nôtre.
    if (!res.ok) {
      await alerteExploitant(
        "Inspexo — annulation d'inspection : argent non traité",
        `<p>Une inspection a été annulée par l'acheteur mais le mouvement d'argent a échoué.</p>
         <p>Inspection : ${inspectionId}<br />Action attendue : ${data.action}<br />
         Erreur : ${res.erreur ?? "inconnue"}</p>
         <p>À régulariser à la main depuis Stripe, puis arbitrer dans l'admin.</p>`,
      );
    }

    // Email à l'acheteur, sauf quand rien n'a été débité (autorisation
    // relâchée sur SA demande : il vient de cliquer, le dire serait du bruit).
    if (data.action !== "annuler_autorisation") {
      const { data: insp } = await admin
        .from("inspections")
        .select("analysis_id")
        .eq("id", inspectionId)
        .maybeSingle();
      const { data: analyse } = insp?.analysis_id
        ? await admin.from("analyses").select("marque, modele").eq("id", insp.analysis_id).maybeSingle()
        : { data: null };
      if (u.user.email) {
        await emailInspectionAnnulee(
          u.user.email,
          [analyse?.marque, analyse?.modele].filter(Boolean).join(" ") || "votre véhicule",
          Number(data.rembourse_cents ?? 0),
          Number(data.retenue_cents ?? 0),
          data.retenue_cents > 0
            ? "Annulation à moins de 24 heures du créneau : le déplacement réservé par l'inspecteur est indemnisé."
            : "Annulation à plus de 24 heures du créneau : rien n'est retenu.",
        );
      }
    }

    return json({
      ok: true,
      action: data.action,
      rembourse_cents: data.rembourse_cents ?? 0,
      retenue_cents: data.retenue_cents ?? 0,
      argent_traite: res.ok,
    });
  } catch (error) {
    console.error("inspection-annuler error:", error);
    return json({ error: "internal", message: "Erreur interne. Réessayez." }, 500);
  }
});
