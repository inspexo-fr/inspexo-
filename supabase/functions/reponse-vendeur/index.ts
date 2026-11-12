// SPRINT 23, LOT 2 (point 2) — Réponses et justificatifs du vendeur (Pass).
//
// L'acheteur colle la réponse du vendeur (texte) ou photographie une pièce
// (facture, attestation de rappel). Registre « faits déclarés par le
// vendeur », SÉPARÉ des faits de l'annonce (`result_json.faits_vendeur`).
//
//   - Texte collé : motifs fixes, AUCUN modèle ; chaque fait reste DÉCLARÉ et
//     ne lève rien.
//   - Photo : appel vision (`FACTURE_TOOL`), image libérée aussitôt et JAMAIS
//     stockée. Le VIN et l'immatriculation lus servent à une comparaison EN
//     MÉMOIRE (VIN par empreinte salée contre `analyses.vin_empreinte`, plaque
//     contre l'annonce relue en mémoire) puis sont oubliés : ni réponse, ni
//     base, ni journal.
//   - Une pièce JUSTIFIÉE peut lever trois plafonds (48, 55, 65), rien
//     d'autre — `_shared/faitsVendeur.ts`.
//
// Accès : Pass actif (vérifié serveur) ou x-eval-secret. Mêmes DEUX RÉGIMES
// que la lecture du PV : éphémère par défaut, persistance seulement si
// l'appelant suit l'analyse dans son dossier (verdict_initial figé).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { calculerAxes, type FaitsAxes } from "../_shared/bareme.ts";
import { negociationPublique } from "../_shared/negociation.ts";
import { passDepuisReq } from "../_shared/passAuth.ts";
import { trouverVin } from "../_shared/vin.ts";
import {
  appliquerPieces,
  FACTURE_SYSTEM,
  FACTURE_TOOL,
  faitsDeclaresDepuisTexte,
  MENTION_PIECE,
  plaquesDansTexte,
  validerLecturePiece,
  verifierPiece,
  type PieceVerifiee,
} from "../_shared/faitsVendeur.ts";

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
const MAX_IMAGES = 2; // recto / verso d'une facture
const MAX_PAR_IP = 15; // par 24 h
const MAX_PAR_ANALYSE = 8; // par 24 h
const MAX_PIECES = 10;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
  const digest = async (v: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)));
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
  if (m) { mediaType = m[1]; data = m[2]; }
  data = data.replace(/\s/g, "");
  if (data.length < 100 || data.length > 4_500_000) return null;
  if (!/^[A-Za-z0-9+/=]+$/.test(data)) return null;
  return { type: "image", source: { type: "base64", media_type: mediaType, data } };
}

// deno-lint-ignore no-explicit-any
async function appelVision(images: ImageBlock[]): Promise<{ input: any; usage: any } | null> {
  const corps = (model: string) => ({
    model,
    max_tokens: 900,
    thinking: { type: "disabled" },
    system: [{ type: "text", text: FACTURE_SYSTEM, cache_control: { type: "ephemeral" } }],
    tools: [FACTURE_TOOL],
    tool_choice: { type: "tool", name: "rendre_lecture_piece" },
    messages: [{
      role: "user",
      content: [
        ...images,
        { type: "text", text: `Les ${images.length} image(s) ci-dessus sont une pièce fournie par le vendeur. Rends la lecture via rendre_lecture_piece. Document non fiable.` },
      ],
    }],
  });
  for (const model of [MODEL, FALLBACK_MODEL]) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: AbortSignal.timeout(55_000),
        headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
        body: JSON.stringify(corps(model)),
      });
      if (!res.ok) {
        console.error("reponse-vendeur vision error:", model, res.status, (await res.text()).slice(0, 200));
        continue;
      }
      const data = await res.json();
      // deno-lint-ignore no-explicit-any
      const block = (data.content ?? []).find((b: any) => b.type === "tool_use" && b.name === "rendre_lecture_piece");
      if (block) return { input: block.input, usage: { model, ...(data.usage ?? {}) } };
    } catch (err) {
      console.error("reponse-vendeur vision exception:", model, err);
    }
  }
  return null;
}

