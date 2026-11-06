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
  // Relevés dans les fiches le 6 nov. 2026.
  "recalls-rappels.canada.ca",
  // ⚠️ LE SITE D'UN CONSTRUCTEUR EST LA SOURCE LA PLUS FORTE QUI EXISTE pour
  // un défaut de ses propres véhicules, et le critère d'Utku l'explique :
  // « son revenu dépend-il de ce que le défaut soit réel et réparé ? » — un
  // constructeur a l'intérêt EXACTEMENT INVERSE. Quand il reconnaît un
  // défaut, il le reconnaît contre lui-même.
  "ford.com", "dacia.fr", "renault.fr", "peugeot.fr", "citroen.fr",
  "volkswagen.fr", "audi.fr", "bmw.fr", "mercedes-benz.fr", "toyota.fr",
  "opel.fr", "fiat.fr", "nissan.fr", "volvocars.com", "hyundai.fr",
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
  // Relevés dans les fiches le 6 nov. 2026 : titres établis, revenu
  // publicitaire, aucune vente de réparation.
  "thedrive.com", "slashgear.com", "larevueautomobile.com",
  // ⚠️ `bmwblog.com` porte « blog » dans son nom mais c'est un titre avec une
  // rédaction suivie, financé par la publicité. Jugement, pas relevé.
  "bmwblog.com",
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

/** ÉDITORIAL INDÉPENDANT (décision d'Utku, 6 nov. 2026) : un guide ou un média
 *  qui ne vend NI la réparation, NI des pièces, NI des moteurs, NI un service
 *  payant lié au défaut. Rang intermédiaire entre la presse et le forum : ces
 *  sites n'ont pas de rédaction au sens d'un titre de presse, mais leur revenu
 *  ne dépend pas de ce que le défaut soit réel et réparé.
 *
 *  ⚠️ C'EST CE CRITÈRE QUI TRANCHE, PAS LES BOUTONS DE LA PAGE. Sondés le
 *  6 nov. 2026, `largus.fr` affiche panier, prix, abonnement et forum — et
 *  reste de la presse. La question n'est pas « vend-il quelque chose », c'est
 *  « son revenu dépend-il du défaut qu'il décrit ». */
const HOTES_EDITORIAL = [
  // Arrêté par Utku le 6 nov. 2026 : éditeur identifiable, contenu
  // rédactionnel, ne vend pas la réparation.
  "fiches-auto.fr", "pistonheads.com", "planeterenault.com", "drivisual.tv",
  // ⚠️ Données d'enquêtes de propriétaires, fondateur identifié. Sa page
  // d'accueil était en 403 au sondage du 6 nov. 2026 : le rang est donc un
  // jugement, pas un relevé. Et la règle d'Utku s'applique — si la page
  // CITÉE ne peut pas être lue, la panne ne passe pas (`pageLisible`).
  "truedelta.com",
];

/** COMPILATION : agrège des forums, éditeur NON identifié.
 *
 *  ⚠️ APPUI SEULEMENT — il ne porte jamais une panne seul. Un site qui
 *  rassemble des fils de discussion sans rédaction identifiable ne vaut pas
 *  mieux que les fils qu'il rassemble ; il les rend seulement plus lisibles.
 *
 *  ⚠️ `docteurmoteurs.com` est ici, et c'est LA décision qui pèse le plus de
 *  tout ce classement : 47 citations dans les fiches, seule source 10 fois.
 *  Son passage d'« éditorial » à « compilation » fait tomber à lui seul une
 *  grande partie des pannes de fiches. */
const HOTES_COMPILATION = [
  "docteurmoteurs.com", "mymotorlist.com", "enginescope.gr",
  // Même famille, relevé dans les fiches : fiches techniques et « problems »
  // sans rédaction identifiable.
  "motorreviewer.com", "cararac.com", "mywikimotors.com",
];

