// SPRINT 8 — Inspection à la demande : règles métier PURES.
// Prix et parts, validité du SIRET, zone couverte, créneau sous 48 h, charte
// d'indépendance. Aucun accès réseau ni base : testé hors ligne par
// tests/inspection.test.mjs, chaîné dans `npm run eval`.

// ---------------------------------------------------------------------------
// SPRINT 14 — DEUX PRESTATIONS, UN SEUL CIRCUIT.
//
// La visio guidée réutilise TOUT le circuit de l'inspection : commande avec
// créneau, autorisation Stripe puis capture à la confirmation, échéance à deux
// bornes, annulation, arbitrage, Stripe Connect, charte, admin. Rien n'est
// dupliqué — ce qui change d'une prestation à l'autre est rassemblé ICI, dans
// une table indexée par type, et le reste du code lit cette table.
//
// ⚠️ Les valeurs de `inspection` sont IDENTIQUES à celles d'avant ce sprint.
// `tests/inspection.test.mjs` le prouve explicitement : une factorisation qui
// déplace un montant au passage serait une régression silencieuse sur un
// produit déjà vendable.
// ---------------------------------------------------------------------------
export type TypePrestation = "inspection" | "visio";

export type Prestation = {
  type: TypePrestation;
  libelle: string;
  prix_cents: number;
  /** Part de l'inspecteur, en CENTIMES. Figée à la commande. */
  part_inspecteur_cents: number;
  /** Départements couverts, ou "*" pour la France entière. */
  zone: string[] | "*";
  zone_libelle: string;
  /** Au-delà, l'annulation par l'acheteur n'est plus gratuite. 0 = gratuite
   *  jusqu'au créneau (cas de la visio : aucun déplacement engagé). */
  annulation_gratuite_heures: number;
  /** Retenue en cas d'annulation tardive ou d'absence, en centimes. */
  retenue_cents: number;
  /** Délai de remise du compte rendu, en heures. */
  rapport_heures: number;
  /** Minutes d'attente avant qu'une absence puisse être constatée. */
  attente_absence_minutes: number;
};

export const PRESTATIONS: Record<TypePrestation, Prestation> = {
  // Valeurs d'avant le sprint 14, inchangées.
  inspection: {
    type: "inspection",
    libelle: "Inspection sur place",
    prix_cents: 17_900, // 179,00 € TTC
    part_inspecteur_cents: 10_740, // 60 %
    zone: ["31"],
    zone_libelle: "Toulouse et Haute-Garonne",
    annulation_gratuite_heures: 24,
    retenue_cents: 4_000, // 40,00 € — un déplacement réellement engagé
    rapport_heures: 24,
    attente_absence_minutes: 0, // constat sur place, pas d'attente codifiée
  },
  visio: {
    type: "visio",
    libelle: "Visio guidée",
    prix_cents: 5_900, // 59,00 € TTC
    part_inspecteur_cents: 4_000, // 40,00 €
    // ⚠️ France entière : c'est tout l'intérêt de la visio. Aucun
    // déplacement, donc aucune contrainte géographique.
    zone: "*",
    zone_libelle: "France entière",
    // ⚠️ Gratuite À TOUT MOMENT avant le créneau (décision du 4 nov. 2026) :
    // aucun déplacement n'est engagé, et cela reste aligné sur le droit de
    // rétractation. La retenue ne vient PAS d'une annulation tardive mais
    // d'une ABSENCE, constatée 15 minutes après le début du créneau.
    annulation_gratuite_heures: 0,
    retenue_cents: 2_000, // 20,00 € — indemnise un créneau bloqué, pas un trajet
    rapport_heures: 2,
    attente_absence_minutes: 15,
  },
};

export const prestation = (t: TypePrestation): Prestation => PRESTATIONS[t] ?? PRESTATIONS.inspection;

// Compatibilité : ces deux constantes restent exportées parce qu'elles sont
// lues ailleurs, et elles valent exactement ce qu'elles valaient.
export const PRIX_INSPECTION_CENTS = PRESTATIONS.inspection.prix_cents;
export const PART_INSPECTEUR = 0.6; // 60 % à l'inspecteur

