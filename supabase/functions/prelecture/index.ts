// SPRINT 23, LOT 3 (point 4) — Pré-lecture IMMÉDIATE pour l'extension, SANS IA.
//
// Avant l'analyse complète (30 à 60 s), l'extension affiche en une seconde :
//   - les rappels RappelConso du modèle (fonction `rappels`, cache 24 h) ;
//   - la vignette Crit'Air (calcul réglementaire, `critair.ts`) ;
//   - la fourchette des prix observés et la position du prix (agrégats,
//     ≥ 15 relevés, mêmes règles que le score : `referencePrix`) ;
//   - les signaux d'arnaque (motifs fixes, `securiteTransaction.ts`).
// Aucun appel au modèle, aucun écrit hormis le compteur anti-abus. Rien
// n'est conservé de l'annonce.
//
// Accès : UNIQUEMENT par le proxy Vercel `/api/prelecture` (secret
// INTAKE_PROXY_SECRET, le même que l'extension utilise déjà pour `intake`),
// vérifié AVANT la lecture du corps. Marque et modèle sont déduits du TITRE
// par le serveur, jamais pris du client.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { critair, libelleCritair } from "../_shared/critair.ts";
import { detecterSignauxArnaque } from "../_shared/securiteTransaction.ts";
import {
  boiteDe, generationDe, moisRecents, referencePrix, regionDe, segmentDepuisTitreAnnonce,
  SEUIL_FOURCHETTE, technoDe, type LigneAgregat,
} from "../_shared/marche.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const IP_HASH_SALT = Deno.env.get("IP_HASH_SALT");
const INTAKE_PROXY_SECRET = Deno.env.get("INTAKE_PROXY_SECRET") ?? null;
if (!IP_HASH_SALT) throw new Error("IP_HASH_SALT manquant — configurez le secret.");
const MAX_PAR_IP = 120; // pré-lectures par 24 h (une par annonce ouverte)

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
async function sha256Hex(input: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function proxySecretMatches(req: Request): Promise<boolean> {
  if (!INTAKE_PROXY_SECRET) return false;
  const given = req.headers.get("x-proxy-secret");
  if (!given) return false;
  const digest = async (v: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)));
  const [a, b] = await Promise.all([digest(given), digest(INTAKE_PROXY_SECRET)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
const entier = (n: unknown, min: number, max: number) => (typeof n === "number" && Number.isInteger(n) && n >= min && n <= max ? n : null);

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  try {
    // Garde AVANT la lecture du corps.
    if (!(await proxySecretMatches(req))) return jsonResponse({ error: "forbidden" }, 403);
    const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const ip = (req.headers.get("x-proxy-client-ip") ?? "unknown").slice(0, 64);
    const ipHash = await sha256Hex(IP_HASH_SALT + ip);
    await admin.from("events").insert({ name: "prelecture", ip_hash: ipHash, props_json: {} });
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count } = await admin.from("events").select("id", { count: "exact", head: true })
      .eq("name", "prelecture").eq("ip_hash", ipHash).gte("created_at", since);
    if ((count ?? 0) > MAX_PAR_IP) return jsonResponse({ error: "rate_limited" }, 429);

    const body = await req.json().catch(() => null);
    const titre = typeof body?.titre === "string" ? body.titre.slice(0, 200) : "";
    const texte = typeof body?.texte === "string" ? body.texte.slice(0, 6000) : "";
    const prix = entier(body?.prix, 200, 1_000_000);
    const annee = entier(body?.annee, 1950, new Date().getFullYear() + 1);
    const km = entier(body?.km, 0, 2_000_000);
    const carburant = typeof body?.carburant === "string" ? body.carburant.slice(0, 40) : "";
    const codePostal = typeof body?.code_postal === "string" ? body.code_postal.slice(0, 5) : "";
    if (!titre) return jsonResponse({ error: "invalid_input" }, 400);

    const seg = segmentDepuisTitreAnnonce(titre);

    // Rappels (cache 24 h en face) — jamais « aucun rappel » si la source est muette.
    let rappels: { n: number; titres: string[]; indisponible: boolean; takata: unknown } | null = null;
    if (seg) {
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/rappels`, {
          method: "POST", signal: AbortSignal.timeout(12_000),
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
          body: JSON.stringify({ marque: seg.marque, modele: seg.modele, annee, carburant }),
        });
        const j = await r.json().catch(() => null);
        if (r.ok && j) {
          const liste = Array.isArray(j.rappels) ? j.rappels : [];
          rappels = {
            n: liste.length,
            titres: liste.slice(0, 5).map((x: { titre?: string }) => String(x?.titre ?? "").slice(0, 160)),
            indisponible: j.indisponible === true,
            takata: j.takata ?? null,
          };
        }
      } catch (e) {
        console.error("prelecture rappels:", e);
      }
    }

    // Crit'Air : sans date de 1re immatriculation, l'année-modèle (dit à l'écran).
    const classe = carburant && annee ? critair(carburant, annee) : "inconnu";

    // Prix observés : mêmes agrégats et même seuil que le score.
    let prixObserves: Record<string, unknown> = { evalue: false };
    let p25: number | null = null;
    if (seg) {
      const { data: rows } = await admin.from("marche_agregats")
        .select("generation_norm, techno, cyl, boite, annee, km_tranche, region, prix_tranche, effectif, parts_api")
        .eq("marque_norm", seg.marque).eq("modele_norm", seg.modele).in("mois", moisRecents(new Date())).limit(5000);
      // deno-lint-ignore no-explicit-any
      const lignes: LigneAgregat[] = ((rows ?? []) as any[]).map((r) => ({
        generation_norm: String(r.generation_norm ?? ""), techno: String(r.techno ?? ""), cyl: String(r.cyl ?? ""),
        boite: String(r.boite ?? ""), annee: Number(r.annee ?? 0), km_tranche: Number(r.km_tranche ?? -1),
        region: String(r.region ?? ""), prix_tranche: Number(r.prix_tranche ?? 0), effectif: Number(r.effectif ?? 0),
        parts_api: (r.parts_api ?? {}) as Record<string, number>,
      }));
      const tc = technoDe(titre);
      const ref = referencePrix(lignes, {
        techno: tc.techno, cyl: tc.cyl, boite: boiteDe(titre), generation: generationDe(titre),
        annee, km, region: regionDe(codePostal),
      }, prix, SEUIL_FOURCHETTE);
      if (ref) {
        p25 = ref.fourchette.p25;
        prixObserves = {
          evalue: true, p25: ref.fourchette.p25, mediane: ref.fourchette.mediane, p75: ref.fourchette.p75,
          n: ref.fourchette.n, portee: ref.fourchette.portee, position: ref.position?.libelle ?? null,
        };
      }
    }

    const signaux = detecterSignauxArnaque(`${titre}. ${texte}`, prix, p25 != null ? { p25 } : null);

    return jsonResponse({
      vehicule: seg ? { marque: seg.marque, modele: seg.modele, annee } : null,
      rappels,
      critair: { classe, libelle: libelleCritair(classe), base: "annee_modele" },
      prix: prixObserves,
      signaux_arnaque: signaux,
      mention: "Pré-lecture sans intelligence artificielle. L'analyse complète suit.",
    });
  } catch (error) {
    console.error("prelecture error:", error);
    return jsonResponse({ error: "internal" }, 500);
  }
});
