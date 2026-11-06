// Barème déterministe des 5 axes.
// Le modèle EXTRAIT les faits, il ne note plus : deux analyses de la même
// annonce donnent le même score. Fonction pure, sans effet de bord, testable
// hors ligne (tests/bareme.test.mjs).

/** Version du barème, exposée par l'API de scoring pour qu'un client sache
 *  sur quelle règle son résultat a été calculé. À INCRÉMENTER dès qu'une
 *  modification change un score à faits identiques — pas pour un commentaire
 *  ni un libellé.
 *  11.0 : sprint 9 (axe prix sur relevé de marché, correction kilométrique).
 *         Aucune évolution du calcul au sprint 11 : seule la version est
 *         désormais publiée. */
// 11.1 — SPRINT 13 : deux faits HistoVec entrent dans le barème
// (`histovec_opposition`, `histovec_vge_en_cours`). À faits identiques, c'est
// à dire SANS rapport HistoVec, le score est inchangé — vérifié par
// `tests/bareme.test.mjs`. La version bouge quand même : la surface d'entrée
// du barème a changé, et les clients d'API suivent ce numéro.
// 11.3 — SPRINT 13.1. La LISTE de pannes qui pèsent sur le score est désormais
// décidée par des règles serveur, non par le choix du modèle
// (`_shared/pannesApplicables.ts`) :
//   - entrées de FICHE moteur : garanties, elles sont propres à ce moteur ;
//   - entrées d'ATLAS de marque : comptées seulement si l'annonce mentionne
//     explicitement l'équipement, la génération ou le code visés — sinon
//     affichées et transformées en question au vendeur.
// Le barème lui-même est inchangé, mais ce qu'il reçoit ne l'est pas : à texte
// d'annonce identique, le score peut différer de celui rendu en 11.1 ou 11.2.
// C'est exactement ce que cette version signale aux clients d'API — et c'est
// ce qui rend le même texte toujours égal au même score (71/71/71 mesuré).
// 11.5 — SPRINT 20 : les comparables de la RECHERCHE de l'utilisateur
// (extension, application) alimentent l'axe prix et la négociation, à partir
// de 6 retenus, là où seul le relevé agrégé le faisait à partir de 15. Le
// barème est inchangé — c'est ce qu'il REÇOIT qui change : un dossier dont
// l'axe prix était « non évalué », et donc exclu du score, est désormais noté
// dès que six annonces comparables accompagnent l'analyse. À texte d'annonce
// identique MAIS sans comparables, le score est strictement le même qu'en
// 11.4 (vérifié par tests/bareme.test.mjs et par les trois cas de référence).
// 11.7 — SPRINT 20.1, second tour : le plafond d'un moteur non identifié
// descend de 69 (orange haut) à 55 (le rang d'une opération critique non
// faite). À 69, l'ignorance payait encore face à un véhicule documenté : +2
// points contre un défaut majeur, +10 contre une casse, +16 contre un défaut
// de sécurité. ⚠️ La 11.6 n'a jamais été servie à une analyse réelle — elle
// n'a vécu que le temps d'un run d'éval. On incrémente quand même : un numéro
// de version doit désigner UN comportement.
// 11.6 — SPRINT 20.1 : un moteur NON IDENTIFIÉ ne sort plus du score.
// L'axe `risques_mecaniques` vaut 10/20 (neutre) au lieu d'être exclu, et le
// verdict plafonne à 69 (orange). Mesuré en production le 5 nov. 2026 : sur la
// même Classe C 220 d, l'échec d'identification faisait MONTER le verdict de
// 71 à 75, parce qu'un axe pesant ×2 disparaissait. À faits identiques — donc
// avec une famille moteur identifiée — le score est strictement inchangé par
// rapport à la 11.5, et le champ est optionnel pour que les anciens appelants
// ne bougent pas. Vérifié par tests/bareme.test.mjs et sa contre-épreuve.
// 11.8 — SPRINT 21.1 : une panne ne pèse que si une source INDÉPENDANTE
// (officielle, presse ou éditoriale) la porte. Les autres deviennent des
// questions au vendeur. Dès qu'une panne est rétrogradée, l'axe risques est
// plafonné à 10/20 et ne dit JAMAIS « aucun défaut documenté » — il dit
// « défauts signalés non vérifiables ». Mesuré le 6 nov. 2026 : sans ce
// plafond, retirer les pannes non sourcées FAISAIT MONTER le verdict (Mercedes
// 71 → 77), et aurait écrit à 28 moteurs sur 44 qu'ils n'ont aucun défaut
// connu. Champ OPTIONNEL : absent, aucun score ne bouge.
export const BAREME_VERSION = "11.8";