/** Part de l'inspecteur, arrondie au centime. Le reste va à la plateforme :
 *  les deux parts additionnées font TOUJOURS le prix payé (pas de centime
 *  perdu ni créé). */
export function partInspecteurCents(prixCents: number = PRIX_INSPECTION_CENTS): number {
  return Math.round(prixCents * PART_INSPECTEUR);
}

/** Parts d'une prestation donnée. Pour la visio, la part de l'inspecteur est
 *  un MONTANT FIXE (40 € sur 59 €), pas un pourcentage : l'écrire en ratio
 *  donnerait 67,796 %, donc un arrondi à chaque calcul là où le contrat
 *  annonce un chiffre rond. */
export function partsPrestation(t: TypePrestation): { inspecteur: number; plateforme: number } {
  const p = prestation(t);
  const inspecteur = Math.min(p.part_inspecteur_cents, p.prix_cents);
  return { inspecteur, plateforme: p.prix_cents - inspecteur };
}
export function partPlateformeCents(prixCents: number = PRIX_INSPECTION_CENTS): number {
  return prixCents - partInspecteurCents(prixCents);
}

// ---------------------------------------------------------------------------
// Zone couverte — Toulouse et Haute-Garonne au lancement.
// ---------------------------------------------------------------------------
export const ZONE_LANCEMENT = PRESTATIONS.inspection.zone as string[];
export const ZONE_LIBELLE = PRESTATIONS.inspection.zone_libelle;

/** Département d'un code postal français (miroir de public._departement). */
export function departementDeCp(cp: string): string | null {
  const c = String(cp ?? "").replace(/\s/g, "");
  if (!/^[0-9]{5}$/.test(c)) return null;
  const deux = c.slice(0, 2);
  return deux === "97" || deux === "98" ? c.slice(0, 3) : deux;
}

export function dansZoneLancement(cp: string): boolean {
  return dansZone(cp, "inspection");
}

/** Le code postal est-il dans la zone de CETTE prestation ?
 *  La visio couvre "*" — mais un code postal valide reste exigé : on ne
 *  commande pas une visio sans savoir où est la voiture. */
export function dansZone(cp: string, t: TypePrestation): boolean {
  const d = departementDeCp(cp);
  if (d === null) return false;
  const z = prestation(t).zone;
  return z === "*" ? true : z.includes(d);
}

// ---------------------------------------------------------------------------
// SIRET — 14 chiffres, clé de Luhn.
// ---------------------------------------------------------------------------
/** Luhn sur une chaîne de chiffres (SIREN 9, SIRET 14). */
function luhnValide(num: string): boolean {
  let somme = 0;
  // On pondère par 2 un chiffre sur deux EN PARTANT DE LA DROITE.
  for (let i = 0; i < num.length; i++) {
    const depuisDroite = num.length - 1 - i;
    let v = Number(num[i]);
    if (depuisDroite % 2 === 1) {
      v *= 2;
      if (v > 9) v -= 9;
    }
    somme += v;
  }
  return somme % 10 === 0;
}

/** Validité d'un SIRET : 14 chiffres + Luhn.
 *  ⚠️ Exception officielle : les établissements de La Poste (SIREN 356000000)
 *  ne respectent pas Luhn — la règle est que la somme des chiffres soit un
 *  multiple de 5. Sans ce cas particulier, un SIRET La Poste parfaitement
 *  valide serait refusé. */
export function siretValide(brut: string): boolean {
  const s = String(brut ?? "").replace(/[\s.-]/g, "");
  if (!/^[0-9]{14}$/.test(s)) return false;
  if (s.startsWith("356000000")) {
    const somme = s.split("").reduce((t, c) => t + Number(c), 0);
    return somme % 5 === 0;
  }
  return luhnValide(s);
}

/** SIREN (9 premiers chiffres) d'un SIRET, pour l'affichage. */
export function sirenDeSiret(brut: string): string | null {
  const s = String(brut ?? "").replace(/[\s.-]/g, "");
  return /^[0-9]{14}$/.test(s) ? s.slice(0, 9) : null;
}

