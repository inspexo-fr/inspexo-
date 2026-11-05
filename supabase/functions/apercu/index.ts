// SPRINT 17.2 — Dépôt d'un aperçu de partage dans le bucket public.
//
// L'image est RENDUE AILLEURS (script Node + navigateur, voir
// `scripts/apercus.mjs`) et seulement déposée ici. Ce découpage est
// volontaire : la tentative précédente rendait l'image à la volée dans une
// fonction Vercel, et quatre corrections n'ont jamais abouti — pendant ce
// temps `og:image` pointait sur une URL en 500.
//
// Rendre l'image dans un vrai navigateur donne en prime la typographie de la
// charte : nos fontes sont en woff2, qu'un navigateur lit et que les moteurs
// de rendu SVG côté serveur refusent.
//
// GET  → la liste des analyses dont l'aperçu reste à produire.
// POST → dépose un PNG pour une analyse.
//
// Accès : administrateur, ou header x-eval-secret.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifierAdmin } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-eval-secret",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const EVAL_BYPASS_SECRET = Deno.env.get("EVAL_BYPASS_SECRET") ?? null;

const BUCKET = "apercus";
const TAILLE_MAX = 2_000_000; // 2 Mo : une image 1200×630 en pèse ~60 Ko
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function evalSecretMatches(req: Request): Promise<boolean> {
  if (!EVAL_BYPASS_SECRET) return false;
  const f = req.headers.get("x-eval-secret");
  if (!f || f.length !== EVAL_BYPASS_SECRET.length) return false;
  const e = new TextEncoder(), a = e.encode(f), b = e.encode(EVAL_BYPASS_SECRET);
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

/** Les octets sont-ils réellement un PNG ?
 *
 *  ⚠️ Le bucket est PUBLIC : ce qui y entre est servi à n'importe qui, sous
 *  notre domaine. On ne se fie donc pas à l'extension ni au type déclaré —
 *  on lit la signature du fichier. */
function estPng(octets: Uint8Array): boolean {
  const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (octets.length < SIGNATURE.length + 8) return false;
  return SIGNATURE.every((b, i) => octets[i] === b);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!(await evalSecretMatches(req))) {
    const acces = await verifierAdmin(req);
    if (!acces.ok) return json({ error: acces.error }, acces.status);
  }

  const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  try {
    if (req.method === "GET") {
      const limite = Number(new URL(req.url).searchParams.get("limite") ?? 20);
      const { data, error } = await admin.rpc("analyses_sans_apercu", { p_limite: limite });
      if (error) throw error;
      return json({ analyses: data ?? [] });
    }

    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

    const body = await req.json().catch(() => null);
    const id = typeof body?.analysis_id === "string" ? body.analysis_id : "";
    if (!UUID_RE.test(id)) return json({ error: "invalid_input", message: "analysis_id requis." }, 400);

    const b64 = String(body?.png_base64 ?? "").replace(/^data:image\/png;base64,/, "");
    if (!/^[A-Za-z0-9+/=]+$/.test(b64) || b64.length < 100) {
      return json({ error: "invalid_input", message: "png_base64 invalide." }, 400);
    }
    const octets = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    if (octets.length > TAILLE_MAX) return json({ error: "trop_grand" }, 413);
    if (!estPng(octets)) return json({ error: "pas_un_png" }, 400);

    // ⚠️ Le nom du fichier est l'identifiant du dossier, et RIEN d'autre : il
    // doit être devinable depuis l'URL publique de la page, sinon l'aperçu ne
    // serait pas trouvable par celui qui l'affiche. L'identifiant est déjà
    // public (il est dans l'URL /a/:id).
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(`${id}.png`, octets, { contentType: "image/png", upsert: true, cacheControl: "86400" });
    if (upErr) {
      console.error("apercu upload:", upErr);
      return json({ error: "upload", message: upErr.message }, 500);
    }
    await admin.rpc("apercu_depose", { p_id: id });

    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(`${id}.png`);
    return json({ ok: true, url: pub?.publicUrl ?? null, octets: octets.length });
  } catch (e) {
    console.error("apercu:", e);
    return json({ error: "internal", message: String(e).slice(0, 200) }, 500);
  }
});