export type FaitsAxes = {
  annee_courante: number;
  statut_vendeur: string;
  annee: number | null;
  kilometrage: number | null;
  prix_affiche: number | null;
  fourchette: { p25: number; mediane: number; p75: number } | null;
  comparables_count: number;
  // SPRINT 9 — relevé de marché. `fourchette` porte les prix OBSERVÉS ;
  // `fourchette_decalage_km` est la correction, mesurée DANS LE SEGMENT, qui
  // ramène la référence au kilométrage de ce véhicule (0 si non mesurable :
  // aucune décote n'est jamais inventée). `fourchette_n` est l'effectif du
  // relevé, affiché pour que l'acheteur sache sur quoi la note s'appuie.
  fourchette_n?: number;
  fourchette_decalage_km?: number;
  // Entretien (après audit de la critique)
  entretien_renseigne: boolean; // l'annonce dit quelque chose de l'entretien
  signaux_entretien: number;
  contradictions_entretien: number;
  operations_critiques_non_faites: number;
  // Risques
  catalogue_vide: boolean;
  /** SPRINT 21.1 — combien de pannes ont été RÉTROGRADÉES en question faute
   *  de source indépendante (ni officielle, ni presse, ni éditoriale) ?
   *
   *  ⚠️ CE CHAMP EXISTE POUR QU'ON NE PUISSE PAS DIRE « AUCUN DÉFAUT ». Mesuré
   *  le 6 nov. 2026 : en retirant simplement les pannes non portées, l'axe
   *  risques de la Mercedes passait de 13 à 16/20 avec le commentaire
   *  « Aucun défaut documenté retenu sur ce moteur » — et le verdict montait
   *  de 71 à 77. Appliqué aux 28 fiches à terre, le dispositif aurait écrit à
   *  28 moteurs qu'ils n'ont aucun défaut connu, alors que la vérité est qu'on
   *  ne sait pas les sourcer. C'est faux en substance, et flatteur.
   *
   *  Champ OPTIONNEL : absent, aucun score ne bouge. */
  pannes_non_verifiables?: number;
  /** SPRINT 20.1 — la FAMILLE MOTEUR a-t-elle été identifiée ?
   *
   *  ⚠️ À distinguer de `catalogue_vide`, qui confond deux situations très
   *  différentes : « on sait quel moteur c'est et on n'a rien trouvé » et
   *  « on ne sait même pas quel moteur c'est ». La seconde ne doit JAMAIS
   *  valoir mieux que la première.
   *
   *  Champ OPTIONNEL : absent, il vaut « identifiée », donc le score d'un
   *  appelant qui ne le renseigne pas ne change pas. */
  famille_identifiee?: boolean;
  // `couverte_garantie` : la panne entre dans une garantie constructeur en
  // cours ou un programme d'extension dont CE véhicule respecte les seuils.
  pannes: Array<{
    gravite: string;
    rappel_officiel: boolean;
    rappel_confirme_effectue: boolean;
    couverte_garantie?: boolean;
  }>;
  // Ce que l'acheteur doit fournir pour activer cette couverture.
  condition_garantie?: string | null;
  // Faits qui autorisent, à eux seuls, un feu rouge.
  rappel_stop_drive?: boolean;
  juridique_grave?: boolean;
  fraude_suspectee?: boolean;
  // Compteur photographié contredisant le kilométrage annoncé (> 2 %) :
  // preuve matérielle de fraude — plafonne le score en rouge à lui seul.
  compteur_contredit?: boolean;
  // SPRINT 13 — faits lus sur le certificat de situation administrative
  // HistoVec. Absents (undefined) quand aucun rapport n'a été déposé : le
  // score est alors identique à celui d'avant ce sprint.
  /** Vol, gage, opposition au transfert, saisie, ou certificat annulé : la
   *  carte grise ne peut pas être mise au nom de l'acheteur. */
  histovec_opposition?: boolean;
  /** Procédure « véhicule gravement endommagé » NON LEVÉE : le véhicule n'est
   *  pas autorisé à circuler avant validation de la réparation. */
  histovec_vge_en_cours?: boolean;
  // Transverse
  incoherences: number;
};

