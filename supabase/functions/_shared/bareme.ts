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
  pannes: Array<{ gravite: string; rappel_officiel: boolean; rappel_confirme_effectue: boolean }>;
  // Transverse
  incoherences: number;
};

export type Axe = { note: number | null; commentaire: string };

const borne = (n: number, min = 2, max = 20) => Math.max(min, Math.min(max, Math.round(n)));
const fr = (n: number) => n.toLocaleString("fr-FR");

/** Notes des 5 axes + score global, entièrement déterministes. */
export function calculerAxes(f: FaitsAxes): {
  axes: Record<string, Axe>;
  score: number;
  verdict: "vert" | "orange" | "rouge";
} {
  const axes: Record<string, Axe> = {};

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
    let securite = 0, majeures = 0, mineures = 0, rappels = 0;
    for (const p of f.pannes) {
      if (p.gravite === "securite") securite += 1;
      else if (p.gravite === "majeure") majeures += 1;
      else mineures += 1;
      if (p.rappel_officiel && !p.rappel_confirme_effectue) rappels += 1;
    }
    let note = securite > 0 ? 5 : majeures > 0 ? 9 : mineures > 0 ? 13 : 16;
    if (rappels > 0) note -= 3;
    const total = securite + majeures + mineures;
    if (total >= 5) note -= 2;
    else if (total >= 3) note -= 1;
    const bouts = [
      securite ? `${securite} point${securite > 1 ? "s" : ""} de sécurité` : null,
      majeures ? `${majeures} défaut${majeures > 1 ? "s" : ""} majeur${majeures > 1 ? "s" : ""}` : null,
      mineures ? `${mineures} défaut${mineures > 1 ? "s" : ""} mineur${mineures > 1 ? "s" : ""}` : null,
      rappels ? `${rappels} rappel${rappels > 1 ? "s" : ""} constructeur à faire confirmer` : null,
    ].filter(Boolean);
    axes.risques_mecaniques = {
      note: borne(note),
      commentaire: bouts.length
        ? `${bouts.join(", ")} retenu${bouts.length > 1 || securite + majeures + mineures > 1 ? "s" : ""} sur ce moteur.`
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
  const POIDS: Record<string, number> = { risques_mecaniques: 2 };
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

  // Une annonce qui n'apprend rien ne mérite pas un feu vert : sur un véhicule
  // déjà âgé ou kilométré, l'absence totale d'information sur l'entretien
  // plafonne le verdict à « prudence » (le vert reste possible sur un véhicule
  // récent et peu roulé, où il y a objectivement peu à savoir).
  const ageV = f.annee != null ? f.annee_courante - f.annee : null;
  const vehiculeUse = (ageV != null && ageV >= 5) || (f.kilometrage != null && f.kilometrage >= 100000);
  if (!f.entretien_renseigne && vehiculeUse) plafond = Math.min(plafond, 65);

  // Trop peu d'axes évaluables : le score repose sur une base trop étroite.
  const axesNotes = Object.values(axes).filter((a) => a.note != null).length;
  if (axesNotes <= 2) plafond = Math.min(plafond, 72);

  if (nSecurite >= 1) plafond = Math.min(plafond, 58);
  if (f.operations_critiques_non_faites >= 1) plafond = Math.min(plafond, 55);
  if (nRappels >= 1) plafond = Math.min(plafond, 48);
  score = Math.min(score, plafond);

  const verdict = score >= 70 ? "vert" : score >= 40 ? "orange" : "rouge";
  return { axes, score, verdict };
}
