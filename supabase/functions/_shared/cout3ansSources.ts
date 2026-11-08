// SPRINT 22 — Les sources du coût sur 3 ans, tranchées côté SERVEUR.
//
// Construit l'entrée de `coutTroisAns` (module pur, miroir navigateur) à
// partir d'un `result_json` déjà produit. Aucun appel au modèle, aucune
// requête réseau : on relit ce que l'analyse contient, plus les fourchettes
// de `repair_costs` et le relevé officiel des prix du contrôle technique.
//
// Deux règles distinctes (décision d'Utku du 8 nov. 2026, cf.
// `coutEntretienPrevu` dans `atlasSource.ts`) :
//   - une opération n'est DUE que si le plan d'entretien la sourçe par une
//     page PORTANTE (officielle, presse, éditoriale) ;
//   - son PRIX peut venir d'un comparateur de garages, avec le libellé qui le
//     dit — et seulement parce qu'elle est prévue au plan.
// Une opération déclarée non faite par l'annonce mais ABSENTE du plan n'a
// donc droit qu'à un prix portant ou à un devis validé.
import {
  coutEntretienPrevu,
  sourcesPortentLEntree,
} from "./atlasSource.ts";
import { chercherCout, type CoutCandidat, coutsApplicables } from "./negociation.ts";
import { coutCarteGrise, type TarifsCarteGrise } from "./revendeur.ts";
import {
  type Cout3Ans,
  coutTroisAns,
  type EntreeCout3Ans,
  kmAnBorne,
  type OperationSourcee,
  type SourceCout,
  type TarifCt,
} from "./cout3ans.ts";

// deno-lint-ignore no-explicit-any
type Json = any;

export type ReleveCt = {
  maj: string; // JJ/MM/AAAA
  source: string;
  // par énergie : diesel | essence | hybride | electrique | gaz | toutes
  energies: Record<string, { p25: number; p50: number; p75: number; n: number }>;
};

const num = (x: unknown): number | null =>
  typeof x === "number" && Number.isFinite(x) && x > 0 ? x : null;