export type Axe = { note: number | null; commentaire: string };

const borne = (n: number, min = 2, max = 20) => Math.max(min, Math.min(max, Math.round(n)));
const fr = (n: number) => n.toLocaleString("fr-FR");

// ---------- Horizon de détention (pannes d'usure lointaines) ----------
// Une panne d'usure pèse sur la note si son kilométrage typique d'apparition
// tombe avant km actuel + 60 000 km (détention moyenne d'un véhicule
// d'occasion). Au-delà, elle reste affichée — l'acheteur doit la connaître —
// avec la mention « au-delà d'une détention moyenne », mais ne compte pas.
export const HORIZON_DETENTION_KM = 60_000;

/** Premier seuil kilométrique publié dans un libellé « dès 160 000 km »,
 *  « 100 000 - 150 000 km »… null si aucun chiffre exploitable. */
export function seuilKmPanne(kmTypique: string | null): number | null {
  if (!kmTypique) return null;
  const nombres = [...kmTypique.matchAll(/(\d[\d\s]{2,8})/g)]
    .map((m) => parseInt(m[1].replace(/\s/g, ""), 10))
    .filter((n) => Number.isFinite(n) && n >= 10000);
  return nombres.length ? Math.min(...nombres) : null;
}

/** La panne compte-t-elle dans la note ? Sans seuil publié ou sans kilométrage
 *  connu, elle compte (on ne minore jamais un risque par manque de donnée). */
export function panneDansHorizon(kmActuel: number | null, seuilKm: number | null): boolean {
  if (seuilKm == null || kmActuel == null) return true;
  return seuilKm <= kmActuel + HORIZON_DETENTION_KM;
}

/** Notes des 5 axes + score global, entièrement déterministes. */
export type ResultatBareme = {
  axes: Record<string, Axe>;
  score: number;
  verdict: "vert" | "orange" | "rouge";
  // Pourquoi le score a été plafonné (affiché sous le score, une ligne).
  plafond_raison: string | null;
  // Ce que deviendrait le verdict si la couverture de garantie était activée.
  verdict_conditionnel: { score: number; verdict: string; condition: string } | null;
};

