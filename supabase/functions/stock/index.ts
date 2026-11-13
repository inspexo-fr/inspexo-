// SPRINT 24 lot 3 — CONTRÔLE D'ENTRÉE EN STOCK (mode revendeur, sans annonce).
//
//   POST { mode: "vin", vin }                    décodage local du numéro de série
//   POST { mode: "carte_grise", photo }          lecture d'une photo de carte grise
//   POST { mode: "fiche", vehicule, marge_visee } un véhicule : l'écran complet
//   POST { mode: "lot", lignes, marge_visee }     jusqu'à 20 véhicules, classés
//
// ⚠️ ACCÈS : drapeau `stock_revendeur`, évalué CÔTÉ SERVEUR avec le jeton de
// l'appelant (admin uniquement pour l'instant ; la formule pro distincte du
// Pass est préparée, pas activée). Le secret d'éval passe outre.
// ⚠️ RIEN N'EST ÉCRIT dans un dossier public : le résultat est renvoyé une
// fois, à l'appelant. La photo n'est jamais stockée ; seuls les champs
// techniques en sortent (jamais nom, adresse ni immatriculation).
// ⚠️ Moteur incertain : la fonction DEMANDE de choisir parmi les candidats de
// la table, elle ne devine pas.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decoderVin } from "../_shared/vin.ts";
import { resoudreFamille, FAMILLES } from "../_shared/familleMoteur.ts";
import { lookupDefectSheet } from "../_shared/defectSheets.ts";
import { varianteVehicule } from "../_shared/variantes.ts";
import { calculerCout3Ans, chargerContexteCout } from "../_shared/cout3ansSources.ts";
import { factureAPrevoir } from "../_shared/factureAPrevoir.ts";
import { programmesPourFamille, type WarrantyProgram } from "../_shared/warrantyPrograms.ts";
import { marqueCanonique, modeleCanonique, moisRecents, referencePrix, technoDe, type LigneAgregat, SEUIL_FOURCHETTE } from "../_shared/marche.ts";
import { PARAMETRES_DEFAUT, prixReventeDepuisMarche } from "../_shared/revendeur.ts";
import { accesProDepuisReq } from "../_shared/proAuth.ts";
import {
  CG_SYSTEM, CG_TOOL, classerLot, controlesSurPlace, MAX_LOT, MENTION_STOCK, pannesDeLaFiche, prixPlafond,
  type ResumeLot, rjSynthetique, separerFactureRisque, validerCarteGrise, vehiculeDepuisEntree, type VehiculeStock,
  choisirParMotorisation,
} from "../_shared/stock.ts";
import TABLE from "../_shared/famillesMoteur.json" with { type: "json" };
import { indexerModeles, nommeUnAutreVehicule, type FamilleMoteur } from "../_shared/modeles.ts";

const CATALOGUE = indexerModeles((TABLE as { familles: Array<FamilleMoteur & { modeles: string[] }> }).familles)
  .map((p) => ({ marque: p.marque, modele: p.modele }));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const EVAL_SECRET = Deno.env.get("EVAL_BYPASS_SECRET") ?? "";
const MODEL = "claude-sonnet-5";
const FALLBACK_MODEL = "claude-sonnet-4-6";
const MAX_CG_PAR_IP_24H = 30;

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function empreinteIp(req: Request): Promise<string | null> {
  const ip = req.headers.get("cf-connecting-ip");
  const sel = Deno.env.get("IP_HASH_SALT");
  if (!ip || !sel) return null;
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sel + ip));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function imageBloc(raw: unknown) {
  if (typeof raw !== "string") return null;
  let mediaType = "image/jpeg", data = raw;
  const m = raw.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/s);
  if (m) { mediaType = m[1]; data = m[2]; }
  data = data.replace(/\s/g, "");
  if (data.length < 100 || data.length > 4_500_000 || !/^[A-Za-z0-9+/=]+$/.test(data)) return null;
  return { type: "image", source: { type: "base64", media_type: mediaType, data } };
}

