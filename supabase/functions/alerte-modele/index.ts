// SPRINT 23, LOT 3 (point 3) — « Être prévenu d'un rappel sur ce modèle ».
// Sans compte, en DOUBLE OPT-IN (décision d'Utku du 12 nov. 2026).
//
//   POST { action: "inscrire", email, analysis_id }
//     → la réponse est TOUJOURS la même, que l'adresse soit nouvelle, déjà
//       confirmée, désinscrite ou en attente : on ne révèle pas si une
//       adresse est connue. Marque, modèle et année sont relus dans
//       l'analyse, jamais pris du client.
//   POST { action: "confirmer", id, jeton }
//     → appelé par le BOUTON de la page /alerte/confirmer (jamais par un GET :
//       un scanner qui précharge le lien ne doit rien confirmer). Pose la
//       référence du nombre de rappels : seule une AUGMENTATION alertera.
//
// Garde AVANT la lecture du corps : limite par IP (tentative enregistrée
// avant le comptage). Le cron `alertes` envoie les alertes et efface les
// inscriptions non confirmées sous 7 jours.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { emailConfirmationAlerteModele, empreinteEmail, empreinteJeton } from "../_shared/notify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const IP_HASH_SALT = Deno.env.get("IP_HASH_SALT");
if (!IP_HASH_SALT) throw new Error("IP_HASH_SALT manquant — configurez le secret.");

