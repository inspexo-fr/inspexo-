// SPRINT 16 — Règles PURES du sourcing de l'atlas.
//
// Séparées de la fonction edge pour être testables hors ligne : le fichier de
// la fonction importe `deno.land`, que Node ne sait pas charger. Même raison
// que pour tous les autres modules purs du projet.

/** L'affirmation soumise au vérificateur : le DÉFAUT, sans le prix.
 *
 * ⚠️ Défaut trouvé à la première campagne (BMW, 4 entrées sur 5 retirées).
 * La description de l'atlas finit souvent par « Coût constaté : 2 500 à
 * 4 500 € ». Soumise telle quelle, l'affirmation devient un paquet : une page
 * qui atteste parfaitement la chaîne de distribution N47 mais ne donne aucun
 * prix est jugée « non soutenue » — et l'entrée disparaît alors qu'elle est
 * l'un des défauts les mieux documentés de la marque.
 *
 * Le coût suit son propre chemin : il n'est retenu que s'il est publié par
 * une page, et il ne décide jamais du sort de l'entrée. */
export function affirmationSansCout(titre: string, description: string): string {
  // Tous les espaces, y compris insécable et fine, entre les chiffres.
  const MONTANT = String.raw`\d[\d\s\u00a0\u202f.,]*\s?(?:€|eur\b|euros?)`;
  const sansPrix = String(description ?? "")
    // « Coût constaté : 2 500 à 4 500€ », « Compter 1 200 € », « coûte 450 EUR »
    .replace(new RegExp(String.raw`(?:co[ûu]te?s?|prix|tarif|budget|compter|facture)[^.]{0,80}?${MONTANT}\.?`, "gi"), " ")
    .replace(new RegExp(MONTANT, "gi"), " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;])/g, "$1")
    .trim();
  return `${String(titre ?? "").trim()}${sansPrix ? ` — ${sansPrix}` : ""}`.slice(0, 500);
}

/** Marqueurs distinctifs d'une entrée : codes (moteur, caisse, boîte) et mots
 *  techniques rares. Une page qui n'en contient AUCUN ne parle pas de ça. */
export function marqueursEntree(titre: string, description: string, models: string): string[] {
  const texte = `${titre} ${description} ${models}`;
  const out = new Set<string>();
  // Codes : N47, EA888, W203, 722.9, 1.2 PureTech, DQ200…
  for (const m of texte.matchAll(/\b([A-Z]{1,3}\d{2,4}[A-Z]?|\d{3}\.\d|\d\.\d\s?[A-Za-zé]{3,})\b/g)) {
    out.add(m[1].toLowerCase());
  }
  // Mots techniques d'au moins 6 lettres, hors mots trop courants.
  const BANAL = new Set([
    "moteur", "moteurs", "vehicule", "vehicules", "probleme", "problemes", "defaut",
    "defauts", "panne", "pannes", "reparation", "constate", "constatee", "coutent",
    "remplacement", "premiere", "premieres", "modeles", "annees", "version", "versions",
  ]);
  for (const m of texte.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").matchAll(/\b([a-z]{6,})\b/g)) {
    if (!BANAL.has(m[1])) out.add(m[1]);
  }
  return [...out];
}

/** La page contient-elle au moins un marqueur distinctif de l'entrée ? */
export function pageParleDeLEntree(textePage: string, marqueurs: string[]): boolean {
  const t = textePage.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  let touches = 0;
  for (const m of marqueurs) if (t.includes(m)) touches += 1;
  return touches >= 2;
}

// ---------------------------------------------------------------------------
// SPRINT 21 — LE RANG D'UNE SOURCE SE DÉDUIT DE SON HÔTE, PAS D'UNE ÉTIQUETTE
// QUE LE MODÈLE S'ATTRIBUE.
// ---------------------------------------------------------------------------
// ⚠️ LE DÉFAUT MESURÉ LE 5 NOVEMBRE 2026. Le sprint 16 avait posé la règle
// « un forum ne porte jamais une entrée seul », et le garde-fou côté serveur
// la faisait respecter : `retenues.filter(r => r.type !== "forum_marque")`.
// Mais `type` est choisi par le MODÈLE, c'est-à-dire par l'étape même qu'on
// prétend contrôler. Résultat, sur la campagne hors moteur :
//   · `autoliva.com` (réparateur de boîtes) classé « presse_auto » ;
//   · `ecutesting.com` (réparateur de mécatroniques) classé « presse_auto » ;
//   · `caroom.fr` (guide d'achat commercial) classé « constructeur_ou_rappel » ;
//   · `la-boite-automatique.com` et `specialiste-bmw.fr` portant les COÛTS,
//     donc la gravité — et un coût de réparateur poussait quatre entrées en
//     « casse », qui plafonne le score.
// Et la même famille de sites était citée, ailleurs dans la même campagne,
// comme MOTIF DE RETRAIT. Le jugement n'était donc pas reproductible.
//
// C'est la leçon du sprint 11 (`estAppelApi` exige les DEUX facteurs) : un
// garde-fou ne peut pas reposer sur une valeur que l'appelant choisit.
//
// ⚠️ LE DÉFAUT EST « COMMERCIAL ». Un hôte inconnu ne porte pas une entrée.
// La liste blanche est donc la chose à maintenir à la main — comme
// `brandAliases` et `famillesMoteur`, et pour la même raison : on ne déclare
// pas une source de rang 1 ou 2 qui n'est pas attestée.

/** Hôtes officiels : constructeurs, autorités, bases de rappels. */
const HOTES_OFFICIELS = [
  "nhtsa.gov", "static.nhtsa.gov", "europa.eu", "rappel.conso.gouv.fr",
  "economie.gouv.fr", "securite-routiere.gouv.fr", "ecologie.gouv.fr",
  "service-public.fr", "service-public.gouv.fr", "utac.com", "ademe.fr",
  "vehicle-recalls.service.gov.uk", "kba.de", "transportstyrelsen.se",
];

/** Presse automobile et consumériste RECONNUE. Liste curée, à enrichir à la
 *  main : chaque ajout est une décision, pas un héritage. */
const HOTES_PRESSE = [
  "largus.fr", "caradisiac.com", "autoplus.fr", "auto-moto.com",
  "lautomobile-magazine.fr", "automobile-magazine.fr", "turbo.fr",
  "challenges.fr", "lesnumeriques.com", "quechoisir.org", "ufcquechoisir.org",
  "60millions-mag.com", "autonews.fr", "moniteurautomobile.be",
  "lavoixdunord.fr", "lemonde.fr", "lesechos.fr", "francetvinfo.fr",
  "autocar.co.uk", "whatcar.com", "honestjohn.co.uk", "drive.com.au",
  "motor1.com", "autoexpress.co.uk", "autobild.de", "adac.de",
  "consumerreports.org", "jdpower.com",
  // ⚠️ Ajouté le 6 nov. 2026 sur décision d'Utku, après examen des 14 hôtes
  // que le filtre écartait. C'est le SEUL des quatorze reclassé : publication
  // automobile américaine établie, rédaction identifiée.
  //
  // ⚠️ Et il ne sauve RIEN — l'entrée Ford PowerShift tenait déjà par une note
  // technique NHTSA. C'est précisément pour cela qu'il pouvait être ajouté :
  // la liste grandit par décision sur ce QU'EST la source, jamais pour
  // rattraper une campagne. `autoliva.com` et `la-boite-automatique.com`
  // auraient sauvé trois entrées ; ils restent commerciaux.
  "carbuzz.com",
];

/** Forums et agrégateurs de discussion : EN APPUI SEULEMENT (sprint 16). */
const MOTIFS_FORUM = [
  /forum/i, /\bplanete-/i, /forumactif/i, /reddit\.com/i, /discord/i,
  /\bclub\b/i, /\.proboards\./i, /vbulletin/i, /quora\.com/i,
  // ⚠️ Ajoutés le 6 nov. 2026. Le motif `\bclub\b` ne couvrait pas
  // « toyotaownersclub.com » (pas de frontière de mot avant « club »), et
  // « communaute.dacia.fr » ne contenait aucun des motifs : quatre sites
  // communautaires tombaient donc dans « commercial ». Le COMPORTEMENT était
  // juste — ni l'un ni l'autre ne porte une entrée — mais l'ÉTIQUETTE était
  // fausse, et c'est elle qu'un humain relit dans le motif d'un retrait.
  // Appeler « commercial » le club des propriétaires Toyota est inexact.
  /ownersclub/i, /owners-club/i, /communaute/i, /community/i, /\bcamping\b/i,
];

/** Hôtes communautaires repérés à l'usage, que les motifs ne capturent pas.
 *  Liste d'OBSERVATION : elle grandit quand une campagne en rencontre un. */
const HOTES_COMMUNAUTE = ["c5x7.fr", "wildcamping.co.uk"];

export type RangSource = "officiel" | "presse" | "forum" | "commercial";

/** Le rang d'une source, déduit de son hôte.
 *
 *  ⚠️ « commercial » est le DÉFAUT, et c'est volontaire : un hôte inconnu ne
 *  peut pas porter une entrée. Un garage, un vendeur de pièces ou un site de
 *  contenu référencé ont tout intérêt à décrire un défaut — leur page n'est
 *  pas une attestation, c'est une offre. */
export function rangSource(url: unknown): RangSource {
  let hote = "";
  try {
    hote = new URL(String(url)).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "commercial";
  }
  const correspond = (liste: string[]) =>
    liste.some((h) => hote === h || hote.endsWith(`.${h}`));
  if (correspond(HOTES_OFFICIELS)) return "officiel";
  // ⚠️ L'ordre compte : `forum-auto.caradisiac.com` est un FORUM, pas la
  // presse, même si le domaine racine est un titre reconnu.
  if (MOTIFS_FORUM.some((re) => re.test(hote))) return "forum";
  if (correspond(HOTES_COMMUNAUTE)) return "forum";
  if (correspond(HOTES_PRESSE)) return "presse";
  return "commercial";
}

/** Une entrée tient-elle sur ses sources ?
 *
 *  Il lui faut au moins UNE source de rang officiel ou presse. Forums et sites
 *  commerciaux ne viennent qu'en appui — ils peuvent préciser, jamais porter. */
export function sourcesPortentLEntree(urls: readonly unknown[]): boolean {
  return urls.some((u) => {
    const r = rangSource(u);
    return r === "officiel" || r === "presse";
  });
}

/** Un COÛT publié par un site commercial ne fixe pas la gravité.
 *
 *  ⚠️ Quatre entrées de la campagne hors moteur ont été portées en « casse »
 *  par des fourchettes affichées sur des pages de réparateurs. Or « casse »
 *  plafonne le score : le tarif d'un garage aurait poussé un verdict vers le
 *  rouge. Un prix sur une page qui vend la réparation est une offre, pas un
 *  relevé. */
export function coutUtilisable(urls: readonly unknown[]): boolean {
  return urls.some((u) => {
    const r = rangSource(u);
    return r === "officiel" || r === "presse";
  });
}
