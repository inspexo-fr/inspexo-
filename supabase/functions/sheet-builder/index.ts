// SPRINT 1.5 — Worker interne de génération de fiche famille moteur.
// Invoqué uniquement par la fonction `score` (service → service) : il dispose
// de son PROPRE budget wall-clock de 150 s, indépendant de celui de `score`.
// Auth stricte : Authorization doit porter exactement la service role key.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getOrCreateDefectSheet, normFamille, refreshProgrammes } from "../_shared/defectSheets.ts";
import { expandBrand } from "../_shared/brandAliases.ts";
import { genererPlan } from "../_shared/planBuilder.ts";
import { verdictIndexationMoteur } from "../_shared/indexation.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const EVAL_BYPASS_SECRET = Deno.env.get("EVAL_BYPASS_SECRET") ?? null;
/** Secret d'éval accepté pour les opérations internes (temps constant). */
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

serve(async (req: Request) => {
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const evalOk = await evalSecretMatches(req);
    if (auth !== `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` && !evalOk) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const marque = typeof body?.marque === "string" ? body.marque.trim() : "";
    const famille = typeof body?.famille_moteur === "string" ? body.famille_moteur.trim() : "";
    if (!marque || !famille) {
      return new Response(JSON.stringify({ error: "invalid_input" }), { status: 400 });
    }

    const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // SPRINT 22 — Mode « plan » : relève le plan d'entretien SOURCÉ d'une fiche
    // EXISTANTE, et le RENVOIE sans l'écrire. L'écriture passe par
    // admin-defect-sheets (`ajouter_plan`), avec un jeton d'administrateur :
    // ce mode ne touche ni aux pannes, ni au plan en place.
    if (body?.mode === "plan") {
      const { data: lignes } = await admin
        .from("defect_sheets")
        .select("id, marque, famille_moteur, famille_norm, moteur_label, annee_debut, annee_fin, plan_entretien")
        .in("marque_norm", expandBrand(marque))
        .eq("famille_norm", normFamille(famille));
      const fiche = (lignes ?? [])[0];
      if (!fiche) {
        return new Response(JSON.stringify({ error: "fiche_absente", message: `Aucune fiche ${marque} ${famille}.` }), { status: 404 });
      }
      const annees = [fiche.annee_debut, fiche.annee_fin].filter((x: unknown) => x != null).join("-");
      const r = await genererPlan(ANTHROPIC_API_KEY!, admin, {
        marque: fiche.marque, famille: fiche.famille_moteur, label: fiche.moteur_label ?? null, annees,
        // Domaines de recherche optionnels : noms d'hôte seulement, 10 au plus.
        domaines: (Array.isArray(body?.domaines) ? body.domaines : [])
          .filter((d: unknown): d is string => typeof d === "string" && /^[a-z0-9.-]{3,80}\.[a-z]{2,12}$/i.test(d)).slice(0, 10),
      });
      return new Response(JSON.stringify({
        fiche_id: fiche.id,
        fiche: `${fiche.marque} ${fiche.famille_moteur}`,
        plan_existant: Array.isArray(fiche.plan_entretien) ? fiche.plan_entretien.length : 0,
        ...r,
      }), { headers: { "Content-Type": "application/json" } });
    }

    // Mode « programmes » : rejoue UNIQUEMENT la recherche d'extensions de
    // garantie sur une fiche existante (régénération ciblée).
    if (body?.mode === "programmes") {
      const out = await refreshProgrammes(admin, ANTHROPIC_API_KEY!, marque, famille);
      return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json" } });
    }

    // Mode « regenerer » : relance une génération complète (seuil qualité inclus)
    // hors cache et hors cooldown. L'ancienne fiche n'est JAMAIS supprimée au
    // préalable : si la nouvelle génération échoue, la fiche existante reste en
    // place (c'est getOrCreateDefectSheet qui remplace l'ancienne, et seulement
    // après une génération réussie).
    const force = body?.mode === "regenerer";

    // SPRINT 24, chantier A — Mode « parties » : fiche construite à partir des
    // seules parties confirmées par le juge (aucune recherche web). Réservé au
    // secret d'éval. JAMAIS d'écrasement : une fiche existante est renvoyée
    // telle quelle (`hit`), et son complément passe par l'admin.
    // deno-lint-ignore no-explicit-any
    const parties = body?.mode === "parties" && Array.isArray(body?.parties)
      ? (body.parties as any[]).slice(0, 30).map((p) => ({
        texte: String(p?.texte ?? "").slice(0, 600),
        urls: (Array.isArray(p?.urls) ? p.urls : []).filter((u: unknown): u is string => typeof u === "string" && /^https?:\/\/\S+$/.test(u)).slice(0, 6),
        extraits: (Array.isArray(p?.extraits) ? p.extraits : []).filter((e: unknown): e is string => typeof e === "string").map((e: string) => e.slice(0, 400)).slice(0, 8),
      })).filter((p) => p.texte && p.urls.length > 0)
      : undefined;
    if (body?.mode === "parties" && (!evalOk || !parties?.length)) {
      return new Response(JSON.stringify({ error: !evalOk ? "forbidden" : "invalid_input" }), { status: !evalOk ? 403 : 400 });
    }

    const result = await getOrCreateDefectSheet(admin, ANTHROPIC_API_KEY!, {
      force: parties ? false : force,
      parties,
      marque,
      famille_moteur: famille,
      moteur_label: typeof body?.moteur_label === "string" ? body.moteur_label : null,
      annee: typeof body?.annee === "number" ? body.annee : null,
    });

    // Coût de la génération : la campagne de couverture (sprint 6) tient son
    // budget à partir de ce chiffre, comme l'éval le fait pour les analyses.
    const u = result.usage;
    const usd = !u ? 0
      : u.input_tokens * 3e-6 + u.output_tokens * 15e-6 +
        (u.cache_read_input_tokens ?? 0) * 0.3e-6 +
        (u.cache_creation_input_tokens ?? 0) * 3.75e-6;
    return new Response(
      JSON.stringify({
        status: result.cacheStatus,
        pannes: result.sheet?.pannes?.length ?? 0,
        plan_entretien: result.sheet?.plan_entretien?.length ?? 0,
        searches: result.searches,
        // Mode « parties » : la fiche serait-elle publiée et indexable ? (règle
        // du 13 nov. 2026, même calcul que les pages /moteur)
        ...(parties && result.sheet
          ? { indexation: (() => {
            const fam = { marque, famille: famille.toUpperCase(), nom_commercial: typeof body?.nom_commercial === "string" ? body.nom_commercial : (result.sheet.moteur_label ?? famille) };
            const v = verdictIndexationMoteur(fam, result.sheet, []);
            return { publiee: v.publiee, ...v.resume };
          })() }
          : {}),
        cout_eur: Math.round(usd * 0.92 * 10000) / 10000,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("sheet-builder error:", err);
    return new Response(JSON.stringify({ error: "internal" }), { status: 500 });
  }
});
