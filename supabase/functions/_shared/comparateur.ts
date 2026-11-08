// SPRINT 22 — Comparer 2 ou 3 dossiers, et recommander PAR RÈGLES.
//
// Module PUR. La recommandation n'est jamais demandée au modèle : elle sort
// de seuils fixes, écrits ici, qu'on peut relire et rejouer. Le même
// tableau donne toujours la même recommandation.
//
// ⚠️ « IMPOSSIBLE DE DÉPARTAGER » EST UNE RÉPONSE À PART ENTIÈRE. Quand les
// écarts sont sous les seuils, ou que la donnée qui trancherait manque d'un
// côté, on le dit et on nomme ce qui manque — plutôt que d'élire un gagnant
// sur un point de score. Un conseil d'achat tiré d'un écart de bruit serait
// pire que pas de conseil.
//
// ⚠️ Ce module n'est JAMAIS sur le chemin de notation : il lit des verdicts
// déjà rendus. `tests/independance-score.test.mjs` interdit au score de le
// citer.
import { sourcesPortentLEntree } from "./atlasSource.ts";
import type { Cout3Ans } from "./cout3ans.ts";

// deno-lint-ignore no-explicit-any
type Json = any;

export const SEUIL_SCORE = 5; // points
export const SEUIL_COUT_EUR = 500; // € sur 3 ans
export const RANG_GRAVITE: Record<string, number> = { aucune: 0, mineure: 1, majeure: 2, casse: 3, securite: 4 };
const LIBELLE_GRAVITE: Record<string, string> = {
  aucune: "aucune panne documentée", mineure: "mineure", majeure: "majeure", casse: "risque de casse", securite: "sécurité",
};

export type FicheComparaison = {
  analysis_id: string;
  titre: string;
  verdict: "vert" | "orange" | "rouge" | string;
  score: number | null;
  /** Motif qui écarte le véhicule de la recommandation, s'il y en a un. */
  eliminatoire: string | null;
  pannes_portees: Array<{ titre: string; gravite: string }>;
  gravite_max: string;
  questions: number;
  travaux: { min: number | null; max: number | null; postes: number };
  prix: { demande: number | null; position: string | null; n: number | null; source: string | null };
  critair: string | null;
  cout_3ans: {
    total_min: number;
    total_max: number;
    non_chiffrees: Array<{ libelle: string; motif: string }>;
    partiel: boolean;
  } | null;
};

const s = (x: unknown) => (typeof x === "string" ? x : "");

export function ficheDepuisAnalyse(
  id: string,
  rj: Json,
  ligne: { verdict?: string | null; score?: number | null },
  cout: Cout3Ans | null,
): FicheComparaison {
  const v = rj?.vehicule ?? {};
  const faits = rj?.recalcul?.faits ?? {};
  const verdict = s(ligne.verdict) || s(rj?.verdict);
  const score = typeof ligne.score === "number" ? ligne.score : (typeof rj?.score === "number" ? rj.score : null);

  // Portée recalculée depuis les URL : vrai aussi pour les analyses d'avant
  // le sprint 21.1, dont la liste mêlait pannes portées et non portées.
  const pannes = (Array.isArray(rj?.pannes_connues) ? rj.pannes_connues : [])
    .filter((p: Json) => sourcesPortentLEntree(Array.isArray(p?.urls) ? p.urls : []))
    .filter((p: Json) => !p?.usure_lointaine)
    .map((p: Json) => ({ titre: s(p?.titre).slice(0, 140), gravite: s(p?.gravite) || "mineure" }));
  const graviteMax = pannes.reduce(
    (a: string, p: { gravite: string }) => ((RANG_GRAVITE[p.gravite] ?? 1) > (RANG_GRAVITE[a] ?? 0) ? p.gravite : a),
    "aucune",
  );

  let eliminatoire: string | null = null;
  if (verdict === "rouge") eliminatoire = "verdict rouge";
  else if (faits.compteur_contredit) eliminatoire = "kilométrage contredit par un document ou une photo";
  else if (faits.histovec_opposition) eliminatoire = "opposition au transfert relevée sur le rapport HistoVec";
  else if (faits.histovec_vge_en_cours) eliminatoire = "procédure véhicule endommagé non levée";

  const neg = rj?.negociation ?? null;
  const f = rj?.prix?.fourchette ?? null;
  const prixDemande = typeof v.prix_reel === "number" ? v.prix_reel : (typeof v.prix_affiche === "number" ? v.prix_affiche : null);

  return {
    analysis_id: id,
    titre: [v.marque, v.modele, v.motorisation, v.annee].filter((x) => x != null && String(x).trim()).join(" ").slice(0, 120),
    verdict,
    score,
    eliminatoire,
    pannes_portees: pannes.slice(0, 8),
    gravite_max: graviteMax,
    questions: Array.isArray(rj?.questions_vendeur) ? rj.questions_vendeur.length : 0,
    travaux: {
      min: typeof neg?.total_min_eur === "number" ? neg.total_min_eur : null,
      max: typeof neg?.total_max_eur === "number" ? neg.total_max_eur : null,
      postes: typeof neg?.nb_postes_chiffres === "number" ? neg.nb_postes_chiffres : 0,
    },
    prix: {
      demande: prixDemande,
      position: f ? s(f.position) || null : null,
      n: f && typeof f.n === "number" ? f.n : null,
      source: f ? s(f.source) || null : null,
    },
    critair: rj?.critair?.libelle ? s(rj.critair.libelle) : null,
    cout_3ans: cout
      ? {
        total_min: cout.total_min,
        total_max: cout.total_max,
        non_chiffrees: cout.lignes.filter((l) => !l.chiffree).map((l) => ({ libelle: l.libelle, motif: l.motif ?? "" })),
        partiel: cout.partiel,
      }
      : null,
  };
}

