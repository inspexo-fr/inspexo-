// SPRINT 19.1 — « Mes cibles » : les modèles où l'utilisateur a assez de
// relevés, avec la marge estimée de chacun, triés par marge.
//
// ⚠️ POURQUOI UNE FONCTION EDGE ET PAS UNE RPC SQL. Les quantiles n'ont
// qu'UNE implémentation dans ce projet (`quantileHisto`, _shared/marche.ts).
// En écrire une en SQL ferait diverger deux chiffres qui doivent être le
// même. La base rend donc les histogrammes REPLIÉS, et les quantiles sont lus
// ici par le module partagé — exactement comme `get_prix_segments` au
// sprint 9.
//
// ⚠️ MÉDIANE ET QUARTILES, JAMAIS UNE MOYENNE. Une moyenne de prix se fait
// emporter par une seule annonce à 50 000 € ; une médiane lue sur
// l'histogramme fusionné ne bouge que d'une tranche. C'est la raison d'être
// du stockage en histogramme.
//
// ⚠️ AUCUNE REQUÊTE VERS UN SITE D'ANNONCES. Cette fonction ne lit que le
// carnet privé de l'utilisateur. La recherche à sauvegarder est COMPOSÉE, pas
// récupérée (tests/pas-de-scraping.test.mjs le vérifie).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { passDepuisReq } from "../_shared/passAuth.ts";
import { quantileHisto } from "../_shared/marche.ts";
import {
  cibleDepuisQuantiles,
  MENTION_CIBLES,
  parametresDepuisProfil,
  profilValide,
  rechercheSauvegardee,
  SEUIL_CIBLE,
  trierCibles,
} from "../_shared/cibles.ts";
import { coutCarteGrise, PARAMETRES_DEFAUT } from "../_shared/revendeur.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

/** Largeur des tranches, par série. Les prix gardent le défaut du module. */
const TRANCHE_ANNEE = 1;
const TRANCHE_KM = 10_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Un histogramme stocké en jsonb → sa Map et son effectif. */
function lireHistogramme(brut: unknown): { histo: Map<number, number>; total: number } {
  const histo = new Map<number, number>();
  let total = 0;
  for (const [t, n] of Object.entries((brut ?? {}) as Record<string, unknown>)) {
    const tranche = Number(t), effectif = Number(n);
    if (!Number.isFinite(tranche) || !Number.isFinite(effectif) || effectif <= 0) continue;
    histo.set(tranche, (histo.get(tranche) ?? 0) + effectif);
    total += effectif;
  }
  return { histo, total };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // deno-lint-ignore no-explicit-any
  const admin: any = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  // Réservé au Pass : décidé ICI, à partir du JWT, jamais d'un drapeau client.
  const { userId, passActif } = await passDepuisReq(admin, req);
  if (!userId) return json({ error: "connexion_requise" }, 401);
  if (!passActif) {
    return json({
      error: "pass_requis",
      message: "Les cibles sont une fonction du Pass achat.",
    }, 403);
  }

  const { data: lignes, error } = await admin
    .from("revendeur_cibles")
    .select("marque, modele, energie, prix_tranches, annee_tranches, km_tranches, effectif, maj_le")
    .eq("user_id", userId);
  if (error) {
    console.error("revendeur_cibles select:", error);
    return json({ error: "lecture_impossible" }, 500);
  }

  // Profil mémorisé : les paramètres de l'utilisateur, pas des valeurs
  // génériques. Un profil absent laisse les défauts.
  const { data: pref } = await admin
    .from("preferences_revendeur")
    .select("region, ville_revente, parametres")
    .eq("user_id", userId)
    .maybeSingle();
  const profil = profilValide({
    region: pref?.region ?? "",
    ville_revente: pref?.ville_revente ?? "",
    ...(pref?.parametres ?? {}),
  });
  const params = parametresDepuisProfil(PARAMETRES_DEFAUT, profil);

  // Barème de carte grise : lu en config, jamais en dur.
  const { data: cfg } = await admin
    .from("config")
    .select("valeur")
    .eq("cle", "carte_grise_tarifs")
    .maybeSingle();
  const bareme = cfg?.valeur ?? null;

  // ⚠️ Sans puissance fiscale ou sans région, la carte grise n'est PAS
  // inventée : elle vaut zéro dans le calcul, ce qui rend les cibles
  // optimistes — et l'écran le dit.
  const cg = coutCarteGrise(profil.cv, profil.region || null, bareme);

  const cibles = [];
  const enAttente = [];
  for (const l of lignes ?? []) {
    const prix = lireHistogramme(l.prix_tranches);
    if (prix.total < SEUIL_CIBLE) {
      enAttente.push({ marque: l.marque, modele: l.modele, energie: l.energie, effectif: prix.total });
      continue;
    }
    const annees = lireHistogramme(l.annee_tranches);
    const kms = lireHistogramme(l.km_tranches);

    const cible = cibleDepuisQuantiles({
      marque: l.marque,
      modele: l.modele,
      energie: l.energie,
      n: prix.total,
      p25: quantileHisto(prix.histo, prix.total, 0.25),
      p50: quantileHisto(prix.histo, prix.total, 0.5),
      p75: quantileHisto(prix.histo, prix.total, 0.75),
      annee_mediane: annees.total > 0
        ? Math.round(quantileHisto(annees.histo, annees.total, 0.5, TRANCHE_ANNEE))
        : null,
      km_median: kms.total > 0
        ? Math.round(quantileHisto(kms.histo, kms.total, 0.5, TRANCHE_KM))
        : null,
      maj: typeof l.maj_le === "string" ? l.maj_le.slice(0, 10) : null,
    }, params, { carte_grise_eur: cg.connu ? cg.montant_eur : null });
    if (!cible) continue;

    cibles.push({
      ...cible,
      recherche: rechercheSauvegardee({
        marque: l.marque,
        modele: l.modele,
        energie: l.energie,
        annee_mediane: cible.annee_mediane,
        km_median: cible.km_median,
      }, cible.achat_max),
    });
  }

  return json({
    cibles: trierCibles(cibles),
    // Les segments sous le seuil, comptés seulement : savoir qu'il manque
    // trois relevés sur un modèle est une information actionnable.
    en_attente: enAttente.sort((a, b) => b.effectif - a.effectif),
    seuil: SEUIL_CIBLE,
    profil,
    carte_grise_connue: cg.connu,
    mention: MENTION_CIBLES,
  });
});
