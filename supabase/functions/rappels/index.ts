// SPRINT 1 — /rappels : rappels constructeur (RappelConso v2) + check Takata
// Entrée  : { marque: string, modele: string, annee?: number|null, analysis_id?: uuid }
// Sortie  : { rappels: [...] | null, takata: {...}, source, fetched_at, cache }
// Cache   : table rappels_cache, 24 h, clé marque|modele normalisés.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import takataModels from "../_shared/takata_models.json" with { type: "json" };
import { normalizeBrand, rawBrandVariants, sameBrand } from "../_shared/brandAliases.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Dataset RappelConso V2 vérifié le 2026-10-18 (l'ancien `rappelconso0` n'existe plus).
const RAPPELCONSO_DATASET = "rappelconso-v2-gtin-espaces";
const RAPPELCONSO_BASE =
  `https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/${RAPPELCONSO_DATASET}/records`;
const CATEGORIE_AUTO = "automobiles et moyens de déplacement"; // valeur exacte du facet
const CACHE_TTL_MS = 24 * 3600 * 1000;
const MAX_RAPPELS = 10;        // renvoyés au client (après filtre d'années)
const MAX_CACHE_MATCHES = 30;  // stockés en cache (avant filtre d'années)

const TAKATA_MESSAGE =
  "Modèle concerné par la campagne airbags Takata — vérifiez avec le numéro de série (VIN) sur le site du constructeur avant tout achat";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Normalisation texte libre : minuscules, sans accents, espaces propres. */
function norm(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** true si `needle` apparaît comme mot entier dans `haystack` (textes normalisés). */
function containsWord(haystack: string, needle: string): boolean {
  if (!needle) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(haystack);
}

// Mots trop génériques pour identifier un modèle à eux seuls :
// carrosseries, finitions et badges moteur partagés entre modèles.
const GENERIC_WORDS = new Set([
  "serie", "classe", "type", "grand", "grande", "voiture", "berline",
  "break", "cabriolet", "coupe", "pack", "phase", "sport", "line",
  "edition", "tourisme", "utilitaire", "van", "diesel", "essence",
  // carrosseries / silhouettes
  "sportback", "allroad", "touring", "estate", "limousine", "roadster",
  "gran", "turismo", "crossback", "tourer", "avant",
  // badges moteur/transmission partagés dans toute une gamme
  "tfsi", "tdi", "tsi", "fsi", "hdi", "bluehdi", "dci", "tce", "cdi",
  "crdi", "vti", "thp", "puretech", "etsi", "xdrive", "quattro", "4matic",
]);

/**
 * Candidats de correspondance pour un modèle extrait d'annonce.
 * Ex. "Série 3 F30 320d" → ["serie 3 f30 320d", "serie 3", "f30", "320d"]
 * (la phrase complète est souvent plus riche que les libellés des sources).
 */
function modelCandidates(modele: string): string[] {
  const m = norm(modele);
  const out = new Set<string>();
  if (m) out.add(m);
  const tokens = m.split(" ").filter(Boolean);
  for (let i = 0; i + 1 < tokens.length; i++) {
    out.add(`${tokens[i]} ${tokens[i + 1]}`); // bigrammes : "serie 3", "classe c"
  }
  for (const t of tokens) {
    if (/\d/.test(t) && t.length >= 2 && !/^(19|20)\d{2}$/.test(t)) out.add(t); // codes : f30, 320d, c3, 308
    else if (t.length >= 4 && !GENERIC_WORDS.has(t)) out.add(t); // noms : golf, megane
  }
  // Dérivés sportifs étiquetés par leur modèle de base dans les sources
  // officielles : Audi S7/RS7 → A7, S6/RS6 → A6, etc.
  for (const t of [...out]) {
    const m = t.match(/^(?:rs|s)(\d)$/);
    if (m) out.add(`a${m[1]}`);
  }
  return [...out];
}

/**
 * Candidats pour un libellé de la liste Takata.
 * Ex. "Série 3 (F30/F31/F34)" → ["serie 3 (f30/f31/f34)", "serie 3", "f30", "f31", "f34"]
 * Ex. "C3 II" → ["c3 ii", "c3"]
 */
function takataNomCandidates(nom: string): string[] {
  const out = new Set<string>();
  const full = norm(nom);
  if (full) out.add(full);
  const noParens = norm(nom.replace(/\([^)]*\)/g, " "));
  if (noParens) out.add(noParens);
  const noGen = noParens.replace(/\b(i|ii|iii|iv|v|vi)$/i, "").trim();
  if (noGen) out.add(noGen);
  for (const match of nom.matchAll(/\(([^)]*)\)/g)) {
    for (const part of match[1].split(/[\/,]/)) {
      const p = norm(part);
      if (p.length >= 2 && !GENERIC_WORDS.has(p)) out.add(p);
    }
  }
  return [...out].filter(Boolean);
}

