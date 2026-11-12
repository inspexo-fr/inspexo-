// SPRINT 23, LOT 3 (point 5) — Pages publiques par MODÈLE :
// /modele/<marque>/<modele>-<generation>.
//
// Une page modèle AGRÈGE les fiches des familles moteur montées sur ce
// modèle (table `famillesMoteur.json`, jamais une liste en dur). Elle ne
// recopie pas les fiches : chaque panne renvoie à sa page /moteur, qui reste
// la page de référence (lien canonique du contenu moteur).
//
//   - UNIQUEMENT les pannes PORTÉES par une source indépendante
//     (`sourcesPortentLEntree`, le même classement que le score) ; seules les
//     sources portantes sont citées ;
//   - UNIQUEMENT les prises en charge DATÉES (période écrite) ; une source
//     d'un autre pays reste une information de contexte ;
//   - seuil de publication : au moins 3 pannes portées sur la page.
//
// Module PUR (tests/modeles.test.mjs).
import { sourcesPortentLEntree, urlsDeLaPanne } from "./atlasSource.ts";
import { sanitizePrisesEnCharge, MENTION_CONTEXTE, MENTION_FRANCE } from "./prisesEnCharge.ts";
import { titreSansRappelOfficiel } from "./rappelsApplicables.ts";

export const SEUIL_PANNES_MODELE = 3;

export type FamilleMoteur = {
  marque: string;
  famille: string;
  nom_commercial: string;
  modeles: string[];
  debut?: number | null;
  derniere_attestee?: number | null;
};

export type PageModele = {
  marque: string;
  modele: string;
  generation: string | null;
  slug_marque: string;
  slug: string;
  familles: FamilleMoteur[];
};

const ROMAIN: Record<string, string> = { "1": "I", "2": "II", "3": "III", "4": "IV", "5": "V", "6": "VI", "7": "VII", "8": "VIII" };