export type Raison = { critere: "score" | "pannes" | "cout_3ans" | "complement"; texte: string };

export type Recommandation =
  | { issue: "recommande"; analysis_id: string; titre: string; raisons: Raison[]; ecartes: Array<{ titre: string; motif: string }> }
  | { issue: "aucune"; motif: string; ecartes: Array<{ titre: string; motif: string }> }
  | { issue: "indecis"; motif: string; manque: string[]; ecartes: Array<{ titre: string; motif: string }> };

const eur = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " €";
const milieu = (c: NonNullable<FicheComparaison["cout_3ans"]>) => (c.total_min + c.total_max) / 2;

/** Les lignes non chiffrées de deux coûts sont-elles les MÊMES postes ?
 *  Sinon l'écart de total compare deux additions incomplètes de façon
 *  différente, et ne prouve rien. */
function memesTrous(a: FicheComparaison, b: FicheComparaison): boolean {
  const cle = (f: FicheComparaison) =>
    (f.cout_3ans?.non_chiffrees ?? []).map((l) => l.libelle.toLowerCase().replace(/\(\d+\)/g, "").trim()).sort().join("|");
  return cle(a) === cle(b);
}

type Duel = { gagne: number; perd: number; raisons: Raison[]; manque: string[] };

function duel(a: FicheComparaison, b: FicheComparaison): Duel {
  const d: Duel = { gagne: 0, perd: 0, raisons: [], manque: [] };

  // 1) Score.
  if (a.score != null && b.score != null) {
    const e = a.score - b.score;
    if (e >= SEUIL_SCORE) {
      d.gagne++;
      d.raisons.push({ critere: "score", texte: `Score ${a.score}/100 contre ${b.score}/100 (${e} points d'écart).` });
    } else if (-e >= SEUIL_SCORE) d.perd++;
  } else d.manque.push(`score de « ${a.score == null ? a.titre : b.titre} »`);

  // 2) Gravité maximale des pannes portées par une source indépendante.
  const ra = RANG_GRAVITE[a.gravite_max] ?? 0, rb = RANG_GRAVITE[b.gravite_max] ?? 0;
  if (ra < rb) {
    d.gagne++;
    d.raisons.push({
      critere: "pannes",
      texte: `Pannes documentées : ${a.pannes_portees.length} (gravité max. ${LIBELLE_GRAVITE[a.gravite_max]}) ` +
        `contre ${b.pannes_portees.length} (gravité max. ${LIBELLE_GRAVITE[b.gravite_max]}).`,
    });
  } else if (ra > rb) d.perd++;

  // 3) Coût sur 3 ans — seulement si les deux additions ont les mêmes trous.
  if (a.cout_3ans && b.cout_3ans) {
    if (!memesTrous(a, b)) {
      const trous = (f: FicheComparaison) => (f.cout_3ans?.non_chiffrees ?? []).map((l) => l.libelle);
      const diff = [...new Set([...trous(a), ...trous(b)])].filter((x) => !(trous(a).includes(x) && trous(b).includes(x)));
      d.manque.push(`coût sur 3 ans non comparable (non chiffré d'un seul côté : ${diff.slice(0, 3).join(", ")})`);
    } else {
      const e = milieu(b.cout_3ans) - milieu(a.cout_3ans);
      if (e >= SEUIL_COUT_EUR) {
        d.gagne++;
        d.raisons.push({
          critere: "cout_3ans",
          texte: `Coût sur 3 ans de ${eur(a.cout_3ans.total_min)} à ${eur(a.cout_3ans.total_max)}, ` +
            `contre ${eur(b.cout_3ans.total_min)} à ${eur(b.cout_3ans.total_max)} (environ ${eur(e)} de moins).`,
        });
      } else if (-e >= SEUIL_COUT_EUR) d.perd++;
    }
  } else d.manque.push(`coût sur 3 ans de « ${a.cout_3ans ? b.titre : a.titre} »`);

  return d;
}

