// SPRINT 23, LOT 3 (point 5) — Données des pages /modele/<marque>/<modele>.
//
//   GET ?liste=1                 → pages publiables (pré-rendu, sitemap, index)
//   GET ?marque=<slug>&modele=<slug> → contenu d'une page, ou 404
//
// LECTURE SEULE, données publiques (les fiches moteur sont déjà publiées sur
// /moteur). Fonction serveur plutôt que RPC SQL : le classement des sources
// (`rangSource`) n'existe qu'en TypeScript, et le recopier en SQL créerait une
// seconde liste d'hôtes — donc des pages modèle qui cesseraient de décrire la
// règle appliquée au score.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import TABLE from "../_shared/famillesMoteur.json" with { type: "json" };
import { composerPage, indexerModeles, type FamilleMoteur, type FicheMoteur } from "../_shared/modeles.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=600" },
  });
}

const PAGES = indexerModeles((TABLE as { familles: FamilleMoteur[] }).familles);
// Noms de tous les véhicules connus : une ligne qui en nomme un autre ne va
// pas sur cette page.
const CATALOGUE = PAGES.map((p) => ({ marque: p.marque, modele: p.modele }));

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return jsonResponse({ error: "method_not_allowed" }, 405);
  try {
    const url = new URL(req.url);
    const liste = url.searchParams.get("liste") === "1";
    const slugMarque = (url.searchParams.get("marque") ?? "").slice(0, 40);
    const slugModele = (url.searchParams.get("modele") ?? "").slice(0, 60);
    if (!liste && (!/^[a-z0-9-]+$/.test(slugMarque) || !/^[a-z0-9-]+$/.test(slugModele))) {
      return jsonResponse({ error: "invalid_input" }, 400);
    }
    const pages = liste ? PAGES : PAGES.filter((p) => p.slug_marque === slugMarque && p.slug === slugModele);
    if (pages.length === 0) return jsonResponse({ error: "not_found" }, 404);

    const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const { data, error } = await admin
      .from("defect_sheets")
      .select("marque, famille_moteur, moteur_label, pannes, prises_en_charge, statut, updated_at")
      .order("statut", { ascending: false }) // « validee » avant « generee »
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    // Validée d'abord, puis la plus récente : `composerPage` garde la première.
    const fiches = ((data ?? []) as Array<FicheMoteur & { statut: string }>)
      .sort((a, b) => Number(b.statut === "validee") - Number(a.statut === "validee"));

    if (liste) {
      const publiables = pages
        .map((p) => ({ p, c: composerPage(p, fiches, CATALOGUE) }))
        .filter((x) => x.c.publiable)
        .map(({ p, c }) => ({
          marque: p.marque, modele: p.modele, generation: p.generation,
          slug_marque: p.slug_marque, slug: p.slug, n_pannes: c.n_pannes,
          familles: c.sections.map((s) => s.famille),
        }));
      return jsonResponse({ pages: publiables, seuil: 3 });
    }

    const p = pages[0];
    const c = composerPage(p, fiches, CATALOGUE);
    if (!c.publiable) return jsonResponse({ error: "not_found", n_pannes: c.n_pannes }, 404);
    return jsonResponse({
      marque: p.marque, modele: p.modele, generation: p.generation,
      slug_marque: p.slug_marque, slug: p.slug, n_pannes: c.n_pannes, sections: c.sections,
    });
  } catch (error) {
    console.error("modele-public error:", error);
    return jsonResponse({ error: "internal" }, 500);
  }
});
