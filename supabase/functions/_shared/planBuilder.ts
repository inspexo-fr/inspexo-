// SPRINT 22 — Génération d'un plan d'entretien SOURCÉ, sans écriture.
//
// Recherche (≤ 3), lecture des pages portantes, contrôle LITTÉRAL du chiffre,
// puis juge à vote (cache 180 jours). Ce module n'écrit RIEN dans les fiches :
// l'écriture passe par `admin-defect-sheets` (`ajouter_plan`), avec un jeton
// d'administrateur. Le seul effet de bord est le cache du juge.
import { rangSource } from "./atlasSource.ts";
import {
  affirmationIntervalle,
  candidats,
  intervalleAnsPresent,
  intervalleKmPresent,
  type OperationPlan,
  PLAN_TOOL,
  systemPlan,
} from "./planEntretien.ts";
import {
  cleVerif,
  ecrireCacheVerif,
  lireCacheVerif,
  messageVerification,
  type ReponseJuge,
  texteDeLaPage,
  type UsageJuge,
  VERIF_SYSTEM,
  VERIF_TOOL,
  voter,
  verdictsDeLaReponse,
} from "./verifSource.ts";

const MODEL = "claude-sonnet-5";
const MAX_SEARCHES = 3;
const MAX_BOUCLES = 4;
// Une fonction edge vit 150 s : la génération doit laisser du temps à la
// lecture des pages et au juge.
const ECHEANCE_GENERATION_MS = 95_000;
// Tarif web search : 10 $ / 1 000 recherches. Les fonctions précédentes ne le
// comptaient pas ; un coût qui oublie une ligne n'est pas un coût.
const USD_PAR_RECHERCHE = 0.01;

type Usage = { input_tokens: number; output_tokens: number };

export type ResultatPlan = {
  operations: OperationPlan[];
  ecartees: Array<{ operation: string; motif: string; url?: string }>;
  proposees: number;
  recherches: number;
  juge: { passages: number; depuis_cache: number };
  cout_eur: number;
};

const usdDe = (u: Usage | UsageJuge) => u.input_tokens * 3e-6 + u.output_tokens * 15e-6;

// deno-lint-ignore no-explicit-any
async function appelAnthropic(cle: string, corps: any, ms: number): Promise<any | null> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal: AbortSignal.timeout(Math.max(5_000, ms)),
    headers: { "Content-Type": "application/json", "x-api-key": cle, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(corps),
  });
  if (!res.ok) {
    console.error("plan generation:", res.status, (await res.text()).slice(0, 300));
    return null;
  }
  return await res.json();
}

async function proposer(cle: string, marque: string, famille: string, label: string | null, annees: string) {
  const system = systemPlan(marque, famille, label, annees);
  const tools = [{ type: "web_search_20250305", name: "web_search", max_uses: MAX_SEARCHES }, PLAN_TOOL];
  // deno-lint-ignore no-explicit-any
  let messages: any[] = [{ role: "user", content: `Relève le plan d'entretien publié du moteur ${famille} (${marque}). Recherche, puis appelle rendre_plan.` }];
  const usage: Usage = { input_tokens: 0, output_tokens: 0 };
  let recherches = 0;
  const fin = Date.now() + ECHEANCE_GENERATION_MS;
  for (let i = 0; i < MAX_BOUCLES && Date.now() < fin; i++) {
    const data = await appelAnthropic(cle, { model: MODEL, max_tokens: 3000, system, tools, messages }, fin - Date.now());
    if (!data) return { input: null, usage, recherches };
    usage.input_tokens += data.usage?.input_tokens ?? 0;
    usage.output_tokens += data.usage?.output_tokens ?? 0;
    // deno-lint-ignore no-explicit-any
    recherches += (data.content ?? []).filter((b: any) => b.type === "server_tool_use" && b.name === "web_search").length;
    // deno-lint-ignore no-explicit-any
    const bloc = (data.content ?? []).find((b: any) => b.type === "tool_use" && b.name === "rendre_plan");
    if (bloc) return { input: bloc.input, usage, recherches };
    if (data.stop_reason === "pause_turn") { messages = [...messages, { role: "assistant", content: data.content }]; continue; }
    messages = [...messages, { role: "assistant", content: data.content },
      { role: "user", content: "Appelle maintenant rendre_plan avec ce que tu as trouvé (liste vide si rien de publié)." }];
    const forcee = await appelAnthropic(cle, {
      model: MODEL, max_tokens: 2500, system, thinking: { type: "disabled" },
      tools: [PLAN_TOOL], tool_choice: { type: "tool", name: "rendre_plan" }, messages,
    }, fin - Date.now());
    if (!forcee) return { input: null, usage, recherches };
    usage.input_tokens += forcee.usage?.input_tokens ?? 0;
    usage.output_tokens += forcee.usage?.output_tokens ?? 0;
    // deno-lint-ignore no-explicit-any
    const fb = (forcee.content ?? []).find((b: any) => b.type === "tool_use" && b.name === "rendre_plan");
    return { input: fb?.input ?? null, usage, recherches };
  }
  return { input: null, usage, recherches };
}

async function unPassage(cle: string, cible: string, affs: Array<{ type: string; texte: string }>, url: string, texte: string): Promise<ReponseJuge> {
  const data = await appelAnthropic(cle, {
    model: MODEL, max_tokens: 1200, thinking: { type: "disabled" },
    system: [{ type: "text", text: VERIF_SYSTEM, cache_control: { type: "ephemeral" } }],
    tools: [VERIF_TOOL], tool_choice: { type: "tool", name: "rendre_verifications" },
    messages: [{ role: "user", content: [{ type: "text", text: messageVerification(cible, affs, url, texte) }] }],
  }, 60_000);
  if (!data) return null;
  // deno-lint-ignore no-explicit-any
  const bloc = (data.content ?? []).find((b: any) => b.type === "tool_use" && b.name === "rendre_verifications");
  if (!bloc) return null;
  return {
    verdicts: verdictsDeLaReponse(bloc.input),
    usage: { input_tokens: data.usage?.input_tokens ?? 0, output_tokens: data.usage?.output_tokens ?? 0 },
    modele: MODEL,
  };
}

