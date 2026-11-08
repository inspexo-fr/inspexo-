// SPRINT 15 — Vérification INDÉPENDANTE des affirmations d'une analyse.
//
// Une analyse affirme des choses et cite des pages. Cette fonction relit
// chaque affirmation contre LA page qu'elle cite, par un passage séparé qui
// n'a vu ni l'analyse, ni son score, ni le raisonnement qui l'a produite.
//
// ⚠️ C'EST TOUTE LA VALEUR DU DISPOSITIF. Un passage qui verrait l'analyse
// ne vérifierait pas : il confirmerait. Le seul contexte transmis est
// l'IDENTITÉ du véhicule (marque, modèle, motorisation, année, famille
// moteur) — un fait de l'annonce, sans lequel le verdict « mauvais moteur »
// serait impossible à rendre. Aucun score, aucun verdict, aucune raison,
// aucune mention de ce que la critique avait gardé ou écarté.
//
// Trois verdicts utiles, plus deux constats :
//   soutenue           — la page dit ce que l'affirmation prétend
//   non_soutenue       — la page ne le dit pas, ou dit le contraire
//   mauvais_moteur     — la page parle d'un AUTRE moteur / modèle / génération
//   source_absente     — l'affirmation ne cite aucune page (Defect Atlas)
//   source_injoignable — la page n'a pas pu être lue (404, PDF, blocage)
//
// Accès : administrateur (rôle lu en base) ou header x-eval-secret.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifierAdmin } from "../_shared/adminAuth.ts";
import {
  type Affirmation,
  affirmationsDeAnalyse,
  identiteVehicule,
  parSource,
} from "../_shared/affirmations.ts";
import {
  cleVerif,
  ecrireCacheVerif,
  lireCacheVerif,
  messageVerification,
  texteDeLaPage,
  VERIF_SYSTEM,
  VERIF_TOOL,
  voter,
} from "../_shared/verifSource.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-eval-secret",
};

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const EVAL_BYPASS_SECRET = Deno.env.get("EVAL_BYPASS_SECRET") ?? null;

const MODEL = "claude-sonnet-5";
const FALLBACK_MODEL = "claude-sonnet-4-6";
const MAX_SOURCES = 8; // pages lues par analyse
const MAX_AFFIRMATIONS = 40;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function evalSecretMatches(req: Request): Promise<boolean> {
  if (!EVAL_BYPASS_SECRET) return false;
  const fourni = req.headers.get("x-eval-secret");
  if (!fourni || fourni.length !== EVAL_BYPASS_SECRET.length) return false;
  const enc = new TextEncoder();
  const a = enc.encode(fourni), b = enc.encode(EVAL_BYPASS_SECRET);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
};

