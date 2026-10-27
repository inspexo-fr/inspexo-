// SPRINT 3.1 — Désinscription des alertes du dossier, en un clic, SANS login.
// Le lien reçu par email porte une signature HMAC (UNSUB_SECRET) : il est
// infalsifiable sans le secret et ne révèle rien (u = user_id, t = signature).
//  - POST (RFC 8058, List-Unsubscribe-Post: One-Click, ou bouton de la page) :
//    coupe TOUTES les alertes du dossier immédiatement.
//  - GET : page de confirmation avec un bouton (jamais d'effet de bord sur un
//    simple GET — les scanners d'emails préchargent les liens).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { signatureDesinscription } from "../_shared/notify.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const page = (titre: string, corps: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titre} — Inspexo</title></head>
<body style="font-family:-apple-system,Segoe UI,sans-serif;background:#F8F9FA;margin:0;padding:48px 16px">
<div style="max-width:460px;margin:0 auto;background:#fff;border:1.5px solid rgba(0,0,0,0.07);border-radius:16px;padding:28px 24px;text-align:center">
<div style="font-weight:800;letter-spacing:3px;color:#0F1B2D;margin-bottom:18px">INSP<span style="color:#FF4D00">E</span>XO</div>
<h1 style="font-size:1.125rem;color:#0F1B2D;margin:0 0 10px">${titre}</h1>
${corps}
</div></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );

async function signatureValide(userId: string, token: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !/^[0-9a-f]{64}$/i.test(token)) return false;
  const attendu = await signatureDesinscription(userId);
  if (!attendu) return false;
  // Comparaison en temps constant.
  let diff = 0;
  for (let i = 0; i < attendu.length; i++) diff |= attendu.charCodeAt(i) ^ (token.charCodeAt(i) ?? 0);
  return diff === 0 && attendu.length === token.length;
}

serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const u = url.searchParams.get("u") ?? "";
    const t = url.searchParams.get("t") ?? "";

    if (!(await signatureValide(u, t))) {
      return page(
        "Lien invalide",
        `<p style="color:#6B7280;font-size:0.9375rem;line-height:1.6">Ce lien de désinscription est invalide ou a été altéré.
         Vous pouvez gérer vos alertes depuis votre <a href="https://www.inspexo.io/dossier" style="color:#1E4D8C">dossier d'achat</a>.</p>`,
        403,
      );
    }

    if (req.method === "GET") {
      // Pas d'effet de bord sur GET : confirmation en un clic (formulaire POST).
      return page(
        "Se désinscrire des alertes ?",
        `<p style="color:#6B7280;font-size:0.9375rem;line-height:1.6">Vous ne recevrez plus aucune alerte email
         (rappels constructeur, annonces modifiées, retours d'achat) pour les analyses de votre dossier.</p>
         <form method="post" action="${url.pathname}?u=${u}&t=${t}">
           <button type="submit" style="background:#0F1B2D;color:#fff;border:none;border-radius:10px;padding:13px 26px;font-size:0.9375rem;font-weight:700;cursor:pointer">
             Me désinscrire de toutes les alertes
           </button>
         </form>
         <p style="color:#9CA3AF;font-size:0.75rem;margin-top:14px">Réversible à tout moment depuis
         <a href="https://www.inspexo.io/dossier" style="color:#1E4D8C">votre dossier</a>.</p>`,
      );
    }

    if (req.method === "POST") {
      const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
      const { error } = await admin.from("dossier").update({ alertes: false }).eq("user_id", u);
      if (error) {
        console.error("desinscription update:", error);
        return page("Erreur", `<p style="color:#B91C1C">Réessayez dans un instant.</p>`, 500);
      }
      await admin.from("events").insert({
        name: "desinscription_alertes",
        props_json: { user_id: u, via: req.headers.get("content-type")?.includes("multipart") ? "one_click" : "page" },
      });
      return page(
        "Désinscription confirmée",
        `<p style="color:#16A34A;font-size:0.9375rem;font-weight:600">Vous ne recevrez plus d'alertes email.</p>
         <p style="color:#9CA3AF;font-size:0.75rem">Vous pouvez les réactiver analyse par analyse depuis
         <a href="https://www.inspexo.io/dossier" style="color:#1E4D8C">votre dossier</a>.</p>`,
      );
    }

    return page("Méthode non autorisée", "", 405);
  } catch (err) {
    console.error("desinscription error:", err);
    return page("Erreur", `<p style="color:#B91C1C">Erreur interne.</p>`, 500);
  }
});
