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
