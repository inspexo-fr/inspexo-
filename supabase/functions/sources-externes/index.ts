// SPRINT 23 — Sources externes (fichier sources-moteurs-2026-11) : outils
// d'INSTRUCTION, sans effet sur le score.
//
//   mode « fiches »     : liste les fiches moteur EN BASE (y compris non
//                         publiées), pour la table de correspondance. Lecture.
//   mode « precontrole »: pour chaque page, joignable depuis nos fonctions
//                         edge ? extraits verbatim retrouvés ? SANS MODÈLE.
//   mode « juger »      : juge à vote + cache (même juge que /fiabilite).
//                         Écrit le cache du juge, RIEN d'autre.
//
// ⚠️ Aucune écriture dans les fiches ici : la fusion passe par
// admin-defect-sheets, avec un jeton d'administrateur.
// ⚠️ Aucun contournement d'un site qui bloque : une seule requête, le même
// agent que partout ; une page refusée est rapportée « injoignable ».
//
// Accès : secret d'éval ou administrateur.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifierAdmin } from "../_shared/adminAuth.ts";
import { controlerPage } from "../_shared/precontrole.ts";
import {
  cleVerif,
  ecrireCacheVerif,
  lireCacheVerif,
  MAX_TEXTE_SOURCE,
  messageVerification,
  pageStructuree,
  type ReponseJuge,
  texteCentre,
  texteDeLaPage,
  texteDeLaPageComplet,
  VERIF_SYSTEM,
  VERIF_TOOL,
  voter,
} from "../_shared/verifSource.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-eval-secret",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const EVAL_BYPASS_SECRET = Deno.env.get("EVAL_BYPASS_SECRET") ?? null;
const MODEL = "claude-sonnet-5";

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

// Collecte des réponses brutes du juge, seulement en mode debug (secret d'éval).
let BRUTS: Array<Record<string, unknown>> | null = null;

