// SPRINT 10 — Redirection comptée vers un partenaire : /go/<slug>.
//
// Pourquoi passer par le serveur plutôt que de poser un lien direct :
//  - le navigateur ne reçoit jamais l'URL du partenaire, donc la mise en
//    relation ne peut pas être suivie sans être comptée ;
//  - aucun traceur tiers n'est chargé sur nos pages ;
//  - le `Referer` est coupé par le proxy, pour que le partenaire ne reçoive
//    pas l'adresse du dossier d'analyse que l'acheteur était en train de lire.
//
// Ce qui est journalisé : le partenaire, le dossier, la source, une empreinte
// d'IP salée et un drapeau « robot ». Aucune donnée personnelle, aucune
// transmission de coordonnées — en V1 il n'y en a tout simplement pas.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { estRobot } from "../_shared/partenaires.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-proxy-secret, x-proxy-client-ip",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const IP_HASH_SALT = Deno.env.get("IP_HASH_SALT");
if (!IP_HASH_SALT) throw new Error("IP_HASH_SALT manquant — configurez le secret.");
const GO_PROXY_SECRET = Deno.env.get("GO_PROXY_SECRET") ?? null;

async function proxySecretMatches(req: Request): Promise<boolean> {
  if (!GO_PROXY_SECRET) return false;
  const given = req.headers.get("x-proxy-secret");
  if (!given) return false;
  const digest = async (v: string) =>
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)));
  const [a, b] = await Promise.all([digest(given), digest(GO_PROXY_SECRET)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
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
  if (!(await proxySecretMatches(req))) return json({ error: "forbidden" }, 403);

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "invalid_input" }, 400);

    const slug = String(body.slug ?? "").trim().toLowerCase();
    if (!/^[a-z0-9-]{3,40}$/.test(slug)) return json({ error: "slug_invalide" }, 400);

    const analysisId = typeof body.analysis_id === "string" &&
        /^[0-9a-f-]{36}$/i.test(body.analysis_id)
      ? body.analysis_id
      : null;
    const source = ["web", "app", "ext"].includes(String(body.source)) ? String(body.source) : "web";
    const ip = String(body.ip ?? req.headers.get("x-proxy-client-ip") ?? "inconnu");
    const robot = estRobot(body.user_agent);

    const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    const { data, error } = await admin.rpc("enregistrer_mise_en_relation", {
      p_slug: slug,
      p_analysis_id: analysisId,
      p_source: source,
      p_ip_hash: await sha256Hex(`${IP_HASH_SALT}go:${ip}`),
      p_robot: robot,
    });
    if (error) {
      console.error("enregistrer_mise_en_relation:", error);
      return json({ error: "server_error" }, 500);
    }
    // Partenaire inconnu ou éteint : pas d'URL, donc pas de redirection. Un
    // partenaire désactivé doit cesser d'exister pour l'extérieur, même si un
    // ancien lien traîne dans un email ou un signet.
    if (!data || !data.url) return json({ error: "introuvable" }, 404);

    return json({ url: data.url, nom: data.nom, type: data.type });
  } catch (e) {
    console.error("go:", e);
    return json({ error: "server_error" }, 500);
  }
});
