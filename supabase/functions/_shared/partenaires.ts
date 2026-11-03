// SPRINT 10 — Partenaires assurance et crédit : RÈGLES LÉGALES, module PUR.
//
// Inspexo n'est ni courtier ni intermédiaire en opérations de banque : sans
// immatriculation ORIAS, son rôle se limite à celui d'INDICATEUR — mettre en
// relation, rien de plus. Tout ce qui ressemblerait à du conseil, à une
// comparaison ou à une description de contrat nous ferait basculer dans une
// activité réglementée. Ce module rend cette frontière VÉRIFIABLE : un texte
// de partenaire ne peut pas être enregistré s'il la franchit.
//
// Ce qu'on refuse, et pourquoi :
//  - ASSURANCE (garantie panne) : aucun contenu de contrat. Ni couverture, ni
//    prix, ni franchise, ni plafond, ni comparaison. On ne dit jamais qu'une
//    panne « serait couverte » — et aucun lien, textuel ou visuel, n'est fait
//    entre les pannes détectées par l'analyse et la garantie.
//  - CRÉDIT : statut d'indicateur (art. R519-2 CMF). Ni simulateur, ni
//    mensualité, ni taux, ni calcul de capacité d'emprunt. La mention légale
//    de l'art. L312-5 du code de la consommation est OBLIGATOIRE, et les
//    arguments de facilité ou de rapidité sont interdits.
//
// Fonctions pures, testées hors ligne : tests/partenaires.test.mjs.

export type TypePartenaire = "assurance" | "credit";

/** Mention légale obligatoire de toute communication sur un crédit
 *  (art. L312-5 du code de la consommation, rédaction en vigueur au
 *  20/11/2026 — ordonnance 2025-880). Elle s'affiche À CÔTÉ du lien, de
 *  façon lisible, jamais en note de bas de page. */
export const MENTION_CREDIT =
  "Attention ! Un crédit coûte de l'argent et doit être remboursé";

/** Entrée en vigueur de la rédaction applicable : aucun partenaire de type
 *  crédit ne peut être activé avant cette date. */
export const CREDIT_ACTIVABLE_LE = "2026-11-20";

/** Comparaison insensible à la casse, aux accents, aux apostrophes typo-
 *  graphiques et aux espaces multiples. */
export const normaliserTexte = (t: unknown): string =>
  String(t ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‘’ʼ´`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

const MENTION_CREDIT_NORM = normaliserTexte(MENTION_CREDIT);

/** Le texte porte-t-il la mention légale crédit ? (tolère l'espace avant le
 *  point d'exclamation et les variantes d'apostrophe). */
export function contientMentionCredit(texte: unknown): boolean {
  // « Attention ! », « Attention! » et « Attention  !  » doivent tous passer :
  // on ramène le point d'exclamation à une forme unique des deux côtés.
  const uniformiser = (t: string) => t.replace(/\s*!\s*/g, "! ").trim();
  return uniformiser(normaliserTexte(texte)).includes(uniformiser(MENTION_CREDIT_NORM));
}

/** Motif tolérant qui reconnaît la mention légale, quelles que soient la
 *  casse, les accents, l'apostrophe et l'espace avant le point d'exclamation. */
const MENTION_CREDIT_RE =
  /attention\s*!\s*un cr[ée]dit co[uû]te de l['’ʼ´`]argent et doit [eê]tre rembours[ée]\s*\.?/gi;

/** Le texte du partenaire SANS la mention légale.
 *
 *  Pourquoi : la mention est obligatoire DANS le texte validé (c'est ainsi
 *  qu'on vérifie qu'elle existe), mais elle doit s'afficher à sa place — en
 *  évidence à côté du lien, pas noyée dans le paragraphe. L'afficher aux deux
 *  endroits la banaliserait ; ne l'afficher que dans le paragraphe la
 *  rendrait moins lisible. On la retire donc du corps et on la réaffiche
 *  seule. */
export function texteSansMentionCredit(texte: unknown): string {
  return String(texte ?? "").replace(MENTION_CREDIT_RE, " ").replace(/\s{2,}/g, " ").trim();
}

type Interdit = { motif: string; test: RegExp };