async function unPassage(cible: string, affs: Array<{ type: string; texte: string }>, url: string, texte: string): Promise<ReponseJuge> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal: AbortSignal.timeout(60_000),
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL, max_tokens: 2000, thinking: { type: "disabled" },
      system: [{ type: "text", text: VERIF_SYSTEM, cache_control: { type: "ephemeral" } }],
      tools: [VERIF_TOOL], tool_choice: { type: "tool", name: "rendre_verifications" },
      messages: [{ role: "user", content: [{ type: "text", text: messageVerification(cible, affs, url, texte) }] }],
    }),
  });
  if (!res.ok) { console.error("sources-externes juge:", res.status, (await res.text()).slice(0, 200)); return null; }
  const data = await res.json();
  // deno-lint-ignore no-explicit-any
  const bloc = (data.content ?? []).find((b: any) => b.type === "tool_use" && b.name === "rendre_verifications");
  // Diagnostic (mode debug) : la réponse BRUTE de chaque passage.
  BRUTS?.push({ stop_reason: data.stop_reason ?? null, verdicts: bloc?.input?.verdicts ?? null, sortie: data.usage?.output_tokens ?? null });
  if (!bloc) return null;
  return {
    verdicts: Array.isArray(bloc.input?.verdicts) ? bloc.input.verdicts : [],
    usage: { input_tokens: data.usage?.input_tokens ?? 0, output_tokens: data.usage?.output_tokens ?? 0,
      cache_read_input_tokens: data.usage?.cache_read_input_tokens ?? 0, cache_creation_input_tokens: data.usage?.cache_creation_input_tokens ?? 0 },
    modele: MODEL,
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!(await evalSecretMatches(req))) {
    const acces = await verifierAdmin(req);
    if (!acces.ok) return json({ error: acces.error }, acces.status);
  }
  try {
    const body = await req.json().catch(() => null);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (body?.mode === "fiches") {
      const { data, error } = await admin
        .from("defect_sheets")
        .select("id, marque, famille_moteur, famille_norm, moteur_label, annee_debut, annee_fin, statut, pannes, plan_entretien");
      if (error) return json({ error: error.message }, 500);
      // deno-lint-ignore no-explicit-any
      return json({ fiches: ((data ?? []) as any[]).map((f) => ({
        id: f.id, marque: f.marque, famille_moteur: f.famille_moteur, famille_norm: f.famille_norm,
        moteur_label: f.moteur_label, annee_debut: f.annee_debut, annee_fin: f.annee_fin, statut: f.statut,
        pannes: Array.isArray(f.pannes) ? f.pannes.map((p: { titre?: string }) => String(p?.titre ?? "")) : [],
        plan: Array.isArray(f.plan_entretien) ? f.plan_entretien.length : 0,
      })) });
    }

    // ── SPRINT 23 — SILENCES DU JUGE FIGÉS À TORT (décision d'Utku du
    // 10 nov. 2026). Deux temps, jamais un seul :
    //   « silences »        : COMPTAGE À BLANC, lecture seule — lignes ciblées,
    //                         dates, fonction d'origine ; plus les lignes de
    //                         `verifications` (/fiabilite) touchées.
    //   « purger_silences » : supprime EXACTEMENT les clés fournies, et
    //                         seulement si leur justification est bien celle
    //                         du silence. Rien d'autre dans verif_cache.
    // Réservés au SECRET D'ÉVAL (pas au jeton admin seul).
    if (body?.mode === "silences" || body?.mode === "purger_silences") {
      if (!(await evalSecretMatches(req))) return json({ error: "secret_eval_requis" }, 403);
      const SILENCE = "Aucun verdict rendu pour cette affirmation.";
      if (body.mode === "silences") {
        const { data: lignes, error } = await admin
          .from("verif_cache").select("cle, url, moteur, juge_le, votes, verdict").eq("justification", SILENCE).limit(5000);
        if (error) return json({ error: error.message }, 500);
        // Origine, d'après la forme de la clé moteur : le fichier de sources
        // emploie des clés « MARQUE-MOTEUR » en capitales ; atlas-builder une
        // cible « Marque CODE années » ; verification une famille moteur seule.
        // deno-lint-ignore no-explicit-any
        const origine = (m: string) => /^[A-Z0-9][A-Z0-9.\-]+$/.test(m) && m.includes("-") ? "sources-externes"
          : /\s(19|20)\d{2}/.test(m) ? "atlas-builder ou plans" : "verification";
        // deno-lint-ignore no-explicit-any
        const rows = ((lignes ?? []) as any[]).map((r) => ({ cle: r.cle, url: r.url, moteur: r.moteur, juge_le: r.juge_le, origine: origine(String(r.moteur ?? "")) }));
        const { data: verifs } = await admin
          .from("verifications").select("analysis_id, created_at, verdict, analyses!inner(is_eval)").eq("justification", SILENCE).limit(5000);
        // deno-lint-ignore no-explicit-any
        const v = (verifs ?? []) as any[];
        const reelles = v.filter((x) => x.analyses?.is_eval === false);
        return json({
          verif_cache: { lignes: rows.length, par_origine: rows.reduce((o: Record<string, number>, r) => (o[r.origine] = (o[r.origine] ?? 0) + 1, o), {}),
            premiere: rows.map((r) => r.juge_le).sort()[0] ?? null, derniere: rows.map((r) => r.juge_le).sort().at(-1) ?? null, cles: rows },
          verifications: { lignes: v.length, sur_analyses_reelles: reelles.length,
            analyses_reelles_touchees: new Set(reelles.map((x) => x.analysis_id)).size },
        });
      }
      const cles = (Array.isArray(body.cles) ? body.cles : []).filter((c: unknown) => typeof c === "string" && /^[0-9a-f]{64}$/.test(c as string));
      if (cles.length === 0) return json({ error: "cles_requises" }, 400);
      const { data: supprimees, error } = await admin
        .from("verif_cache").delete().in("cle", cles).eq("justification", SILENCE).select("cle");
      if (error) return json({ error: error.message }, 500);
      return json({ demandees: cles.length, supprimees: (supprimees ?? []).length });
    }

    if (body?.mode === "precontrole") {
      const pages = (Array.isArray(body.pages) ? body.pages : []).slice(0, 25)
        .filter((p: { url?: unknown }) => typeof p?.url === "string" && /^https?:\/\/\S{8,1000}$/i.test(p.url));
      const resultats = await Promise.all(pages.map(async (p: { url: string; extraits?: unknown[] }) => {
        const texte = await texteDeLaPageComplet(p.url, 200);
        const ex = (Array.isArray(p.extraits) ? p.extraits : []).filter((x): x is string => typeof x === "string").slice(0, 20);
        return controlerPage(p.url, texte, ex, MAX_TEXTE_SOURCE);
      }));
      return json({ resultats, limite_juge: MAX_TEXTE_SOURCE });
    }

    if (body?.mode === "juger") {
      if (!ANTHROPIC_API_KEY) return json({ error: "config" }, 500);
      const url = typeof body.url === "string" ? body.url : "";
      const cible = String(body.cible ?? "").slice(0, 200);
      const moteurCle = String(body.moteur ?? cible).slice(0, 120);
      const affs = (Array.isArray(body.affirmations) ? body.affirmations : []).slice(0, 12)
        .map((a: { id?: unknown; texte?: unknown; extraits?: unknown }) => ({
          id: String(a?.id ?? ""), texte: String(a?.texte ?? "").slice(0, 400),
          // Extraits VERBATIM de cette affirmation sur cette page : ils servent
          // à centrer la fenêtre. Absents ⇒ lecture standard.
          extraits: (Array.isArray(a?.extraits) ? a.extraits : []).filter((x): x is string => typeof x === "string").slice(0, 6),
        }))
        .filter((a: { id: string; texte: string }) => a.id && a.texte);
      if (!/^https?:\/\//i.test(url) || !cible || affs.length === 0) return json({ error: "invalid_input" }, 400);
      // Debug : réservé au secret d'éval, jamais à un jeton admin seul.
      BRUTS = body.debug === true && (await evalSecretMatches(req)) ? [] : null;

      const cles = await Promise.all(affs.map((a: { texte: string }) => cleVerif(url, a.texte, moteurCle)));
      const enCache = await lireCacheVerif(admin, cles);
      const verdicts: Record<string, { verdict: string; justification: string | null; depuis_cache: boolean; votes?: string[]; lecture?: string }> = {};
      const aJuger: number[] = [];
      affs.forEach((a: { id: string }, i: number) => {
        const c = enCache.get(cles[i]);
        if (c) verdicts[a.id] = { verdict: c.verdict, justification: c.justification, depuis_cache: true };
        else aJuger.push(i);
      });
      let usd = 0, passages = 0, lisible = true;
      const juger = async (indices: number[], texte: string, lecture: string) => {
        const v = await voter((sous) => unPassage(cible, sous, url, texte), indices.map((i) => ({ type: "panne", texte: affs[i].texte })));
        passages += v.passages;
        for (const u of v.usages) {
          usd += u.input_tokens * 3e-6 + u.output_tokens * 15e-6 +
            (u.cache_read_input_tokens ?? 0) * 0.3e-6 + (u.cache_creation_input_tokens ?? 0) * 3.75e-6;
        }
        const aEcrire: Parameters<typeof ecrireCacheVerif>[1] = [];
        indices.forEach((i, k) => {
          const r = v.resultats[k];
          verdicts[affs[i].id] = { verdict: r.verdict, justification: r.justification, depuis_cache: false, votes: r.votes, lecture };
          if (r.fiable) aEcrire.push({ cle: cles[i], url, affirmation: affs[i].texte, moteur: moteurCle, verdict: r.verdict, justification: r.justification, votes: r.votes, modele: r.modele });
        });
        await ecrireCacheVerif(admin, aEcrire);
      };
      if (aJuger.length) {
        // 1) Fenêtre centrée pour les affirmations dont l'extrait est retrouvé.
        const avecExtraits = aJuger.filter((i) => affs[i].extraits.length > 0);
        const page = avecExtraits.length ? await pageStructuree(url) : null;
        const centrees: number[] = [];
        if (page) {
          for (const i of avecExtraits) if (texteCentre(page, affs[i].extraits)) centrees.push(i);
        }
        if (page && centrees.length) {
          const fenetre = texteCentre(page, centrees.flatMap((i) => affs[i].extraits))!;
          await juger(centrees, fenetre, "fenetre");
        }
        // 2) Lecture standard pour les autres (extrait absent ou non verbatim).
        const reste = aJuger.filter((i) => !centrees.includes(i));
        if (reste.length) {
          const texte = await texteDeLaPage(url);
          if (!texte) {
            lisible = false;
            for (const i of reste) verdicts[affs[i].id] = { verdict: "source_injoignable", justification: null, depuis_cache: false };
          } else {
            await juger(reste, texte, "standard");
          }
        }
      }
      return json({ url, lisible, passages, verdicts, cout_eur: Math.round(usd * 0.92 * 10000) / 10000, ...(BRUTS ? { bruts: BRUTS } : {}) });
    }

    return json({ error: "mode_inconnu" }, 400);
  } catch (e) {
    console.error("sources-externes:", e);
    return json({ error: "internal", message: String(e).slice(0, 200) }, 500);
  }
});