export function formaterSiret(brut: string): string {
  const s = String(brut ?? "").replace(/[\s.-]/g, "");
  if (!/^[0-9]{14}$/.test(s)) return String(brut ?? "");
  return `${s.slice(0, 3)} ${s.slice(3, 6)} ${s.slice(6, 9)} ${s.slice(9)}`;
}

// ---------------------------------------------------------------------------
// Créneau — l'engagement produit est « sous 48 h ».
// ---------------------------------------------------------------------------
export const DELAI_MIN_HEURES = 2; // le temps qu'un inspecteur voie la demande
export const DELAI_MAX_HEURES = 48;

export type CreneauVerdict = { ok: true; date: Date } | { ok: false; raison: string };

/** Le créneau demandé doit tomber entre +2 h et +48 h. Au-delà, ce n'est plus
 *  l'offre vendue ; en deçà, aucun inspecteur ne peut raisonnablement s'y rendre. */
export function validerCreneau(iso: unknown, maintenant: Date = new Date()): CreneauVerdict {
  if (typeof iso !== "string" || iso.trim() === "") {
    return { ok: false, raison: "Choisissez un créneau." };
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { ok: false, raison: "Créneau illisible." };
  const h = (d.getTime() - maintenant.getTime()) / 3_600_000;
  if (h < DELAI_MIN_HEURES) {
    return { ok: false, raison: `Choisissez un créneau dans au moins ${DELAI_MIN_HEURES} heures.` };
  }
  if (h > DELAI_MAX_HEURES) {
    return { ok: false, raison: `L'inspection est garantie sous ${DELAI_MAX_HEURES} heures : choisissez un créneau plus proche.` };
  }
  return { ok: true, date: d };
}

// ---------------------------------------------------------------------------
// Charte d'indépendance — VERSIONNÉE. Le texte signé doit pouvoir être
// reconstitué des années plus tard : on ne modifie JAMAIS une version
// existante, on en publie une nouvelle.
// ---------------------------------------------------------------------------
export const CHARTE_VERSION = "2026-11-03";

export const CHARTE_INDEPENDANCE = [
  "Je suis payé par l'acheteur, jamais par le vendeur. Je n'accepte, pendant ou après une inspection Inspexo, aucune somme, remise, commission, cadeau ni avantage de la part du vendeur du véhicule, de son mandataire, d'un garage ou d'un intermédiaire concerné par la vente.",
  "Je n'ai aucun intérêt dans la vente. Je n'inspecte pas un véhicule vendu par moi-même, par un proche, par mon employeur, ni par une entreprise dans laquelle j'ai un intérêt. Si je découvre un tel lien, je refuse la mission ou je la signale immédiatement.",
  "Je ne propose jamais de réparer ce que je constate. Je n'oriente pas l'acheteur vers mon propre atelier ni vers un garage avec lequel j'ai un accord commercial.",
  "Je rapporte ce que j'ai vu, pas ce qui arrange. Je ne tais aucun défaut constaté et je n'en invente aucun. Ce que je n'ai pas pu vérifier, je l'écris comme non vérifié.",
  "Je respecte le véhicule et les personnes. Je me présente, j'explique ma démarche au vendeur, et je ne photographie ni plaque d'immatriculation, ni document d'identité, ni aucune personne reconnaissable — ni le vendeur, ni un passant, ni moi-même.",
  "J'informe le vendeur dès mon premier contact. Je lui dis que l'acheteur a commandé cette inspection, que ses coordonnées m'ont été transmises pour ce seul rendez-vous, et je lui indique où lire la politique de confidentialité d'Inspexo (inspexo.io/politique-de-confidentialite). Il peut m'y demander la suppression de ses coordonnées.",
  "Je suis indépendant et assuré. J'exerce sous mon propre numéro SIRET et je maintiens une assurance responsabilité civile professionnelle en cours de validité pendant toute ma collaboration.",
  "Je sais qu'un manquement met fin à la collaboration. Inspexo peut suspendre mon compte immédiatement, et la rémunération d'une mission entachée d'un manquement n'est pas due.",
];

/** Rappel affiché à l'inspecteur au moment de photographier : le vendeur doit
 *  être informé, et certaines choses ne se photographient jamais. */
export const CONSENTEMENT_PHOTOS = [
  "Les photos que vous prenez pendant cette inspection sont CONSERVÉES : elles constituent le rapport remis à l'acheteur. C'est la seule situation où Inspexo garde des photos.",
  "Prévenez le vendeur que vous photographiez le véhicule pour le compte de l'acheteur.",
  "Ne photographiez jamais : la plaque d'immatriculation, un document d'identité, la carte grise en entier, une personne, l'intérieur du domicile.",
];

// ---------------------------------------------------------------------------
// Statuts — libellés partagés serveur/client.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// PAIEMENT EN DEUX TEMPS, ET BARÈME D'ANNULATION.
//
// À la commande, le paiement est seulement AUTORISÉ (capture_method manual) ;
// il n'est débité qu'au moment où un inspecteur confirme. Personne ne paie
// pour une mission que personne n'a prise.
//
// ⚠️ Une autorisation de carte en ligne ne tient que SEPT JOURS. La fenêtre de
// confirmation est donc fixée à 48 heures : largement en dessous, pour qu'une
// autorisation n'expire jamais d'elle-même chez Stripe pendant qu'on attend.
// Une autorisation qui expire côté Stripe laisserait une mission confirmable
// mais impayable.
// ---------------------------------------------------------------------------
export const DELAI_CONFIRMATION_HEURES = 48;
export const DUREE_AUTORISATION_JOURS = 7; // limite Stripe, pour mémoire

/** Marge avant le créneau : au-delà, confirmer n'a plus de sens — l'inspecteur
 *  n'aurait pas le temps de s'y rendre, et l'acheteur attendrait pour rien. */
export const MARGE_AVANT_CRENEAU_HEURES = 2;

/** Délai de grâce après la confirmation : l'acheteur peut revenir sur sa
 *  commande dans l'heure, quel que soit le créneau. Sans lui, un créneau
 *  choisi à +3 h rendrait l'annulation payante AVANT que l'acheteur ait pu
 *  réagir à la confirmation qu'il vient de recevoir. */
export const DELAI_GRACE_CONFIRMATION_HEURES = 1;

/** Échéance de confirmation : le PREMIER des deux termes.
 *
 *  Le créneau peut être à 2 h de la commande alors que la confirmation a 48 h
 *  pour arriver : les deux bornes doivent coexister, et c'est la plus proche
 *  qui s'applique. Sans la borne du créneau, une mission restait confirmable
 *  après l'heure du rendez-vous. */
export function echeanceConfirmation(
  autoriseeLe: Date | null,
  creneau: Date | null,
): Date | null {
  const bornes: number[] = [];
  if (autoriseeLe && !Number.isNaN(autoriseeLe.getTime())) {
    bornes.push(autoriseeLe.getTime() + DELAI_CONFIRMATION_HEURES * 3_600_000);
  }
  if (creneau && !Number.isNaN(creneau.getTime())) {
    bornes.push(creneau.getTime() - MARGE_AVANT_CRENEAU_HEURES * 3_600_000);
  }
  if (bornes.length === 0) return null;
  return new Date(Math.min(...bornes));
}

/** Au-delà, l'annulation par l'acheteur n'est plus gratuite : un inspecteur a
 *  réservé son créneau et va se déplacer. */
export const DELAI_ANNULATION_GRATUITE_HEURES = 24;

/** Indemnité de déplacement, versée à l'INSPECTEUR (jamais à Inspexo). */
export const RETENUE_DEPLACEMENT_CENTS = 4_000; // 40,00 €

export type ActionArgent =
  | "annuler_autorisation" // rien n'a été débité : on relâche
  | "rembourser_integral"  // débité, tout revient à l'acheteur
  | "retenue_deplacement"  // débité, 139 € rendus et 40 € à l'inspecteur
  | "rien"; // déjà réglé, ou rien à faire

export type DecisionAnnulation = {
  action: ActionArgent;
  rembourse_cents: number;
  retenue_cents: number;
  motif: string;
};

export type ContexteAnnulation = {
  /** Type de prestation. Absent = inspection, pour que tout appelant d'avant
   *  le sprint 14 garde exactement le comportement qu'il avait. */
  type?: TypePrestation;
  statut: string;
  /** Créneau confirmé par l'inspecteur, ou à défaut créneau souhaité. */
  creneau: Date | null;
  maintenant: Date;
  prix_cents: number;
  /** Instant où l'inspecteur a confirmé — ouvre l'heure de grâce. */
  confirmee_le?: Date | null;
  /** L'inspecteur a constaté sur place que le véhicule n'était pas montrable. */
  absence_vendeur?: boolean;
};

/** Barème d'annulation — fonction PURE, c'est elle qui décide du sort de
 *  l'argent. Aucune règle de prix n'est écrite ailleurs.
 *
 *  Règles (CGV de l'inspection, art. 6) :
 *   - avant toute confirmation : l'autorisation est relâchée, rien n'a bougé ;
 *   - après confirmation, à plus de 24 h du créneau : remboursement intégral ;
 *   - à moins de 24 h, ou vendeur absent / véhicule indisponible constaté sur
 *     place : 40 € vont à l'inspecteur, le reste revient à l'acheteur.
 *
 *  L'absence de vendeur l'emporte sur le délai : un inspecteur qui s'est
 *  déplacé pour rien doit être indemnisé, même si le constat a lieu bien avant
 *  le créneau annoncé. */
export function decisionAnnulation(c: ContexteAnnulation): DecisionAnnulation {
  const p = prestation(c.type ?? "inspection");
  const prix = Number.isFinite(c.prix_cents) && c.prix_cents > 0
    ? Math.round(c.prix_cents)
    : p.prix_cents;

  if (c.statut === "faite") {
    return { action: "rien", rembourse_cents: 0, retenue_cents: 0,
      motif: "Inspection déjà réalisée : plus d'annulation possible." };
  }
  if (c.statut === "annulee") {
    return { action: "rien", rembourse_cents: 0, retenue_cents: 0,
      motif: "Inspection déjà annulée." };
  }

  // Rien n'a été encaissé tant qu'aucun inspecteur n'a confirmé.
  if (c.statut === "a_payer" || c.statut === "a_attribuer" || c.statut === "refusee") {
    return { action: "annuler_autorisation", rembourse_cents: 0, retenue_cents: 0,
      motif: "Aucun inspecteur n'avait confirmé : l'autorisation est annulée, rien n'est débité." };
  }

  // À partir d'ici : statut `acceptee`, donc le paiement a été encaissé.
  // ⚠️ La retenue ne peut JAMAIS dépasser ce qui a été encaissé, sinon le
  // remboursement devient négatif — c'est-à-dire qu'on redemanderait de
  // l'argent à l'acheteur pour l'avoir annulé. À 179 € le cas n'arrive pas,
  // mais le prix est un paramètre : le garde-fou est ici, pas dans l'espoir
  // que le prix reste au-dessus de 40 €.
  const retenue = Math.min(p.retenue_cents, prix);

  if (c.absence_vendeur === true) {
    return {
      action: "retenue_deplacement",
      rembourse_cents: prix - retenue,
      retenue_cents: retenue,
      motif: p.type === "visio"
        ? "Acheteur absent au rendez-vous : montant proportionné au créneau réservé "
          + "par l'inspecteur, qui n'a pas pu être réemployé."
        : "Véhicule non présenté : montant proportionné au service déjà fourni "
          + "(organisation du rendez-vous et déplacement effectué).",
    };
  }

  // Heure de grâce : l'acheteur peut revenir sur sa commande dans l'heure qui
  // suit la confirmation, quel que soit le créneau.
  if (c.confirmee_le && !Number.isNaN(c.confirmee_le.getTime())) {
    const depuis = (c.maintenant.getTime() - c.confirmee_le.getTime()) / 3_600_000;
    if (depuis >= 0 && depuis <= DELAI_GRACE_CONFIRMATION_HEURES) {
      return { action: "rembourser_integral", rembourse_cents: prix, retenue_cents: 0,
        motif: "Annulation dans l'heure suivant la confirmation : remboursement intégral." };
    }
  }

  const heures = c.creneau
    ? (c.creneau.getTime() - c.maintenant.getTime()) / 3_600_000
    : null;

  // Créneau inconnu : on traite au plus favorable pour l'acheteur. Un barème
  // ne se déclenche pas sur une donnée manquante.
  if (heures === null || heures > p.annulation_gratuite_heures) {
    return {
      action: "rembourser_integral",
      rembourse_cents: prix,
      retenue_cents: 0,
      motif: p.annulation_gratuite_heures === 0
        // Visio : aucun déplacement engagé, donc gratuit jusqu'au créneau.
        ? "Annulation avant le créneau : remboursement intégral, rien n'est retenu."
        : `Annulation à plus de ${p.annulation_gratuite_heures} heures du créneau : remboursement intégral.`,
    };
  }

  return {
    action: "retenue_deplacement",
    rembourse_cents: prix - retenue,
    retenue_cents: retenue,
    motif: p.type === "visio"
      // Pour une visio, passé l'heure du créneau il ne s'agit plus d'une
      // annulation mais d'une absence : le créneau de l'inspecteur est perdu.
      ? "Créneau dépassé : le créneau réservé par l'inspecteur est indemnisé."
      : `Annulation à moins de ${p.annulation_gratuite_heures} heures du créneau : montant `
        + "proportionné au service déjà fourni (organisation du rendez-vous et déplacement réservé).",
  };
}

/** L'absence de l'acheteur peut-elle être constatée ?
 *
 *  Pour une visio, la retenue de 20 € n'indemnise pas un déplacement mais un
 *  CRÉNEAU BLOQUÉ : elle ne se justifie qu'après une attente réelle. Quinze
 *  minutes après l'heure du rendez-vous, pas avant — et jamais avant l'heure
 *  du rendez-vous elle-même. */
export function absenceConstatable(
  t: TypePrestation,
  creneau: Date | null,
  maintenant: Date,
): { ok: true } | { ok: false; raison: string; minutes_restantes: number } {
  const p = prestation(t);
  if (p.attente_absence_minutes === 0) return { ok: true }; // inspection : constat sur place
  if (!creneau || Number.isNaN(creneau.getTime())) {
    return { ok: false, raison: "creneau_inconnu", minutes_restantes: 0 };
  }
  const ecoulees = (maintenant.getTime() - creneau.getTime()) / 60_000;
  if (ecoulees < p.attente_absence_minutes) {
    return {
      ok: false,
      raison: "attente_insuffisante",
      minutes_restantes: Math.ceil(p.attente_absence_minutes - ecoulees),
    };
  }
  return { ok: true };
}

/** Une autorisation non confirmée doit-elle être relâchée ?
 *
 *  Vrai dès que l'échéance de confirmation est passée — 48 h après
 *  l'autorisation, ou 2 h avant le créneau, selon ce qui arrive d'abord. */
export function autorisationExpiree(
  autoriseeLe: Date | null,
  maintenant: Date,
  creneau: Date | null = null,
): boolean {
  const echeance = echeanceConfirmation(autoriseeLe, creneau);
  if (!echeance) return false;
  return maintenant.getTime() >= echeance.getTime();
}

/** Texte EXACT de la demande d'exécution immédiate. Case obligatoire, jamais
 *  pré-cochée : sans elle, l'acheteur conserve ses 14 jours de rétractation
 *  après l'inspection, et nous aurions payé l'inspecteur pour rien. */
export const DEMANDE_EXECUTION_IMMEDIATE =
  "Je demande que l'inspection soit réalisée avant la fin du délai de rétractation de 14 jours "
  + "et je reconnais perdre ce droit une fois l'inspection entièrement réalisée.";

/** Délai au-delà duquel l'absence de rapport déclenche une alerte exploitant. */
export const DELAI_RAPPORT_HEURES = 24;

export const STATUTS_INSPECTION: Record<string, string> = {
  a_payer: "Paiement en attente",
  a_attribuer: "En attente d'un inspecteur",
  acceptee: "Inspecteur confirmé",
  refusee: "À réattribuer",
  faite: "Rapport remis",
  annulee: "Annulée",
};