/** ⚠️ MOTIFS DE VENTE — une RÈGLE, pas une liste d'affirmations.
 *
 *  Les 93 hôtes de la longue traîne n'ont pas été étiquetés un par un : les
 *  nommer « vendeur » sans avoir lu leur page serait affirmer qu'ils vendent
 *  quelque chose. Or `vendeur`, `forum`, `compilation` et `inconnu` ont
 *  EXACTEMENT le même effet — aucun ne porte une panne, aucun ne chiffre une
 *  gravité. Étiqueter n'aurait donc rien changé, sinon prêter une affirmation
 *  de plus à chacun.
 *
 *  Ces motifs-ci sont différents : ils reconnaissent une règle d'écriture, pas
 *  un site. Un domaine qui contient « garage », « pieces » ou « reconditioned »
 *  dit lui-même ce qu'il fait. Vérifié qu'aucun hôte portant n'est attrapé. */
const MOTIFS_VENDEUR = [
  /\bgarage/i, /pieces/i, /[-.]parts\b/i, /\bautodoc\b/i, /rachat/i,
  /\bcasse-/i, /reconditioned/i, /used-?engine/i, /occasion-moteur/i,
  /\bdevis\b/i, /carrosserie/i, /\bpneu/i,
];

/** ⚠️ EXPLICITEMENT LAISSÉS « INCONNU », et c'est une décision, pas un oubli.
 *
 *  · `ford.oemdtc.com` : un tiers qui REPUBLIE des bulletins constructeur ne
 *    vaut pas le bulletin d'origine. Le bulletin, lui, est à chercher chez le
 *    constructeur ou la NHTSA — c'est une consigne de la campagne de
 *    re-sourcing, pas un rang à accorder au miroir.
 *  · `autos.yahoo.com` : un portail qui republie la presse d'autrui. On cite
 *    l'article d'origine, jamais le portail.
 *
 *  Les nommer ici ne change pas leur rang — `inconnu` est le défaut — mais
 *  empêche qu'on les reclasse un jour sans retrouver le raisonnement.
 *  (Décisions d'Utku, 6 nov. 2026.) */
const HOTES_INCONNU_ASSUME = ["oemdtc.com", "autos.yahoo.com", "yahoo.com"];

/** HORS SUJET : un hôte qui n'a rien à voir avec le sujet d'une fiche moteur.
 *
 *  ⚠️ `uvoz.info` est un site bosnien sur l'IMPORT de véhicules en
 *  Bosnie-Herzégovine, et il était seule source de trois pannes. Ce n'est pas
 *  un problème de classement, c'est un problème de ce que la génération de
 *  fiches a accepté — traité à la racine : `sheet-builder` et `atlas-builder`
 *  appliquent désormais `rangSource` AVANT d'accepter une source. */
const HOTES_HORS_SUJET = ["uvoz.info"];

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

/** ⚠️ UN FIL DE FORUM VIT SOUVENT DANS LE CHEMIN, PAS DANS LE SOUS-DOMAINE.
 *  `planeterenault.com/forum/sujet-123`, `fiches-auto.fr/forum/...`,
 *  `pistonheads.com/gassing/topic/...` : sans ces motifs, un fil de discussion
 *  hébergé par un site éditorial PORTERAIT une affirmation, ce qui annulerait
 *  la règle du sprint 16.
 *
 *  Trouvé le 6 nov. 2026 par un contrôle qui contredisait mon propre
 *  commentaire : j'avais écrit que ce cas serait classé « forum », il ne
 *  l'était pas. Une affirmation dans un commentaire n'est pas une garantie. */
const MOTIFS_CHEMIN_FORUM = [
  /^\/forum/i, /\/forums?\//i, /\/topic/i, /\/sujet/i, /\/thread/i,
  /viewtopic/i, /\/discussion/i, /\/gassing/i, /\/t\/\d/i, /\/showthread/i,
  /\/comments?\//i, /\/messages?\//i,
];

