// SPRINT 1 — /rappels : rappels constructeur (RappelConso v2) + check Takata
// Entrée  : { marque: string, modele: string, annee?: number|null, analysis_id?: uuid }
// Sortie  : { rappels: [...] | null, takata: {...}, source, fetched_at, cache }
// Cache   : table rappels_cache, 24 h, clé marque|modele normalisés.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import takataModels from "../_shared/takata_models.json" with { type: "json" };
import { normalizeBrand, rawBrandVariants, sameBrand } from "../_shared/brandAliases.ts";
import {
  cacheServable,
  classerReponse,
  doitMettreEnCache,
  doitRetenter,
  echec,
  MAX_ESSAIS,
  MESSAGE_INDISPONIBLE,
  type ResultatRappels,
} from "../_shared/rappelsCache.ts";

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

async function fetchRappelConso(marque: string, modele: string): Promise<ResultatRappels> {
  // Anti-injection ODSQL : une valeur n'entre dans la clause where que si elle
  // ne contient ni guillemet ni backslash ni astérisque (seuls caractères
  // capables de sortir de la chaîne ou d'élargir le like). Les accents des
  // variantes connues ("citroën") sont préservés.
  const isSafe = (v: string) => v.length > 0 && v.length <= 40 && !/["\\*]/.test(v);
  const variants = rawBrandVariants(marque).filter(isSafe);
  if (variants.length === 0) return echec("marque_non_interrogeable");
  const inList = variants.map((v) => `"${v}"`).join(",");
  const primary = normalizeBrand(marque);
  if (!isSafe(primary)) return echec("marque_non_interrogeable");
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

  // Un zéro enregistrement pour TOUTE la marque est la signature d'une
  // fenêtre de réindexation du dataset : on retente une fois avant de
  // conclure quoi que ce soit (incident du 28/10/2026).
  let records: RappelConsoRecord[] = [];
  let essais = 0;
  while (essais < MAX_ESSAIS) {
    let res: Response;
    try {
      res = await fetch(`${RAPPELCONSO_BASE}?${params}`, {
        headers: { Accept: "application/json" },
      });
    } catch (e) {
      console.error("RappelConso reseau:", e);
      return echec("reseau");
    }
    if (!res.ok) {
      console.error(`RappelConso HTTP ${res.status}: ${await res.text()}`);
      return echec("http");
    }
    let data: { results?: RappelConsoRecord[] };
    try {
      data = await res.json();
    } catch (e) {
      console.error("RappelConso JSON illisible:", e);
      return echec("reseau");
    }
    records = data.results ?? [];
    essais += 1;
    if (!doitRetenter(records.length, essais)) break;
  }

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
      texte_production: `${r.modeles_ou_references ?? ""} ${r.libelle ?? ""}`.slice(0, 1200),
    });
    if (matches.length >= MAX_CACHE_MATCHES) break;
  }
  return classerReponse(records.length, matches);
}

/**
 * Extrait la plage d'années de production / première immatriculation
 * mentionnée dans le texte d'une fiche (formats constatés : "2013-2017",
 * "entre le 03/09/2015 et le 20/10/2016", "produits entre 2011 et 2019",
 * "depuis 2015"). Renvoie null si aucune plage identifiable.
 */
function extractYearRange(texte: string): { debut: number; fin: number } | null {
  const t = texte ?? "";
  const years: number[] = [];
  // dates jj/mm/aaaa
  for (const m of t.matchAll(/\b\d{1,2}\/\d{1,2}\/((?:19|20)\d{2})\b/g)) years.push(parseInt(m[1], 10));
  // plages AAAA-AAAA / AAAA à AAAA / AAAA et AAAA
  for (const m of t.matchAll(/\b((?:19|20)\d{2})\s*(?:-|–|à|a|au|et)\s*((?:19|20)\d{2})\b/gi)) {
    years.push(parseInt(m[1], 10), parseInt(m[2], 10));
  }
  const dep = t.match(/depuis\s+((?:19|20)\d{2})/i);
  if (dep) return { debut: parseInt(dep[1], 10), fin: 9999 };
  if (years.length === 0) return null;
  return { debut: Math.min(...years), fin: Math.max(...years) };
}

