// SPRINT 23, LOT 2 (point 1) — SÉCURITÉ DE LA TRANSACTION, PAR RÈGLES FIXES.
//
// Décision d'Utku du 12 nov. 2026 :
//   - les signaux d'arnaque sont relevés par des MOTIFS FIXES, jamais par le
//     modèle : même annonce, mêmes signaux, et chacun est CITÉ depuis
//     l'annonce (extrait ≤ 15 mots, nettoyé) ;
//   - ils n'ont AUCUN EFFET SUR LE SCORE : ils portent sur la transaction,
//     pas sur le véhicule. `tests/independance-score.test.mjs` interdit au
//     barème d'importer ce module.
//
// Garde-fous (même méthode que `entretienDeclare.ts`) :
//   - négation amont (« aucun acompte demandé », « pas de transporteur ») :
//     pas de signal ;
//   - sans fourchette de prix observés, AUCUN signal « prix très bas » : on
//     n'avertit pas sur une supposition.
//
// Module PUR.
import { nettoyerCitationVendeur } from "./negociation.ts";

export type CodeSignal =
  | "paiement_distance"
  | "vendeur_etranger"
  | "livraison_transporteur"
  | "refus_visite"
  | "acompte"
  | "contact_hors_plateforme"
  | "prix_tres_bas";

export type SignalArnaque = { code: CodeSignal; libelle: string; extrait: string };

type Regle = {
  code: Exclude<CodeSignal, "prix_tres_bas">;
  libelle: string;
  motif: RegExp;
  /** La négation EST le signal (refus de visite) : pas de garde de négation. */
  negationEstLeSignal?: boolean;
  /** Formulations qui annulent le signal dans la même phrase. */
  sauf?: RegExp;
};

const PAYS =
  "l'[ée]tranger|espagne|belgique|allemagne|italie|portugal|angleterre|royaume-uni|suisse|irlande|luxembourg|pays-bas|pologne|roumanie|canada|dubai|duba[iï]";

