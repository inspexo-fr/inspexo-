// SPRINT 17.1 — Une « incohérence » oppose deux éléments, ou n'en est pas une.
//
// Le cas qui a forcé cette règle : l'annonce de l'Audi S7 écrit « MOTEUR A
// CHAINE » en toutes lettres. Le 4.0 TFSI EA824 est bien à chaîne — c'est une
// mention EXACTE. Le modèle la signalait pourtant comme une incohérence, par
// intermittence (deux fois sur quatre passages), ce qui faisait échouer
// l'éval et, surtout, affichait à l'acheteur une contradiction qui n'existe
// pas. Un dossier qui invente une contradiction est pire qu'un dossier muet :
// il envoie poser une question sans objet.
//
// RÈGLE : une incohérence produite par le modèle n'est retenue que si elle
// oppose l'annonce à un élément NOMMÉ — la fiche moteur, un rappel officiel,
// un document (contrôle technique, carte grise, facture, carnet, HistoVec),
// ou une autre affirmation de l'annonce elle-même (deux prix, deux
// kilométrages). Opposer l'annonce à une connaissance générale non citée
// n'est pas une contradiction : c'est une opinion.
//
// ⚠️ LES INCOHÉRENCES POSÉES PAR LE SERVEUR SONT EXEMPTES. Le cadre juridique
// de l'intermédiaire, le compteur contredit par une photo ou par un PV : ce
// sont des constantes serveur, déjà adossées à leur preuve. Les soumettre à un
// filtre linguistique reviendrait à laisser une expression régulière effacer
// une règle de droit.
//
// Module PUR, testé hors ligne.

/** L'élément opposé est NOMMÉ : un document, une source, une pièce. */
const SOURCE_NOMMEE_RE = new RegExp(
  [
    // Documents du véhicule
    "contr[oô]le\\s+technique", "\\bCT\\b", "proc[eè]s-verbal", "\\bPV\\b",
    "carte\\s+grise", "certificat\\s+d'immatriculation", "facture", "carnet",
    "histovec", "certificat\\s+de\\s+situation", "rapport",
    // Nos propres sources
    "fiche\\s+moteur", "catalogue", "base\\s+inspexo", "rappel",
    // Mesures opposables
    "compteur", "photo", "annonces?\\s+comparables?", "relev[ée]",
  ].join("|"),
  "i",
);

/** Deux affirmations de l'annonce qui se contredisent entre elles. */
const CONTRADICTION_INTERNE_RE = new RegExp(
  [
    "deux\\s+prix", "prix\\s+affich[ée]\\s+et", "deux\\s+kilom[ée]trages?",
    "plus\\s+haut.{0,30}plus\\s+bas", "ailleurs\\s+dans\\s+l'annonce",
    "la\\s+m[eê]me\\s+annonce", "d'un\\s+c[oô]t[ée].{0,40}de\\s+l'autre",
  ].join("|"),
  "i",
);

/** Marqueur d'opposition : sans lui, le texte énonce, il n'oppose pas. */
const OPPOSITION_RE = new RegExp(
  [
    "alors\\s+que", "tandis\\s+que", "contredit", "contradiction", "incompatible",
    "ne\\s+correspond\\s+pas", "diff[eè]re", "divergen", "\\bmais\\b", "\\bor\\b",
    "contrairement", "inf[ée]rieur\\s+[àa]\\s+celui", "sup[ée]rieur\\s+[àa]\\s+celui",
    "\\bversus\\b", "\\bvs\\b", "au\\s+lieu\\s+de", "ne\\s+peut\\s+pas\\s+[eê]tre",
  ].join("|"),
  "i",
);

export type IncoherenceEcartee = { texte: string; motif: "sans_opposition" | "sans_element_oppose" };

/** L'incohérence oppose-t-elle réellement deux éléments identifiables ? */
export function opposeDeuxElements(texte: string): boolean {
  const t = String(texte ?? "");
  if (!OPPOSITION_RE.test(t)) return false;
  return SOURCE_NOMMEE_RE.test(t) || CONTRADICTION_INTERNE_RE.test(t);
}

/** Filtre les incohérences PRODUITES PAR LE MODÈLE.
 *
 *  `posesParLeServeur` : les textes qu'on a nous-mêmes insérés, jamais filtrés.
 *  Ils portent leur preuve ailleurs (constante juridique, photo du compteur,
 *  PV de contrôle technique). */
export function filtrerIncoherences(
  incoherences: readonly string[],
  posesParLeServeur: readonly string[] = [],
): { gardees: string[]; ecartees: IncoherenceEcartee[] } {
  const exempt = new Set(posesParLeServeur.map((t) => String(t ?? "").trim()));
  const gardees: string[] = [];
  const ecartees: IncoherenceEcartee[] = [];
  for (const i of incoherences) {
    const t = String(i ?? "").trim();
    if (!t) continue;
    if (exempt.has(t)) { gardees.push(t); continue; }
    if (!OPPOSITION_RE.test(t)) { ecartees.push({ texte: t, motif: "sans_opposition" }); continue; }
    if (!SOURCE_NOMMEE_RE.test(t) && !CONTRADICTION_INTERNE_RE.test(t)) {
      ecartees.push({ texte: t, motif: "sans_element_oppose" });
      continue;
    }
    gardees.push(t);
  }
  return { gardees, ecartees };
}

/** Une mention de l'annonce que NOTRE catalogue corrobore n'est pas une
 *  contradiction.
 *
 *  ⚠️ Portée réelle, à ne pas surestimer : elle ne mord que si la fiche parle
 *  du même organe. Sur l'EA824, la fiche ne contient pas le mot « chaîne » —
 *  ce n'est donc PAS cette règle qui règle le cas de la S7, c'est
 *  `opposeDeuxElements`. Elle est là pour le cas symétrique : une fiche qui
 *  dit « courroie en bain d'huile » et une annonce qui dit « courroie »
 *  n'entrent pas en contradiction. */
export function corroboreeParLeCatalogue(
  texte: string,
  entreesFiche: ReadonlyArray<{ titre?: string | null; symptome?: string | null }>,
): boolean {
  const ORGANES = [
    /\bcha[iî]nes?\b/i,
    /\bcourroies?\b/i,
    /\bturbos?\b/i,
    /\bfiltre\s+[àa]\s+particules?\b|\bfap\b/i,
    /\bembrayages?\b/i,
  ];
  const t = String(texte ?? "");
  const catalogue = entreesFiche
    .map((e) => `${e?.titre ?? ""} ${e?.symptome ?? ""}`)
    .join(" ");
  if (!catalogue.trim()) return false;
  return ORGANES.some((re) => re.test(t) && re.test(catalogue));
}