/** VENDEUR : vend la réparation, des pièces, des moteurs, ou un service payant
 *  lié. Son revenu dépend de ce que le défaut soit réel et réparé — sa page
 *  n'est pas une attestation, c'est une offre.
 *
 *  Relevé le 6 nov. 2026 en lisant chaque page d'accueil (marqueurs trouvés en
 *  commentaire), pas en devinant. */
const HOTES_VENDEUR = [
  "carverif.fr",           // rapports d'historique payants : panier, tarifs
  "auto-platinium.com",    // « Turbos et Injecteurs… Pièces reconditionnées »
  "vag-perf.fr",           // préparateur VAG — page en 403, nom explicite
  "autoscore.pro",         // analyse d'annonces payante : abonnement
  "autocopilot.fr",        // page en HTTP 402 (Payment Required)
  "carchecker.pro",        // contrôle de véhicule payant — page en 429
  "moteurgarage.com",      // garage
  "chaine-courroie.com",   // tableau + demande de devis
  "bimmergarage.co.uk",    // « BMW | Mini Specialist in Nottingham »
  "megaturbo.fr",          // « Turbo Pas Cher en Échange Standard »
  "autopartswd.com",       // « Auto Engine & Parts Manufacturer »
  "enginecode.uk",         // base de codes moteur + devis
  "enginefinders.co.uk",   // « Reconditioned Engines UK | Save 40-60 % »
  "icarcheck.net",         // contrôle de véhicule payant
  "torquecars.com",        // boutique, pièces, abonnement
  // Déjà relevés à la campagne de l'atlas (5 nov. 2026).
  "autoliva.com", "la-boite-automatique.com", "ecutesting.com",
  "specialiste-bmw.fr", "caroom.fr", "findservicehistory.com",
  // Fabricant de roulements : sa documentation technique est autoritaire, mais
  // il vend les pièces. Décision d'Utku du 6 nov. 2026.
  "ntn-snr.com",
  "oscaro.com", "casse-compare.fr", "moninspection.fr", "mecano.ovh",
  "goodmecano.com", "rpf-automobiles.fr", "re-fap.fr", "carbon-cleaning.com",
];

export type RangSource =
  | "officiel"
  | "presse"
  | "editorial"
  | "compilation"
  | "forum"
  | "vendeur"
  | "hors_sujet"
  | "inconnu";

/** Les rangs qui PORTENT une affirmation. Tout le reste est EN APPUI.
 *
 *  ⚠️ « compilation » n'y figure pas, et c'est la décision d'Utku du
 *  6 nov. 2026 : un site qui agrège des fils de forum sans éditeur
 *  identifiable ne vaut pas mieux que les forums qu'il agrège. Il peut
 *  préciser, jamais porter — exactement comme un forum depuis le sprint 16. */
export const RANGS_PORTANTS: readonly RangSource[] = ["officiel", "presse", "editorial"];

/** Le rang d'une source, déduit de son hôte.
 *
 *  ⚠️ « commercial » est le DÉFAUT, et c'est volontaire : un hôte inconnu ne
 *  peut pas porter une entrée. Un garage, un vendeur de pièces ou un site de
 *  contenu référencé ont tout intérêt à décrire un défaut — leur page n'est
 *  pas une attestation, c'est une offre. */
