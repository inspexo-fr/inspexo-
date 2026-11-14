// SPRINT 24 (chantier atlas, décision d'Utku du 13 nov. 2026) — Construction
// du catalogue de pannes (atlas de marque + fiche moteur), SORTIE DE `score`
// À L'IDENTIQUE pour être partagée avec le contrôle d'entrée en stock.
//
// ⚠️ REFACTOR PUR : le corps est déplacé octet pour octet (seuls les mots
// `export` ont été ajoutés). Aucune règle de notation n'est ici : les filtres
// (doublons, codes étrangers, versions, rappels, sources portantes) restent
// appliqués par chaque appelant. Le diff avant/après sur les 4 références est
// consigné dans le journal du sprint 24.
import defectAtlas from "./defectAtlas.json" with { type: "json" };
import { sameBrand } from "./brandAliases.ts";

export type CatalogueEntry = {
  ref: string;
  titre: string;
  organe: string | null;
  symptome: string;
  km_typique: string | null;
  gravite: "securite" | "casse" | "majeure" | "mineure";
  cout_min_eur: number | null;
  cout_max_eur: number | null;
  urls: string[];
  sources: Array<{ url: string; title: string | null }>;
  source_statut: "base_inspexo" | "en_ligne";
  contexte: string | null; // modèles/années côté atlas
  rappel_code: string | null;
  rappel_date: string | null;
  rappel_vehicules: string | null;
  rappel_portee?: string | null;
  rappel_annee_debut: number | null;
  rappel_annee_fin: number | null;
  /** SPRINT 23 — campagne publiée à l'étranger seulement : information de
   *  contexte, jamais un rappel (`_shared/rappelsApplicables.ts`). */
  rappel_contexte?: string | null;
};

export function extractCostRange(text: string): { min: number | null; max: number | null } {
  // "2 500 à 4 500€", "800-1 200€", "1 500€+"
  const range = text.match(/(\d[\d\s.,]{1,8})\s*(?:€)?\s*(?:à|–|-)\s*(\d[\d\s.,]{1,8})\s*€/);
  const toNum = (s: string) => {
    const n = parseInt(s.replace(/[\s.,]/g, ""), 10);
    return Number.isFinite(n) && n >= 30 && n < 100000 ? n : null;
  };
  if (range) return { min: toNum(range[1]), max: toNum(range[2]) };
  const single = text.match(/(\d[\d\s.,]{1,8})\s*€\s*\+?/);
  if (single) {
    const n = toNum(single[1]);
    return { min: n, max: null };
  }
  return { min: null, max: null };
}