/** Motorisations absentes d'un véhicule purement thermique. */
const MOTIF_ELECTRIQUE_RE =
  /batterie\s+haute\s+tension|haute\s+tension|hybride|tfsi[\s-]?e\b|e[\s-]tron|phev|recharge|module.{0,20}batterie/i;

// Marqueurs de motorisation dans les motifs de rappel, par carburant exclu.
const MOTIFS_DIESEL_RE = /\b(dv5r?[a-z]*|dw10|dv6|blue\s?hdi|bluehdi|\bhdi\b|diesel|gazole|dci|tdi|crdi|multijet|adblue|scr\b|fap\b)\b/i;
const MOTIFS_ESSENCE_RE = /\b(puretech|eb2[a-z]*|tce|vti|thp|tfsi|tsi|vtec|essence)\b/i;
const MOTIFS_HYBRIDE_RE = /\b(e[\s-]?dct|hybride?|hev|phev|e[\s-]?tense|haute\s+tension)\b/i;

// Mention explicite d'une génération dans le libellé du rappel (« 308 III »,
// « (v3) », « phase 3 »…) : si la génération du véhicule n'est pas confirmée,
// ces rappels partent dans le bloc replié « autres générations ».
const GEN_HINT_RE = /\b(?:i{2,3}|iv|v(?=\b|3)|v[2-9]|phase\s*[2-9]|g[ée]n[ée]ration\s*[2-9])\b/i;

/**
 * Tri post-cache des rappels :
 *  - exclusion des rappels de publication antérieure à (année-modèle − 1) ;
 *  - exclusion des motifs de motorisation absente (hybride/HT sur thermique) ;
 *  - split générationnel : en premier les rappels dont la plage de production
 *    extraite couvre l'année du véhicule ; les autres (sans plage ou d'une
 *    autre génération) vont dans un bloc secondaire replié.
 */
