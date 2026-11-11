// ============================================================
// Statut du vendeur — règles DÉTERMINISTES (sprint 23, étape a2)
// ============================================================
// Mesuré le 11 nov. 2026 : sur trois analyses du MÊME texte (S7 vendue par
// une agence), le modèle a répondu deux fois « intermédiaire pour
// particulier » et une fois « pro déguisé probable ». Or « pro déguisé » est
// une ACCUSATION : elle ne doit jamais sortir d'une variance.
//
// Règles (décision d'Utku du 11 nov. 2026) :
//   1. L'annonce dit vendre pour le compte d'un particulier (agence,
//      dépôt-vente, mandataire, courtier, « pour le compte de… ») ⇒
//      « intermediaire_pour_particulier », quoi qu'ait dit le modèle.
//      Une agence qui se dit agence ne se déguise pas : la règle 1 passe
//      AVANT la règle 2.
//   2. « pro_deguise_probable » exige que le vendeur SE PRÉSENTE comme
//      particulier (écrit dans l'annonce, ou type transmis par la
//      plateforme) ET :
//        - un indice FORT (SIRET/SIREN, autres annonces, plusieurs véhicules),
//        - ou au moins DEUX indices faibles DISTINCTS (« nos véhicules »,
//          « notre parc », « reprise possible », « financement possible »,
//          « frais de dossier »).
//      Un seul indice faible : le statut reste « particulier » et l'indice
//      devient une QUESTION au vendeur. Sans présentation en particulier :
//      jamais d'accusation.
//   3. Le modèle ne peut plus poser « pro déguisé » seul : sans les
//      conditions de la règle 2, il retombe en « particulier ».
//   4. « particulier » contre « pro » reste au modèle : aucune accusation
//      n'est en jeu.
//
// Module PUR : aucun import, testé hors ligne (tests/statut-vendeur.test.mjs).

export type StatutVendeur =
  | "particulier"
  | "pro"
  | "intermediaire_pour_particulier"
  | "pro_deguise_probable";

export type Indice = { force: "fort" | "faible" | "intermediaire"; libelle: string; extrait: string };

export type DecisionStatut = {
  statut: StatutVendeur;
  /** Extraits affichés à l'acheteur (jamais d'accusation sans eux). */
  indices: string[];
  /** Question au vendeur quand un indice existe sans fonder d'accusation. */
  question: string | null;
  /** Écart avec la réponse du modèle, pour la traçabilité. */
  ecart: null | "intermediaire_impose" | "pro_deguise_ecarte" | "pro_deguise_pose";
  se_dit_particulier: boolean;
};

const STATUTS: StatutVendeur[] = ["particulier", "pro", "intermediaire_pour_particulier", "pro_deguise_probable"];

