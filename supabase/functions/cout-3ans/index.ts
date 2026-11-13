// SPRINT 22 — Coût réel sur 3 ans d'un dossier.
//
// Calculé À LA LECTURE à partir du `result_json` déjà produit : aucun appel
// au modèle, et le score n'est pas touché. Toutes les analyses en profitent,
// anciennes comprises.
//
// ⚠️ VERROU SERVEUR, comme la négociation et le mode revendeur : sans Pass, la
// réponse ne porte que le TOTAL (et ce qu'il ne compte pas). Les lignes, leurs
// sources et l'entrée de recalcul ne quittent pas le serveur.
//
// Ouverte à anon : le total est gratuit. Rien n'est écrit en base.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { passDepuisReq } from "../_shared/passAuth.ts";
import { calculerCout3Ans, chargerContexteCout } from "../_shared/cout3ansSources.ts";
import { coutTroisAnsPublic } from "../_shared/cout3ans.ts";
import { factureAPrevoir } from "../_shared/factureAPrevoir.ts";
import { programmesPourFamille, type WarrantyProgram } from "../_shared/warrantyPrograms.ts";
import { varianteVehicule } from "../_shared/variantes.ts";
import { indexerModeles, nommeUnAutreVehicule, type FamilleMoteur } from "../_shared/modeles.ts";
import { expandBrand } from "../_shared/brandAliases.ts";
import { normFamille } from "../_shared/defectSheets.ts";
import TABLE from "../_shared/famillesMoteur.json" with { type: "json" };

// Noms des véhicules connus : une prise en charge qui en nomme un autre que
// celui du dossier n'entre pas dans sa facture.
const CATALOGUE = indexerModeles((TABLE as { familles: FamilleMoteur[] }).familles).map((p) => ({ marque: p.marque, modele: p.modele }));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    // Le droit au détail se décide AVANT de lire la demande, depuis le jeton.
    const acces = await passDepuisReq(admin, req);

    const body = await req.json().catch(() => null);
    const id = typeof body?.analysis_id === "string" ? body.analysis_id : "";
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "invalid_input", message: "analysis_id requis." }, 400);

    const { data: a } = await admin.from("analyses").select("result_json").eq("id", id).maybeSingle();
    const rj = a?.result_json;
    if (!rj) return json({ error: "introuvable" }, 404);
    if (rj.statut_analyse === "en_cours") return json({ error: "en_cours" }, 409);
    if (!rj.vehicule) return json({ error: "sans_vehicule" }, 422);

    const ctx = await chargerContexteCout(admin);
    const { cout, entree } = calculerCout3Ans(rj, ctx, {
      km_an: body?.km_an,
      region: body?.region,
      cv: body?.cv,
    });

    // SPRINT 24 lot 2 — LA FACTURE À PRÉVOIR, gratuite pour tous (lignes
    // sourcées et datées, sans montant quand aucune source n'est confirmée).
    // Hors score : calculée ici, à la lecture, jamais dans `score`.
    let facture = null;
    try {
      const v = rj.vehicule ?? {};
      const famille = typeof v.famille_moteur === "string" ? v.famille_moteur : null;
      let programmesFiche: WarrantyProgram[] | null = null;
      let ficheMaj: string | null = null;
      if (famille) {
        const { data: f } = await admin.from("defect_sheets")
          .select("programmes, updated_at, statut")
          .in("marque_norm", expandBrand(String(v.marque ?? "")))
          .eq("famille_norm", normFamille(famille))
          .order("updated_at", { ascending: false })
          .limit(3);
        // deno-lint-ignore no-explicit-any
        const fiches = ((f ?? []) as any[]).sort((a, b) => Number(b.statut === "validee") - Number(a.statut === "validee"));
        programmesFiche = Array.isArray(fiches[0]?.programmes) ? fiches[0].programmes : null;
        ficheMaj = fiches[0]?.updated_at ?? null;
      }
      const page = { marque: String(v.marque ?? ""), modele: String(v.modele ?? ""), generation: null, slug_marque: "", slug: "", familles: [] };
      facture = factureAPrevoir({
        aujourdhui: new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date()),
        kilometrage: typeof v.kilometrage === "number" ? v.kilometrage : null,
        premiere_immat: rj.critair?.premiere_immatriculation ?? null,
        annee: typeof v.annee === "number" ? v.annee : null,
        version: varianteVehicule({ cylindree: v.cylindree, motorisation: v.motorisation }),
        cout3ans: cout,
        pannes: Array.isArray(rj.pannes_connues) ? rj.pannes_connues : [],
        prises: Array.isArray(rj.prises_en_charge) ? rj.prises_en_charge : [],
        programmes: programmesPourFamille(famille, programmesFiche),
        fiche_maj: ficheMaj,
        nommeUnAutreVehicule: page.marque && page.modele ? (t: string) => nommeUnAutreVehicule(t, page, CATALOGUE) : undefined,
      });
    } catch (e) {
      console.error("cout-3ans facture:", e);
    }

    if (!acces.passActif) return json({ pass: false, cout: coutTroisAnsPublic(cout), facture });
    // Avec Pass : l'ENTRÉE accompagne le résultat, pour que le navigateur
    // recalcule (kilométrage annuel, corrections) avec le même module.
    return json({ pass: true, cout, entree, facture });
  } catch (e) {
    console.error("cout-3ans:", e);
    return json({ error: "internal" }, 500);
  }
});