type TakataEntry = { nom: string; debut: number | null; fin: number | null };

function checkTakata(marque: string, modele: string, annee: number | null) {
  const marques = (takataModels as { marques: Record<string, TakataEntry[]> }).marques;
  const mCands = modelCandidates(modele);
  for (const [brand, entries] of Object.entries(marques)) {
    if (!sameBrand(brand, marque)) continue;
    for (const entry of entries) {
      const tCands = takataNomCandidates(entry.nom);
      const modelMatch = mCands.some((mc) =>
        tCands.some((tc) => containsWord(tc, mc) || containsWord(mc, tc)),
      );
      if (!modelMatch) continue;
      // Année inconnue → prudence : on affiche le bandeau (il renvoie vers la
      // vérification par VIN de toute façon).
      const yearMatch =
        annee == null ||
        ((entry.debut == null || annee >= entry.debut) &&
          (entry.fin == null || annee <= entry.fin));
      if (yearMatch) {
        return {
          concerne: true,
          message: TAKATA_MESSAGE,
          modele_takata: entry.nom,
          periode: entry.debut
            ? `${entry.debut}–${entry.fin ?? "?"}`
            : "toutes années",
          source: (takataModels as { _source: string })._source,
          liste_date: takataListeDate(),
        };
      }
    }
  }
  // Bloc TOUJOURS affiché côté UI : message négatif explicite avec la date de liste.
  return {
    concerne: false,
    message: `Airbags Takata : modèle non listé dans la campagne officielle (liste du ${takataListeDate()}).`,
    modele_takata: null,
    periode: null,
    source: (takataModels as { _source: string })._source,
    liste_date: takataListeDate(),
  };
}