export async function genererPlan(
  cleApi: string,
  // deno-lint-ignore no-explicit-any
  db: any,
  p: { marque: string; famille: string; label: string | null; annees: string },
): Promise<ResultatPlan> {
  let usd = 0;
  const ecartees: ResultatPlan["ecartees"] = [];
  const juge = { passages: 0, depuis_cache: 0 };

  const prop = await proposer(cleApi, p.marque, p.famille, p.label, p.annees);
  usd += usdDe(prop.usage) + prop.recherches * USD_PAR_RECHERCHE;
  const cands = candidats(prop.input?.operations);

  // 1) Rang : sans page portante, aucune lecture ni aucun appel payant.
  const aLire = new Set<string>();
  for (const c of cands) {
    if (!c.intervalle_km && !c.intervalle_annees) { ecartees.push({ operation: c.operation, motif: "aucun_intervalle_publie" }); continue; }
    if (c.portantes.length === 0) {
      // Les pages refusées sont NOMMÉES, avec leur rang : sans elles, on ne
      // sait pas si la règle a écarté des garages ou des pages constructeur
      // absentes de la liste blanche (constat du pilote du 8 nov. 2026).
      ecartees.push({ operation: c.operation, motif: "aucune_source_portante",
        url: c.url_source.map((u) => `${u} [${rangSource(u)}]`).join(" ; ").slice(0, 600) });
      continue;
    }
    c.portantes.forEach((u) => aLire.add(u));
  }
  const urls = [...aLire];
  const textes = new Map(await Promise.all(urls.map(async (u) => [u, await texteDeLaPage(u)] as const)));

  // 2) Chiffre LITTÉRALEMENT présent sur la page : gratuit, et éliminatoire.
  type Claim = { op: typeof cands[number]; km: number | null; ans: number | null; texte: string };
  const parPage = new Map<string, Claim[]>();
  for (const c of cands) {
    if ((!c.intervalle_km && !c.intervalle_annees) || c.portantes.length === 0) continue;
    for (const u of c.portantes) {
      const t = textes.get(u);
      if (!t) { ecartees.push({ operation: c.operation, motif: "page_illisible", url: u }); continue; }
      const km = c.intervalle_km && intervalleKmPresent(t, c.intervalle_km) ? c.intervalle_km : null;
      const ans = c.intervalle_annees && intervalleAnsPresent(t, c.intervalle_annees) ? c.intervalle_annees : null;
      if (km == null && ans == null) { ecartees.push({ operation: c.operation, motif: "chiffre_absent_de_la_page", url: u }); continue; }
      const l = parPage.get(u) ?? [];
      l.push({ op: c, km, ans, texte: affirmationIntervalle(c.operation, p.famille, km, ans) });
      parPage.set(u, l);
    }
  }

  // 3) Juge à vote, cache d'abord. Une affirmation par opération et par page.
  const cible = `${p.marque} ${p.famille} ${p.annees}`.replace(/\s+/g, " ").trim();
  const retenues = new Map<string, OperationPlan>();
  for (const [url, claims] of parPage) {
    const cles = await Promise.all(claims.map((c) => cleVerif(url, c.texte, cible)));
    const enCache = db ? await lireCacheVerif(db, cles) : new Map();
    const verdicts: string[] = new Array(claims.length);
    const aJuger: number[] = [];
    claims.forEach((_, i) => {
      const c = enCache.get(cles[i]);
      if (c) { verdicts[i] = c.verdict; juge.depuis_cache++; } else aJuger.push(i);
    });
    if (aJuger.length) {
      const v = await voter((a) => unPassage(cleApi, cible, a, url, textes.get(url)!), aJuger.map((i) => ({ type: "entretien", texte: claims[i].texte })));
      juge.passages += v.passages;
      for (const u of v.usages) usd += usdDe(u);
      const aEcrire: Parameters<typeof ecrireCacheVerif>[1] = [];
      aJuger.forEach((i, k) => {
        const r = v.resultats[k];
        verdicts[i] = r.verdict;
        if (r.fiable) aEcrire.push({ cle: cles[i], url, affirmation: claims[i].texte, moteur: cible, verdict: r.verdict, justification: r.justification, votes: r.votes, modele: r.modele });
      });
      if (db) await ecrireCacheVerif(db, aEcrire);
    }
    claims.forEach((c, i) => {
      if (verdicts[i] !== "soutenue") { ecartees.push({ operation: c.op.operation, motif: verdicts[i] ?? "non_soutenue", url }); return; }
      const deja = retenues.get(c.op.operation);
      retenues.set(c.op.operation, {
        operation: c.op.operation,
        intervalle_km: deja?.intervalle_km ?? c.km,
        intervalle_annees: deja?.intervalle_annees ?? c.ans,
        critique: false, lie_a_panne: null, cout_min_eur: null, cout_max_eur: null,
        url_source: [...new Set([...(deja?.url_source ?? []), url])].slice(0, 3),
        a_verifier_carnet: false,
      });
    });
  }

  return {
    operations: [...retenues.values()],
    ecartees,
    proposees: cands.length,
    recherches: prop.recherches,
    juge,
    cout_eur: Math.round(usd * 0.92 * 10000) / 10000,
  };
}