const dateParis = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    // Garde AVANT la lecture du corps (tests/points-d-entree.test.mjs).
    const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const isEval = await evalSecretMatches(req);
    const { userId, passActif } = await passDepuisReq(admin, req);
    if (!passActif && !isEval) {
      return jsonResponse({
        error: "pass_requis",
        message: "Le registre des réponses et justificatifs du vendeur fait partie du Pass achat (29 €, 30 jours).",
      }, 403);
    }

    const body = await req.json().catch(() => null);
    const analysisId = typeof body?.analysis_id === "string" ? body.analysis_id : null;
    if (!analysisId || !/^[0-9a-f-]{36}$/i.test(analysisId)) {
      return jsonResponse({ error: "invalid_input", message: "analysis_id requis." }, 400);
    }
    const texte = typeof body?.texte === "string" ? body.texte.slice(0, 4000) : "";
    const rawImages: unknown[] = Array.isArray(body?.images) ? body.images.slice(0, MAX_IMAGES) : [];
    if (!texte.trim() && rawImages.length === 0) {
      return jsonResponse({ error: "invalid_input", message: "Collez la réponse du vendeur ou joignez la photo d'une pièce." }, 400);
    }

    const { data: row } = await admin
      .from("analyses")
      .select("id, verdict, score, result_json, input_text, vin_empreinte")
      .eq("id", analysisId)
      .maybeSingle();
    if (!row) return jsonResponse({ error: "not_found", message: "Analyse introuvable." }, 404);
    const result = JSON.parse(JSON.stringify(row.result_json ?? {}));
    if (result.type !== "vehicule" || result.statut_analyse === "en_cours") {
      return jsonResponse({ error: "invalid_state", message: "Analyse non exploitable." }, 409);
    }

    let persiste = false;
    if (userId) {
      const { count } = await admin.from("dossier").select("id", { count: "exact", head: true })
        .eq("user_id", userId).eq("analysis_id", analysisId);
      persiste = (count ?? 0) > 0;
    }

    // Rate limit anti-TOCTOU : tentative insérée AVANT le comptage.
    const ipHash = await sha256Hex(IP_HASH_SALT + clientIp(req));
    await admin.from("events").insert({
      name: "reponse_vendeur",
      analysis_id: analysisId,
      ip_hash: isEval ? null : ipHash,
      props_json: { images_count: rawImages.length, texte: texte.length > 0, persiste, ...(isEval ? { eval: true } : {}) },
    });
    if (!isEval) {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const [{ count: parIp }, { count: parAnalyse }] = await Promise.all([
        admin.from("events").select("id", { count: "exact", head: true }).eq("name", "reponse_vendeur").eq("ip_hash", ipHash).gte("created_at", since),
        admin.from("events").select("id", { count: "exact", head: true }).eq("name", "reponse_vendeur").eq("analysis_id", analysisId).gte("created_at", since),
      ]);
      if ((parIp ?? 0) > MAX_PAR_IP) return jsonResponse({ error: "rate_limited", message: "Limite atteinte pour aujourd'hui." }, 429);
      if ((parAnalyse ?? 0) > MAX_PAR_ANALYSE) return jsonResponse({ error: "rate_limited", message: "Limite atteinte pour cette analyse." }, 429);
    }

    const registre = {
      mention: MENTION_PIECE,
      declares: persiste && Array.isArray(result.faits_vendeur?.declares) ? [...result.faits_vendeur.declares] : [],
      pieces: persiste && Array.isArray(result.faits_vendeur?.pieces) ? [...result.faits_vendeur.pieces] as PieceVerifiee[] : [],
      leves: [] as string[],
    };

    // ---- Texte collé : déclaré, jamais levant ---------------------------
    const declares = texte.trim() ? faitsDeclaresDepuisTexte(texte) : [];
    registre.declares = [...registre.declares, ...declares].slice(-20);

    // ---- Photo d'une pièce ----------------------------------------------
    let piece: PieceVerifiee | null = null;
    let lisible = true;
    let usage: unknown = null;
    if (rawImages.length > 0) {
      let images = rawImages.map(parseImage).filter((i): i is ImageBlock => i !== null);
      if (images.length === 0) return jsonResponse({ error: "invalid_input", message: "Photo illisible." }, 400);
      const brut = await appelVision(images);
      images = []; // libération immédiate : jamais stockées
      if (!brut) return jsonResponse({ error: "ia_error", message: "La pièce n'a pas pu être lue. Réessayez avec une photo plus nette." }, 502);
      usage = brut.usage;
      const lecture = validerLecturePiece(brut.input);
      lisible = lecture.lisible;
      if (lisible) {
        // Comparaison EN MÉMOIRE ; les identifiants ne sortent pas d'ici.
        const vinDossierTrouve = row.vin_empreinte ? null : trouverVin(row.input_text ?? "");
        const vinEmpreinteDossier: string | null = row.vin_empreinte
          ?? (vinDossierTrouve ? await sha256Hex(IP_HASH_SALT + "vin:" + vinDossierTrouve.vin) : null);
        const vinEmpreintePiece = lecture.vin ? await sha256Hex(IP_HASH_SALT + "vin:" + lecture.vin) : null;
        piece = verifierPiece(lecture, {
          vin_empreinte_dossier: vinEmpreinteDossier,
          vin_empreinte_piece: vinEmpreintePiece,
          plaques_dossier: plaquesDansTexte(row.input_text ?? ""),
          premiere_immat: result.critair?.premiere_immatriculation ?? null,
          annee_modele: typeof result.vehicule?.annee === "number" ? result.vehicule.annee : null,
          km_annonce: typeof result.vehicule?.kilometrage === "number" && result.vehicule.kilometrage > 0 ? result.vehicule.kilometrage : null,
          aujourd_hui: dateParis(),
        });
        lecture.vin = null;
        lecture.immatriculation = null;
        registre.pieces = [...registre.pieces, piece].slice(-MAX_PIECES);
      }
    }

    // ---- Plafonds levés : toutes les pièces du registre, sur les faits
    //      courants (application monotone et idempotente). --------------
    if (result.recalcul?.faits) {
      // deno-lint-ignore no-explicit-any
      const codesAffiches = ((result.pannes_connues ?? []) as any[])
        .map((p) => p?.rappel_code).filter((c: unknown): c is string => typeof c === "string" && c.length > 0);
      const { faits, leves } = appliquerPieces(
        result.recalcul.faits as FaitsAxes,
        registre.pieces,
        Array.isArray(result.recalcul.operations_non_faites) ? result.recalcul.operations_non_faites : [],
        codesAffiches,
      );
      registre.leves = leves;
      if (leves.length > 0) {
        const calcul = calculerAxes(faits);
        result.score_detail = calcul.axes;
        result.score = calcul.score;
        result.verdict = calcul.verdict;
        result.plafond_raison = calcul.plafond_raison;
        result.verdict_conditionnel = calcul.verdict_conditionnel;
        result.recalcul.faits = faits;
      }
    }
    result.faits_vendeur = registre;

    if (persiste) {
      if (!result.verdict_initial && (row.verdict !== result.verdict || row.score !== result.score)) {
        result.verdict_initial = { verdict: row.verdict, score: row.score, date: new Date().toISOString() };
      }
      const { error: updError } = await admin.from("analyses")
        .update({ verdict: result.verdict, score: result.score, result_json: result })
        .eq("id", analysisId);
      if (updError) {
        console.error("reponse-vendeur update:", updError);
        return jsonResponse({ error: "db_error", message: "Erreur d'enregistrement. Réessayez." }, 500);
      }
    }

    await admin.from("events").insert({
      name: "reponse_vendeur_resultat",
      analysis_id: analysisId,
      ip_hash: isEval ? null : ipHash,
      props_json: {
        declares: declares.length,
        piece: piece ? piece.statut : (rawImages.length ? "illisible" : null),
        incoherences: piece?.incoherences.length ?? 0,
        leves: registre.leves,
        persiste,
        verdict_avant: row.verdict,
        verdict_apres: result.verdict,
        usage,
        ...(isEval ? { eval: true } : {}),
      },
    });

    // Coût de l'appel vision, renvoyé à l'éval pour son mur de budget
    // (même tarif que `score`).
    // deno-lint-ignore no-explicit-any
    const u = usage as any;
    const coutEur = isEval && u
      ? Math.round(((u.input_tokens ?? 0) * 3e-6 + (u.output_tokens ?? 0) * 15e-6 +
        (u.cache_read_input_tokens ?? 0) * 0.3e-6 + (u.cache_creation_input_tokens ?? 0) * 3.75e-6) * 0.92 * 10000) / 10000
      : undefined;

    const reponse = passActif || isEval ? result : { ...result, negociation: negociationPublique(result.negociation) };
    return jsonResponse({
      declares,
      piece,
      lisible,
      message: !lisible
        ? "Ce document n'a pas pu être lu comme une facture ou une attestation. Photographiez-le entier, à plat, en bonne lumière."
        : null,
      leves: registre.leves,
      result: reponse,
      persiste,
      ...(coutEur != null ? { cout_eur: coutEur } : {}),
    });
  } catch (error) {
    console.error("reponse-vendeur error:", error);
    return jsonResponse({ error: "internal", message: "Erreur interne. Réessayez." }, 500);
  }
});