/** Date de la liste Takata embarquée, au format JJ/MM/AAAA. */
function takataListeDate(): string {
  const iso = (takataModels as { _updated?: string })._updated ?? "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

type RappelConsoRecord = {
  numero_fiche: string;
  libelle: string | null;
  modeles_ou_references: string | null;
  motif_rappel: string | null;
  risques_encourus: string | null;
  date_publication: string | null;
  lien_vers_la_fiche_rappel: string | null;
};

async function fetchRappelConso(marque: string, modele: string) {
  // Anti-injection ODSQL : une valeur n'entre dans la clause where que si elle
  // ne contient ni guillemet ni backslash ni astérisque (seuls caractères
  // capables de sortir de la chaîne ou d'élargir le like). Les accents des
  // variantes connues ("citroën") sont préservés.
  const isSafe = (v: string) => v.length > 0 && v.length <= 40 && !/["\\*]/.test(v);
  const variants = rawBrandVariants(marque).filter(isSafe);
  if (variants.length === 0) return [];
  const inList = variants.map((v) => `"${v}"`).join(",");
  const primary = normalizeBrand(marque);
  if (!isSafe(primary)) return [];
  const where =
    `categorie_produit="${CATEGORIE_AUTO}" and ` +
    `(marque_produit in (${inList}) or marque_produit like "${primary}*")`;

  const params = new URLSearchParams({
    where,
    select:
      "numero_fiche,libelle,modeles_ou_references,motif_rappel,risques_encourus,date_publication,lien_vers_la_fiche_rappel",
    order_by: "date_publication desc",
    limit: "100",
  });

  const res = await fetch(`${RAPPELCONSO_BASE}?${params}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`RappelConso HTTP ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const records: RappelConsoRecord[] = data.results ?? [];

  // Filtre modèle côté serveur (champ texte libre, plages de VIN, etc.)
  const cands = modelCandidates(modele);
  const seen = new Set<string>();
  const matches = [];
  for (const r of records) {
    const target = norm(`${r.modeles_ou_references ?? ""} ${r.libelle ?? ""}`);
    if (!cands.some((c) => containsWord(target, c))) continue;
    if (r.numero_fiche && seen.has(r.numero_fiche)) continue;
    if (r.numero_fiche) seen.add(r.numero_fiche);
    matches.push({
      titre: r.libelle || r.modeles_ou_references || "Rappel constructeur",
      motif: r.motif_rappel,
      risques: r.risques_encourus,
      date: r.date_publication,
      lien: r.lien_vers_la_fiche_rappel,
    });
    if (matches.length >= MAX_CACHE_MATCHES) break;
  }
  return matches;
}

/**
 * Filtre d'années STRICT : un rappel publié avant (année-modèle − 1) ne peut
 * pas concerner ce véhicule. Appliqué APRÈS le cache (le cache est par
 * marque+modèle, l'année varie par requête).
 */
// deno-lint-ignore no-explicit-any
function filterByYear(rappels: any[], annee: number | null): any[] {
  if (annee == null) return rappels.slice(0, MAX_RAPPELS);
  const cutoff = new Date(`${annee - 1}-01-01T00:00:00Z`).getTime();
  return rappels
    .filter((r) => {
      if (!r?.date) return true; // date absente : on garde par prudence
      const t = new Date(r.date).getTime();
      return !Number.isFinite(t) || t >= cutoff;
    })
    .slice(0, MAX_RAPPELS);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    // Reflète les headers demandés : des extensions/proxies injectent des
    // headers supplémentaires qui feraient échouer le preflight.
    return new Response("ok", {
      headers: {
        ...corsHeaders,
        "Access-Control-Allow-Headers":
          req.headers.get("access-control-request-headers") ??
          corsHeaders["Access-Control-Allow-Headers"],
      },
    });
  }

  try {
    const body = await req.json().catch(() => null);
    const marque = typeof body?.marque === "string" ? body.marque.trim() : "";
    const modele = typeof body?.modele === "string" ? body.modele.trim() : "";
    const annee =
      typeof body?.annee === "number" && Number.isFinite(body.annee)
        ? Math.round(body.annee)
        : null;
    const analysisId =
      typeof body?.analysis_id === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.analysis_id)
        ? body.analysis_id
        : null;

    if (!marque || !modele) {
      return jsonResponse(
        { error: "invalid_input", message: "marque et modele sont requis." },
        400,
      );
    }

    const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const cacheKey = `${normalizeBrand(marque)}|${norm(modele)}`;

    // Takata : toujours calculé localement (JSON embarqué), même si
    // RappelConso est indisponible.
    const takata = checkTakata(marque, modele, annee);

    // ---------------- Cache 24 h ----------------
    let rappels: unknown[] | null = null;
    let fetchedAt: string | null = null;
    let fromCache = false;

    const { data: cached } = await admin
      .from("rappels_cache")
      .select("payload, fetched_at")
      .eq("cache_key", cacheKey)
      .maybeSingle();

    if (cached && Date.now() - new Date(cached.fetched_at).getTime() < CACHE_TTL_MS) {
      rappels = cached.payload?.rappels ?? [];
      fetchedAt = cached.fetched_at;
      fromCache = true;
    } else {
      try {
        rappels = await fetchRappelConso(marque, modele);
        fetchedAt = new Date().toISOString();
        await admin.from("rappels_cache").upsert({
          cache_key: cacheKey,
          fetched_at: fetchedAt,
          payload: { rappels },
        });
      } catch (e) {
        console.error("RappelConso fetch error:", e);
        // Source indisponible : on renvoie quand même le check Takata.
        rappels = null;
        fetchedAt = null;
      }
    }

    // Filtre d'années strict, appliqué après le cache (cache = marque+modèle).
    const rappelsFiltres = Array.isArray(rappels) ? filterByYear(rappels, annee) : rappels;

    // ---------------- Event rappels_found ----------------
    const foundCount = Array.isArray(rappelsFiltres) ? rappelsFiltres.length : 0;
    if (foundCount > 0 || takata.concerne) {
      await admin.from("events").insert({
        name: "rappels_found",
        analysis_id: analysisId,
        props_json: {
          count: foundCount,
          takata: takata.concerne,
          marque: normalizeBrand(marque),
          modele: norm(modele),
          annee,
          from_cache: fromCache,
        },
      });
    }

    return jsonResponse({
      rappels: rappelsFiltres,
      takata,
      source: {
        nom: "RappelConso (data.economie.gouv.fr)",
        dataset: RAPPELCONSO_DATASET,
      },
      fetched_at: fetchedAt,
      cache: fromCache,
    });
  } catch (error) {
    console.error("rappels error:", error);
    return jsonResponse({ error: "internal", message: "Erreur interne." }, 500);
  }
});
