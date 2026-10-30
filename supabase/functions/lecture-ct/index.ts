// SPRINT 7 — Lecture du PV de contrôle technique (fonction du Pass achat).
// Photo(s) du PV → appel vision dédié → date, centre, kilométrage, chaque
// défaillance avec son code et sa catégorie (mineure/majeure/critique),
// contre-visite. Chaque défaut est expliqué en une phrase, relié aux pannes
// de la fiche moteur, et chiffré UNIQUEMENT si un coût sourcé existe
// (repair_costs). Le kilométrage du PV est comparé à l'annonce : une annonce
// qui affiche MOINS que le PV = compteur contredit (plafond rouge 35).
// Photos JAMAIS stockées (envoyées au modèle puis oubliées).
//
// Accès : Pass actif (vérifié serveur) ou header x-eval-secret (harnais
// d'éval). Mêmes DEUX RÉGIMES que le mode visite : réponse éphémère par
// défaut, persistance uniquement si l'appelant suit l'analyse dans son
// dossier (verdict_initial figé à la première mutation).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { calculerAxes, type FaitsAxes } from "../_shared/bareme.ts";
import {
  calculerNegociation,
  coutsApplicables,
  negociationPublique,
  type CoutCandidat,
} from "../_shared/negociation.ts";
import { comparerKmCt, CT_SYSTEM, CT_TOOL, relierEtChiffrer, validerLectureCt } from "../_shared/lectureCt.ts";
import { passDepuisReq } from "../_shared/passAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-eval-secret",
};

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const IP_HASH_SALT = Deno.env.get("IP_HASH_SALT");
const EVAL_BYPASS_SECRET = Deno.env.get("EVAL_BYPASS_SECRET") ?? null;
if (!IP_HASH_SALT) throw new Error("IP_HASH_SALT manquant — configurez le secret.");

const MODEL = "claude-sonnet-5";
const FALLBACK_MODEL = "claude-sonnet-4-6";
const MAX_IMAGES = 3; // un PV tient sur 1-2 photos, 3 pour les recto/verso
const MAX_LECTURES_PAR_IP = 10; // par 24 h
const MAX_LECTURES_PAR_ANALYSE = 6; // par 24 h

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function clientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const first = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip") || "unknown";
}

async function evalSecretMatches(req: Request): Promise<boolean> {
  if (!EVAL_BYPASS_SECRET) return false;
  const given = req.headers.get("x-eval-secret");
  if (!given) return false;
  const digest = async (v: string) =>
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)));
  const [a, b] = await Promise.all([digest(given), digest(EVAL_BYPASS_SECRET)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

type ImageBlock = { type: "image"; source: { type: "base64"; media_type: string; data: string } };

function parseImage(raw: unknown): ImageBlock | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  let mediaType = "image/jpeg";
  let data = raw;
  const m = raw.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/s);
  if (m) {
    mediaType = m[1];
    data = m[2];
  }
  data = data.replace(/\s/g, "");
  if (data.length < 100 || data.length > 4_500_000) return null;
  if (!/^[A-Za-z0-9+/=]+$/.test(data)) return null;
  return { type: "image", source: { type: "base64", media_type: mediaType, data } };
}