export function slugTexte(t: string): string {
  return String(t ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Une partie est-elle une GÉNÉRATION (chiffres romains, Mk, code de caisse) ? */
// Finitions et déclinaisons : elles font partie du NOM du modèle (« Clio RS »,
// « 308 GT »), jamais de sa génération.
const FINITIONS = new Set(["RS", "ST", "GT", "GTI", "GTD", "HSD", "SW", "EV", "HEV", "PHEV"]);

export function estGeneration(t: string): boolean {
  if (FINITIONS.has(t)) return false;
  return /^(?:[IVX]{1,4}|Mk\d|[A-Z]{1,2}\d{1,3}[A-Z]?|\d[A-Z]|[A-Z]{2}|[A-Z])$/.test(t);
}

const normGeneration = (g: string) => g.replace(/^Mk(\d)$/, (_, n) => ROMAIN[n] ?? g);

/** « Renault Clio III/IV » → [{Renault, Clio, III}, {Renault, Clio, IV}] ;
 *  « Ford Fiesta/Focus » → deux MODÈLES sans génération ;
 *  « DS 7 Crossback » → marque DS. */
export function decouperLibelle(libelle: string): Array<{ marque: string; modele: string; generation: string | null }> {
  const mots = String(libelle ?? "").trim().split(/\s+/);
  if (mots.length < 2) return [];
  const marque = mots[0] === "VW" ? "Volkswagen" : mots[0];
  let reste = mots.slice(1);
  let generations: string[] = [];
  const dernier = reste[reste.length - 1];
  if (reste.length >= 2 && dernier.split("/").every(estGeneration)) {
    generations = dernier.split("/").map(normGeneration);
    reste = reste.slice(0, -1);
  }
  const modeleTexte = reste.join(" ");
  // « Fiesta/Focus », « 207/208 », « Tucson/ix35 » : plusieurs modèles.
  const modeles = /\//.test(modeleTexte) && !generations.length ? modeleTexte.split("/") : [modeleTexte];
  const out: Array<{ marque: string; modele: string; generation: string | null }> = [];
  for (const m of modeles) {
    if (generations.length === 0) out.push({ marque, modele: m.trim(), generation: null });
    else for (const g of generations) out.push({ marque, modele: m.trim(), generation: g });
  }
  return out.filter((x) => x.modele);
}

/** Index des pages modèle. Une famille citée SANS génération (« Peugeot 2008 »)
 *  vaut pour chaque génération connue du modèle, et pour la page sans
 *  génération quand aucune génération n'est connue. */
export function indexerModeles(familles: FamilleMoteur[]): PageModele[] {
  const pages = new Map<string, PageModele>();
  const generiques: Array<{ marque: string; modele: string; famille: FamilleMoteur }> = [];
  const cle = (ma: string, mo: string, g: string | null) => `${slugTexte(ma)}|${slugTexte(mo)}|${g ?? ""}`;
  for (const f of familles) {
    for (const lib of f.modeles ?? []) {
      for (const x of decouperLibelle(lib)) {
        if (x.generation === null) { generiques.push({ marque: x.marque, modele: x.modele, famille: f }); continue; }
        const k = cle(x.marque, x.modele, x.generation);
        if (!pages.has(k)) {
          pages.set(k, {
            marque: x.marque, modele: x.modele, generation: x.generation,
            slug_marque: slugTexte(x.marque), slug: slugTexte(`${x.modele} ${x.generation}`), familles: [],
          });
        }
        const p = pages.get(k)!;
        if (!p.familles.includes(f)) p.familles.push(f);
      }
    }
  }
  for (const g of generiques) {
    const avecGeneration = [...pages.values()].filter((p) => slugTexte(p.marque) === slugTexte(g.marque) && slugTexte(p.modele) === slugTexte(g.modele));
    if (avecGeneration.length > 0) {
      for (const p of avecGeneration) if (!p.familles.includes(g.famille)) p.familles.push(g.famille);
      continue;
    }
    const k = cle(g.marque, g.modele, null);
    if (!pages.has(k)) {
      pages.set(k, { marque: g.marque, modele: g.modele, generation: null, slug_marque: slugTexte(g.marque), slug: slugTexte(g.modele), familles: [] });
    }
    const p = pages.get(k)!;
    if (!p.familles.includes(g.famille)) p.familles.push(g.famille);
  }
  return [...pages.values()].sort((a, b) => `${a.slug_marque}/${a.slug}`.localeCompare(`${b.slug_marque}/${b.slug}`));
}

export type FicheMoteur = {
  marque: string;
  famille_moteur: string;
  moteur_label?: string | null;
  pannes: unknown;
  prises_en_charge?: unknown;
  updated_at?: string | null;
};

export type PanneModele = { titre: string; gravite: string | null; sources: string[] };
export type SectionFamille = {
  marque: string;
  famille: string;
  nom_commercial: string;
  annees: string | null;
  page_moteur_publiee: boolean;
  pannes: PanneModele[];
  pannes_non_portees: number;
  prises: Array<{ type: string; texte: string; periode: string; portee: "france" | "contexte"; mention: string; urls: string[] }>;
  maj: string | null;
};

const cleFamille = (marque: string, famille: string) =>
  `${slugTexte(marque)}|${String(famille ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "")}`;

/** Même critère que `list_moteurs_publies` : au moins 3 pannes, chacune citant une source. */
export function fichePubliee(f: FicheMoteur): boolean {
  const pannes = Array.isArray(f.pannes) ? f.pannes : [];
  return pannes.length >= 3 && pannes.every((p) => urlsDeLaPanne(p).length > 0);
}

/** Contenu d'une page modèle à partir des fiches en base. */
/** Une ligne de fiche (panne ou prise en charge) qui NOMME une autre marque
 *  ou un autre modèle, et pas celui de la page, ne le concerne pas : la fiche
 *  est par moteur, la page par véhicule (« Rappel (Captur) » n'a rien à faire
 *  sur la page de la Clio IV). Seuls les noms NON numériques sont cherchés :
 *  « 2008 » se confond avec une année. */
// Noms de véhicules qui sont aussi des mots courants : jamais cherchés.
const AMBIGUS = new Set(["expert", "mini", "serie", "classe", "born", "puma"]);

export function nommeUnAutreVehicule(texte: string, page: PageModele, catalogue: Array<{ marque: string; modele: string }>): boolean {
  const t = ` ${slugTexte(texte).replace(/-/g, " ")} `;
  const cherche = (nom: string) => {
    const n = slugTexte(nom).replace(/-/g, " ");
    return n.length >= 3 && /[a-z]/.test(n) && t.includes(` ${n} `);
  };
  const premierMot = (m: string) => m.split(/\s+/)[0];
  const lui = cherche(page.marque) || cherche(page.modele) || (!AMBIGUS.has(slugTexte(premierMot(page.modele))) && cherche(premierMot(page.modele)));
  if (lui) return false;
  for (const v of catalogue) {
    if (slugTexte(v.marque) !== slugTexte(page.marque) && !AMBIGUS.has(slugTexte(v.marque)) && cherche(v.marque)) return true;
    // Nom COMPLET du modèle (« Série 1 », « Classe A ») : un premier mot seul
    // se confond avec la langue courante (« numéro de série »).
    if (slugTexte(v.modele) !== slugTexte(page.modele) && !AMBIGUS.has(slugTexte(v.modele)) && cherche(v.modele)) return true;
  }
  return false;
}

export function composerPage(
  page: PageModele,
  fiches: FicheMoteur[],
  catalogue: Array<{ marque: string; modele: string }> = [],
): { sections: SectionFamille[]; n_pannes: number; publiable: boolean } {
  const parCle = new Map<string, FicheMoteur>();
  for (const f of fiches) {
    const k = cleFamille(f.marque, f.famille_moteur);
    if (!parCle.has(k)) parCle.set(k, f); // l'appelant trie : validée d'abord, puis la plus récente
  }
  const sections: SectionFamille[] = [];
  for (const fam of page.familles) {
    const fiche = parCle.get(cleFamille(fam.marque, fam.famille));
    if (!fiche) continue;
    const brutes = Array.isArray(fiche.pannes) ? fiche.pannes : [];
    const pannes: PanneModele[] = [];
    let nonPortees = 0;
    for (const p of brutes) {
      const urls = urlsDeLaPanne(p);
      // deno-lint-ignore no-explicit-any
      const q = p as any;
      if (nommeUnAutreVehicule(String(q?.titre ?? ""), page, catalogue)) continue;
      if (!sourcesPortentLEntree(urls)) { nonPortees++; continue; }
      pannes.push({
        titre: titreSansRappelOfficiel(q?.titre).slice(0, 200),
        gravite: typeof q?.gravite === "string" ? q.gravite : null,
        sources: urls.filter((u) => sourcesPortentLEntree([u])),
      });
    }
    const prises = sanitizePrisesEnCharge(fiche.prises_en_charge)
      .filter((x) => x.periode !== null)
      .filter((x) => !nommeUnAutreVehicule(x.texte, page, catalogue))
      .map((x) => {
        const france = x.pays.includes("FR");
        return {
          type: x.type, texte: x.texte, periode: x.periode!.texte,
          portee: (france ? "france" : "contexte") as "france" | "contexte",
          mention: france ? MENTION_FRANCE : MENTION_CONTEXTE, urls: x.urls,
        };
      });
    if (pannes.length === 0 && prises.length === 0) continue;
    sections.push({
      marque: fam.marque,
      famille: fam.famille,
      nom_commercial: fam.nom_commercial,
      annees: fam.debut ? `${fam.debut}–${fam.derniere_attestee ?? ""}` : null,
      page_moteur_publiee: fichePubliee(fiche),
      pannes,
      pannes_non_portees: nonPortees,
      prises,
      maj: fiche.updated_at ?? null,
    });
  }
  const n = sections.reduce((s, x) => s + x.pannes.length, 0);
  return { sections, n_pannes: n, publiable: n >= SEUIL_PANNES_MODELE };
}