// deno-lint-ignore no-explicit-any
function splitRappels(rappels: any[], annee: number | null, carburant: string | null, modele: string, motorisation: string | null, generation: string | null): { principaux: any[]; autres: any[] } {
  const cutoff = annee != null ? new Date(`${annee - 1}-01-01T00:00:00Z`).getTime() : null;
  const thermique = carburant != null &&
    !/hybride|electrique|électrique/i.test(carburant) &&
    !/e[\s-]?tron|tfsi[\s-]?e/i.test(norm(modele));

  const principaux: any[] = [];
  const autres: any[] = [];
  for (const r of rappels) {
    // filtre de publication
    if (cutoff != null && r?.date) {
      const t = new Date(r.date).getTime();
      if (Number.isFinite(t) && t < cutoff) continue;
    }
    // motorisation absente du véhicule
    const libelle = `${r?.motif ?? ""} ${r?.titre ?? ""}`;
    if (thermique && MOTIF_ELECTRIQUE_RE.test(libelle)) continue;
    const carbNorm = norm(`${carburant ?? ""} ${motorisation ?? ""}`);
    const essence = /essence|puretech|tce|vti|thp|tsi|tfsi/.test(carbNorm) && !/diesel|hdi|dci|tdi/.test(carbNorm);
    const diesel = /diesel|gazole|hdi|dci|tdi|crdi|bluehdi/.test(carbNorm);
    const hybride = /hybride|hev|phev|e[\s-]?tense/.test(carbNorm);
    if (essence && MOTIFS_DIESEL_RE.test(libelle)) continue;
    if (diesel && MOTIFS_ESSENCE_RE.test(libelle)) continue;
    if ((essence || diesel) && !hybride && MOTIFS_HYBRIDE_RE.test(libelle)) continue;

    const range = extractYearRange(r?.texte_production ?? "");
    const { texte_production: _tp, ...pub } = r;
    const genHint = GEN_HINT_RE.test(libelle) || GEN_HINT_RE.test(String(r?.modeles ?? ""));
    const genConfirmee = generation != null && generation.length > 0 &&
      norm(libelle + " " + String(r?.modeles ?? "")).includes(norm(generation));
    if (genHint && !genConfirmee) {
      autres.push({ ...pub, periode_production: range ? `${range.debut}–${range.fin === 9999 ? "…" : range.fin}` : null });
      continue;
    }
    if (annee != null && range && annee >= range.debut - 1 && annee <= range.fin + 1) {
      principaux.push({ ...pub, periode_production: `${range.debut}–${range.fin === 9999 ? "…" : range.fin}` });
    } else if (annee != null) {
      autres.push({ ...pub, periode_production: range ? `${range.debut}–${range.fin === 9999 ? "…" : range.fin}` : null });
    } else {
      principaux.push(pub);
    }
  }
  return { principaux: principaux.slice(0, MAX_RAPPELS), autres: autres.slice(0, MAX_RAPPELS) };
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
    const carburant = typeof body?.carburant === "string" ? body.carburant.trim() : null;
    const motorisation = typeof body?.motorisation === "string" ? body.motorisation.trim() : null;
    const generation = typeof body?.generation === "string" ? body.generation.trim() : null;
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
    // Le cache ne porte QUE des résultats non vides (cf. _shared/rappelsCache.ts) :
    // une réponse vide ou en erreur n'est jamais écrite, et une entrée vide
    // laissée par une version antérieure n'est jamais servie.
    let rappels: unknown[] | null = null;
    let fetchedAt: string | null = null;
    let fromCache = false;
    let indisponible = false;

    const { data: cached } = await admin
      .from("rappels_cache")
      .select("payload, fetched_at")
      .eq("cache_key", cacheKey)
      .maybeSingle();

    if (cacheServable(cached, Date.now(), CACHE_TTL_MS)) {
      rappels = cached!.payload!.rappels as unknown[];
      fetchedAt = cached!.fetched_at as string;
      fromCache = true;
    } else {
      let resultat: ResultatRappels;
      try {
        resultat = await fetchRappelConso(marque, modele);
      } catch (e) {
        console.error("RappelConso fetch error:", e);
        resultat = echec("reseau");
      }
      if (resultat.etat === "ok") {
        rappels = resultat.matches;
        fetchedAt = new Date().toISOString();
        if (doitMettreEnCache(resultat)) {
          await admin.from("rappels_cache").upsert({
            cache_key: cacheKey,
            fetched_at: fetchedAt,
            payload: { rappels },
          });
        } else {
          // Aucun rappel pour ce modèle : constat exact mais jamais mis en
          // cache — un vide ne doit pas pouvoir figer une panne amont.
          await admin.from("rappels_cache").delete().eq("cache_key", cacheKey);
        }
      } else {
        // Source indisponible : on renvoie quand même le check Takata, et on
        // le dit explicitement au lieu d'afficher « aucun rappel ».
        console.error("RappelConso indisponible:", resultat.raison);
        rappels = null;
        fetchedAt = null;
        indisponible = true;
        await admin.from("events").insert({
          name: "rappels_indisponible",
          analysis_id: analysisId,
          props_json: {
            raison: resultat.raison,
            marque: normalizeBrand(marque),
            modele: norm(modele),
          },
        });
      }
    }

    // Tri post-cache : années de publication, motorisation, générations.
    const split = Array.isArray(rappels)
      ? splitRappels(rappels, annee, carburant, modele, motorisation, generation)
      : null;
    const rappelsFiltres = split ? split.principaux : rappels;

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
      autres_rappels: split ? split.autres : null,
      takata,
      source: {
        nom: "RappelConso (data.economie.gouv.fr)",
        dataset: RAPPELCONSO_DATASET,
      },
      fetched_at: fetchedAt,
      cache: fromCache,
      indisponible,
      message_indisponible: indisponible ? MESSAGE_INDISPONIBLE : null,
    });
  } catch (error) {
    console.error("rappels error:", error);
    return jsonResponse({ error: "internal", message: "Erreur interne." }, 500);
  }
});