/** Une seule phrase pour un critère gagné contre plusieurs rivaux. */
function fusionnerRaisons(
  critere: "score" | "pannes" | "cout_3ans",
  a: FicheComparaison,
  tous: FicheComparaison[],
  textes: string[],
): string {
  const autres = tous.filter((b) => b !== a);
  if (critere === "score") {
    const battus = autres.filter((b) => a.score != null && b.score != null && a.score - b.score >= SEUIL_SCORE);
    return `Score ${a.score}/100 contre ${battus.map((b) => `${b.score}/100`).join(" et ")}.`;
  }
  if (critere === "pannes") {
    const battus = autres.filter((b) => (RANG_GRAVITE[a.gravite_max] ?? 0) < (RANG_GRAVITE[b.gravite_max] ?? 0));
    return `Pannes documentées : ${a.pannes_portees.length} (gravité max. ${LIBELLE_GRAVITE[a.gravite_max]}) contre ` +
      battus.map((b) => `${b.pannes_portees.length} (${LIBELLE_GRAVITE[b.gravite_max]})`).join(" et ") + ".";
  }
  return textes.join(" ");
}

/** Laquelle prendre. Un véhicule n'est recommandé que s'il l'emporte sur
 *  CHACUN des autres sur au moins 2 des 3 critères, sans en perdre aucun. */
export function recommander(fiches: FicheComparaison[]): Recommandation {
  const ecartes = fiches.filter((f) => f.eliminatoire).map((f) => ({ titre: f.titre, motif: f.eliminatoire! }));
  const restants = fiches.filter((f) => !f.eliminatoire);

  if (restants.length === 0) {
    return { issue: "aucune", motif: "Aucun de ces véhicules ne peut être recommandé.", ecartes };
  }
  if (restants.length === 1) {
    const r = restants[0];
    return {
      issue: "recommande",
      analysis_id: r.analysis_id,
      titre: r.titre,
      raisons: ecartes.slice(0, 3).map((e) => ({ critere: "complement" as const, texte: `L'autre véhicule est écarté : ${e.motif} (« ${e.titre} »).` })),
      ecartes,
    };
  }

  const manques = new Set<string>();
  for (const a of restants) {
    const duels = restants.filter((b) => b !== a).map((b) => duel(a, b));
    const gagneTout = duels.every((d) => d.gagne >= 2 && d.perd === 0);
    for (const d of duels) for (const m of d.manque) manques.add(m);
    if (gagneTout) {
      // Une raison par critère, qui nomme TOUS les rivaux battus sur ce
      // critère. À trois dossiers, citer le seul premier duel ferait croire
      // que le recommandé n'a été comparé qu'à un véhicule.
      const raisons: Raison[] = [];
      for (const critere of ["score", "pannes", "cout_3ans"] as const) {
        const textes = duels.flatMap((d) => d.raisons.filter((r) => r.critere === critere).map((r) => r.texte));
        if (textes.length === 0) continue;
        raisons.push({ critere, texte: textes.length === 1 ? textes[0] : fusionnerRaisons(critere, a, restants, textes) });
      }
      // Moins de trois critères gagnés : on complète par des faits CHIFFRÉS
      // où le recommandé fait au moins aussi bien que chacun des autres —
      // jamais par un fait qui le desservirait. Ils ne décident de rien.
      const autres = restants.filter((b) => b !== a);
      const mieux = (f: (x: FicheComparaison) => number | null) => {
        const va = f(a);
        return va != null && autres.every((b) => { const vb = f(b); return vb != null && va < vb; });
      };
      if (raisons.length < 3 && mieux((x) => x.prix.demande)) {
        raisons.push({
          critere: "complement",
          texte: `Prix demandé ${eur(a.prix.demande!)}, contre ${autres.map((b) => eur(b.prix.demande!)).join(" et ")}.`,
        });
      }
      if (raisons.length < 3 && mieux((x) => x.travaux.max)) {
        raisons.push({
          critere: "complement",
          texte: `Travaux chiffrés jusqu'à ${eur(a.travaux.max!)}, contre ${autres.map((b) => eur(b.travaux.max!)).join(" et ")}.`,
        });
      }
      if (raisons.length < 3 && mieux((x) => x.questions)) {
        raisons.push({
          critere: "complement",
          texte: `${a.questions} question(s) à poser au vendeur, contre ${autres.map((b) => b.questions).join(" et ")}.`,
        });
      }
      return { issue: "recommande", analysis_id: a.analysis_id, titre: a.titre, raisons: raisons.slice(0, 3), ecartes };
    }
  }

  return {
    issue: "indecis",
    motif: "Impossible de départager sur ces données : aucun véhicule ne l'emporte nettement " +
      `sur au moins deux critères (score d'au moins ${SEUIL_SCORE} points, pannes documentées moins graves, ` +
      `coût sur 3 ans inférieur d'au moins ${eur(SEUIL_COUT_EUR)}).`,
    manque: [...manques].slice(0, 6),
    ecartes,
  };
}
