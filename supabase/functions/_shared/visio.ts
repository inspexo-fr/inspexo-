// SPRINT 14 — Règles propres à la visio guidée. Module PUR, testé hors ligne.
//
// Ce que la visio ne peut PAS faire, et pourquoi le dire est le cœur du
// produit : un acheteur qui croit avoir fait vérifier les freins alors que
// personne n'a pu les voir est moins bien informé qu'avant l'appel. Le compte
// rendu doit donc porter la liste EXPLICITE de ce qui est resté hors de
// portée.
//
// La liste n'est pas rédigée à la main : elle est DÉDUITE de la checklist du
// véhicule — la même que celle du mode visite (`result.checklist_sur_place`),
// jamais une copie.

/** Fenêtre d'ouverture du lien vidéo, autour du créneau confirmé.
 *
 *  ⚠️ Vérifiée SERVEUR à chaque demande d'accès. Une URL de salle qui
 *  circulerait par email ou capture d'écran ne donne rien hors de sa fenêtre :
 *  le lien seul n'est pas un droit d'entrée. */
export const OUVERTURE_AVANT_MINUTES = 15;
export const OUVERTURE_APRES_MINUTES = 90;

export type FenetreVisio =
  | { ouverte: true }
  | { ouverte: false; raison: "trop_tot"; minutes_restantes: number }
  | { ouverte: false; raison: "trop_tard" }
  | { ouverte: false; raison: "creneau_inconnu" };

export function fenetreVisio(creneau: Date | null, maintenant: Date): FenetreVisio {
  if (!creneau || Number.isNaN(creneau.getTime())) {
    return { ouverte: false, raison: "creneau_inconnu" };
  }
  const minutes = (maintenant.getTime() - creneau.getTime()) / 60_000;
  if (minutes < -OUVERTURE_AVANT_MINUTES) {
    return {
      ouverte: false,
      raison: "trop_tot",
      minutes_restantes: Math.ceil(-minutes - OUVERTURE_AVANT_MINUTES),
    };
  }
  if (minutes > OUVERTURE_APRES_MINUTES) return { ouverte: false, raison: "trop_tard" };
  return { ouverte: true };
}

// ---------------------------------------------------------------------------
// CE QUI NE SE VÉRIFIE PAS À DISTANCE.
//
// Trois familles, et la raison de chacune est donnée à l'acheteur :
//  - ce qui demande de passer SOUS la voiture (pont, fosse) ;
//  - ce qui demande de DÉMONTER ou d'ouvrir un organe ;
//  - ce qui demande de CONDUIRE le véhicule (essai routier, freinage réel).
//
// Un point de checklist qui tombe dans l'une des trois est listé comme non
// vérifiable, avec sa raison. Les autres sont vérifiables en visio : l'acheteur
// est devant la voiture, c'est lui qui agit — l'inspecteur regarde et guide.
// ---------------------------------------------------------------------------
const FAMILLES: Array<{ cle: string; motif: RegExp; raison: string }> = [
  {
    cle: "sous_le_vehicule",
    motif:
      /\bsous (?:la|le) (?:voiture|v[ée]hicule|caisse)|\bpont\b|\bfosse\b|soubassement|plancher|berceau|train (?:avant|arri[èe]re)|corrosion (?:du|des) ch[âa]ssis|ligne d'[ée]chappement|bas de caisse/i,
    raison: "demande de passer sous le véhicule (pont ou fosse)",
  },
  {
    cle: "demontage",
    motif:
      /d[ée]mont|d[ée]pos[eé]|ouvrir le (?:carter|moteur|bo[îi]tier)|retirer (?:la|le)|compression|endoscop|vidanger|purge[rz]?\b|filtre [àa] particules.*valise|valise (?:de )?diagnostic|lecture (?:des )?codes? d[ée]faut/i,
    raison: "demande un démontage ou un outil de diagnostic branché",
  },
  {
    cle: "essai_routier",
    motif:
      /essai (?:routier|sur route)|rouler|conduire|\ben roulant\b|freinage d'urgence|tenue de route|vitesse stabilis|autoroute|boîte.*passages? de rapports? en roulant|embrayage.*patine/i,
    raison: "demande de conduire le véhicule",
  },
];

export type PointChecklist = { quoi?: string; comment?: string; signal_rouge?: string };

export type PointNonVerifiable = {
  quoi: string;
  famille: string;
  raison: string;
};

/** Points de la checklist qui restent hors de portée d'une visio. */
export function pointsNonVerifiables(checklist: PointChecklist[]): PointNonVerifiable[] {
  const out: PointNonVerifiable[] = [];
  for (const p of checklist ?? []) {
    const texte = `${p?.quoi ?? ""} ${p?.comment ?? ""} ${p?.signal_rouge ?? ""}`;
    if (texte.trim().length === 0) continue;
    const f = FAMILLES.find((x) => x.motif.test(texte));
    if (f) {
      out.push({ quoi: String(p.quoi ?? "").slice(0, 160), famille: f.cle, raison: f.raison });
    }
  }
  return out;
}

/** Suite conseillée, déduite de ce qui n'a pas pu être vu.
 *
 *  Jamais une valeur de véhicule, jamais le mot « expertise » : la visio est
 *  une aide à la décision, pas une détermination de valeur (L326-4 C. route). */
export function suiteConseillee(
  nonVerifiables: PointNonVerifiable[],
  constatsRouges: number,
): string {
  const familles = new Set(nonVerifiables.map((p) => p.famille));
  if (constatsRouges > 0) {
    return "Des signaux rouges ont été relevés pendant l'appel : faites-les chiffrer par un garage "
      + "avant toute offre, et demandez les factures correspondantes.";
  }
  if (familles.has("sous_le_vehicule") || familles.has("essai_routier")) {
    return "Rien d'alarmant n'a été vu à l'écran. Les points qui demandent un pont ou un essai "
      + "routier n'ont pas pu être vérifiés : si le véhicule vous intéresse, une inspection sur "
      + "place complète utilement cet appel.";
  }
  if (familles.size > 0) {
    return "Rien d'alarmant n'a été vu à l'écran. Quelques points demandent un outil de diagnostic "
      + "ou un démontage : un garage peut les reprendre en une demi-heure.";
  }
  return "Rien d'alarmant n'a été vu à l'écran, et la checklist de ce véhicule a pu être parcourue "
    + "en entier pendant l'appel.";
}

/** Mots interdits dans un compte rendu de visio. Mêmes raisons qu'ailleurs :
 *  « expertise » est un titre protégé (L326-8 C. route) et la détermination de
 *  valeur est réservée (L326-4 I-2°). */
export const MOTS_INTERDITS = [
  "expertise", "expert en automobile", "expert automobile",
  "valeur du véhicule", "valeur vénale", "cote", "estimation de valeur",
];

export function compteRenduConforme(texte: string): { ok: boolean; trouves: string[] } {
  const t = texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const trouves = MOTS_INTERDITS.filter((m) =>
    t.includes(m.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase())
  );
  return { ok: trouves.length === 0, trouves };
}