const urlsDe = (x: unknown): string[] =>
  Array.isArray(x) ? x.filter((u): u is string => typeof u === "string" && /^https?:\/\//i.test(u)) : [];

/** Énergie du relevé officiel la plus proche du carburant de l'annonce. */
export function energieCt(carburant: unknown): string {
  const e = String(carburant ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (/electri/.test(e)) return "electrique";
  if (/hybrid/.test(e)) return "hybride";
  if (/gpl|gnv|gaz/.test(e)) return "gaz";
  if (/diesel|gazole|hdi|dci|tdi|cdi|crdi/.test(e)) return "diesel";
  if (/essence|sp9|e85|ethanol|tce|tsi|tfsi|puretech/.test(e)) return "essence";
  return "toutes";
}

export function tarifCt(releve: ReleveCt | null, carburant: unknown): TarifCt | null {
  if (!releve?.energies) return null;
  const k = energieCt(carburant);
  const t = releve.energies[k] ?? releve.energies["toutes"];
  if (!t || !num(t.p25) || !num(t.p75) || !(t.n >= 50)) return null;
  return { min: t.p25, max: t.p75, n_centres: t.n, maj: releve.maj, source: releve.source };
}

/** Âge en années décimales, depuis la première immatriculation (AAAA ou
 *  AAAA-MM) sinon l'année-modèle (au 1er juillet). */
export function ageDepuis(
  premiereImmat: unknown,
  anneeModele: unknown,
  aujourdhui: Date,
): { age: number | null; base: "premiere_immatriculation" | "annee_modele" | null } {
  const brut = String(premiereImmat ?? "").trim();
  let d: Date | null = null;
  let base: "premiere_immatriculation" | "annee_modele" | null = null;
  if (/^\d{4}-\d{2}$/.test(brut)) { d = new Date(`${brut}-01T00:00:00Z`); base = "premiere_immatriculation"; }
  else if (/^\d{4}$/.test(brut)) { d = new Date(`${brut}-07-01T00:00:00Z`); base = "premiere_immatriculation"; }
  else if (typeof anneeModele === "number" && anneeModele > 1950 && anneeModele < 2100) {
    d = new Date(`${anneeModele}-07-01T00:00:00Z`); base = "annee_modele";
  }
  if (!d || Number.isNaN(d.getTime())) return { age: null, base: null };
  const age = (aujourdhui.getTime() - d.getTime()) / (365.25 * 86400_000);
  return { age: age < 0 ? 0 : Math.round(age * 100) / 100, base };
}

/** Le coût admis d'une opération PRÉVUE AU PLAN. */
function coutPrevu(
  operation: string,
  coutMin: number | null,
  coutMax: number | null,
  urls: string[],
  candidats: CoutCandidat[],
): { min: number | null; max: number | null; source: SourceCout | null } {
  // a) Le coût porté par la fiche elle-même.
  if (coutMin != null || coutMax != null) {
    const a = coutEntretienPrevu(urls);
    if (a.admis) return { min: coutMin, max: coutMax, source: { via: a.via, libelle: a.libelle, urls: a.urls } };
  }
  // b) Une fourchette de repair_costs : devis validé, prix portant, ou
  //    comparateur de garages (admis ici parce que l'opération est au plan).
  const admissibles = candidats.filter((c) => c.statut === "valide_devis" || coutEntretienPrevu(c.urls).admis);
  const t = chercherCout(operation, admissibles);
  if (t) {
    if (t.statut === "valide_devis") {
      return { min: t.cout_min_eur, max: t.cout_max_eur, source: { via: "devis", libelle: "devis validé", urls: [] } };
    }
    const a = coutEntretienPrevu(t.urls);
    if (a.admis) return { min: t.cout_min_eur, max: t.cout_max_eur, source: { via: a.via, libelle: a.libelle, urls: a.urls } };
  }
  return { min: null, max: null, source: null };
}

const viaPortante = (urls: string[]) => {
  const a = coutEntretienPrevu(urls);
  return a.admis && a.via === "portante";
};

/** Le coût admis d'une opération HORS plan : portant ou devis, jamais
 *  comparateur (règle du 6 nov. 2026 entière). */
function coutHorsPlan(operation: string, candidats: CoutCandidat[]) {
  const admissibles = candidats.filter((c) =>
    c.statut === "valide_devis" || viaPortante(c.urls)
  );
  const t = chercherCout(operation, admissibles);
  if (!t) return { min: null, max: null, source: null };
  if (t.statut === "valide_devis") {
    return { min: t.cout_min_eur, max: t.cout_max_eur, source: { via: "devis" as const, libelle: "devis validé", urls: [] } };
  }
  const a = coutEntretienPrevu(t.urls);
  return a.admis
    ? { min: t.cout_min_eur, max: t.cout_max_eur, source: { via: a.via, libelle: a.libelle, urls: a.urls } }
    : { min: null, max: null, source: null };
}

export function entreeDepuisAnalyse(
  rj: Json,
  candidats: CoutCandidat[],
  releve: ReleveCt | null,
  aujourdhui: Date,
  carteGrise: EntreeCout3Ans["carte_grise"],
  carteGriseMotif: string | null,
): EntreeCout3Ans {
  const v = rj?.vehicule ?? {};
  const rc = rj?.recalcul ?? {};
  const prix = num(v.prix_reel) ?? num(v.prix_affiche);
  const kmActuel = typeof v.kilometrage === "number" && v.kilometrage >= 0 ? v.kilometrage : null;
  const { age, base } = ageDepuis(rj?.critair?.premiere_immatriculation, v.annee, aujourdhui);

  const plan: OperationSourcee[] = [];
  const nonEtablies: Array<{ operation: string; motif: string }> = [];
  const etablies = new Set<string>();

  for (const op of Array.isArray(rc.plan_entretien) ? rc.plan_entretien : []) {
    const operation = String(op?.operation ?? "").trim().slice(0, 140);
    if (!operation) continue;
    const urls = urlsDe(op?.urls);
    const iKm = num(op?.intervalle_km);
    const iAns = num(op?.intervalle_annees);
    if (op?.a_verifier_carnet || (iKm == null && iAns == null)) {
      nonEtablies.push({ operation, motif: "intervalle à vérifier dans le carnet" });
      continue;
    }
    if (!sourcesPortentLEntree(urls)) {
      nonEtablies.push({ operation, motif: "intervalle sans source indépendante : à vérifier dans le carnet" });
      continue;
    }
    const c = coutPrevu(operation, num(op?.cout_min_eur), num(op?.cout_max_eur), urls, candidats);
    plan.push({
      operation,
      intervalle_km: iKm,
      intervalle_annees: iAns,
      cout_min: c.min,
      cout_max: c.max,
      source_cout: c.source,
      urls_echeance: urls.slice(0, 2),
    });
    etablies.add(operation);
  }

  const du: EntreeCout3Ans["du_des_achat"] = [];
  // Échue sans justificatif : même exigence de source pour l'échéance.
  for (const op of Array.isArray(rc.entretien_du_non_prouve) ? rc.entretien_du_non_prouve : []) {
    const operation = String(op?.operation ?? "").trim().slice(0, 140);
    if (!operation) continue;
    const urls = urlsDe(op?.urls);
    if (!sourcesPortentLEntree(urls)) continue;
    const c = coutPrevu(operation, num(op?.cout_min_eur), num(op?.cout_max_eur), urls, candidats);
    du.push({
      operation, intervalle_km: null, intervalle_annees: null,
      cout_min: c.min, cout_max: c.max, source_cout: c.source, urls_echeance: urls.slice(0, 2),
      motif: "échéance passée, aucun justificatif annoncé",
    });
  }

  // Déclarée non faite par l'annonce. Dédoublonnée contre ce qui précède
  // (même organe ou ≥ 2 mots communs : `chercherCout` fait ce rapprochement).
  const dejaDu: CoutCandidat[] = du.map((d) => ({
    operation: d.operation, cout_min_eur: 1, cout_max_eur: 1, urls: [], statut: "fiche", famille_norm: "",
  }));
  const planCand: CoutCandidat[] = plan.map((d) => ({
    operation: d.operation, cout_min_eur: 1, cout_max_eur: 1, urls: [], statut: "fiche", famille_norm: "",
  }));
  for (const brut of Array.isArray(rc.operations_non_faites) ? rc.operations_non_faites : []) {
    const operation = String(brut ?? "").trim().slice(0, 140);
    if (!operation) continue;
    if (chercherCout(operation, dejaDu)) continue;
    const auPlan = chercherCout(operation, planCand);
    let c: { min: number | null; max: number | null; source: SourceCout | null };
    if (auPlan) {
      const p = plan.find((x) => x.operation === auPlan.operation)!;
      c = { min: p.cout_min, max: p.cout_max, source: p.source_cout };
    } else {
      c = coutHorsPlan(operation, candidats);
    }
    du.push({
      operation, intervalle_km: null, intervalle_annees: null,
      cout_min: c.min, cout_max: c.max, source_cout: c.source, urls_echeance: [],
      motif: "l'annonce la déclare non faite",
    });
    dejaDu.push({ operation, cout_min_eur: 1, cout_max_eur: 1, urls: [], statut: "fiche", famille_norm: "" });
  }

  return {
    prix_eur: prix,
    kilometrage: kmActuel,
    age_ans: age,
    age_base: base,
    plan,
    du_des_achat: du.slice(0, 8),
    non_etablies: nonEtablies,
    ct: tarifCt(releve, v.carburant),
    carte_grise: carteGrise,
    carte_grise_motif: carteGriseMotif,
  };
}

// ── Assemblage complet, partagé par `cout-3ans` et `comparer` ───────────────
//
// Une seule fonction, deux appelants : sans elle, le coût affiché dans le
// dossier et celui du comparateur auraient pu diverger au premier paramètre
// ajouté d'un seul côté.

const MOTIFS_CARTE_GRISE: Record<string, string> = {
  bareme_absent: "barème régional indisponible",
  region_inconnue: "indiquez votre région",
  cv_inconnus: "indiquez la puissance fiscale (case P.6 de la carte grise)",
  region_absente_du_bareme: "région absente du barème",
};

export type ContexteCout = {
  candidats: CoutCandidat[];
  releve: ReleveCt | null;
  bareme: TarifsCarteGrise | null;
};

/** Lit UNE FOIS ce qui ne dépend pas de l'analyse. */
// deno-lint-ignore no-explicit-any
export async function chargerContexteCout(admin: any): Promise<ContexteCout> {
  const [{ data: couts }, { data: cfg }] = await Promise.all([
    admin.from("repair_costs").select("operation, cout_min_eur, cout_max_eur, url_source, statut, famille_norm").limit(1000),
    admin.from("config").select("cle, valeur").in("cle", ["ct_prix", "carte_grise_tarifs"]),
  ]);
  // deno-lint-ignore no-explicit-any
  const c = (cle: string) => ((cfg ?? []) as any[]).find((r) => r.cle === cle)?.valeur ?? null;
  return {
    // deno-lint-ignore no-explicit-any
    candidats: ((couts ?? []) as any[]).map((r) => ({
      operation: String(r.operation ?? ""),
      cout_min_eur: typeof r.cout_min_eur === "number" ? r.cout_min_eur : null,
      cout_max_eur: typeof r.cout_max_eur === "number" ? r.cout_max_eur : null,
      urls: Array.isArray(r.url_source) ? r.url_source.filter((u: unknown): u is string => typeof u === "string") : [],
      statut: r.statut === "valide_devis" ? "valide_devis" as const : "source" as const,
      famille_norm: String(r.famille_norm ?? ""),
    })),
    releve: c("ct_prix"),
    bareme: c("carte_grise_tarifs"),
  };
}

export function calculerCout3Ans(
  rj: Json,
  ctx: ContexteCout,
  opts: { km_an?: unknown; region?: unknown; cv?: unknown; aujourdhui?: Date },
): { cout: Cout3Ans; entree: EntreeCout3Ans } {
  const v = rj?.vehicule ?? {};
  const cand = coutsApplicables(ctx.candidats, v.famille_moteur ?? null, v.boite_code ?? null);
  const cg = coutCarteGrise(
    typeof opts.cv === "number" ? opts.cv : Number(opts.cv),
    typeof opts.region === "string" ? opts.region.slice(0, 60) : null,
    ctx.bareme,
  );
  const entree = entreeDepuisAnalyse(
    rj,
    cand,
    ctx.releve,
    opts.aujourdhui ?? new Date(),
    cg.connu ? { montant_eur: cg.montant_eur, region: cg.region, cv: cg.cv, maj: cg.maj ?? null } : null,
    cg.connu ? null : (MOTIFS_CARTE_GRISE[cg.motif] ?? "carte grise non chiffrée"),
  );
  return { cout: coutTroisAns(entree, { km_an: kmAnBorne(opts.km_an) }), entree };
}
