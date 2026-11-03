// SPRINT 10 — Retour d'issue par LIEN SIGNÉ, sans compte.
//
// L'existant (sprint 3) ne touchait que les gens connectés qui avaient pensé
// à marquer « acheté » dans leur dossier : il présupposait l'achat au lieu de
// le demander, et exigeait un compte. Autant dire presque personne.
//
// Ici, le lien reçu par email porte un jeton HMAC (64 caractères, secret
// UNSUB_SECRET) dont seule l'EMPREINTE est stockée (`retours.token_hash`) :
// une fuite de la base ne permet pas de fabriquer un lien valide. Aucun
// compte, aucun mot de passe, et une seule invitation par dossier et par
// email — l'unicité est posée dans le schéma, pas dans la politique d'envoi.
//
// `verifier` ne lit que l'analyse déjà payée/produite pour ce destinataire :
// c'est son propre dossier. Aucun effet de bord.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { empreinteJeton } from "../_shared/notify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const IP_HASH_SALT = Deno.env.get("IP_HASH_SALT");
if (!IP_HASH_SALT) throw new Error("IP_HASH_SALT manquant — configurez le secret.");

/** Jetons invalides tolérés par IP et par 24 h : un jeton fait 64 caractères
 *  hexadécimaux, il ne se devine pas — ce plafond ne sert qu'à rendre une
 *  énumération coûteuse et visible. */
const MAX_ECHECS_PAR_IP = 30;

function clientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") || "inconnu";
}

async function sha256Hex(input: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "invalid_input" }, 400);

    const action = String(body.action ?? "verifier");
    const token = String(body.token ?? "");
    const analysisId = String(body.analysis_id ?? "");
    if (!/^[0-9a-f]{64}$/i.test(token) || !/^[0-9a-f-]{36}$/i.test(analysisId)) {
      return json({ error: "lien_invalide" }, 403);
    }

    const ipHash = await sha256Hex(`${IP_HASH_SALT}retour:${clientIp(req)}`);
    const tokenHash = await empreinteJeton(token);

    const { data: retour } = await admin
      .from("retours")
      .select("id, analysis_id, repondu_le")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (!retour || retour.analysis_id !== analysisId) {
      // Échec compté puis plafonné : l'insertion précède le comptage
      // (anti-TOCTOU, même forme que les autres plafonds du projet).
      await admin.from("events").insert({ name: "retour_lien_invalide", ip_hash: ipHash });
      const { count } = await admin.from("events")
        .select("id", { count: "exact", head: true })
        .eq("name", "retour_lien_invalide").eq("ip_hash", ipHash)
        .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString());
      if ((count ?? 0) > MAX_ECHECS_PAR_IP) return json({ error: "rate_limited" }, 429);
      return json({ error: "lien_invalide" }, 403);
    }

    // ---- Lecture : de quoi se souvenir de ce qu'on avait signalé ----
    const { data: analyse } = await admin
      .from("analyses")
      .select("marque, modele, motorisation, annee, verdict, score, result_json")
      .eq("id", analysisId)
      .maybeSingle();

    // deno-lint-ignore no-explicit-any
    const rj = (analyse?.result_json ?? {}) as any;
    const vehicule = [analyse?.marque, analyse?.modele, analyse?.motorisation]
      .filter(Boolean).join(" ") || "votre véhicule";
    // Les points que nous avions signalés, pour que la question « se sont-ils
    // confirmés ? » porte sur quelque chose de précis et non sur un souvenir.
    const points: string[] = [
      ...(Array.isArray(rj.raisons_principales) ? rj.raisons_principales : []),
      ...(Array.isArray(rj.pannes_connues)
        ? rj.pannes_connues.map((p: { titre?: string }) => p?.titre).filter(Boolean)
        : []),
    ].slice(0, 6).map((s: unknown) => String(s).slice(0, 220));

    if (action === "verifier") {
      return json({
        ok: true,
        vehicule,
        annee: analyse?.annee ?? null,
        verdict: analyse?.verdict ?? null,
        score: analyse?.score ?? null,
        points,
        deja_repondu: Boolean(retour.repondu_le),
      });
    }

    if (action === "repondre") {
      const achete = typeof body.achete === "boolean" ? body.achete : null;
      if (achete === null) return json({ error: "reponse_incomplete" }, 400);
      const prix = Number.isFinite(Number(body.prix_paye)) && Number(body.prix_paye) > 0
        ? Math.round(Number(body.prix_paye))
        : null;
      const choix = ["oui", "non", "pas_verifie"].includes(String(body.points_confirmes))
        ? String(body.points_confirmes)
        : null;
      const commentaire = typeof body.commentaire === "string"
        ? body.commentaire.trim().slice(0, 1000)
        : null;

      const { data: res, error } = await admin.rpc("submit_retour_signe", {
        p_token_hash: tokenHash,
        p_achete: achete,
        // Le prix n'a de sens que si l'achat a eu lieu.
        p_prix_paye: achete ? prix : null,
        p_points_confirmes: choix,
        p_commentaire: commentaire,
      });
      if (error) {
        console.error("submit_retour_signe:", error);
        return json({ error: "server_error" }, 500);
      }
      if (!res?.ok) return json({ error: res?.erreur ?? "refuse" }, 400);
      return json({ ok: true });
    }

    return json({ error: "action_inconnue" }, 400);
  } catch (e) {
    console.error("retour:", e);
    return json({ error: "server_error" }, 500);
  }
});
