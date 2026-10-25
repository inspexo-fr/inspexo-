// SPRINT 2C — Réception des annonces envoyées par l'extension Chrome.
// Valide le payload structuré (champs extraits + ≤6 photos base64 redimensionnées
// côté navigateur, EXIF retiré), compose le texte d'annonce, puis FORWARDE à la
// fonction score en service→service avec l'ip_hash du client final transmis :
// le rate limit (5/24 h) est donc LE MÊME seau que /score. Les images ne sont
// jamais stockées (règle inchangée) : elles transitent vers score puis Claude.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-proxy-secret, x-proxy-client-ip",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const IP_HASH_SALT = Deno.env.get("IP_HASH_SALT");
if (!IP_HASH_SALT) throw new Error("IP_HASH_SALT manquant — configurez le secret.");
const INTAKE_PROXY_SECRET = Deno.env.get("INTAKE_PROXY_SECRET") ?? null;

/** Comparaison temps constant (même approche que x-eval-secret dans score). */
async function proxySecretMatches(req: Request): Promise<boolean> {
  if (!INTAKE_PROXY_SECRET) return false;
  const given = req.headers.get("x-proxy-secret");
  if (!given) return false;
  const digest = async (v: string) =>
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)));
  const [a, b] = await Promise.all([digest(given), digest(INTAKE_PROXY_SECRET)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

const MAX_IMAGES = 6;
const MAX_TEXT = 6000;
const SITES_AUTORISES = ["leboncoin.fr", "lacentrale.fr", "autoscout24.fr"];

function clientIp(req: Request): string {
  // cf-connecting-ip : seule source stable et non spoofable (cf. score).
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const first = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip") || "unknown";
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function champ(v: unknown, max: number): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim().slice(0, max) : null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json().catch(() => null);
    if (!body) return json({ error: "invalid_input", message: "Corps JSON requis." }, 400);

    const titre = champ(body.titre, 200);
    const description = champ(body.description, 5000);
    if (!titre && !description) {
      return json({ error: "invalid_input", message: "Titre ou description de l'annonce requis." }, 400);
    }

    const url = champ(body.url, 500);
    const sourceUrl = url && /^https:\/\/\S+$/.test(url) &&
        SITES_AUTORISES.some((s) => {
          try {
            const h = new URL(url).hostname;
            return h === s || h.endsWith(`.${s}`);
          } catch (_) { return false; }
        })
      ? url
      : null;

    const prix = champ(body.prix, 40);
    const annee = champ(body.annee, 20);
    const km = champ(body.kilometrage, 40);
    const carburant = champ(body.carburant, 40);
    const boite = champ(body.boite, 40);
    const vendeur = champ(body.type_vendeur, 60);
    const site = sourceUrl ? new URL(sourceUrl).hostname.replace(/^www\./, "") : "extension";

    const images: string[] = (Array.isArray(body.images) ? body.images : [])
      .filter((i: unknown): i is string => typeof i === "string" && i.length > 100 && i.length < 4_800_000)
      .slice(0, MAX_IMAGES);

    // Texte d'annonce composé depuis les champs structurés du site.
    const entete = [
      `Annonce importée depuis ${site} via l'extension Inspexo.`,
      titre ? `Titre : ${titre}` : null,
      prix ? `Prix affiché : ${prix}` : null,
      annee ? `Année : ${annee}` : null,
      km ? `Kilométrage : ${km}` : null,
      carburant ? `Carburant : ${carburant}` : null,
      boite ? `Boîte : ${boite}` : null,
      vendeur ? `Type de vendeur affiché par le site : ${vendeur}` : null,
    ].filter(Boolean).join("\n");
    const place = MAX_TEXT - entete.length - 20;
    const text = description
      ? `${entete}\n\nDescription :\n${description.slice(0, Math.max(0, place))}`
      : entete;

    // Forward service→service : score applique SON rate limit sur l'ip_hash
    // du client final (transmis), pas sur l'IP interne de cette fonction.
    // Derrière le proxy inspexo.io/api/intake (secret signé), l'IP réelle du
    // client est dans x-proxy-client-ip ; sinon, IP directe de la requête.
    const viaProxy = await proxySecretMatches(req);
    const ip = viaProxy
      ? (req.headers.get("x-proxy-client-ip") ?? "unknown").trim()
      : clientIp(req);
    const ipHash = await sha256Hex(IP_HASH_SALT + ip);
    const res = await fetch(`${SUPABASE_URL}/functions/v1/score`, {
      method: "POST",
      signal: AbortSignal.timeout(145_000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "x-intake-ip-hash": ipHash,
      },
      body: JSON.stringify({ text, images, source_url: sourceUrl }),
    });
    const out = await res.json().catch(() => ({ error: "bad_gateway" }));
    return json(out, res.status);
  } catch (err) {
    console.error("intake error:", err);
    return json({ error: "internal", message: "Erreur interne. Réessayez." }, 500);
  }
});
