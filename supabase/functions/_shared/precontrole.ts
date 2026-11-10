// SPRINT 23 — Pré-contrôle des sources externes, SANS MODÈLE.
//
// Décision d'Utku du 10 nov. 2026 : avant de payer le juge, vérifier
// gratuitement que chaque page est joignable depuis nos fonctions edge, et que
// les extraits déclarés « verbatim » s'y retrouvent. Une page injoignable sort
// du lot : on ne paie pas pour elle. Aucun contournement d'un site qui bloque.
//
// Module PUR : normalisation et recherche d'extrait. Le réseau est ailleurs.

/** Entités HTML courantes : le texte extrait d'une page les garde telles
 *  quelles (`&rsquo;`), un extrait relevé par un outil de lecture non. */
const NOMMEES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "'", lsquo: "'",
  rdquo: '"', ldquo: '"', laquo: '"', raquo: '"', hellip: "...", ndash: "-", mdash: "-",
  eacute: "é", egrave: "è", ecirc: "ê", agrave: "à", acirc: "â", ccedil: "ç", ocirc: "ô",
  ucirc: "û", ugrave: "ù", icirc: "î", iuml: "ï", euml: "ë", auml: "ä", ouml: "ö", uuml: "ü",
  szlig: "ß", deg: "°", euro: "€",
};

export function decoderEntites(t: string): string {
  return String(t ?? "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => NOMMEES[n.toLowerCase()] ?? m);
}

/** Normalisation commune à la page et à l'extrait : apostrophes, guillemets,
 *  espaces (insécables comprises), tirets, points de suspension, casse. */
export function normaliser(t: string): string {
  return decoderEntites(t)
    .replace(/[‘’‚‛′´`]/g, "'")
    .replace(/[“”„‟«»″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/…/g, "...")
    .replace(/[\s     ​]+/g, " ")
    .toLowerCase()
    .trim();
}

/** Variante plus tolérante : sans ponctuation (une virgule ou un guillemet
 *  relevé différemment ne doit pas faire perdre une page). */
const sansPonctuation = (t: string) => normaliser(t).replace(/[^\p{L}\p{N} ]+/gu, " ").replace(/ +/g, " ").trim();

export type ResultatExtrait = {
  trouve: "exact" | "sans_ponctuation" | "absent";
  /** Position (caractères) dans le texte normalisé, -1 si absent. */
  position: number;
};

export function chercherExtrait(texteNormalise: string, texteSansPonct: string, extrait: string): ResultatExtrait {
  const e = normaliser(extrait).replace(/^\.\.\.|\.\.\.$/g, "").trim();
  if (e.length < 12) return { trouve: "absent", position: -1 };
  const p = texteNormalise.indexOf(e);
  if (p >= 0) return { trouve: "exact", position: p };
  const e2 = sansPonctuation(extrait);
  const p2 = texteSansPonct.indexOf(e2);
  if (p2 >= 0) return { trouve: "sans_ponctuation", position: p2 };
  return { trouve: "absent", position: -1 };
}

export type ResultatPage = {
  url: string;
  joignable: boolean;
  longueur: number;
  extraits_verbatim: number;
  trouves: number;
  /** Trouvés mais au-delà de ce que le juge lit : il ne les verra pas. */
  au_dela_du_juge: number;
};

export function controlerPage(url: string, texteComplet: string | null, extraitsVerbatim: string[], limiteJuge: number): ResultatPage {
  if (!texteComplet) {
    return { url, joignable: false, longueur: 0, extraits_verbatim: extraitsVerbatim.length, trouves: 0, au_dela_du_juge: 0 };
  }
  const n = normaliser(texteComplet);
  const sp = sansPonctuation(texteComplet);
  // Le juge lit les `limiteJuge` premiers caractères BRUTS ; on rapporte la
  // borne au texte normalisé, en proportion (la normalisation raccourcit peu).
  const borne = Math.round(limiteJuge * (n.length / Math.max(1, texteComplet.length)));
  let trouves = 0, auDela = 0;
  for (const x of extraitsVerbatim) {
    const r = chercherExtrait(n, sp, x);
    if (r.trouve === "absent") continue;
    trouves++;
    const limite = r.trouve === "exact" ? borne : Math.round(borne * (sp.length / Math.max(1, n.length)));
    if (r.position > limite) auDela++;
  }
  return { url, joignable: true, longueur: texteComplet.length, extraits_verbatim: extraitsVerbatim.length, trouves, au_dela_du_juge: auDela };
}

// ── SPRINT 23 — fenêtre centrée sur l'extrait (voir verifSource.ts) ────────
export const DEMI_FENETRE = 3_000;
/** Marqueur posé autour des titres de section (h1–h3) à l'extraction. */
export const MARQUE_SECTION = "\u00a7\u00a7";

/** Le texte à soumettre au juge pour un groupe d'extraits localisés : une
 *  fenêtre par extrait, fusionnées si elles se chevauchent, précédées du
 *  titre de page et du titre de section. null si AUCUN extrait n'est retrouvé
 *  (l'appelant retombe alors sur la lecture standard). */
export function texteCentre(page: { titre: string | null; texte: string }, extraits: string[], maxCaracteres = 14_000): string | null {
  // Même longueur en minuscules qu'en casse d'origine : la position trouvée
  // dans la version normalisée vaut dans la version affichée.
  const doux = page.texte.replace(/[‘’‚‛′´`]/g, "'")
    .replace(/[“”„‟«»″]/g, '"').replace(/[‐-―−]/g, "-")
    .replace(/[     ​]/g, " ");
  const bas = doux.toLowerCase();
  const plages: Array<[number, number, number]> = [];
  for (const x of extraits) {
    const n = normaliser(x).replace(/^\.\.\.|\.\.\.$/g, "").trim();
    if (n.length < 12) continue;
    const p = bas.indexOf(n);
    if (p < 0) continue;
    plages.push([Math.max(0, p - DEMI_FENETRE), Math.min(doux.length, p + n.length + DEMI_FENETRE), p]);
  }
  if (plages.length === 0) return null;
  plages.sort((a, b) => a[0] - b[0]);
  const fusion: Array<[number, number, number]> = [];
  for (const pl of plages) {
    const der = fusion[fusion.length - 1];
    if (der && pl[0] <= der[1]) der[1] = Math.max(der[1], pl[1]); else fusion.push([...pl]);
  }
  // Le titre de section est le dernier AVANT L'EXTRAIT (pas avant le début
  // de la fenêtre : il est souvent dans la fenêtre elle-même).
  const blocs = fusion.map(([a, b, p]) => {
    const avant = doux.lastIndexOf(MARQUE_SECTION, p);
    const debutTitre = avant > 0 ? doux.lastIndexOf(MARQUE_SECTION, avant - 1) : -1;
    const section = debutTitre >= 0 ? doux.slice(debutTitre + MARQUE_SECTION.length, avant).trim() : "";
    const corps = doux.slice(a, b).replaceAll(MARQUE_SECTION, " ").replace(/\s+/g, " ").trim();
    return `${section ? `[Section : ${section.slice(0, 160)}]\n` : ""}${a > 0 ? "[…] " : ""}${corps}${b < doux.length ? " […]" : ""}`;
  });
  return `${page.titre ? `[Titre de la page : ${page.titre}]\n` : ""}${blocs.join("\n\n")}`.slice(0, maxCaracteres);
}