const MAX_PAR_IP = 10; // tentatives par 24 h
const RENVOI_MIN_MS = 10 * 60 * 1000; // pas plus d'un email de confirmation par 10 min
const VALIDITE_JETON_MS = 7 * 24 * 3600 * 1000;
const EMAIL_RE = /^[^\s@<>"]{1,64}@[^\s@<>"]{1,185}\.[a-z]{2,24}$/i;
const REPONSE_INSCRIPTION = {
  ok: true,
  message: "Si cette adresse peut recevoir nos e-mails, un lien de confirmation vient de lui être envoyé. Rien ne sera envoyé sans confirmation.",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
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
function egal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const vehiculeDe = (r: { marque: string; modele: string; annee: number | null }) =>
  [r.marque, r.modele, r.annee].filter(Boolean).join(" ");

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  try {
    const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // ---- Garde : limite par IP, AVANT de lire le corps -------------------
    const ipHash = await sha256Hex(IP_HASH_SALT + clientIp(req));
    await admin.from("events").insert({ name: "alerte_modele_tentative", ip_hash: ipHash, props_json: {} });
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count } = await admin.from("events").select("id", { count: "exact", head: true })
      .eq("name", "alerte_modele_tentative").eq("ip_hash", ipHash).gte("created_at", since);
    if ((count ?? 0) > MAX_PAR_IP) return jsonResponse({ error: "rate_limited", message: "Trop de demandes aujourd'hui." }, 429);

    const body = await req.json().catch(() => null);

    // ---- Confirmation ------------------------------------------------------
    if (body?.action === "confirmer") {
      const id = typeof body.id === "string" && /^[0-9a-f-]{36}$/i.test(body.id) ? body.id : null;
      const jeton = typeof body.jeton === "string" && /^[0-9a-f]{64}$/.test(body.jeton) ? body.jeton : null;
      if (!id || !jeton) return jsonResponse({ error: "lien_invalide", message: "Lien de confirmation invalide." }, 400);
      const { data: row } = await admin.from("alertes_modele")
        .select("id, marque, modele, annee, jeton_hash, jeton_envoye_le, confirme_le").eq("id", id).maybeSingle();
      if (!row || !egal(await empreinteJeton(jeton), row.jeton_hash)) {
        return jsonResponse({ error: "lien_invalide", message: "Lien de confirmation invalide ou déjà remplacé." }, 400);
      }
      if (row.confirme_le) return jsonResponse({ ok: true, deja: true, vehicule: vehiculeDe(row) });
      if (Date.now() - new Date(row.jeton_envoye_le).getTime() > VALIDITE_JETON_MS) {
        return jsonResponse({ error: "lien_expire", message: "Ce lien a expiré : refaites la demande depuis le dossier." }, 410);
      }
      // Référence : le nombre de rappels publiés aujourd'hui. Seule une
      // augmentation alertera. En cas d'échec, le cron la posera sans alerter.
      let rappelsVus: number | null = null;
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/rappels`, {
          method: "POST", signal: AbortSignal.timeout(20_000),
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
          body: JSON.stringify({ marque: row.marque, modele: row.modele, annee: row.annee }),
        });
        const j = await res.json().catch(() => null);
        if (res.ok && Array.isArray(j?.rappels) && j?.indisponible !== true) rappelsVus = j.rappels.length;
      } catch (e) {
        console.error("alerte-modele rappels:", e);
      }
      await admin.from("alertes_modele").update({ confirme_le: new Date().toISOString(), rappels_vus: rappelsVus }).eq("id", id);
      await admin.from("events").insert({ name: "alerte_modele_confirmee", props_json: { reference: rappelsVus } });
      return jsonResponse({ ok: true, vehicule: vehiculeDe(row) });
    }

    // ---- Inscription -------------------------------------------------------
    if (body?.action !== "inscrire") return jsonResponse({ error: "invalid_input" }, 400);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const analysisId = typeof body.analysis_id === "string" && /^[0-9a-f-]{36}$/i.test(body.analysis_id) ? body.analysis_id : null;
    if (!EMAIL_RE.test(email) || !analysisId) {
      return jsonResponse({ error: "invalid_input", message: "Adresse e-mail invalide." }, 400);
    }
    const { data: a } = await admin.from("analyses").select("id, marque, modele, annee").eq("id", analysisId).maybeSingle();
    if (!a?.marque || !a?.modele) return jsonResponse({ error: "not_found", message: "Analyse introuvable." }, 404);
    const emailHash = await empreinteEmail(email);
    if (!emailHash) return jsonResponse({ error: "config", message: "Service momentanément indisponible." }, 503);

    // Adresse désinscrite : on n'écrit pas, et on ne le dit pas.
    const { data: opposee } = await admin.from("desinscriptions").select("email_hash").eq("email_hash", emailHash).maybeSingle();
    if (opposee) return jsonResponse(REPONSE_INSCRIPTION);

    const { data: existantes } = await admin.from("alertes_modele")
      .select("id, marque, modele, annee, confirme_le, jeton_envoye_le").eq("email_hash", emailHash).limit(50);
    const meme = (existantes ?? []).find((r) =>
      r.marque.toLowerCase() === String(a.marque).toLowerCase() &&
      r.modele.toLowerCase() === String(a.modele).toLowerCase() &&
      (r.annee ?? 0) === (a.annee ?? 0)
    );
    if (meme?.confirme_le) return jsonResponse(REPONSE_INSCRIPTION);
    if (meme && Date.now() - new Date(meme.jeton_envoye_le).getTime() < RENVOI_MIN_MS) return jsonResponse(REPONSE_INSCRIPTION);

    const jeton = Array.from(crypto.getRandomValues(new Uint8Array(32))).map((b) => b.toString(16).padStart(2, "0")).join("");
    const jetonHash = await empreinteJeton(jeton);
    let id: string | null = null;
    if (meme) {
      await admin.from("alertes_modele").update({ jeton_hash: jetonHash, jeton_envoye_le: new Date().toISOString(), analysis_id: analysisId }).eq("id", meme.id);
      id = meme.id;
    } else {
      const { data: ins, error } = await admin.from("alertes_modele").insert({
        email, email_hash: emailHash, marque: a.marque, modele: a.modele, annee: a.annee ?? null,
        analysis_id: analysisId, jeton_hash: jetonHash,
      }).select("id").single();
      if (error) {
        console.error("alerte-modele insert:", error.message);
        return jsonResponse(REPONSE_INSCRIPTION); // course concurrente : même réponse
      }
      id = ins.id;
    }
    const envoye = await emailConfirmationAlerteModele(email, vehiculeDe(a), id!, jeton);
    await admin.from("events").insert({ name: "alerte_modele_inscription", analysis_id: analysisId, props_json: { envoye } });
    return jsonResponse(REPONSE_INSCRIPTION);
  } catch (error) {
    console.error("alerte-modele error:", error);
    return jsonResponse({ error: "internal", message: "Erreur interne. Réessayez." }, 500);
  }
});