// deno-lint-ignore no-explicit-any
export function buildCatalogue(marque: string | null, sheet: any): CatalogueEntry[] {
  const entries: CatalogueEntry[] = [];
  if (marque) {
    for (const [brandKey, brand] of Object.entries(defectAtlas as Record<string, { label: string; defects: Array<Record<string, string>> }>)) {
      if (!sameBrand(brandKey, marque) && !sameBrand(brand.label, marque)) continue;
      brand.defects.forEach((d, i) => {
        const cost = extractCostRange(d.description ?? "");
        // SPRINT 16 — L'atlas porte désormais ses sources. Une entrée qui n'en
        // a pas reste sans URL, et le filtre `sansSourcePublique` la sortira
        // de la liste des pannes : ce n'est pas un oubli, c'est la règle.
        // deno-lint-ignore no-explicit-any
        const dd = d as any;
        const atlasUrls: string[] = Array.isArray(dd.url_source) ? dd.url_source.filter((u: unknown) =>
          typeof u === "string" && /^https?:\/\//i.test(u)
        ) : [];
        const atlasSources = Array.isArray(dd.sources)
          ? dd.sources.filter((x: { url?: string }) => x && typeof x.url === "string")
          : atlasUrls.map((u) => ({ url: u, title: null }));
        entries.push({
          ref: `A${i + 1}`,
          titre: d.title,
          organe: null,
          symptome: d.description,
          km_typique: null,
          // SPRINT 21 — ce que l'entrée vise, DÉCLARÉ dans l'atlas. Absent :
          // `ciblesAtlas` retombe sur sa déduction d'origine (entrées
          // héritées). Présent et vide : l'entrée ne vise rien de distinctif
          // et restera une question.
          ...(Array.isArray(dd.cibles) ? { cibles: dd.cibles } : {}),
          // `gravite` (barème) si le sourcing l'a rejugée, sinon l'ancienne
          // étiquette. On ne PROMEUT jamais : pas de « casse » sans coût sourcé.
          gravite: typeof dd.gravite === "string" && dd.gravite
            ? dd.gravite
            : (d.severity === "MINEUR" ? "mineure" : "majeure"),
          cout_min_eur: typeof dd.cout_min_eur === "number" ? dd.cout_min_eur : cost.min,
          cout_max_eur: typeof dd.cout_max_eur === "number" ? dd.cout_max_eur : cost.max,
          urls: atlasUrls,
          sources: atlasSources,
          // ⚠️ DÉCISION DU 4 NOVEMBRE 2026 : une entrée d'atlas qui cite des
          // pages publiques s'affiche comme une fiche moteur — « Sources : »
          // suivi des liens. Plus d'étiquette « base Inspexo » sur une entrée
          // sourcée : « base Inspexo », c'est nous, et le lecteur doit pouvoir
          // aller voir. L'étiquette n'est conservée que pour une entrée sans
          // URL — laquelle est de toute façon retirée de l'affichage par la
          // règle du sprint 15.1.
          source_statut: atlasUrls.length > 0 ? "en_ligne" : "base_inspexo",
          contexte: [d.models, d.years].filter(Boolean).join(" — ") || null,
          rappel_code: null,
          rappel_date: null,
          rappel_vehicules: null,
          rappel_portee: null,
          rappel_annee_debut: null,
          rappel_annee_fin: null,
        });
      });
    }
  }
  if (sheet?.pannes) {
    const sheetStatut = sheet.statut === "validee" ? "base_inspexo" : "en_ligne";
    // deno-lint-ignore no-explicit-any
    (sheet.pannes as any[]).forEach((p, i) => {
      entries.push({
        ref: `F${i + 1}`,
        titre: p.titre,
        organe: p.organe ?? null,
        symptome: p.symptomes,
        km_typique: p.km_typique ?? null,
        gravite: p.gravite,
        cout_min_eur: p.cout_indicatif_eur_min ?? null,
        cout_max_eur: p.cout_indicatif_eur_max ?? null,
        urls: p.url_source ?? [],
        sources: Array.isArray(p.sources)
          ? p.sources
          : (p.url_source ?? []).map((u: string) => ({ url: u, title: null })),
        source_statut: sheetStatut,
        contexte: null,
        rappel_code: p.rappel_code ?? null,
        rappel_date: p.rappel_date ?? null,
        rappel_vehicules: p.rappel_vehicules ?? null,
        rappel_portee: p.rappel_portee ?? null,
        rappel_annee_debut: typeof p.rappel_annee_debut === "number" ? p.rappel_annee_debut : null,
        rappel_annee_fin: typeof p.rappel_annee_fin === "number" ? p.rappel_annee_fin : null,
      });
    });
  }
  return entries;
}


/** Fusion de deux entrées décrivant le même défaut (atlas et fiche), pour
 *  `dedupliquerCatalogue`. COPIE CONFORME de la fusion écrite dans `score`
 *  (laissée en place pour ne pas retoucher le chemin de notation) :
 *  tests/stock.test.mjs vérifie que les deux corps restent identiques. */
export const fusionnerEntrees = (garde: CatalogueEntry, autre: CatalogueEntry): CatalogueEntry => ({
          ...garde,
          symptome: garde.symptome || autre.symptome,
          organe: garde.organe ?? autre.organe,
          km_typique: garde.km_typique ?? autre.km_typique,
          cout_min_eur: garde.cout_min_eur ?? autre.cout_min_eur,
          cout_max_eur: garde.cout_max_eur ?? autre.cout_max_eur,
          urls: [...new Set([...(garde.urls ?? []), ...(autre.urls ?? [])])],
          sources: [...(garde.sources ?? []), ...(autre.sources ?? [])],
          contexte: garde.contexte ?? autre.contexte,
          rappel_code: garde.rappel_code ?? autre.rappel_code,
          rappel_date: garde.rappel_date ?? autre.rappel_date,
          rappel_vehicules: garde.rappel_vehicules ?? autre.rappel_vehicules,
          rappel_portee: garde.rappel_portee ?? autre.rappel_portee,
          rappel_annee_debut: garde.rappel_annee_debut ?? autre.rappel_annee_debut,
          rappel_annee_fin: garde.rappel_annee_fin ?? autre.rappel_annee_fin,
          // Une entrée relue à la main reste « base Inspexo ».
          source_statut: garde.source_statut === "base_inspexo" || autre.source_statut === "base_inspexo"
            ? "base_inspexo"
            : garde.source_statut,
        });