// deno-lint-ignore no-explicit-any
async function lireCarteGrise(image: any): Promise<{ input: any; cout_eur: number } | null> {
  for (const model of [MODEL, FALLBACK_MODEL]) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: AbortSignal.timeout(55_000),
        headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model, max_tokens: 500, thinking: { type: "disabled" },
          system: CG_SYSTEM,
          tools: [CG_TOOL],
          tool_choice: { type: "tool", name: "rendre_carte_grise" },
          messages: [{ role: "user", content: [image, { type: "text", text: "Rends les champs techniques via rendre_carte_grise. Jamais de nom ni d'adresse." }] }],
        }),
      });
      if (!res.ok) { console.error("stock vision:", model, res.status); continue; }
      const data = await res.json();
      const u = data.usage ?? {};
      const cout = ((u.input_tokens ?? 0) * 3e-6 + (u.output_tokens ?? 0) * 15e-6) * 0.92;
      // deno-lint-ignore no-explicit-any
      const b = (data.content ?? []).find((x: any) => x.type === "tool_use" && x.name === "rendre_carte_grise");
      if (b) return { input: b.input, cout_eur: Math.round(cout * 10000) / 10000 };
    } catch (e) {
      console.error("stock vision exception:", model, e);
    }
  }
  return null;
}

/** Résolution du moteur : un code choisi doit appartenir à la table pour
 *  cette marque ; sinon la table tranche, ou l'on renvoie les candidats. */
function resoudre(v: VehiculeStock) {
  const r = resoudreFamille({ marque: v.marque, modele: v.modele, motorisation: v.motorisation, carburant: v.energie, annee: v.annee, propose: v.famille });
  const deLaMarque = FAMILLES.filter((f) => f.marque.toLowerCase() === v.marque.toLowerCase());
  const connue = r.famille && deLaMarque.some((f) => f.famille.toUpperCase() === String(r.famille).toUpperCase());
  const candidats = (r.candidats.length ? deLaMarque.filter((f) => r.candidats.includes(f.famille)) : [])
    .map((f) => ({ famille: f.famille, nom_commercial: f.nom_commercial, annees: `${f.debut}–${f.derniere_attestee}` }));
  if (!connue && candidats.length > 1) {
    const lu = choisirParMotorisation(candidats, v.motorisation, (t) => varianteVehicule({ motorisation: t }));
    if (lu) return { famille: lu.famille, candidats: [], motif: "motorisation saisie" };
  }
  return { famille: connue ? r.famille : null, candidats, motif: r.motif };
}

// deno-lint-ignore no-explicit-any
async function prixMarche(admin: any, v: VehiculeStock) {
  const marqueF = marqueCanonique(v.marque);
  const modeleF = modeleCanonique(v.modele);
  if (!marqueF || !modeleF) return null;
  const { data } = await admin.from("marche_agregats")
    .select("generation_norm, techno, cyl, boite, annee, km_tranche, region, prix_tranche, effectif, parts_api")
    .eq("marque_norm", marqueF).eq("modele_norm", modeleF).in("mois", moisRecents(new Date())).limit(5000);
  // deno-lint-ignore no-explicit-any
  const lignes: LigneAgregat[] = ((data ?? []) as any[]).map((r) => ({
    generation_norm: String(r.generation_norm ?? ""), techno: String(r.techno ?? ""), cyl: String(r.cyl ?? ""),
    boite: String(r.boite ?? ""), annee: Number(r.annee ?? 0), km_tranche: Number(r.km_tranche ?? -1),
    region: String(r.region ?? ""), prix_tranche: Number(r.prix_tranche ?? 0), effectif: Number(r.effectif ?? 0),
    parts_api: (r.parts_api ?? {}) as Record<string, number>,
  }));
  const { techno, cyl } = technoDe(`${v.motorisation} ${v.modele}`);
  const ref = referencePrix(lignes, { techno, cyl, boite: "", generation: "", annee: v.annee, km: v.kilometrage, region: "" }, null, SEUIL_FOURCHETTE);
  return ref;
}

