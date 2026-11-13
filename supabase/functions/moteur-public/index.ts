// SPRINT 24 — Données des pages /moteur/<slug>, avec le SEUIL D'INDEXATION.
//
//   GET ?marque=<Marque>&famille=<CODE>  → la fiche publique (même forme que la
//                                           RPC get_moteur_public) + le verdict
//                                           d'indexation
//   GET ?liste=1                          → toutes les pages moteur publiables,
//                                           avec `indexable` (pré-rendu, sitemap)
//
// Règles (décisions d'Utku du 13 nov. 2026) :
//   - une panne qui nomme une cylindrée ou une puissance différente de la
//     famille, ou qu'on ne peut pas départager, n'est pas affichée ;
//   - une page n'est INDEXABLE que si pannes portées + prises en charge
//     datées propres ≥ 3, dont au moins 1 panne portée ; sinon noindex et hors
//     sitemap, la page restant accessible ;
//   - un VRAI doublon (même code moteur sous deux marques : EA288 Audi /
//     Volkswagen) pointe en canonique vers la page principale.
//
// Lecture seule. Fonction serveur plutôt que RPC : le classement des sources
// (`rangSource`) n'existe qu'en TypeScript.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import TABLE from "../_shared/famillesMoteur.json" with { type: "json" };
import { verdictIndexationMoteur, type FamilleMoteur } from "../_shared/indexation.ts";
import { expandBrand } from "../_shared/brandAliases.ts";
import { normFamille } from "../_shared/defectSheets.ts";
import { composerPage, indexerModeles, type FicheMoteur } from "../_shared/modeles.ts";
import { sourcesPortentLEntree, urlsDeLaPanne } from "../_shared/atlasSource.ts";
import { pointProprietaire } from "../_shared/pointsProprietaires.ts";
import { questionSansSourceIndependante } from "../_shared/pannesApplicables.ts";

const PAGES_MODELE = indexerModeles((TABLE as { familles: Array<FamilleMoteur & { modeles: string[] }> }).familles);
const CATALOGUE = PAGES_MODELE.map((p) => ({ marque: p.marque, modele: p.modele }));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const FAMILLES = (TABLE as { familles: FamilleMoteur[] }).familles;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=600" },
  });
}

// deno-lint-ignore no-explicit-any
async function fiche(admin: any, marque: string, famille: string): Promise<any | null> {
  const { data } = await admin.from("defect_sheets")
    .select("marque, famille_moteur, moteur_label, annee_debut, annee_fin, statut, pannes, plan_entretien, programmes, prises_en_charge, updated_at")
    .in("marque_norm", expandBrand(marque))
    .eq("famille_norm", normFamille(famille))
    .order("updated_at", { ascending: false })
    .limit(5);
  // deno-lint-ignore no-explicit-any
  const lignes = ((data ?? []) as any[]).sort((a, b) => Number(b.statut === "validee") - Number(a.statut === "validee"));
  return lignes[0] ?? null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return jsonResponse({ error: "method_not_allowed" }, 405);
  try {
    const url = new URL(req.url);
    const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    if (url.searchParams.get("liste") === "1") {
      const out = [];
      for (const f of FAMILLES) {
        const d = await fiche(admin, f.marque, f.famille);
        if (!d) continue;
        const v = verdictIndexationMoteur(f, d, FAMILLES);
        if (!v.publiee) continue;
        out.push({ marque: f.marque, famille: f.famille, nom_commercial: f.nom_commercial, ...v.resume });
      }
      return jsonResponse({ pages: out });
    }

    const marque = (url.searchParams.get("marque") ?? "").slice(0, 40);
    const famille = (url.searchParams.get("famille") ?? "").slice(0, 30);
    const fam = FAMILLES.find((f) => f.marque.toLowerCase() === marque.toLowerCase() && normFamille(f.famille) === normFamille(famille));
    if (!fam) return jsonResponse({ error: "not_found" }, 404);
    const d = await fiche(admin, fam.marque, fam.famille);
    if (!d) return jsonResponse({ error: "not_found" }, 404);
    const v = verdictIndexationMoteur(fam, d, FAMILLES);
    if (!v.publiee) return jsonResponse({ error: "not_found" }, 404);
    // Liens internes : les pages modèle ACCESSIBLES qui montent ce moteur.
    const { data: toutes } = await admin.from("defect_sheets")
      .select("marque, famille_moteur, pannes, prises_en_charge, statut, updated_at")
      .order("updated_at", { ascending: false }).limit(500);
    // deno-lint-ignore no-explicit-any
    const fiches = ((toutes ?? []) as any[]).sort((a, b) => Number(b.statut === "validee") - Number(a.statut === "validee")) as FicheMoteur[];
    const modeles = PAGES_MODELE
      .filter((p) => p.familles.some((f) => f.marque === fam.marque && f.famille === fam.famille))
      .filter((p) => { const c = composerPage(p, fiches, CATALOGUE); return c.sections.length > 0 && c.n_pannes >= 1; })
      .map((p) => ({ slug_marque: p.slug_marque, slug: p.slug, libelle: [p.marque, p.modele, p.generation].filter(Boolean).join(" ") }));
    // SPRINT 24 (audit de cohérence) — la page n'AFFIRME que les pannes
    // confirmées par une source indépendante (officielle, presse, éditoriale).
    // Les autres : point « signalé par des propriétaires » si au moins 3 sites
    // distincts les citent, sinon question à poser au vendeur. Même règle que
    // le dossier /a/:id.
    // deno-lint-ignore no-explicit-any
    const confirmees = v.pannes.filter((p: any) => sourcesPortentLEntree(urlsDeLaPanne(p)));
    // deno-lint-ignore no-explicit-any
    const nonConfirmees = v.pannes.filter((p: any) => !sourcesPortentLEntree(urlsDeLaPanne(p)));
    const pointsProprietaires = [];
    const questionsNonConfirmees: string[] = [];
    for (const p of nonConfirmees) {
      // deno-lint-ignore no-explicit-any
      const q = p as any;
      const pt = pointProprietaire({ titre: q.titre, organe: q.organe, symptome: q.symptomes ?? q.symptome, km_typique: q.km_typique, urls: urlsDeLaPanne(p) });
      if (pt) pointsProprietaires.push(pt);
      else if (q.titre) questionsNonConfirmees.push(questionSansSourceIndependante(String(q.titre)));
    }
    return jsonResponse({
      modeles,
      marque: d.marque,
      famille_moteur: d.famille_moteur,
      moteur_label: d.moteur_label,
      annee_debut: d.annee_debut,
      annee_fin: d.annee_fin,
      statut: d.statut,
      pannes: confirmees,
      points_proprietaires: pointsProprietaires,
      questions_non_confirmees: questionsNonConfirmees,
      plan_entretien: d.plan_entretien ?? [],
      programmes: d.programmes ?? [],
      updated_at: d.updated_at,
      ...v.resume,
    });
  } catch (error) {
    console.error("moteur-public error:", error);
    return jsonResponse({ error: "internal" }, 500);
  }
});
