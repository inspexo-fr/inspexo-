// SPRINT 13 — Lecture du certificat de situation administrative HistoVec.
//
// L'acheteur dépose le PDF que le vendeur a produit sur histovec.interieur.gouv.fr
// (bouton « Imprimer le CSA »). Le texte est extrait EN MÉMOIRE, les faits
// utiles en sont tirés PAR DES RÈGLES FIXES, et le PDF n'est jamais stocké.
//
// AUCUNE IA sur ce chemin : `unpdf` extrait le texte, `_shared/histovec.ts`
// l'analyse. Les règles de verdict sont fixes par construction.
//
// Ordre des opérations, et c'est un INVARIANT :
//   extraire → comparer (règle 0, a besoin du VIN et de la plaque)
//   → retirer VIN et plaque → ne garder que les faits utiles.
// Rien n'est écrit en base avant ce retrait.
//
// Accès : Pass actif, ou header x-eval-secret (harnais d'éval). MAIS un signal
// ROUGE est renvoyé même sans Pass — on ne cache pas un danger derrière un
// paiement. Le masquage du détail est fait SERVEUR (`histovecPublique`).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractText, getDocumentProxy } from "npm:unpdf@1.9.1";
import { calculerAxes, type FaitsAxes } from "../_shared/bareme.ts";
import {
  extraireFaitsCsa,
  histovecPublique,
  reglesHistovec,
  sansIdentifiants,
  verifierConcordance,
} from "../_shared/histovec.ts";
import { passDepuisReq } from "../_shared/passAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-eval-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EVAL_SECRET = Deno.env.get("EVAL_BYPASS_SECRET") ?? "";

/** Plafond de taille du dépôt. Un CSA réel pèse ~15 Ko ; 6 Mo laisse de la
 *  marge à un PDF scanné sans ouvrir la porte à un envoi massif. */