// deno-lint-ignore no-explicit-any
async function verifierGroupe(
  identite: ReturnType<typeof identiteVehicule>,
  affirmations: Affirmation[],
  texteSource: string,
  url: string,
): Promise<{ verdicts: any[]; usage: Usage | null; modele: string | null }> {
  const corps = (model: string) => ({
    model,
    max_tokens: 1500,
    thinking: { type: "disabled" },
    system: [{ type: "text", text: VERIF_SYSTEM, cache_control: { type: "ephemeral" } }],
    tools: [VERIF_TOOL],
    tool_choice: { type: "tool", name: "rendre_verifications" },
    messages: [{
      role: "user",
      content: [{
        type: "text",
        text: messageVerification(
          `${identite.marque} ${identite.modele} ${identite.motorisation} ${identite.annee}` +
            (identite.famille_moteur ? ` (famille moteur ${identite.famille_moteur})` : ""),
          affirmations,
          url,
          texteSource,
        ),
      }],
    }],
  });

  for (const model of [MODEL, FALLBACK_MODEL]) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: AbortSignal.timeout(60_000),
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(corps(model)),
      });
      if (!res.ok) {
        console.error("verification error:", model, res.status, (await res.text()).slice(0, 200));
        continue;
      }
      const data = await res.json();
      // deno-lint-ignore no-explicit-any
      const block = (data.content ?? []).find((b: any) => b.type === "tool_use" && b.name === "rendre_verifications");
      if (block) {
        return { verdicts: Array.isArray(block.input?.verdicts) ? block.input.verdicts : [], usage: data.usage ?? null, modele: model };
      }
    } catch (err) {
      console.error("verification exception:", model, err);
    }
  }
  return { verdicts: [], usage: null, modele: null };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    if (!ANTHROPIC_API_KEY) return jsonResponse({ error: "config", message: "ANTHROPIC_API_KEY manquante." }, 500);

    const isEval = await evalSecretMatches(req);
    if (!isEval) {
      const acces = await verifierAdmin(req);
      if (!acces.ok) return jsonResponse({ error: acces.error }, acces.status);
    }

    const body = await req.json().catch(() => null);
    const analysisId = typeof body?.analysis_id === "string" ? body.analysis_id : null;
    if (!analysisId || !/^[0-9a-f-]{36}$/i.test(analysisId)) {
      return jsonResponse({ error: "invalid_input", message: "analysis_id requis." }, 400);
    }

    const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const { data: analyse } = await admin
      .from("analyses")
      .select("id, result_json, is_eval")
      .eq("id", analysisId)
      .maybeSingle();
    if (!analyse?.result_json) {
      return jsonResponse({ error: "introuvable", message: "Analyse inconnue ou sans résultat." }, 404);
    }

    // ⚠️ REFUS D'EMBLÉE D'UNE ANALYSE D'ÉVAL, AVANT TOUTE DÉPENSE.
    // `get_fiabilite` joint sur `is_eval = false` : une vérification lancée
    // sur une analyse d'éval coûte des jetons et ne sera JAMAIS publiée.
    // Constaté le 5 nov. 2026 par l'audit : les 9 lignes de `verifications`
    // déjà en base pointaient TOUTES vers des analyses d'éval, donc comptaient
    // pour rien. Le refus est ici, avant l'extraction des affirmations et
    // avant le premier appel au modèle — pas dans un script, qu'on peut
    // oublier d'utiliser.
    if (analyse.is_eval === true) {
      return jsonResponse({
        error: "analyse_eval",
        message: "Cette analyse est marquée `is_eval` : la page fiabilité l'exclut, " +
          "la vérifier coûterait des jetons sans jamais rien publier. " +
          "Rejouez l'annonce avec un jeton d'administrateur (is_eval = false), " +
          "puis vérifiez la nouvelle analyse.",
      }, 409);
    }

    const identite = identiteVehicule(analyse.result_json);
    const affirmations = affirmationsDeAnalyse(analyse.result_json, MAX_AFFIRMATIONS);
    if (affirmations.length === 0) {
      return jsonResponse({ analysis_id: analysisId, affirmations: 0, message: "Aucune affirmation vérifiable." });
    }

    const groupes = parSource(affirmations, MAX_SOURCES);
    const resultats = new Map<string, { verdict: string; justification: string | null; modele: string | null }>();
    let usdTotal = 0;
    const tarif = (u: Usage) =>
      u.input_tokens * 3e-6 + u.output_tokens * 15e-6 +
      (u.cache_read_input_tokens ?? 0) * 0.3e-6 +
      (u.cache_creation_input_tokens ?? 0) * 3.75e-6;

    // SPRINT 22 — LE CACHE D'ABORD. Un couple (URL, affirmation, moteur)
    // déjà jugé depuis moins de 180 jours ne coûte ni lecture de page ni
    // jeton, et rend le MÊME verdict : c'est toute la stabilité demandée.
    const moteur = identite.famille_moteur ||
      `${identite.marque} ${identite.modele} ${identite.motorisation}`;
    const cleDe = new Map<string, string>();
    for (const g of groupes) {
      for (const a of g.affirmations) cleDe.set(a.empreinte + "|" + g.url, await cleVerif(g.url, a.texte, moteur));
    }
    const enCache = await lireCacheVerif(admin, [...new Set(cleDe.values())]);
    let depuisCache = 0, passagesTotal = 0, votesATrois = 0;
    const aEcrire: Parameters<typeof ecrireCacheVerif>[1] = [];

    const aJuger = groupes.map((g) => g.affirmations.filter((a) => {
      const c = enCache.get(cleDe.get(a.empreinte + "|" + g.url)!);
      if (!c) return true;
      resultats.set(a.empreinte, { verdict: c.verdict, justification: c.justification, modele: c.modele });
      depuisCache++;
      return false;
    }));

    // Les pages sont lues EN PARALLÈLE : une analyse qui cite six sources
    // dépasserait sinon le budget de 150 s de la fonction. Une page dont
    // toutes les affirmations sont en cache n'est pas lue du tout.
    const textes = await Promise.all(groupes.map((g, i) => aJuger[i].length ? texteDeLaPage(g.url) : Promise.resolve(null)));

    for (let i = 0; i < groupes.length; i++) {
      const g = groupes[i];
      const affs = aJuger[i];
      if (affs.length === 0) continue;
      const texte = textes[i];
      if (!texte) {
        for (const a of affs) {
          resultats.set(a.empreinte, { verdict: "source_injoignable", justification: "Page non lisible (indisponible, PDF ou rendue côté client).", modele: null });
        }
        continue;
      }
      const vote = await voter(async (sous) => {
        const r = await verifierGroupe(identite, sous as Affirmation[], texte, g.url);
        return r.modele ? r : null;
      }, affs);
      passagesTotal += vote.passages;
      if (vote.passages === 3) votesATrois++;
      for (const u of vote.usages) usdTotal += tarif(u);
      affs.forEach((a, k) => {
        const r = vote.resultats[k];
        resultats.set(a.empreinte, { verdict: r.verdict, justification: r.justification, modele: r.modele });
        if (r.fiable) {
          aEcrire.push({
            cle: cleDe.get(a.empreinte + "|" + g.url)!, url: g.url, affirmation: a.texte, moteur,
            verdict: r.verdict, justification: r.justification, votes: r.votes, modele: r.modele,
          });
        }
      });
    }
    await ecrireCacheVerif(admin, aEcrire);

    const lignes = affirmations.map((a) => {
      const r = resultats.get(a.empreinte);
      return {
        analysis_id: analysisId,
        claim_type: a.type,
        claim_text: a.texte,
        claim_hash: a.empreinte,
        source_url: a.url,
        source_titre: a.titre,
        verdict: r?.verdict ?? (a.url ? "source_injoignable" : "source_absente"),
        justification: r?.justification ?? (a.url ? null : "Affirmation sans source publique citée (catalogue interne)."),
        modele: r?.modele ?? null,
      };
    });

    // `upsert` sur (analysis_id, claim_hash) : rejouer une vérification
    // remplace le verdict précédent au lieu d'en empiler un second.
    const { error: insErr } = await admin
      .from("verifications")
      .upsert(lignes, { onConflict: "analysis_id,claim_hash" });
    if (insErr) {
      console.error("verifications insert:", insErr);
      return jsonResponse({ error: "insert", message: insErr.message }, 500);
    }

    const compte = (v: string) => lignes.filter((l) => l.verdict === v).length;
    return jsonResponse({
      analysis_id: analysisId,
      is_eval: analyse.is_eval === true,
      affirmations: lignes.length,
      sources_lues: textes.filter(Boolean).length,
      soutenues: compte("soutenue"),
      non_soutenues: compte("non_soutenue"),
      mauvais_moteur: compte("mauvais_moteur"),
      sans_source: compte("source_absente"),
      injoignables: compte("source_injoignable"),
      depuis_cache: depuisCache,
      passages: passagesTotal,
      groupes_a_trois_votes: votesATrois,
      cout_eur: Math.round(usdTotal * 0.92 * 10000) / 10000,
    });
  } catch (err) {
    console.error("verification:", err);
    return jsonResponse({ error: "internal", message: String(err).slice(0, 200) }, 500);
  }
});
