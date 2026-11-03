// SPRINT 11 — API de scoring v0 : POST /api/v1/analyses.
//
// MÊME PIPELINE QUE LE PUBLIC, AUCUN TRAITEMENT DE FAVEUR. L'analyse est
// produite par la fonction `score`, avec les mêmes règles, le même barème et
// le même cache de 7 jours. Ce qui change n'est pas le calcul : c'est le
// compteur. Un client d'API est plafonné par son quota mensuel et par un
// plafond journalier global, au lieu des 5 analyses / 24 h par IP du public.
//
// Deux plafonds, et pas un :
//  - le quota MENSUEL par client, c'est ce qu'il a acheté ;
//  - le plafond JOURNALIER GLOBAL, c'est ce qui protège notre facture d'API
//    Anthropic. Séparé du public : une rafale côté API ne doit jamais fermer
//    le service gratuit, et inversement.
//
// La clé n'est jamais comparée en clair ni en temps variable : empreinte
// salée, comparaison en temps constant, décision et débit atomiques en SQL.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  cleDepuisRequete,
  evaluerQuota,
  hacherCle,
  PLAFOND_JOUR_API,
} from "../_shared/apiClients.ts";
import { BAREME_VERSION } from "../_shared/bareme.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-inspexo-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const API_KEY_SALT = Deno.env.get("API_KEY_SALT") ?? null;

const MAX_TEXTE = 6000;

function json(body: unknown, status = 200, enTetes: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...enTetes },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed", message: "Utilisez POST." }, 405);
  }
  if (!API_KEY_SALT) {
    console.error("API_KEY_SALT manquant");
    return json({ error: "service_indisponible", message: "API non configurée." }, 503);
  }

  const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  try {
    const cle = cleDepuisRequete(req.headers);
    if (!cle) {
      return json({
        error: "cle_manquante",
        message:
          "Clé d'API requise : en-tête « Authorization: Bearer ix_live_… » ou « X-API-Key ».",
      }, 401);
    }

    // Décision ET débit en une seule opération atomique : deux appels
    // simultanés ne peuvent pas consommer le même dernier crédit.
    const { data: quota, error: quotaErr } = await admin.rpc("api_consommer", {
      p_cle_hash: await hacherCle(cle, API_KEY_SALT),
      p_plafond_jour: PLAFOND_JOUR_API,
    });
    if (quotaErr) {
      console.error("api_consommer:", quotaErr);
      return json({ error: "server_error", message: "Erreur interne." }, 500);
    }
    if (!quota?.ok) {
      // Le module pur compose le message : une seule formulation, testée.
      const etat = evaluerQuota({
        trouve: quota?.raison !== "cle_inconnue",
        actif: quota?.raison !== "cle_revoquee",
        quota_mensuel: quota?.quota ?? 0,
        appels_mois: quota?.raison === "quota_mensuel" ? (quota?.quota ?? 0) : 0,
        appels_jour_global: quota?.raison === "plafond_journalier" ? (quota?.plafond ?? PLAFOND_JOUR_API) : 0,
        plafond_jour_global: quota?.plafond ?? PLAFOND_JOUR_API,
      });
      const statut = quota?.raison === "cle_inconnue"
        ? 401
        : quota?.raison === "cle_revoquee"
        ? 403
        : 429;
      return json({ error: quota?.raison ?? "refuse", message: etat.message }, statut);
    }

    const body = await req.json().catch(() => null);
    const texte = typeof body?.texte === "string" ? body.texte.trim() : "";
    if (texte.length < 40) {
      return json({
        error: "texte_trop_court",
        message: "Le champ « texte » doit contenir le texte de l'annonce (40 caractères minimum).",
      }, 400);
    }

    // Prix et kilométrage facultatifs : ajoutés en tête du texte, comme le
    // fait l'extension. Le modèle les lit comme n'importe quelle annonce —
    // aucun chemin de calcul particulier.
    const prix = Number.isFinite(Number(body?.prix)) && Number(body.prix) > 0
      ? Math.round(Number(body.prix)) : null;
    const km = Number.isFinite(Number(body?.km)) && Number(body.km) >= 0
      ? Math.round(Number(body.km)) : null;
    const entete = [
      prix ? `Prix affiché : ${prix} €` : null,
      km != null ? `Kilométrage : ${km} km` : null,
    ].filter(Boolean).join("\n");
    const texteComplet = (entete ? `${entete}\n\n${texte}` : texte).slice(0, MAX_TEXTE);

    // Appel service→service. `x-api-client` + clé de service role : les DEUX
    // facteurs, sans quoi `score` traiterait l'appel comme public.
    const res = await fetch(`${SUPABASE_URL}/functions/v1/score`, {
      method: "POST",
      signal: AbortSignal.timeout(145_000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "x-api-client": String(quota.client_id),
      },
      body: JSON.stringify({ text: texteComplet }),
    });
    const brut = await res.json().catch(() => null);

    if (!res.ok || !brut?.result) {
      // Le quota a été débité : on le rend, l'appel n'a rien produit.
      await admin.rpc("api_rembourser", { p_client_id: quota.client_id }).catch(() => {});
      return json({
        error: brut?.error ?? "analyse_indisponible",
        message: brut?.message ?? "L'analyse n'a pas abouti. Réessayez dans un instant.",
      }, res.status >= 400 ? res.status : 502);
    }

    const r = brut.result;
    const v = r.vehicule ?? {};
    return json({
      id: brut.id,
      url: `https://www.inspexo.io/a/${brut.id}`,
      verdict: r.verdict,
      score: r.score,
      bareme_version: BAREME_VERSION,
      cache: Boolean(brut.cache),
      vehicule: {
        marque: v.marque ?? null,
        modele: v.modele ?? null,
        motorisation: v.motorisation ?? null,
        famille_moteur: v.famille_moteur ?? null,
        annee: v.annee ?? null,
        kilometrage: v.kilometrage ?? null,
        prix_affiche: v.prix_affiche ?? null,
      },
      // ⚠️ `score_detail` EST la carte des axes, pas un objet qui la
      // contient : `score_detail.axes` rendait toujours null (constaté à
      // l'appel de contrôle du 03/11, corrigé avant publication).
      axes: r.score_detail ?? null,
      plafond_raison: r.plafond_raison ?? null,
      motifs: r.raisons_principales ?? [],
      // « Points sourcés » : chaque défaut porte ses sources consultables.
      // Un point sans source n'existe pas dans nos analyses.
      points: (r.pannes_connues ?? []).map((p: Record<string, unknown>) => ({
        titre: p.titre,
        organe: p.organe ?? null,
        gravite: p.gravite,
        symptome: p.symptome ?? null,
        km_typique: p.km_typique ?? null,
        cout_min_eur: p.cout_min_eur ?? null,
        cout_max_eur: p.cout_max_eur ?? null,
        source: p.source_statut === "base_inspexo" ? "base Inspexo" : "sources en ligne",
        urls: Array.isArray(p.urls) ? p.urls : [],
      })),
      incoherences: r.incoherences ?? [],
      avertissement: r.avertissement,
      quota: {
        restant_mois: quota.restant_mois,
        quota_mensuel: quota.quota_mensuel,
      },
    }, 200, { "X-Quota-Restant": String(quota.restant_mois ?? "") });
  } catch (e) {
    console.error("api-analyses:", e);
    return json({ error: "server_error", message: "Erreur interne." }, 500);
  }
});