/** Minuscules, sans accents, apostrophes et espaces unifiés. */
export function normaliserTexte(t: string): string {
  return (t ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’`´]/g, "'")
    .replace(/[  ]/g, " ");
}

// Une mention niée ou refusée ne vaut rien : « agences s'abstenir »,
// « pas de mandataire », « sans reprise ». Les particuliers écrivent souvent
// ces phrases — sans ce garde-fou, la règle 1 les traiterait en agence.
const NEGATION_AVANT = /(?:\bpas\s+(?:d'|de\s+|du\s+|des\s+)|\bsans\s+|\bni\s+|\baucune?\s+|\bnon\s+|\bjamais\s+|\bexclu\w*\s+|\brefus\w*\s+)(?:\S+\s+){0,2}$/;
const NEGATION_APRES = /^[^.!?\n]{0,60}?(?:s'?\s?abstenir|abstenez|ne\s+(?:pas\s+)?(?:me\s+|nous\s+)?(?:contacter|deranger|appeler)|pas\s+(?:de\s+)?demarch|non\s+merci|merci\s+de\s+passer)/;

function nie(n: string, debut: number, fin: number): boolean {
  // La négation ne franchit pas une fin de phrase : « Pas de reprise. Voir
  // mes autres annonces » ne nie pas les autres annonces.
  const avant = n.slice(Math.max(0, debut - 30), debut).split(/[.!?;\n]/).pop() ?? "";
  const apres = n.slice(fin, fin + 80);
  return NEGATION_AVANT.test(avant) || NEGATION_APRES.test(apres);
}

/** Extrait lisible (≤ 12 mots) autour d'une correspondance, pris dans le texte ORIGINAL. */
function extraitAutour(original: string, debut: number, fin: number): string {
  const avant = original.slice(0, debut);
  const s = Math.max(avant.lastIndexOf("\n"), avant.lastIndexOf("."), avant.lastIndexOf("!"), avant.lastIndexOf("?")) + 1;
  const reste = original.slice(fin);
  const e = reste.search(/[.!?\n]/);
  let phrase = original.slice(s, e === -1 ? original.length : fin + e).trim()
    // Jamais de coordonnée ni d'identifiant en clair (même règle que
    // nettoyerCitationVendeur) : liens, emails, suites de ≥ 9 chiffres.
    .replace(/(https?:\/\/|www\.)\S+/gi, "")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]{2,}/g, "")
    .replace(/[+\d][\d\s.\-()]{6,}\d/g, (m) => ((m.match(/\d/g) ?? []).length >= 9 ? "" : m))
    .replace(/\s+([,;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
  const mots = phrase.split(/\s+/).filter(Boolean);
  if (mots.length > 12) phrase = mots.slice(0, 12).join(" ") + "…";
  return phrase;
}

type Motif = { libelle: string; re: RegExp; force: Indice["force"] };

const MOTIFS_INTERMEDIAIRE: Motif[] = [
  { libelle: "agence", re: /\bagences?\b(?!\s+(?:de\s+voyage|immobili|bancaire|postale|de\s+communication))/g, force: "intermediaire" },
  { libelle: "dépôt-vente", re: /\bdepots?[\s-]+ventes?\b/g, force: "intermediaire" },
  { libelle: "mandataire", re: /\bmandataires?\b/g, force: "intermediaire" },
  { libelle: "mandat de vente", re: /\b(?:mandat\s+de\s+vente|sous\s+mandat)\b/g, force: "intermediaire" },
  { libelle: "courtier", re: /\bcourtiers?\b/g, force: "intermediaire" },
  { libelle: "pour le compte d'un tiers", re: /\bpour\s+le\s+compte\s+(?:d'|de\s+)(?:un\s+|une\s+|mon\s+|notre\s+|nos\s+)?(?:client|particulier|proprietaire|mandant)/g, force: "intermediaire" },
];

const MOTIFS_PRO: Motif[] = [
  { libelle: "SIRET", re: /\bsir(?:et|en)\b/g, force: "fort" },
  { libelle: "autres annonces", re: /\b(?:voir|consulte[rz]?|decouvre[rz]?|retrouve[rz]?)\s+(?:mes|nos|toutes?\s+(?:mes|nos))\s+autres\s+annonces\b/g, force: "fort" },
  { libelle: "plusieurs véhicules", re: /\b(?:plusieurs|autres|d'autres)\s+(?:vehicules|voitures|modeles)\s+(?:disponibles|en\s+vente|en\s+stock|a\s+vendre)\b|\bplus\s+de\s+\d[\d\s.]*\s+(?:vehicules|voitures)\b/g, force: "fort" },
  { libelle: "« nos véhicules »", re: /\bnos\s+(?:vehicules|voitures|occasions)\b/g, force: "faible" },
  { libelle: "« notre parc »", re: /\bnotre\s+parc\b/g, force: "faible" },
  { libelle: "reprise possible", re: /\breprise\s+(?:possible|acceptee|de\s+votre\s+(?:vehicule|vehicule)|de\s+votre\s+voiture)\b/g, force: "faible" },
  { libelle: "financement possible", re: /\b(?:financement|credit)\s+(?:possible|disponible|sur\s+mesure|personnalise)\b/g, force: "faible" },
  { libelle: "frais de dossier", re: /\bfrais\s+de\s+dossier\b/g, force: "faible" },
];

function chercher(original: string, motifs: Motif[]): Indice[] {
  const n = normaliserTexte(original);
  // L'extrait se prend dans l'original en NFC : une lettre accentuée y est UN
  // caractère, comme sa forme sans accent dans n — les positions coïncident.
  const aligne = (original ?? "").normalize("NFC");
  const trouves: Indice[] = [];
  for (const m of motifs) {
    m.re.lastIndex = 0;
    let r: ReturnType<RegExp["exec"]>;
    while ((r = m.re.exec(n)) !== null) {
      if (nie(n, r.index, r.index + r[0].length)) continue;
      trouves.push({ force: m.force, libelle: m.libelle, extrait: extraitAutour(aligne, r.index, r.index + r[0].length) });
      break; // une occurrence par motif suffit
    }
  }
  return trouves;
}

export const indicesIntermediaire = (t: string) => chercher(t, MOTIFS_INTERMEDIAIRE);
export const indicesPro = (t: string) => chercher(t, MOTIFS_PRO);

// Se présenter comme particulier : formes EXPLICITES seulement. Conservateur
// à dessein — moins on le reconnaît, moins on accuse.
const SE_DIT_PARTICULIER = [
  /type de vendeur affiche par le site\s*:\s*particulier\b/,
  /\bvente\s+(?:entre|de|d'un|par\s+un)\s+particuliers?\b/,
  /\b(?:je\s+suis|en\s+tant\s+que|vendeur|vendu\s+par\s+un)\s+(?:un\s+)?particulier\b/,
  /\bparticulier\s+vend\b/,
  /(?:^|\n)\s*(?:vendeur\s*:\s*)?particulier\s*(?:\n|$)/,
];

export function seDitParticulier(t: string): boolean {
  const n = normaliserTexte(t);
  // Un type « professionnel » transmis par la plateforme l'emporte.
  if (/type de vendeur affiche par le site\s*:\s*pro/.test(n)) return false;
  return SE_DIT_PARTICULIER.some((re) => re.test(n));
}

export function questionIndice(indices: Indice[]): string {
  const cites = indices.slice(0, 2).map((i) => `« ${i.extrait} »`).join(" et ");
  return `L'annonce mentionne ${cites} : vendez-vous ce véhicule à titre personnel ? La carte grise est-elle à votre nom ?`;
}

export function deciderStatut(texte: string, statutModele: unknown): DecisionStatut {
  const modele: StatutVendeur = STATUTS.includes(statutModele as StatutVendeur)
    ? (statutModele as StatutVendeur)
    : "particulier";
  const particulier = seDitParticulier(texte);

  // Règle 1 — intermédiaire déclaré.
  const inter = indicesIntermediaire(texte);
  if (inter.length > 0) {
    return {
      statut: "intermediaire_pour_particulier",
      indices: inter.map((i) => i.extrait),
      question: null,
      ecart: modele === "intermediaire_pour_particulier" ? null : "intermediaire_impose",
      se_dit_particulier: particulier,
    };
  }

  const pro = indicesPro(texte);
  const forts = pro.filter((i) => i.force === "fort");
  const faibles = pro.filter((i) => i.force === "faible");
  const faiblesDistincts = new Set(faibles.map((i) => i.libelle)).size;
  const fonde = forts.length > 0 || faiblesDistincts >= 2;

  // Règle 4 — « pro » reste au modèle.
  if (modele === "pro") {
    return { statut: "pro", indices: pro.map((i) => i.extrait), question: null, ecart: null, se_dit_particulier: particulier };
  }

  // Règle 2 — pro déguisé, uniquement sur indices nommés.
  if (particulier && fonde) {
    const retenus = [...forts, ...faibles];
    return {
      statut: "pro_deguise_probable",
      indices: retenus.map((i) => `${i.libelle} : « ${i.extrait} »`),
      question: null,
      ecart: modele === "pro_deguise_probable" ? null : "pro_deguise_pose",
      se_dit_particulier: true,
    };
  }

  // Règle 3 — le modèle ne pose pas l'accusation seul.
  const statut: StatutVendeur = modele === "pro_deguise_probable" ? "particulier" : modele;
  return {
    statut,
    indices: [],
    question: pro.length > 0 ? questionIndice(pro) : null,
    ecart: modele === "pro_deguise_probable" ? "pro_deguise_ecarte" : null,
    se_dit_particulier: particulier,
  };
}
