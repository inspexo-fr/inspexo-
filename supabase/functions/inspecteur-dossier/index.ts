// SPRINT 8 — Dépôt de l'attestation d'assurance RC professionnelle par
// l'inspecteur (bucket PRIVÉ `inspecteurs`, lisible des seuls admins).
// Authentifié : le document est rangé sous l'identifiant de l'APPELANT,
// jamais sous un identifiant reçu du client.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TYPES = {
  "application/pdf": "pdf",
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

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
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = await admin.auth.getUser(jwt);
    if (!u?.user) return json({ error: "unauthorized", message: "Connexion requise." }, 401);

    const { data: ins } = await admin
      .from("inspecteurs").select("id, statut, rc_pro_document").eq("user_id", u.user.id).maybeSingle();
    if (!ins) return json({ error: "candidature_absente", message: "Remplissez d'abord votre candidature." }, 404);
    if (ins.statut === "suspendu") return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => null);
    const brut = typeof body?.document === "string" ? body.document : "";
    const m = brut.match(/^data:(application\/pdf|image\/(?:jpeg|png|webp));base64,(.+)$/s);
    if (!m) {
      return json({ error: "invalid_input", message: "Déposez un PDF ou une photo de l'attestation." }, 400);
    }
    const mime = m[1] as keyof typeof TYPES;
    const b64 = m[2].replace(/\s/g, "");
    if (b64.length < 100 || b64.length > 8_000_000) {
      return json({ error: "invalid_input", message: "Document trop lourd (8 Mo maximum)." }, 400);
    }
    if (!/^[A-Za-z0-9+/=]+$/.test(b64)) return json({ error: "invalid_input" }, 400);

    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    } catch (_) {
      return json({ error: "invalid_input", message: "Document illisible." }, 400);
    }

    const chemin = `${ins.id}/rc-pro-${Date.now()}.${TYPES[mime]}`;
    const { error: upErr } = await admin.storage
      .from("inspecteurs").upload(chemin, bytes, { contentType: mime, upsert: false });
    if (upErr) {
      console.error("upload rc pro:", upErr);
      return json({ error: "storage", message: "Dépôt impossible. Réessayez." }, 500);
    }

    // Le remplacement d'une attestation efface l'ancienne : on ne garde pas
    // de pièces d'identité professionnelle périmées plus que nécessaire.
    if (ins.rc_pro_document) {
      await admin.storage.from("inspecteurs").remove([ins.rc_pro_document]).catch(() => {});
    }
    await admin.from("inspecteurs").update({ rc_pro_document: chemin }).eq("id", ins.id);

    return json({ ok: true });
  } catch (error) {
    console.error("inspecteur-dossier error:", error);
    return json({ error: "internal", message: "Erreur interne. Réessayez." }, 500);
  }
});