export const REGLES: Regle[] = [
  {
    code: "paiement_distance",
    libelle: "Paiement demandé à distance par un moyen qui ne laisse aucun recours (mandat, coupons, transfert d'argent).",
    motif:
      /\b(?:mandat[\s-]cash|western\s+union|moneygram|ria\s+money|coupons?\s+(?:pcs|transcash|neosurf|paysafecard)|pcs\s+mastercard|transcash|neosurf|paysafecard|carte\s+cadeau|paiement\s+(?:en|par)\s+crypto|bitcoin)\b/i,
  },
  {
    code: "vendeur_etranger",
    libelle: "Vendeur qui se dit à l'étranger : la visite et la remise en main propre deviennent impossibles.",
    motif: new RegExp(
      `\\b(?:je\\s+suis|nous\\s+sommes|actuellement|vendeur|propri[ée]taire|v[ée]hicule|voiture)\\s+(?:actuellement\\s+|d[ée]sormais\\s+)?(?:bas[ée]e?\\s+|install[ée]e?\\s+|situ[ée]e?\\s+)?(?:à|en|au|aux)\\s+(?:${PAYS})\\b|\\bexpatri[ée]e?s?(?![a-zà-ÿ])|\\bmut[ée]e?\\s+(?:à|en|au)\\s+(?:${PAYS})\\b|\\ben\\s+mission\\s+(?:à|en|au)\\s+(?:${PAYS})\\b`,
      "i",
    ),
  },
  {
    code: "livraison_transporteur",
    libelle: "Livraison par transporteur ou paiement à un tiers (« séquestre ») proposés à la place d'une remise en main propre.",
    motif:
      /\b(?:livraison|livr[ée]e?|exp[ée]di[ée]e?|envoi)\s+(?:par|via|avec)\s+(?:un\s+|une\s+|le\s+|la\s+)?(?:transporteur|soci[ée]t[ée]\s+de\s+transport|camion|agence)|\btransporteur\s+agr[ée][ée]|\bs[ée]questre\b|\bsoci[ée]t[ée]\s+de\s+livraison\b/i,
  },
  {
    code: "refus_visite",
    libelle: "Visite ou essai refusés avant paiement.",
    negationEstLeSignal: true,
    motif:
      /\b(?:pas|aucune?)\s+(?:de\s+)?(?:visite|essai)s?\s+(?:possible|avant|n'est)|\b(?:visite|essai)s?\s+(?:impossible|non\s+possible|pas\s+possible)|\bvendue?\s+sans\s+(?:visite|essai)|\bsans\s+(?:visite|essai)\s+(?:pr[ée]alable|possible)|\bpas\s+d'essai\b/i,
    sauf: /\b(?:dimanche|week-?end|soir|sans\s+rendez-vous|sans\s+rdv|sauf\s+sur\s+rendez-vous)\b/i,
  },
  {
    code: "acompte",
    libelle: "Acompte ou réservation payante demandés avant d'avoir vu le véhicule.",
    motif:
      /\b(?:acompte|arrhes)\b|\br[ée]servation\s+(?:contre|avec|moyennant|apr[èe]s)\s+(?:un\s+)?(?:paiement|versement|virement)|\b(?:verser|versement|payer|r[ée]gler)\s+(?:d'abord|à\s+l'avance|avant\s+(?:la\s+)?(?:visite|livraison|l'envoi))|\bfrais\s+de\s+(?:dossier|transport|douane|d[ée]douanement)\s+(?:à\s+(?:r[ée]gler|payer|verser)|avant)/i,
  },
  {
    code: "contact_hors_plateforme",
    libelle: "Contact limité à un e-mail ou une messagerie, sans appel possible.",
    motif:
      /\b(?:uniquement|seulement|exclusivement)\s+(?:par|sur|via)\s+(?:e-?mail|mail|courriel|whatsapp|telegram|signal)\b|\b(?:contact|joignable|r[ée]ponds?)\s+(?:uniquement|seulement)\s+(?:par|sur)\s+(?:e-?mail|mail|whatsapp|telegram)\b|\b(?:pas|jamais)\s+d'appels?\b|\bne\s+(?:r[ée]ponds?|d[ée]croche)\s+pas\s+au\s+t[ée]l[ée]phone\b/i,
  },
];

// Négation placée juste avant le motif, dans la même phrase.
const NEGATION_AMONT = /\b(?:pas|aucune?|sans|jamais|ni|non)\b(?:\s+\S+){0,2}\s*$/i;

function phrases(texte: string): string[] {
  return String(texte ?? "").split(/(?<=[.!?;])\s+|\n+|\s+[—–]\s+/).map((p) => p.trim()).filter(Boolean);
}

export const SEUIL_PRIX_TRES_BAS = 0.6;

/** Relit l'annonce et rend les signaux. `fourchette` = prix OBSERVÉS
 *  (P25) ; absente, aucun signal de prix. Un signal par code au plus. */
export function detecterSignauxArnaque(
  texte: string,
  prix: number | null,
  fourchette: { p25: number } | null,
): SignalArnaque[] {
  const vus = new Set<string>();
  const out: SignalArnaque[] = [];
  for (const phrase of phrases(texte)) {
    for (const r of REGLES) {
      if (vus.has(r.code)) continue;
      const m = phrase.match(r.motif);
      if (!m || m.index == null) continue;
      if (!r.negationEstLeSignal && NEGATION_AMONT.test(phrase.slice(0, m.index))) continue;
      if (r.sauf && r.sauf.test(phrase)) continue;
      vus.add(r.code);
      out.push({ code: r.code, libelle: r.libelle, extrait: nettoyerCitationVendeur(phrase, 15) });
    }
  }
  if (
    typeof prix === "number" && prix > 0 && fourchette && typeof fourchette.p25 === "number" &&
    fourchette.p25 > 0 && prix < SEUIL_PRIX_TRES_BAS * fourchette.p25
  ) {
    const pct = Math.round((1 - prix / fourchette.p25) * 100);
    out.push({
      code: "prix_tres_bas",
      libelle: `Prix inférieur de ${pct} % au quart le moins cher des annonces comparables : un prix d'appel est le premier ressort des fausses annonces.`,
      extrait: `${prix} € demandés`,
    });
  }
  return out;
}
