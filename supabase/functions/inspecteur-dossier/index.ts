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

const IP_HASH_SALT = Deno.env.get("IP_HASH_SALT");
if (!IP_HASH_SALT) throw new Error("IP_HASH_SALT manquant — configurez le secret.");

const MAX_DEPOTS_PAR_IP = 12; // par 24 h
const MAX_DEPOTS_PAR_INSPECTEUR = 6; // par 24 h

async function sha256Hex(input: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function clientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const first = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip") || "unknown";
}

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

    // Rate limit anti-TOCTOU : tentative insérée AVANT le comptage. C'était
    // la seule fonction du sprint sans plafond — ~6 Mo acceptés par appel,
    // sans limite, dans un quota de stockage partagé avec les rapports payés.
    const ipHash = await sha256Hex(IP_HASH_SALT + clientIp(req));
    await admin.from("events").insert({
      name: "inspecteur_dossier_tentative",
      ip_hash: ipHash,
      props_json: { inspecteur_id: ins.id },
    });
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const [{ count: parIp }, { count: parInspecteur }] = await Promise.all([
      admin.from("events").select("id", { count: "exact", head: true })
        .eq("name", "inspecteur_dossier_tentative").eq("ip_hash", ipHash).gte("created_at", since),
      admin.from("events").select("id", { count: "exact", head: true })
        .eq("name", "inspecteur_dossier_tentative")
        .contains("props_json", { inspecteur_id: ins.id }).gte("created_at", since),
    ]);
    if ((parIp ?? 0) > MAX_DEPOTS_PAR_IP || (parInspecteur ?? 0) > MAX_DEPOTS_PAR_INSPECTEUR) {
      return json({
        error: "rate_limited",
        message: "Trop de dépôts aujourd'hui. Réessayez demain ou écrivez à contact@inspexo.io.",
      }, 429);
    }

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

    // Chemin DÉTERMINISTE + upsert : c'est ce qui empêche structurellement
    // les orphelins. Avec un horodatage dans le nom, deux dépôts concurrents
    // laissaient des objets que plus aucune ligne ne référençait, donc que
    // plus rien ne pouvait supprimer (audit du 2 nov., majeur n° 4).
    const chemin = `${ins.id}/rc-pro.${TYPES[mime]}`;
    // Une extension différente de la précédente laisserait l'ancien fichier :
    // on nettoie le dossier de l'inspecteur avant d'écrire.
    const { data: existants } = await admin.storage.from("inspecteurs").list(ins.id);
    const aSupprimer = (existants ?? [])
      .map((f) => `${ins.id}/${f.name}`)
      .filter((c) => c !== chemin);
    if (aSupprimer.length > 0) {
      await admin.storage.from("inspecteurs").remove(aSupprimer).catch(() => {});
    }

    const { error: upErr } = await admin.storage
      .from("inspecteurs").upload(chemin, bytes, { contentType: mime, upsert: true });
    if (upErr) {
      console.error("upload rc pro:", upErr);
      return json({ error: "storage", message: "Dépôt impossible. Réessayez." }, 500);
    }

    await admin.from("inspecteurs").update({ rc_pro_document: chemin }).eq("id", ins.id);
    await admin.from("events").insert({
      name: "inspecteur_attestation_deposee",
      ip_hash: ipHash,
      props_json: { inspecteur_id: ins.id, type: mime },
    });

    return json({ ok: true });
  } catch (error) {
    console.error("inspecteur-dossier error:", error);
    return json({ error: "internal", message: "Erreur interne. Réessayez." }, 500);
  }
});
