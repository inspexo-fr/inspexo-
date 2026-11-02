// SPRINT 9 — Contributions au relevé de prix de marché.
//
// RÈGLE DE CONSENTEMENT (décision d'Utku, à ne pas contourner) : une
// contribution = UNE ACTION de l'utilisateur. L'extension n'envoie rien en
// tâche de fond : l'utilisateur clique « Ajouter ces annonces comme
// comparables » sur une page de résultats, et la contribution au relevé de
// marché n'a lieu que s'il a coché « Contribuer anonymement aux prix de
// marché » (case DÉCOCHÉE par défaut, choix mémorisé). La promesse « aucune
// collecte sans votre action » reste donc littéralement vraie.
//
// Ce qui est reçu : titre, année, km, prix, carburant, boîte et code postal
// des annonces AFFICHÉES sur la page que l'utilisateur regardait. Ce qui est
// écrit : des histogrammes par segment (`marche_agregats`). Rien d'autre —
// aucune ligne d'annonce, aucune URL, aucun titre, aucun code postal, et la
// granularité temporelle est le mois.
//
// Aucune requête n'est faite depuis nos serveurs vers Leboncoin, La Centrale
// ou AutoScout24 : nous ne lisons que le DOM déjà chargé par le navigateur de
// l'utilisateur.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fondreReleves, type ReleveMarche, segmentDepuisTitreAnnonce } from "../_shared/marche.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-proxy-secret, x-proxy-client-ip",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const IP_HASH_SALT = Deno.env.get("IP_HASH_SALT");
if (!IP_HASH_SALT) throw new Error("IP_HASH_SALT manquant — configurez le secret.");
const MARCHE_PROXY_SECRET = Deno.env.get("MARCHE_PROXY_SECRET") ?? null;

// Plafonds par IP et par 24 h. Une contribution normale, c'est une page de
// résultats consultée puis un clic : quelques lots par jour. Ces plafonds
// laissent passer l'usage réel et ferment la porte à l'aspiration massive.
const MAX_ANNONCES_PAR_LOT = 60;
const MAX_LOTS_PAR_IP = 20;
const MAX_ANNONCES_PAR_IP = 600;

const SITES_AUTORISES = ["leboncoin.fr", "lacentrale.fr", "autoscout24.fr"];

/** Comparaison en temps constant (même approche que `intake`). */
async function proxySecretMatches(req: Request): Promise<boolean> {
  if (!MARCHE_PROXY_SECRET) return false;
  const given = req.headers.get("x-proxy-secret");
  if (!given) return false;
  const digest = async (v: string) =>
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)));
  const [a, b] = await Promise.all([digest(given), digest(MARCHE_PROXY_SECRET)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function clientIp(req: Request): string {
  const proxied = req.headers.get("x-proxy-client-ip");
  if (proxied) return proxied.trim();
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const first = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip") || "unknown";
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const texte = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
const entier = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseInt(v.replace(/\D/g, ""), 10) : NaN;
  return Number.isFinite(n) ? n : null;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // Seul le proxy inspexo.io parle à cette fonction : l'anon key est publiée
  // dans le bundle du site, elle ne protège RIEN (leçon du sprint 8 :
  // verify_jwt n'est pas un contrôle d'accès, seul le code en est un).
  if (!(await proxySecretMatches(req))) {
    return json({ error: "forbidden" }, 403);
  }

  const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "invalid_input" }, 400);

    // Site d'origine : les contributions ne viennent que des sites que
    // l'extension sait lire. Un site inconnu signale un appel détourné.
    const site = texte(body.site, 40).toLowerCase();
    if (!SITES_AUTORISES.includes(site)) return json({ error: "site_non_supporte" }, 400);

    const brutes = Array.isArray(body.annonces) ? body.annonces.slice(0, MAX_ANNONCES_PAR_LOT) : [];
    if (brutes.length === 0) return json({ error: "invalid_input", message: "Aucune annonce." }, 400);

    const ipHash = await sha256Hex(`${IP_HASH_SALT}${clientIp(req)}`);

    // Rate limit anti-TOCTOU : la tentative est insérée AVANT le comptage, qui
    // l'inclut — deux appels simultanés se comptent mutuellement.
    await admin.from("events").insert({
      name: "marche_contribution",
      ip_hash: ipHash,
      props_json: { site, recus: brutes.length },
    });
    const depuis = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: recents } = await admin
      .from("events")
      .select("props_json")
      .eq("name", "marche_contribution")
      .eq("ip_hash", ipHash)
      .gte("created_at", depuis)
      .limit(MAX_LOTS_PAR_IP + 1);
    const lots = (recents ?? []).length;
    const annoncesJour = (recents ?? []).reduce(
      // deno-lint-ignore no-explicit-any
      (s: number, e: any) => s + (Number(e?.props_json?.recus) || 0),
      0,
    );
    if (lots > MAX_LOTS_PAR_IP || annoncesJour > MAX_ANNONCES_PAR_IP) {
      return json({
        error: "rate_limited",
        message: "Plafond de contributions atteint pour aujourd'hui. Merci, revenez demain.",
      }, 429);
    }

    // deno-lint-ignore no-explicit-any
    const releves: ReleveMarche[] = (brutes as any[]).flatMap((a) => {
      const prix = entier(a?.prix);
      const titre = texte(a?.titre, 160);
      if (prix == null || !titre) return [];
      // Marque et modèle sont déduits du titre par le module partagé, qui rend
      // null dès qu'il n'est pas sûr. Le client ne les fournit pas : il ne doit
      // pas pouvoir décider dans quel segment ses prix atterrissent.
      const seg = segmentDepuisTitreAnnonce(titre);
      if (!seg) return [];
      return [{
        marque: seg.marque,
        modele: seg.modele,
        libelle: titre,
        carburant: texte(a?.carburant, 40),
        boite: texte(a?.boite, 40),
        annee: entier(a?.annee),
        km: entier(a?.km),
        prix,
        code_postal: texte(a?.code_postal, 10),
      }];
    });

    const lignes = fondreReleves(releves);
    if (lignes.length > 0) {
      const { error } = await admin.rpc("agreger_marche", { p_lignes: lignes });
      if (error) {
        console.error("agreger_marche:", error);
        return json({ error: "agregation_echouee" }, 500);
      }
    }

    await admin.from("events").insert({
      name: "marche_contribution_resultat",
      ip_hash: ipHash,
      props_json: { site, recus: brutes.length, segmentables: releves.length, segments: lignes.length },
    });

    return json({ ok: true, recus: brutes.length, retenus: releves.length, segments: lignes.length });
  } catch (e) {
    console.error("marche:", e);
    return json({ error: "server_error" }, 500);
  }
});