// deno-lint-ignore no-explicit-any
async function evaluer(admin: any, ctx: any, v: VehiculeStock, margeVisee: number) {
  const res = resoudre(v);
  if (!res.famille) {
    return res.candidats.length > 1
      ? { statut: "moteur_a_choisir", candidats: res.candidats, message: "Plusieurs moteurs sont possibles pour ce modèle et cette année : choisis celui du véhicule (carte grise, P.1 / P.2, ou étiquette moteur)." }
      : { statut: "moteur_non_couvert", candidats: [], message: "Ce moteur n'est pas dans nos fiches : aucun défaut ne peut être vérifié, donc ni risque de retour ni plafond." };
  }
  v.famille = res.famille;
  const fiche = (await lookupDefectSheet(admin, { marque: v.marque, famille_moteur: v.famille, annee: v.annee, modele: v.modele }));
  const version = varianteVehicule({ motorisation: v.motorisation });
  const { confirmees, points, questions } = pannesDeLaFiche(fiche, version, v.annee);
  const aujourdhui = new Date();
  const rj = rjSynthetique(v, fiche, confirmees, aujourdhui);
  const { cout } = calculerCout3Ans(rj, ctx, {});
  const facture = factureAPrevoir({
    aujourdhui: new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(aujourdhui),
    kilometrage: v.kilometrage,
    premiere_immat: v.premiere_immat,
    annee: v.annee,
    version,
    cout3ans: cout,
    pannes: confirmees,
    prises: rj.prises_en_charge,
    programmes: programmesPourFamille(v.famille, (Array.isArray(fiche?.programmes) ? fiche!.programmes : null) as WarrantyProgram[] | null),
    fiche_maj: (fiche as { updated_at?: string } | null)?.updated_at ?? null,
    // Même filtre que la facture du dossier : une prise en charge qui nomme
    // un AUTRE véhicule (Kadjar, Captur, Juke…) n'est pas affichée.
    nommeUnAutreVehicule: (t: string) => nommeUnAutreVehicule(t, { marque: v.marque, modele: v.modele, generation: null, slug_marque: "", slug: "", familles: [] }, CATALOGUE),
  });
  const sep = separerFactureRisque(facture);
  const ref = await prixMarche(admin, v);
  const revente = ref
    ? prixReventeDepuisMarche({ mediane: ref.mediane_reference, n: ref.fourchette.n, ajustement_eur: ref.ajustement?.ecart_eur ?? null }, SEUIL_FOURCHETTE, PARAMETRES_DEFAUT)
    : null;
  const motif = ref == null
    ? `Moins de ${SEUIL_FOURCHETTE} prix relevés sur ce modèle ces 3 derniers mois : pas de prix de revente réaliste, donc pas de plafond.`
    : "";
  const plafond = prixPlafond(
    revente ? { valeur: revente.valeur, mediane_observee: revente.mediane_observee, nb: revente.nb_comparables, retrait_negociation_eur: revente.retrait_negociation_eur, ajustement_km_eur: revente.ajustement_km_eur } : null,
    motif, sep, margeVisee,
  );
  return {
    statut: "ok",
    vehicule: { marque: v.marque, modele: v.modele, annee: v.annee, kilometrage: v.kilometrage, motorisation: v.motorisation, famille: v.famille },
    fiche: fiche ? { famille: v.famille, maj: (fiche as { updated_at?: string }).updated_at ?? null } : null,
    defauts_confirmes: confirmees.map((p) => ({ titre: p.titre, organe: p.organe, gravite: p.gravite, km_typique: p.km_typique, cout_min_eur: p.cout_min_eur, cout_max_eur: p.cout_max_eur, urls: p.urls.slice(0, 3) })),
    controles: controlesSurPlace(confirmees, points, v.kilometrage),
    points_proprietaires: points,
    questions,
    prises_en_charge: sep.facture.lignes.filter((l) => l.rubrique === "prise_en_charge"),
    facture: sep.facture,
    risque: sep.risque,
    deja_dans_facture: sep.deja_dans_facture,
    prix_observes: ref ? { n: ref.fourchette.n, p25: ref.fourchette.p25, mediane: ref.fourchette.mediane, p75: ref.fourchette.p75 } : null,
    plafond,
    mention: MENTION_STOCK,
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const isEval = EVAL_SECRET.length > 0 && req.headers.get("x-eval-secret") === EVAL_SECRET;
    // ---- DRAPEAU, lu côté serveur avec le jeton de l'appelant, AVANT le corps.
    if (!isEval) {
      const authHeader = req.headers.get("Authorization") ?? "";
      const commeAppelant = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: authHeader ? { Authorization: authHeader } : {} },
      });
      const { data: ouvert, error } = await commeAppelant.rpc("drapeau_actif", { p_cle: "stock_revendeur" });
      if (error) console.error("drapeau_actif:", error);
      if (ouvert !== true) return json({ error: "fonction_fermee", message: "Le contrôle d'entrée en stock est réservé à la formule pro, pas encore ouverte." }, 403);
    }
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    // Le drapeau ouvert ne suffit pas : il faut aussi la formule pro (ou être
    // admin). Ainsi, ouvrir le drapeau au public n'ouvre pas l'outil à tous.
    if (!isEval) {
      const acces = await accesProDepuisReq(admin, req);
      if (!acces.proActif) return json({ error: "pro_requis", message: "Réservé aux abonnés de la formule pro." }, 403);
    }
    const body = await req.json().catch(() => null);
    const mode = String(body?.mode ?? "");
    const margeVisee = Math.min(50_000, Math.max(0, Number(body?.marge_visee ?? PARAMETRES_DEFAUT.marge_voulue_eur) || 0));

    if (mode === "vin") {
      const d = decoderVin(body?.vin);
      return json({ vin: d });
    }

    if (mode === "carte_grise") {
      const image = imageBloc(body?.photo);
      if (!image) return json({ error: "invalid_input", message: "Photo illisible (JPEG, PNG ou WebP, 3 Mo au plus)." }, 400);
      // Limite par IP, tentative insérée AVANT le comptage (anti-TOCTOU).
      const ipHash = await empreinteIp(req);
      if (!isEval) {
        await admin.from("events").insert({ name: "stock_carte_grise", ip_hash: ipHash, props_json: {} });
        const { count } = await admin.from("events").select("id", { count: "exact", head: true })
          .eq("name", "stock_carte_grise").eq("ip_hash", ipHash)
          .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString());
        if ((count ?? 0) > MAX_CG_PAR_IP_24H) return json({ error: "limite", message: "Limite de lectures atteinte pour aujourd'hui." }, 429);
      }
      const lu = await lireCarteGrise(image);
      if (!lu) return json({ error: "service_unavailable" }, 503);
      const cg = validerCarteGrise(lu.input, (x) => decoderVin(x).valide === true);
      return json({ carte_grise: cg, cout_eur: lu.cout_eur });
    }

    if (mode === "fiche") {
      const v = vehiculeDepuisEntree(body?.vehicule);
      if (!v) return json({ error: "invalid_input", message: "Marque, modèle et kilométrage requis." }, 400);
      const ctx = await chargerContexteCout(admin);
      return json(await evaluer(admin, ctx, v, margeVisee));
    }

    if (mode === "lot") {
      const entrees = (Array.isArray(body?.lignes) ? body.lignes : []).slice(0, MAX_LOT);
      if (entrees.length === 0) return json({ error: "invalid_input", message: "Au moins une ligne." }, 400);
      const ctx = await chargerContexteCout(admin);
      const resumes: ResumeLot[] = [];
      // deno-lint-ignore no-explicit-any
      for (const [i, e] of (entrees as any[]).entries()) {
        const id = String(e?.id ?? i + 1).slice(0, 40);
        const v = vehiculeDepuisEntree(e);
        const libelle = v ? `${v.marque} ${v.modele}${v.annee ? ` ${v.annee}` : ""}, ${v.kilometrage.toLocaleString("fr-FR")} km` : String(e?.libelle ?? `Ligne ${i + 1}`).slice(0, 80);
        if (!v) { resumes.push({ id, libelle, prix_demande: null, plafond: null, revente: null, facture_max: 0, risque_max: 0, marge_nette: null, motif: "marque, modèle ou kilométrage manquant" }); continue; }
        // deno-lint-ignore no-explicit-any
        const r: any = await evaluer(admin, ctx, v, margeVisee);
        if (r.statut !== "ok") { resumes.push({ id, libelle, prix_demande: v.prix_demande, plafond: null, revente: null, facture_max: 0, risque_max: 0, marge_nette: null, motif: r.statut === "moteur_a_choisir" ? "moteur à choisir" : "moteur non couvert" }); continue; }
        const revente = r.plafond.calcule ? r.plafond.lignes.find((l: { cle: string }) => l.cle === "revente")?.montant_eur ?? null : null;
        resumes.push({
          id, libelle, prix_demande: v.prix_demande,
          plafond: r.plafond.calcule ? r.plafond.valeur : null,
          revente, facture_max: r.facture.total_max, risque_max: r.risque.total_max, marge_nette: null,
          motif: !r.plafond.calcule ? "moins de 15 prix relevés" : v.prix_demande == null ? "prix demandé manquant" : null,
        });
      }
      return json({ lignes: classerLot(resumes), mention: MENTION_STOCK });
    }

    return json({ error: "invalid_input", message: "mode inconnu" }, 400);
  } catch (e) {
    console.error("stock:", e);
    return json({ error: "internal" }, 500);
  }
});