export function calculerAxes(f: FaitsAxes): ResultatBareme {
  const axes: Record<string, Axe> = {};
  // Pondération des axes : le risque mécanique est le cœur du service.
  const POIDS: Record<string, number> = { risques_mecaniques: 2 };

  // ---------- PRIX ----------
  if (!f.fourchette || f.prix_affiche == null) {
    axes.prix = {
      note: null,
      // ⚠️ SPRINT 20 — le message disait « collez 3 annonces comparables » :
      // trois n'ont jamais suffi à rien, et l'utilisateur qui en collait trois
      // voyait toujours « non évalué » sans comprendre pourquoi. Les deux
      // chemins réels sont 6 comparables de sa propre recherche, ou 15 relevés
      // dans le relevé Inspexo.
      commentaire: f.comparables_count > 0
        ? "Non évalué — pas assez d'annonces comparables récentes pour situer ce prix."
        : "Non évalué — il faut 6 annonces comparables issues de votre recherche, ou 15 relevés pour ce modèle.",
    };
  } else {
    // Les bornes servant à NOTER sont corrigées du kilométrage quand le
    // segment permet de mesurer une décote ; celles AFFICHÉES restent les
    // prix observés (le libellé « prix demandés relevés le … » doit rester
    // littéralement vrai).
    const decalage = f.fourchette_decalage_km ?? 0;
    const p25 = f.fourchette.p25 + decalage;
    const mediane = f.fourchette.mediane + decalage;
    const p75 = f.fourchette.p75 + decalage;
    const p = f.prix_affiche;
    let note: number;
    // Les trois positions publiées : quart le moins cher / moyenne / plus
    // chère que 75 % des annonces comparables. Les paliers intermédiaires ne
    // servent qu'à la note, jamais à qualifier l'annonce à l'écran.
    let position: string;
    if (p <= p25) { note = 18; position = "dans le quart le moins cher"; }
    else if (p <= mediane) { note = 15; position = "dans la moyenne, sous la médiane"; }
    else if (p <= p75) { note = 11; position = "dans la moyenne, au-dessus de la médiane"; }
    else if (p <= p75 * 1.15) { note = 7; position = "plus chère que 75 % des annonces comparables"; }
    else { note = 4; position = "plus chère que 75 % des annonces comparables, nettement"; }
    const n = f.fourchette_n ?? 0;
    axes.prix = {
      note,
      commentaire: `${fr(p)} € demandés : ${position}` +
        `${n > 0 ? ` sur ${fr(n)} annonces relevées` : ""}` +
        ` (P25 ${fr(f.fourchette.p25)} € · médiane ${fr(f.fourchette.mediane)} € · P75 ${fr(f.fourchette.p75)} €` +
        `${decalage !== 0 ? `, référence corrigée de ${decalage > 0 ? "+" : ""}${fr(decalage)} € pour le kilométrage` : ""}).` +
        " Prix demandés, pas prix de vente.",
    };
  }

  // ---------- KILOMÉTRAGE ET ÂGE ----------
  const age = f.annee != null ? Math.max(0, f.annee_courante - f.annee) : null;
  if (f.kilometrage == null && age == null) {
    axes.kilometrage_age = { note: null, commentaire: "Non évalué — ni kilométrage ni année exploitables dans l'annonce." };
  } else if (f.kilometrage == null || age == null) {
    axes.kilometrage_age = {
      note: 12,
      commentaire: "Évaluation partielle — l'annonce ne donne pas à la fois le kilométrage et l'année.",
    };
  } else {
    const kmAn = f.kilometrage / Math.max(1, age);
    let note: number;
    let qualif: string;
    if (kmAn < 10000) { note = 17; qualif = "faible"; }
    else if (kmAn < 20000) { note = 15; qualif = "dans la moyenne"; }
    else if (kmAn < 30000) { note = 12; qualif = "soutenu mais courant"; }
    else if (kmAn < 40000) { note = 10; qualif = "élevé, typique d'un véhicule de société ou d'une LLD"; }
    else { note = 7; qualif = "très élevé"; }
    if (age >= 12) note -= 2;
    if (f.kilometrage >= 150000) note -= 2;
    if (f.kilometrage >= 200000) note -= 2;
    // Un kilométrage total faible reste un atout, même si le rythme annuel est
    // élevé (véhicule récent de société : beaucoup de km/an, peu de km au total).
    if (f.kilometrage < 50000) note = Math.max(note, 16);
    else if (f.kilometrage < 80000) note = Math.max(note, 14);
    axes.kilometrage_age = {
      note: borne(note),
      commentaire: `${fr(f.kilometrage)} km en ${age} an${age > 1 ? "s" : ""}, soit ${fr(Math.round(kmAn))} km/an : rythme ${qualif}.`,
    };
  }

  // ---------- HISTORIQUE ET ENTRETIEN ----------
  // L'absence d'information n'est jamais pénalisée.
  if (!f.entretien_renseigne) {
    axes.historique_entretien = {
      note: null,
      commentaire: "Non évalué — l'annonce ne dit rien de l'entretien : exigez le carnet et les factures avant d'acheter.",
    };
  } else {
    // Un élément « annoncé » n'est pas un élément « prouvé » : le bonus reste
    // modeste et plafonné, les manquements déclarés pèsent plus lourd.
    let note = 11 + Math.min(4, f.signaux_entretien * 2)
      - f.operations_critiques_non_faites * 4
      - f.contradictions_entretien * 3;
    const bouts = [
      f.signaux_entretien > 0 ? `${f.signaux_entretien} élément${f.signaux_entretien > 1 ? "s" : ""} d'entretien annoncé${f.signaux_entretien > 1 ? "s" : ""}` : null,
      f.operations_critiques_non_faites > 0 ? `${f.operations_critiques_non_faites} opération${f.operations_critiques_non_faites > 1 ? "s" : ""} critique${f.operations_critiques_non_faites > 1 ? "s" : ""} déclarée${f.operations_critiques_non_faites > 1 ? "s" : ""} non faite${f.operations_critiques_non_faites > 1 ? "s" : ""}` : null,
      f.contradictions_entretien > 0 ? `${f.contradictions_entretien} contradiction${f.contradictions_entretien > 1 ? "s" : ""} avec le plan d'entretien` : null,
    ].filter(Boolean);
    axes.historique_entretien = {
      note: borne(note),
      commentaire: `${bouts.join(", ")} — les justificatifs restent à vérifier sur place.`,
    };
  }

  // ---------- RISQUES MÉCANIQUES ----------
  // ⚠️ MOTEUR NON IDENTIFIÉ : 10/20, ET L'AXE COMPTE (décision d'Utku du
  // 5 nov. 2026). Mesuré ce jour-là sur la Classe C 220 d : quand
  // l'identification ne déduisait pas l'OM654, l'axe sortait du score — et
  // comme il pèse ×2, le verdict MONTAIT de 4 points. Un véhicule sur lequel
  // on ne sait rien était donc mieux noté qu'un véhicule documenté.
  //
  // 10/20 est délibérément NEUTRE : ni une bonne note (on n'a rien vérifié),
  // ni une mauvaise (on n'a rien trouvé contre lui). L'honnêteté est dans le
  // plafond qui l'accompagne, pas dans une pénalité inventée.
  const familleInconnue = f.famille_identifiee === false;
  if (familleInconnue) {
    axes.risques_mecaniques = {
      note: 10,
      commentaire: "Moteur non identifié : les pannes connues de cette motorisation n'ont pas pu être " +
        "vérifiées. Note neutre, et le verdict ne peut pas être vert.",
    };
  } else if (f.catalogue_vide) {
    axes.risques_mecaniques = {
      note: null,
      commentaire: "Non évalué — pas encore de données de fiabilité pour ce moteur.",
    };
  } else if ((f.pannes_non_verifiables ?? 0) > 0 && f.pannes.length === 0) {
    // ⚠️ TOUTES les pannes de ce moteur ont été rétrogradées : on ne dit
    // SURTOUT PAS « aucun défaut documenté ». Des défauts sont signalés, nous
    // ne pouvons simplement pas les confirmer. 10/20 est neutre, comme pour un
    // moteur non identifié : ni bonne note, ni pénalité inventée.
    const n = f.pannes_non_verifiables ?? 0;
    axes.risques_mecaniques = {
      note: 10,
      commentaire: `Défauts signalés non vérifiables : ${n} point${n > 1 ? "s" : ""} de ` +
        `défaillance ${n > 1 ? "sont rapportés" : "est rapporté"} sur cette motorisation, ` +
        `mais aucune source indépendante ne les confirme. ${n > 1 ? "Ils figurent" : "Il figure"} ` +
        `dans les questions à poser au vendeur.`,
    };
  } else {
    // La note dépend de la GRAVITÉ LA PLUS ÉLEVÉE, pas du nombre de pannes :
    // qu'un moteur documenté expose 2 ou 4 défauts majeurs change peu le risque
    // réel pour l'acheteur, alors que le décompte, lui, varie d'une analyse à
    // l'autre. Le volume n'ajoute qu'un malus faible et plafonné.
    let securite = 0, casses = 0, majeures = 0, mineures = 0, rappels = 0;
    for (const p of f.pannes) {
      if (p.gravite === "securite") securite += 1;
      else if (p.gravite === "casse") casses += 1;
      else if (p.gravite === "majeure") majeures += 1;
      else mineures += 1;
      if (p.rappel_officiel && !p.rappel_confirme_effectue) rappels += 1;
    }
    // La note dépend de la gravité LA PLUS ÉLEVÉE, jamais du nombre de pannes :
    // un moteur mieux documenté ne doit pas être pénalisé pour cette raison.
    let note = securite > 0 ? 4 : casses > 0 ? 5 : majeures > 0 ? 9 : mineures > 0 ? 13 : 16;
    if (rappels > 0) note -= 3;
    const bouts = [
      securite ? `${securite} point${securite > 1 ? "s" : ""} de sécurité` : null,
      casses ? `${casses} risque${casses > 1 ? "s" : ""} de casse moteur ou boîte` : null,
      majeures ? `${majeures} défaut${majeures > 1 ? "s" : ""} majeur${majeures > 1 ? "s" : ""}` : null,
      mineures ? `${mineures} défaut${mineures > 1 ? "s" : ""} mineur${mineures > 1 ? "s" : ""}` : null,
      rappels ? `${rappels} rappel${rappels > 1 ? "s" : ""} constructeur à faire confirmer` : null,
    ].filter(Boolean);
    // ⚠️ DÈS QU'UNE PANNE EST RÉTROGRADÉE, L'AXE EST PLAFONNÉ À 10/20.
    // On a vu une partie des défauts seulement : la note ne peut pas être
    // celle d'un moteur dont on aurait tout vérifié. Et le commentaire le dit,
    // pour que l'acheteur sache que la liste est incomplète.
    const nonVerifiables = f.pannes_non_verifiables ?? 0;
    const notePlafonnee = nonVerifiables > 0 ? Math.min(note, 10) : note;
    const suffixe = nonVerifiables > 0
      ? ` ${nonVerifiables} autre${nonVerifiables > 1 ? "s" : ""} défaut${nonVerifiables > 1 ? "s" : ""} ` +
        `${nonVerifiables > 1 ? "sont signalés" : "est signalé"} sans source indépendante : ` +
        `${nonVerifiables > 1 ? "ils figurent" : "il figure"} dans les questions au vendeur.`
      : "";
    axes.risques_mecaniques = {
      note: borne(notePlafonnee),
      commentaire: (bouts.length
        ? `${bouts.join(", ")} retenu${bouts.length > 1 || securite + casses + majeures + mineures > 1 ? "s" : ""} sur ce moteur.`
        : "Aucun défaut documenté retenu sur ce moteur à ce kilométrage.") + suffixe,
    };
  }

  // ---------- VENDEUR ET CADRE JURIDIQUE ----------
  const baseVendeur: Record<string, { note: number; texte: string }> = {
    pro: { note: 16, texte: "Vendeur professionnel : garantie légale de conformité de 12 mois." },
    particulier: { note: 12, texte: "Vente entre particuliers : seul recours, les vices cachés." },
    intermediaire_pour_particulier: { note: 8, texte: "Vente par un intermédiaire présentée comme entre particuliers : garantie légale à clarifier." },
    pro_deguise_probable: { note: 6, texte: "Indices de professionnel déguisé en particulier : cadre juridique incertain." },
  };
  const v = baseVendeur[f.statut_vendeur] ?? baseVendeur.particulier;
  const malusIncoherences = Math.min(3, f.incoherences);
  axes.vendeur_cadre = {
    note: borne(v.note - malusIncoherences),
    commentaire: malusIncoherences > 0
      ? `${v.texte} ${f.incoherences} incohérence${f.incoherences > 1 ? "s" : ""} relevée${f.incoherences > 1 ? "s" : ""} dans l'annonce.`
      : v.texte,
  };

  // ---------- SCORE ET VERDICT (seuils fixes) ----------
  // Pondération : le risque mécanique est le cœur du service et compte double.
  // Effet secondaire recherché : dès qu'une panne de sécurité existe, cet axe
  // touche son plancher et le score cesse de dépendre du NOMBRE de pannes
  // retenues — ce qui rend le verdict reproductible.
  let somme = 0, max = 0;
  for (const [cle, a] of Object.entries(axes)) {
    if (a.note == null) continue;
    const poids = POIDS[cle] ?? 1;
    somme += a.note * poids;
    max += 20 * poids;
  }
  let score = max > 0 ? Math.round((somme / max) * 100) : 0;

  // Plafonds : certains faits sont rédhibitoires et ne se compensent pas.
  const nSecurite = f.pannes.filter((p) => p.gravite === "securite").length;
  const nRappels = f.pannes.filter((p) => p.rappel_officiel && !p.rappel_confirme_effectue).length;
  let plafond = 100;
  let plafondRaison: string | null = null;
  const poser = (valeur: number, raison: string) => {
    if (valeur < plafond) { plafond = valeur; plafondRaison = raison; }
  };

  // Une annonce qui n'apprend rien ne mérite pas un feu vert : sur un véhicule
  // déjà âgé ou kilométré, l'absence totale d'information sur l'entretien
  // plafonne le verdict à « prudence » (le vert reste possible sur un véhicule
  // récent et peu roulé, où il y a objectivement peu à savoir).
  const ageV = f.annee != null ? f.annee_courante - f.annee : null;
  const vehiculeUse = (ageV != null && ageV >= 5) || (f.kilometrage != null && f.kilometrage >= 100000);
  if (!f.entretien_renseigne && vehiculeUse) {
    poser(65, "Vert impossible sans preuve d'entretien : demandez le carnet et les factures.");
  }

  // Trop peu d'axes évaluables : le score repose sur une base trop étroite.
  const axesNotes = Object.values(axes).filter((a) => a.note != null).length;
  if (axesNotes <= 2) poser(72, "Annonce trop peu détaillée pour évaluer plus de deux critères.");

  // ⚠️ Moteur non identifié : plafond ORANGE BAS (décision d'Utku du
  // 5 nov. 2026, après mesure). Le premier correctif plafonnait à 69, la borne
  // haute de l'orange — ce qui garantissait bien qu'un moteur non identifié
  // ne soit jamais vert, mais laissait l'ignorance PAYER face à un véhicule
  // documenté : +2 points contre un défaut majeur, +10 contre une casse,
  // +16 contre un défaut de sécurité avec rappel.
  //
  // 55 est le niveau déjà retenu pour « une opération d'entretien critique
  // déclarée non faite » : un fait qui coûte cher et dont on est sûr. Ne pas
  // savoir quel moteur on achète se situe au même rang.
  //
  // ⚠️ On BORNE plus bas, on n'invente aucune note. Descendre l'AXE à 4/20
  // (le rang d'un défaut de sécurité) reviendrait à affirmer un danger qu'on
  // n'a pas trouvé — ce que le projet refuse depuis le sprint 2. La note reste
  // neutre à 10/20 ; c'est le plafond qui porte l'honnêteté.
  if (familleInconnue) {
    poser(55, "Moteur non identifié : pannes connues non vérifiées.");
  }

  if (f.compteur_contredit) {
    poser(35, "Le compteur photographié contredit le kilométrage annoncé : vérifiez l'historique (HistoVec) avant toute discussion.");
  }
  if (nSecurite >= 1) poser(58, "Un défaut de sécurité documenté est retenu sur ce moteur.");
  if (f.operations_critiques_non_faites >= 1) {
    poser(55, "Une opération d'entretien critique est déclarée non faite.");
  }
  if (nRappels >= 1) poser(48, "Un rappel constructeur reste à faire confirmer sur ce véhicule.");
  // HistoVec. Ces deux faits sont des EMPÊCHEMENTS, pas des défauts
  // mécaniques : on ne peut pas devenir propriétaire (opposition) ou on ne
  // peut pas circuler (procédure non levée). Le plafond est donc plus bas que
  // celui d'un défaut de sécurité.
  if (f.histovec_opposition) {
    poser(30, "Le certificat de situation administrative porte une opposition : ne rien payer avant sa levée.");
  }
  if (f.histovec_vge_en_cours) {
    poser(32, "Procédure « véhicule gravement endommagé » non levée : le véhicule n'est pas autorisé à circuler.");
  }
  score = Math.min(score, plafond);

  // ---------- Le rouge est réservé aux faits graves ----------
  // Un feu rouge dit « ne l'achetez pas en l'état ». Il exige donc un danger
  // pour les occupants, un risque de casse moteur/boîte non couvert, un rappel
  // « stop drive » non traité, un problème juridique grave ou des signes de
  // fraude. Une panne seulement « majeure » plafonne à « prudence ».
  // Attention : une couverture de garantie n'est ACQUISE qu'une fois les
  // justificatifs fournis. Tant qu'ils manquent, la panne pèse de tout son
  // poids dans le verdict affiché ; elle n'est allégée que dans le conditionnel.
  const securiteNonCouverte = f.pannes.some((p) => p.gravite === "securite");
  const casseNonCouverte = f.pannes.some((p) => p.gravite === "casse");
  const rougeJustifie = securiteNonCouverte || casseNonCouverte ||
    Boolean(f.rappel_stop_drive) || Boolean(f.juridique_grave) || Boolean(f.fraude_suspectee) ||
    Boolean(f.compteur_contredit) ||
    // Une opposition ou une procédure non levée justifie le rouge à elle
    // seule : l'acheteur ne pourrait ni devenir propriétaire, ni circuler.
    Boolean(f.histovec_opposition) || Boolean(f.histovec_vge_en_cours);
  if (!rougeJustifie && score < 40) score = 40;

  const verdict = score >= 70 ? "vert" : score >= 40 ? "orange" : "rouge";

  // ---------- Verdict conditionnel (couverture de garantie) ----------
  // Une panne couverte par une garantie en cours ou un programme d'extension
  // ne disparaît pas, mais son poids baisse d'un cran DÈS LORS que l'acheteur
  // fournit ce que le constructeur exige.
  let verdictConditionnel: ResultatBareme["verdict_conditionnel"] = null;
  const couvertes = f.pannes.filter((p) => p.couverte_garantie);
  if (couvertes.length > 0 && f.condition_garantie && axes.risques_mecaniques.note != null) {
    const restantes = f.pannes.filter((p) => !p.couverte_garantie);
    const ORDRE = ["securite", "casse", "majeure", "mineure"];
    const gravMax = (liste: typeof f.pannes) =>
      ORDRE.find((g) => liste.some((p) => p.gravite === g)) ?? "aucune";
    // Les pannes couvertes rétrogradent d'un cran, les autres sont inchangées.
    const retrograde = (g: string) =>
      g === "securite" ? "casse" : g === "casse" ? "majeure" : "mineure";
    const gravites = [
      gravMax(restantes),
      ...couvertes.map((p) => retrograde(p.gravite)),
    ];
    const pire = ORDRE.find((g) => gravites.includes(g)) ?? "aucune";
    let noteCond = pire === "securite" ? 4 : pire === "casse" ? 5 : pire === "majeure" ? 9 : pire === "mineure" ? 13 : 16;
    // Un rappel pris en charge par le programme ne pèse plus.
    const rappelsHorsCouverture = restantes.filter((p) => p.rappel_officiel && !p.rappel_confirme_effectue).length;
    if (rappelsHorsCouverture > 0) noteCond -= 3;
    noteCond = borne(noteCond);

    let sommeC = 0, maxC = 0;
    for (const [cle, a] of Object.entries(axes)) {
      if (a.note == null) continue;
      const poids = POIDS[cle] ?? 1;
      sommeC += (cle === "risques_mecaniques" ? noteCond : a.note) * poids;
      maxC += 20 * poids;
    }
    let scoreC = maxC > 0 ? Math.round((sommeC / maxC) * 100) : 0;
    // Les plafonds liés à ce qui est couvert tombent ; les autres restent.
    let plafondC = 100;
    // Une fraude au compteur n'est jamais « couverte » par une garantie.
    if (f.compteur_contredit) plafondC = Math.min(plafondC, 35);
    // Aucune garantie ne lève un gage ni une procédure administrative.
    if (f.histovec_opposition) plafondC = Math.min(plafondC, 30);
    if (f.histovec_vge_en_cours) plafondC = Math.min(plafondC, 32);
    if (!f.entretien_renseigne && vehiculeUse) plafondC = Math.min(plafondC, 65);
    // ⚠️ Une garantie ne nous apprend pas quel moteur c'est : ce plafond-là
    // ne tombe jamais dans le conditionnel.
    if (familleInconnue) plafondC = Math.min(plafondC, 55);
    if (axesNotes <= 2) plafondC = Math.min(plafondC, 72);
    if (gravites.includes("securite")) plafondC = Math.min(plafondC, 58);
    if (rappelsHorsCouverture >= 1) plafondC = Math.min(plafondC, 48);
    scoreC = Math.min(scoreC, plafondC);
    const rougeJustifieC = gravites.includes("securite") || gravites.includes("casse") ||
      Boolean(f.rappel_stop_drive) || Boolean(f.juridique_grave) || Boolean(f.fraude_suspectee);
    if (!rougeJustifieC && scoreC < 40) scoreC = 40;
    const verdictC = scoreC >= 70 ? "vert" : scoreC >= 40 ? "orange" : "rouge";
    if (scoreC > score) {
      verdictConditionnel = { score: scoreC, verdict: verdictC, condition: f.condition_garantie };
    }
  }

  return { axes, score, verdict, plafond_raison: plafondRaison, verdict_conditionnel: verdictConditionnel };
}
