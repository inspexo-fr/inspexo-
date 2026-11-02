// SPRINT 8 — Inspection à la demande : règles métier PURES.
// Prix et parts, validité du SIRET, zone couverte, créneau sous 48 h, charte
// d'indépendance. Aucun accès réseau ni base : testé hors ligne par
// tests/inspection.test.mjs, chaîné dans `npm run eval`.

// ---------------------------------------------------------------------------
// Argent — tout en CENTIMES, jamais en flottants d'euros.
// ---------------------------------------------------------------------------
export const PRIX_INSPECTION_CENTS = 17_900; // 179,00 € TTC
export const PART_INSPECTEUR = 0.6; // 60 % à l'inspecteur

/** Part de l'inspecteur, arrondie au centime. Le reste va à la plateforme :
 *  les deux parts additionnées font TOUJOURS le prix payé (pas de centime
 *  perdu ni créé). */
export function partInspecteurCents(prixCents: number = PRIX_INSPECTION_CENTS): number {
  return Math.round(prixCents * PART_INSPECTEUR);
}
export function partPlateformeCents(prixCents: number = PRIX_INSPECTION_CENTS): number {
  return prixCents - partInspecteurCents(prixCents);
}

// ---------------------------------------------------------------------------
// Zone couverte — Toulouse et Haute-Garonne au lancement.
// ---------------------------------------------------------------------------
export const ZONE_LANCEMENT = ["31"];
export const ZONE_LIBELLE = "Toulouse et Haute-Garonne";

/** Département d'un code postal français (miroir de public._departement). */
export function departementDeCp(cp: string): string | null {
  const c = String(cp ?? "").replace(/\s/g, "");
  if (!/^[0-9]{5}$/.test(c)) return null;
  const deux = c.slice(0, 2);
  return deux === "97" || deux === "98" ? c.slice(0, 3) : deux;
}

export function dansZoneLancement(cp: string): boolean {
  const d = departementDeCp(cp);
  return d !== null && ZONE_LANCEMENT.includes(d);
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
export const CHARTE_VERSION = "2026-11-01";

export const CHARTE_INDEPENDANCE = [
  "Je suis payé par l'acheteur, jamais par le vendeur. Je n'accepte, pendant ou après une inspection Inspexo, aucune somme, remise, commission, cadeau ni avantage de la part du vendeur du véhicule, de son mandataire, d'un garage ou d'un intermédiaire concerné par la vente.",
  "Je n'ai aucun intérêt dans la vente. Je n'inspecte pas un véhicule vendu par moi-même, par un proche, par mon employeur, ni par une entreprise dans laquelle j'ai un intérêt. Si je découvre un tel lien, je refuse la mission ou je la signale immédiatement.",
  "Je ne propose jamais de réparer ce que je constate. Je n'oriente pas l'acheteur vers mon propre atelier ni vers un garage avec lequel j'ai un accord commercial.",
  "Je rapporte ce que j'ai vu, pas ce qui arrange. Je ne tais aucun défaut constaté et je n'en invente aucun. Ce que je n'ai pas pu vérifier, je l'écris comme non vérifié.",
  "Je respecte le véhicule et les personnes. Je me présente, j'explique ma démarche au vendeur, je ne photographie ni plaque d'immatriculation, ni document d'identité, ni personne.",
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
export const STATUTS_INSPECTION: Record<string, string> = {
  a_payer: "Paiement en attente",
  a_attribuer: "En attente d'un inspecteur",
  acceptee: "Inspecteur confirmé",
  refusee: "À réattribuer",
  faite: "Rapport remis",
  annulee: "Annulée",
};