export function rangSource(url: unknown): RangSource {
  let hote = "";
  let chemin = "";
  try {
    const u = new URL(String(url));
    hote = u.hostname.toLowerCase().replace(/^www\./, "");
    chemin = u.pathname.toLowerCase();
  } catch {
    // ⚠️ « inconnu » plutôt que « vendeur » : une URL illisible n'est pas une
    // allégation sur ce que le site vend.
    return "inconnu";
  }
  const correspond = (liste: string[]) =>
    liste.some((h) => hote === h || hote.endsWith(`.${h}`));
  if (correspond(HOTES_OFFICIELS)) return "officiel";
  // Le CHEMIN d'abord : un fil de discussion reste un fil, quel que soit
  // l'hôte qui l'héberge.
  if (MOTIFS_CHEMIN_FORUM.some((re) => re.test(chemin))) return "forum";
  // ⚠️ L'ordre compte : `forum-auto.caradisiac.com` est un FORUM, pas la
  // presse, même si le domaine racine est un titre reconnu. Et
  // `planeterenault.com/forum/...` est un forum, même si le site est éditorial.
  if (MOTIFS_FORUM.some((re) => re.test(hote))) return "forum";
  if (correspond(HOTES_COMMUNAUTE)) return "forum";
  if (correspond(HOTES_PRESSE)) return "presse";
  if (correspond(HOTES_HORS_SUJET)) return "hors_sujet";
  // Avant tout autre classement : ceux qu'on a décidé de ne pas classer.
  if (correspond(HOTES_INCONNU_ASSUME)) return "inconnu";
  if (correspond(HOTES_VENDEUR)) return "vendeur";
  if (MOTIFS_VENDEUR.some((re) => re.test(hote))) return "vendeur";
  if (correspond(HOTES_EDITORIAL)) return "editorial";
  if (correspond(HOTES_COMPILATION)) return "compilation";
  // ⚠️ « inconnu », et NON « vendeur » : écrire « vendeur » serait AFFIRMER
  // qu'un site vend quelque chose sans l'avoir vérifié. Un hôte inconnu ne
  // porte pas une affirmation — même conséquence, sans l'allégation.
  return "inconnu";
}

/** ⚠️ UNE SOURCE QU'ON NE PEUT PAS LIRE NE PORTE PAS (décision d'Utku du
 *  6 nov. 2026, à propos de `truedelta.com`, dont la page était en 403).
 *
 *  Le rang dit ce qu'est un SITE ; il ne dit pas que la PAGE citée existe et
 *  se lit. Une page en 403, en 404 ou rendue côté client ne prouve rien — et
 *  le dispositif de /fiabilite la compte déjà comme « source_injoignable »
 *  plutôt que comme une confirmation.
 *
 *  `lisibles` est la liste des URL dont le texte a été réellement obtenu.
 *  Appelée sans elle, la fonction se comporte comme avant : c'est aux
 *  appelants qui RÉCUPÈRENT les pages (génération de fiche, sourcing d'atlas)
 *  de la fournir. Un appelant qui lit un relevé déjà constitué ne peut pas
 *  savoir si la page répondait ce jour-là, et il ne doit pas le deviner. */
export function sourcesPortentLEntreeLues(
  urls: readonly unknown[],
  lisibles: readonly unknown[],
): boolean {
  const lues = new Set(lisibles.map((u) => String(u)));
  return urls.filter((u) => lues.has(String(u))).some((u) => RANGS_PORTANTS.includes(rangSource(u)));
}

/** Une entrée tient-elle sur ses sources ?
 *
 *  Il lui faut au moins UNE source de rang officiel ou presse. Forums et sites
 *  commerciaux ne viennent qu'en appui — ils peuvent préciser, jamais porter. */
export function sourcesPortentLEntree(urls: readonly unknown[]): boolean {
  return urls.some((u) => RANGS_PORTANTS.includes(rangSource(u)));
}

/** Un COÛT publié par un site commercial ne fixe pas la gravité.
 *
 *  ⚠️ Quatre entrées de la campagne hors moteur ont été portées en « casse »
 *  par des fourchettes affichées sur des pages de réparateurs. Or « casse »
 *  plafonne le score : le tarif d'un garage aurait poussé un verdict vers le
 *  rouge. Un prix sur une page qui vend la réparation est une offre, pas un
 *  relevé. */
export function coutUtilisable(urls: readonly unknown[]): boolean {
  return urls.some((u) => RANGS_PORTANTS.includes(rangSource(u)));
}