// Interdits COMMUNS aux deux types : tout ce qui ressemble à un chiffre
// commercial ou à une comparaison.
const INTERDITS_COMMUNS: Interdit[] = [
  { motif: "un pourcentage ou un taux", test: /%|\btaux\b|\btaeg\b|\bteg\b/ },
  { motif: "un montant en euros", test: /€|\beuros?\b/ },
  { motif: "une comparaison ou un superlatif commercial", test: /\bmeilleur\w*\b|\bmoins cher\w*\b|\bcompar\w+\b|\ble plus \w+\b|\bimbattable\b|\bn°\s?1\b/ },
  { motif: "une promesse de résultat", test: /\bgaranti\b(?!e)|\bassur[ée] d'obtenir\b|\b100\s?%/ },
];

// Interdits propres à l'ASSURANCE : aucun contenu de contrat.
const INTERDITS_ASSURANCE: Interdit[] = [
  { motif: "une description de couverture", test: /\bcouvre\b|\bcouvert\w*\b|\bcouvertur\w+\b|\bpris\w* en charge\b|\bprise en charge\b|\bindemnis\w+\b/ },
  { motif: "un élément de contrat (franchise, plafond, exclusion, durée)", test: /\bfranchise\b|\bplafond\w*\b|\bexclusion\w*\b|\bdelai de carence\b|\bcarence\b/ },
  { motif: "une liste de pièces ou d'organes garantis", test: /\bmoteur\b|\bboite de vitesses\b|\bembrayage\b|\bturbo\b|\bdistribution\b|\binjecteur\w*\b/ },
  { motif: "un lien avec les pannes détectées", test: /\bcette panne\b|\bvos pannes\b|\bles pannes detectees\b|\bserait couvert\w*\b|\bce defaut\b/ },
];

// Interdits propres au CRÉDIT : ni chiffrage, ni argument de facilité.
const INTERDITS_CREDIT: Interdit[] = [
  { motif: "une mensualité ou une échéance", test: /\bmensualit\w+\b|\b\/\s?mois\b|\bpar mois\b|\becheanc\w+\b|\bremboursement mensuel\b/ },
  { motif: "une durée de prêt", test: /\bsur \d+ (mois|ans?)\b|\bduree du (credit|pret)\b|\ben \d+ (mensualites|fois)\b/ },
  { motif: "un simulateur ou un calcul de capacité d'emprunt", test: /\bsimul\w+\b|\bcalcul\w+\b|\bcapacite d'emprunt\b|\bestim\w+ votre\b/ },
  { motif: "un montant empruntable", test: /\bjusqu'a \d/ },
  // Demandé explicitement : aucun argument de facilité ou de rapidité.
  { motif: "un argument de facilité ou de rapidité", test: /\brapid\w*\b|\bfacil\w*\b|\bimmediat\w*\b|\ben quelques minutes\b|\bsans justificatif\w*\b|\baccord garanti\b|\breponse immediate\b|\bsimple et\b|\ben 2 clics\b|\bsans paperasse\b/ },
];

export type Verification = { ok: boolean; motifs: string[] };

/** Un texte de partenaire est-il publiable ?
 *
 *  La mention légale crédit est RETIRÉE avant l'analyse des interdits : elle
 *  contient « doit être remboursé », qui serait sinon pris pour une promesse
 *  de prise en charge. */
export function verifierTextePartenaire(
  type: TypePartenaire,
  texte: unknown,
): Verification {
  const motifs: string[] = [];
  const brut = String(texte ?? "").trim();
  if (brut.length < 20) {
    return { ok: false, motifs: ["le texte est vide ou trop court (20 caractères minimum)"] };
  }
  if (brut.length > 600) {
    motifs.push("le texte dépasse 600 caractères");
  }

  let t = normaliserTexte(brut);
  if (type === "credit") {
    if (!contientMentionCredit(brut)) {
      motifs.push(
        `la mention légale obligatoire est absente : « ${MENTION_CREDIT} » (art. L312-5 du code de la consommation)`,
      );
    }
    // Retirée de l'analyse : elle est imposée par la loi, pas rédigée par nous.
    // On retire toutes les variantes d'espacement du point d'exclamation.
    t = t.replace(/attention\s*!\s*un credit coute de l'argent et doit etre rembourse/g, " ");
  }

  const regles = [
    ...INTERDITS_COMMUNS,
    ...(type === "assurance" ? INTERDITS_ASSURANCE : INTERDITS_CREDIT),
  ];
  for (const r of regles) {
    if (r.test.test(t)) motifs.push(`le texte contient ${r.motif}`);
  }
  return { ok: motifs.length === 0, motifs };
}

/** Un partenaire de ce type peut-il être activé aujourd'hui ?
 *  `aujourdhui` au format AAAA-MM-JJ (comparaison lexicographique sûre). */
export function peutActiver(
  type: TypePartenaire,
  aujourdhui: string,
): Verification {
  if (type === "credit" && aujourdhui < CREDIT_ACTIVABLE_LE) {
    return {
      ok: false,
      motifs: [
        `un partenaire crédit ne peut pas être activé avant le ${
          CREDIT_ACTIVABLE_LE.split("-").reverse().join("/")
        } (entrée en vigueur de la rédaction applicable de l'art. R519-2 CMF)`,
      ],
    };
  }
  return { ok: true, motifs: [] };
}

// ---------------------------------------------------------------------------
// Comptage des mises en relation : brut et net.
//
// « Brut » = tout ce qui a frappé /go/. « Net » = ce qui ressemble à un
// humain : robots écartés, et au plus UNE mise en relation par dossier, par
// partenaire et par jour. C'est le net qu'on regarde pour juger de l'intérêt
// réel, le brut qu'on garde pour voir si quelque chose cloche.
// ---------------------------------------------------------------------------

const ROBOTS = [
  "bot", "crawler", "spider", "slurp", "curl", "wget", "python-requests",
  "httpclient", "headlesschrome", "phantomjs", "scrapy", "axios", "okhttp",
  "go-http-client", "java/", "libwww", "scanner", "archive.org_bot",
  "preview", "monitor", "uptime", "pingdom", "lighthouse",
  // Agents d'APERÇU DE LIEN : ils suivent l'URL dès qu'elle est partagée,
  // sans qu'aucun humain n'ait cliqué. Même liste que la réécriture Open
  // Graph de vercel.json, qui les reconnaît déjà pour /a/:id.
  "facebookexternalhit", "facebookcatalog", "facebot", "whatsapp", "telegram",
  "discord", "linkedin", "twitter", "skype", "pinterest", "vkshare",
  "imessage", "slack", "applebot", "embedly", "quora link preview",
];

/** Un user-agent de robot, d'aperçu de lien ou d'outil en ligne de commande.
 *  Un user-agent ABSENT est traité comme un robot : un navigateur en envoie
 *  toujours un. */
export function estRobot(userAgent: unknown): boolean {
  const ua = String(userAgent ?? "").toLowerCase().trim();
  if (!ua) return true;
  return ROBOTS.some((r) => ua.includes(r));
}

/** Clé de déduplication : un dossier, un partenaire, un jour.
 *  Sans dossier (consultation hors analyse), on retombe sur l'empreinte IP
 *  pour ne pas compter cent fois le même visiteur. */
export function cleDedup(
  partenaireId: string,
  analysisId: string | null,
  ipHash: string | null,
  horodatage: Date,
): string {
  const jour = horodatage.toISOString().slice(0, 10);
  return `${partenaireId}|${analysisId ?? `ip:${ipHash ?? "inconnu"}`}|${jour}`;
}

/** Compte net d'une liste de mises en relation déjà filtrée par partenaire. */
export function compterNet(
  lignes: Array<{ analysis_id: string | null; ip_hash: string | null; created_at: string; robot: boolean }>,
  partenaireId: string,
): number {
  const vues = new Set<string>();
  for (const l of lignes) {
    if (l.robot) continue;
    vues.add(cleDedup(partenaireId, l.analysis_id, l.ip_hash, new Date(l.created_at)));
  }
  return vues.size;
}

// ---------------------------------------------------------------------------
// Ce qui s'affiche à l'écran.
// ---------------------------------------------------------------------------

/** Phrase imposée au-dessus du lien d'inspection quand le verdict est ROUGE :
 *  l'inspection reste proposée, mais jamais comme l'action à faire d'abord. */
export const PREALABLE_ROUGE =
  "Demandez d'abord au vendeur la preuve écrite qui lève le point rouge. " +
  "Si elle tient, l'inspection vérifie le reste.";

/** Verdicts pour lesquels un partenaire peut apparaître. Le rouge n'y est
 *  PAS : on n'aide pas à acheter une voiture classée rouge. */
export const VERDICTS_PARTENAIRES = ["vert", "orange"] as const;

export function partenairesAffichables(verdict: unknown): boolean {
  return (VERDICTS_PARTENAIRES as readonly string[]).includes(String(verdict ?? ""));
}