const MAX_OCTETS = 6 * 1024 * 1024;
/** Lectures par IP et par 24 h, et par analyse. */
const MAX_PAR_IP = 10;
const MAX_PAR_ANALYSE = 5;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  try {
    const isEval = EVAL_SECRET.length > 0 && req.headers.get("x-eval-secret") === EVAL_SECRET;
    const body = await req.json().catch(() => null);
    const analysisId = typeof body?.analysis_id === "string" ? body.analysis_id : null;
    if (!analysisId || !/^[0-9a-f-]{36}$/i.test(analysisId)) {
      return json({ error: "invalid_input", message: "analysis_id requis." }, 400);
    }

    const pass = isEval ? { actif: true, email: null } : await passDepuisReq(req, admin);

    // Rate limit anti-TOCTOU : la tentative est insérée AVANT le comptage.
    const ipHash = await empreinteIp(req);
    if (!isEval) {
      await admin.from("events").insert({
        name: "histovec_lecture",
        analysis_id: analysisId,
        ip_hash: ipHash,
        props_json: { pass: pass.actif === true },
      });
      const depuis = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const [{ count: parIp }, { count: parAnalyse }] = await Promise.all([
        admin.from("events").select("id", { count: "exact", head: true })
          .eq("name", "histovec_lecture").eq("ip_hash", ipHash).gte("created_at", depuis),
        admin.from("events").select("id", { count: "exact", head: true })
          .eq("name", "histovec_lecture").eq("analysis_id", analysisId),
      ]);
      if ((parIp ?? 0) > MAX_PAR_IP || (parAnalyse ?? 0) > MAX_PAR_ANALYSE) {
        return json({ error: "rate_limited", message: "Trop de lectures de certificat. Réessayez demain." }, 429);
      }
    }

    // ---- Extraction du texte, EN MÉMOIRE ----------------------------------
    const b64 = typeof body?.pdf_base64 === "string" ? body.pdf_base64.replace(/\s/g, "") : "";
    if (!b64) return json({ error: "invalid_input", message: "pdf_base64 requis." }, 400);
    if (b64.length > MAX_OCTETS * 1.37) {
      return json({
        error: "fichier_trop_gros",
        message: `Ce fichier dépasse ${Math.round(MAX_OCTETS / 1024 / 1024)} Mo. Le certificat HistoVec pèse quelques dizaines de kilo-octets : vérifiez que vous déposez bien le PDF du CSA.`,
      }, 413);
    }
    if (!/^[A-Za-z0-9+/=]+$/.test(b64)) {
      return json({ error: "invalid_input", message: "Fichier illisible." }, 400);
    }

    let texte = "";
    try {
      const octets = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const doc = await getDocumentProxy(octets);
      const extrait = await extractText(doc, { mergePages: true });
      texte = String(extrait?.text ?? "");
    } catch (e) {
      console.error("lecture-histovec extraction:", e);
      return json({
        error: "format_non_reconnu",
        message: "Ce fichier n'a pas pu être lu comme un PDF. Déposez le certificat téléchargé depuis HistoVec.",
      }, 422);
    }

    // ---- Faits, concordance, PUIS retrait des identifiants ----------------
    const { data: analyse } = await admin
      .from("analyses").select("id, result_json").eq("id", analysisId).maybeSingle();
    if (!analyse?.result_json) {
      return json({ error: "not_found", message: "Analyse introuvable." }, 404);
    }
    const result = analyse.result_json as Record<string, any>;
    const v = result.vehicule ?? {};

    const faitsBruts = extraireFaitsCsa(texte);
    if (!faitsBruts.lisible) {
      await admin.from("events").insert({
        name: "histovec_illisible", analysis_id: analysisId,
        props_json: { motif: faitsBruts.motif_illisible?.slice(0, 120) ?? null },
      });
      return json({
        error: "format_non_reconnu",
        message: faitsBruts.motif_illisible
          ?? "Ce document n'est pas un certificat de situation administrative HistoVec.",
      }, 422);
    }

    const concordance = verifierConcordance(faitsBruts, {
      marque: v.marque ?? null,
      modele: v.modele ?? null,
      annee: typeof v.annee === "number" ? v.annee : null,
      premiere_immatriculation: v.premiere_immatriculation ?? null,
      vin: v.vin ?? null,
      immatriculation: v.immatriculation ?? null,
    });
    const regles = reglesHistovec(faitsBruts, v, concordance, new Date());

    // ⚠️ À PARTIR D'ICI, plus de VIN ni de plaque. Ce retrait est la raison
    // pour laquelle la concordance passe avant.
    const faits = sansIdentifiants(faitsBruts);
    const lecture = {
      faits: { ...faits, motif_illisible: undefined },
      concordance: { concorde: concordance.concorde, compares: concordance.compares, discordances: concordance.discordances },
      signaux: regles.signaux,
      lu_le: new Date().toISOString(),
    };

    // ---- Recalcul du barème avec les deux faits HistoVec ------------------
    if (result.recalcul?.faits) {
      const faitsAxes: FaitsAxes = {
        ...result.recalcul.faits,
        histovec_opposition: regles.faits.histovec_opposition,
        histovec_vge_en_cours: regles.faits.histovec_vge_en_cours,
      };
      const calcul = calculerAxes(faitsAxes);
      result.score_detail = calcul.axes;
      result.score = calcul.score;
      result.verdict = calcul.verdict;
      result.plafond_raison = calcul.plafond_raison;
      result.verdict_conditionnel = calcul.verdict_conditionnel;
      result.recalcul.faits = faitsAxes;
    }
    result.histovec = lecture;

    // ---- DEUX RÉGIMES. Persistance seulement si l'appelant suit l'analyse.
    let persiste = false;
    if (pass.actif === true && pass.email) {
      const { count } = await admin
        .from("dossier").select("id", { count: "exact", head: true })
        .eq("analysis_id", analysisId);
      persiste = (count ?? 0) > 0;
    }
    if (persiste) {
      if (result.verdict_initial == null) {
        result.verdict_initial = { score: analyse.result_json.score, verdict: analyse.result_json.verdict };
      }
      await admin.from("analyses").update({
        result_json: result, score: result.score, verdict: result.verdict,
      }).eq("id", analysisId);
    }

    await admin.from("events").insert({
      name: "histovec_lu", analysis_id: analysisId,
      props_json: {
        persiste,
        signaux: regles.signaux.length,
        rouges: regles.signaux.filter((s) => s.niveau === "rouge").length,
        concorde: concordance.concorde,
        pass: pass.actif === true,
      },
    });

    // Sans Pass, seuls les signaux rouges sortent — masquage SERVEUR.
    const rendu = pass.actif === true ? lecture : { ...lecture, ...histovecPublique(lecture) };
    return json({
      ok: true,
      histovec: rendu,
      verdict: result.verdict,
      score: result.score,
      plafond_raison: result.plafond_raison ?? null,
      persiste,
    });
  } catch (e) {
    console.error("lecture-histovec:", e);
    return json({ error: "internal", message: "Erreur interne. Réessayez." }, 500);
  }
});

async function empreinteIp(req: Request): Promise<string | null> {
  const sel = Deno.env.get("IP_HASH_SALT");
  const ip = req.headers.get("cf-connecting-ip");
  if (!sel || !ip) return null;
  const octets = new TextEncoder().encode(sel + ip);
  const h = await crypto.subtle.digest("SHA-256", octets);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