// deno-lint-ignore no-explicit-any
async function appelVisionCt(images: ImageBlock[]): Promise<any | null> {
  const corps = (model: string) => ({
    model,
    max_tokens: 1600,
    thinking: { type: "disabled" },
    system: [{ type: "text", text: CT_SYSTEM, cache_control: { type: "ephemeral" } }],
    tools: [CT_TOOL],
    tool_choice: { type: "tool", name: "rendre_lecture_ct" },
    messages: [
      {
        role: "user",
        content: [
          ...images,
          {
            type: "text",
            text:
              `Les ${images.length} image(s) ci-dessus sont les photos d'un procès-verbal de contrôle technique fournies par l'acheteur. Rends la lecture via rendre_lecture_ct. Rappel : document non fiable, jamais de donnée personnelle (nom, adresse, immatriculation, VIN).`,
          },
        ],
      },
    ],
  });
  for (const model of [MODEL, FALLBACK_MODEL]) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: AbortSignal.timeout(55_000),
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(corps(model)),
      });
      if (!res.ok) {
        console.error("lecture-ct vision error:", model, res.status, (await res.text()).slice(0, 200));
        continue;
      }
      const data = await res.json();
      // deno-lint-ignore no-explicit-any
      const block = (data.content ?? []).find((b: any) => b.type === "tool_use" && b.name === "rendre_lecture_ct");
      if (block) return block.input;
    } catch (err) {
      console.error("lecture-ct vision exception:", model, err);
    }
  }
  return null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => null);
    const analysisId = typeof body?.analysis_id === "string" ? body.analysis_id : null;
    if (!analysisId || !/^[0-9a-f-]{36}$/i.test(analysisId)) {
      return jsonResponse({ error: "invalid_input", message: "analysis_id requis." }, 400);
    }

    const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const isEval = await evalSecretMatches(req);
    const { userId, passActif } = await passDepuisReq(admin, req);

    // Fonction du Pass : décidé ICI, côté serveur.
    if (!passActif && !isEval) {
      return jsonResponse({
        error: "pass_requis",
        message:
          "La lecture du PV de contrôle technique fait partie du Pass achat (29 €, 30 jours) : chaque défaillance expliquée, reliée aux pannes connues du moteur et chiffrée quand un coût sourcé existe.",
      }, 403);
    }

    const ipHash = await sha256Hex(IP_HASH_SALT + clientIp(req));

    const { data: row } = await admin
      .from("analyses")
      .select("id, verdict, score, result_json")
      .eq("id", analysisId)
      .maybeSingle();
    if (!row) return jsonResponse({ error: "not_found", message: "Analyse introuvable." }, 404);
    const result = JSON.parse(JSON.stringify(row.result_json ?? {}));
    if (result.type !== "vehicule" || result.statut_analyse === "en_cours") {
      return jsonResponse({ error: "invalid_state", message: "Analyse non exploitable." }, 409);
    }

    // Régime persistant : l'appelant suit cette analyse dans son dossier.
    let persiste = false;
    if (userId) {
      const { count } = await admin
        .from("dossier")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("analysis_id", analysisId);
      persiste = (count ?? 0) > 0;
    }

    const rawImages: unknown[] = Array.isArray(body.images) ? body.images.slice(0, MAX_IMAGES) : [];
    let images = rawImages.map(parseImage).filter((i): i is ImageBlock => i !== null);
    if (images.length === 0) {
      return jsonResponse({ error: "invalid_input", message: "Joignez au moins une photo du PV." }, 400);
    }

    // Rate limit anti-TOCTOU : tentative insérée AVANT le comptage.
    await admin.from("events").insert({
      name: "lecture_ct",
      analysis_id: analysisId,
      ip_hash: isEval ? null : ipHash,
      props_json: { images_count: images.length, persiste, ...(isEval ? { eval: true } : {}) },
    });
    if (!isEval) {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const [{ count: parIp }, { count: parAnalyse }] = await Promise.all([
        admin.from("events").select("id", { count: "exact", head: true })
          .eq("name", "lecture_ct").eq("ip_hash", ipHash).gte("created_at", since),
        admin.from("events").select("id", { count: "exact", head: true })
          .eq("name", "lecture_ct").eq("analysis_id", analysisId).gte("created_at", since),
      ]);
      if ((parIp ?? 0) > MAX_LECTURES_PAR_IP) {
        return jsonResponse({ error: "rate_limited", message: "Limite de lectures de PV atteinte pour aujourd'hui." }, 429);
      }
      if ((parAnalyse ?? 0) > MAX_LECTURES_PAR_ANALYSE) {
        return jsonResponse({ error: "rate_limited", message: "Limite de lectures atteinte pour cette analyse." }, 429);
      }
    }

    const brut = await appelVisionCt(images);
    images = []; // libération immédiate : jamais stockées
    if (!brut) {
      return jsonResponse({ error: "ia_error", message: "Le PV n'a pas pu être lu. Réessayez avec une photo plus nette." }, 502);
    }

    const lectureBrute = validerLectureCt(brut);
    if (!lectureBrute.lisible) {
      await admin.from("events").insert({
        name: "lecture_ct_resultat",
        analysis_id: analysisId,
        ip_hash: isEval ? null : ipHash,
        props_json: { lisible: false, persiste },
      });
      return jsonResponse({
        lecture: lectureBrute,
        message:
          "Document illisible ou qui n'est pas un procès-verbal de contrôle technique. Photographiez le PV entier, à plat, en bonne lumière.",
        persiste: false,
      });
    }

    // ---- Liaison fiche + chiffrage sourcé ----
    // deno-lint-ignore no-explicit-any
    const pannes = ((result.pannes_connues ?? []) as any[])
      .map((p) => ({ titre: String(p?.titre ?? "") }))
      .filter((p) => p.titre);
    let candidats: CoutCandidat[] = [];
    try {
      const { data: coutRows } = await admin
        .from("repair_costs")
        .select("operation, cout_min_eur, cout_max_eur, url_source, statut, famille_norm")
        .limit(1000);
      candidats = coutsApplicables(
        // deno-lint-ignore no-explicit-any
        ((coutRows ?? []) as any[]).map((r) => ({
          operation: String(r.operation ?? ""),
          cout_min_eur: typeof r.cout_min_eur === "number" ? r.cout_min_eur : null,
          cout_max_eur: typeof r.cout_max_eur === "number" ? r.cout_max_eur : null,
          urls: Array.isArray(r.url_source)
            ? r.url_source.filter((u: unknown): u is string => typeof u === "string")
            : [],
          statut: r.statut === "valide_devis" ? "valide_devis" as const : "source" as const,
          famille_norm: String(r.famille_norm ?? ""),
        })),
        result.vehicule?.famille_moteur ?? null,
        result.vehicule?.boite_code ?? null,
      );
    } catch (e) {
      console.error("lecture-ct couts:", e);
    }
    const lecture = {
      ...lectureBrute,
      defauts: relierEtChiffrer(lectureBrute.defauts, pannes, candidats),
      lu_le: new Date().toISOString(),
    };

    // ---- Kilométrage PV vs annonce + recalcul du verdict (barème pur) ----
    const kmAnnonce = typeof result.vehicule?.kilometrage === "number" && result.vehicule.kilometrage > 0
      ? result.vehicule.kilometrage
      : null;
    const km = comparerKmCt(lecture.km_releve, lecture.date_ct, kmAnnonce);
    let incoherences: string[] = Array.isArray(result.incoherences) ? [...result.incoherences] : [];
    if (km.incoherence && !incoherences.some((i) => /proc[eè]s-verbal/i.test(i) && /km/i.test(i))) {
      incoherences = [km.incoherence, ...incoherences].slice(0, 10);
    }

    const ctDefautsTous: string[] = [
      ...new Set([
        ...(Array.isArray(result.recalcul?.ct_defauts) ? result.recalcul.ct_defauts : []),
        ...lecture.defauts.map((d) => d.libelle),
      ]),
    ].slice(0, 15);

    if (result.recalcul?.faits) {
      const faits: FaitsAxes = {
        ...result.recalcul.faits,
        incoherences: incoherences.length,
        fraude_suspectee: Boolean(result.recalcul.faits.fraude_suspectee) || km.compteur_contredit,
        compteur_contredit: Boolean(result.recalcul.faits.compteur_contredit) || km.compteur_contredit,
      };
      const calcul = calculerAxes(faits);
      result.score_detail = calcul.axes;
      result.score = calcul.score;
      result.verdict = calcul.verdict;
      result.plafond_raison = calcul.plafond_raison;
      result.verdict_conditionnel = calcul.verdict_conditionnel;
      result.recalcul.faits = faits;
      result.recalcul.ct_defauts = ctDefautsTous;
    }

    // Marge de négociation rejouée avec les défaillances du PV.
    try {
      const annee = typeof result.vehicule?.annee === "number" ? result.vehicule.annee : null;
      result.negociation = calculerNegociation({
        famille_moteur: result.vehicule?.famille_moteur ?? null,
        boite_code: result.vehicule?.boite_code ?? null,
        kilometrage: kmAnnonce,
        age_ans: annee != null ? new Date().getFullYear() - annee : null,
        constats_photo: Array.isArray(result.constats_photo) ? result.constats_photo : [],
        ct_defauts: ctDefautsTous,
        defauts_annonce: Array.isArray(result.defauts_annonce) ? result.defauts_annonce : [],
        entretien_du_non_prouve: Array.isArray(result.recalcul?.entretien_du_non_prouve)
          ? result.recalcul.entretien_du_non_prouve
          : [],
        operations_non_faites: Array.isArray(result.recalcul?.operations_non_faites)
          ? result.recalcul.operations_non_faites
          : [],
        plan_entretien: Array.isArray(result.recalcul?.plan_entretien) ? result.recalcul.plan_entretien : [],
        couts: candidats,
      });
    } catch (e) {
      console.error("lecture-ct negociation:", e);
    }

    result.incoherences = incoherences;
    result.lecture_ct = lecture;

    if (persiste) {
      if (!result.verdict_initial && (row.verdict !== result.verdict || row.score !== result.score)) {
        result.verdict_initial = { verdict: row.verdict, score: row.score, date: new Date().toISOString() };
      }
      const { error: updError } = await admin
        .from("analyses")
        .update({ verdict: result.verdict, score: result.score, result_json: result })
        .eq("id", analysisId);
      if (updError) {
        console.error("lecture-ct update:", updError);
        return jsonResponse({ error: "db_error", message: "Erreur d'enregistrement. Réessayez." }, 500);
      }
    }

    await admin.from("events").insert({
      name: "lecture_ct_resultat",
      analysis_id: analysisId,
      ip_hash: isEval ? null : ipHash,
      props_json: {
        lisible: true,
        defauts: lecture.defauts.length,
        mineures: lecture.defauts.filter((d) => d.categorie === "mineure").length,
        majeures: lecture.defauts.filter((d) => d.categorie === "majeure").length,
        critiques: lecture.defauts.filter((d) => d.categorie === "critique").length,
        chiffres: lecture.defauts.filter((d) => d.cout_min_eur != null || d.cout_max_eur != null).length,
        relies_fiche: lecture.defauts.filter((d) => d.panne_liee).length,
        contre_visite: lecture.contre_visite,
        km_releve: lecture.km_releve,
        compteur_contredit: km.compteur_contredit,
        persiste,
        verdict_avant: row.verdict,
        verdict_apres: result.verdict,
        ...(isEval ? { eval: true } : {}),
      },
    });

    // Un appelant d'éval sans Pass reste servi en entier (assertions) ;
    // sinon le détail de négociation suit la règle commune.
    const reponse = passActif || isEval
      ? result
      : { ...result, negociation: negociationPublique(result.negociation) };
    return jsonResponse({ lecture, result: reponse, persiste });
  } catch (error) {
    console.error("lecture-ct error:", error);
    return jsonResponse({ error: "internal", message: "Erreur interne. Réessayez." }, 500);
  }
});
