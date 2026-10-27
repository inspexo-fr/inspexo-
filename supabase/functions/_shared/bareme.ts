// Barème déterministe des 5 axes.
// Le modèle EXTRAIT les faits, il ne note plus : deux analyses de la même
// annonce donnent le même score. Fonction pure, sans effet de bord, testable
// hors ligne (tests/bareme.test.mjs).

export type FaitsAxes = {
  annee_courante: number;
  statut_vendeur: string;
  annee: number | null;
  kilometrage: number | null;
  prix_affiche: number | null;
  fourchette: { p25: number; mediane: number; p75: number } | null;
  comparables_count: number;
  // Entretien (après audit de la critique)
  entretien_renseigne: boolean; // l'annonce dit quelque chose de l'entretien
  signaux_entretien: number;
  contradictions_entretien: number;
  operations_critiques_non_faites: number;
  // Risques
  catalogue_vide: boolean;
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
      commentaire: f.comparables_count > 0
        ? "Non évalué — pas assez d'annonces comparables récentes pour situer ce prix."
        : "Non évalué — collez 3 annonces comparables lors de l'analyse pour situer le prix.",
    };
  } else {
    const { p25, mediane, p75 } = f.fourchette;
    const p = f.prix_affiche;
    let note: number;
    let position: string;
    if (p <= p25) { note = 18; position = "parmi les moins chers des annonces comparables"; }
    else if (p <= mediane) { note = 15; position = "sous la médiane des annonces comparables"; }
    else if (p <= p75) { note = 11; position = "au-dessus de la médiane des annonces comparables"; }
    else if (p <= p75 * 1.15) { note = 7; position = "parmi les plus chers des annonces comparables"; }
    else { note = 4; position = "nettement au-dessus des annonces comparables"; }
    axes.prix = {
      note,
      commentaire: `${fr(p)} € demandés, ${position} (P25 ${fr(p25)} € · médiane ${fr(mediane)} € · P75 ${fr(p75)} €).`,
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
  if (f.catalogue_vide) {
    axes.risques_mecaniques = {
      note: null,
      commentaire: "Non évalué — pas encore de données de fiabilité pour ce moteur.",
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
    axes.risques_mecaniques = {
      note: borne(note),
      commentaire: bouts.length
        ? `${bouts.join(", ")} retenu${bouts.length > 1 || securite + casses + majeures + mineures > 1 ? "s" : ""} sur ce moteur.`
        : "Aucun défaut documenté retenu sur ce moteur à ce kilométrage.",
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

  if (f.compteur_contredit) {
    poser(35, "Le compteur photographié contredit le kilométrage annoncé : vérifiez l'historique (HistoVec) avant toute discussion.");
  }
  if (nSecurite >= 1) poser(58, "Un défaut de sécurité documenté est retenu sur ce moteur.");
  if (f.operations_critiques_non_faites >= 1) {
    poser(55, "Une opération d'entretien critique est déclarée non faite.");
  }
  if (nRappels >= 1) poser(48, "Un rappel constructeur reste à faire confirmer sur ce véhicule.");
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
    Boolean(f.compteur_contredit);
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
    if (!f.entretien_renseigne && vehiculeUse) plafondC = Math.min(plafondC, 65);
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
