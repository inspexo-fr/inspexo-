// Gravité jugée sur le REMÈDE — garde-fou déterministe (module PUR,
// testé hors ligne : tests/gravite-remede.test.mjs).
//
// Règle générale posée le 28/10/2026 : la gravité d'un défaut se juge sur le
// remède du défaut tel qu'il se présente, jamais sur ce qui arriverait si on
// l'ignorait. Le prompt de génération la porte déjà, mais le modèle y déroge
// régulièrement : sur la famille DV5, la panne de chaîne est revenue classée
// « casse » avec 8 000 € — or ces 8 000 € sont la réparation APRÈS rupture
// (« remplacement de toutes les soupapes et de la distribution »), pas le
// remplacement de la chaîne. Même biais constaté sur des chaînes B47, N47,
// 2ZR-FE et sur un tendeur de pompe à huile FOX.
//
// Ce garde-fou passe après la génération : il rétrograde « casse » en
// « majeure » quand le remède porte sur un ORGANE, et non sur le moteur ou
// la boîte, et qu'aucun coût sourcé ne dépasse le seuil. Il ne promeut
// jamais : rétrograder une gravité trop sévère est sans danger, l'inverse ne
// l'est pas.

/** Au-delà de ce montant, le remède vaut un remplacement moteur. */
export const SEUIL_CASSE_EUR = 3000;

/**
 * Organes dont le remplacement EST le remède : coûteux parfois, mais ce
 * n'est ni un moteur ni une boîte. Une casse moteur reste possible si on
 * laisse traîner — cela se dit dans les symptômes, pas dans la gravité.
 */
const ORGANES_REMPLACABLES =
  /\b(cha[îi]nes?|courroies?|tendeurs?|galets?|poulies?|pompes?\s+[àa]\s+eau|pompes?\s+[àa]\s+huile|cr[ée]pines?|injecteurs?|turbos?|turbocompresseurs?|vannes?\s+egr|egr|fap|filtres?\s+[àa]\s+particules|volants?\s+moteur|embrayages?|d[ée]bitm[èe]tres?|bougies?|bobines?|alternateurs?|d[ée]marreurs?|capteurs?|durites?|joints?\s+de\s+(?:culasse|cache|carter)|radiateurs?|[ée]changeurs?|collecteurs?|catalyseurs?|adblue|scr|boîtiers?|calculateurs?|servofreins?)\b/i;

/**
 * Formulations qui désignent le moteur ou la boîte EUX-MÊMES : là, le remède
 * est bien un remplacement ou une réfection, et « casse » est justifié même
 * sans montant publié.
 */
const REMEDE_EST_LE_MOTEUR =
  /\b(segment(?:ation)?s?|pistons?|vilebrequins?|coussinets?|bielles?|cylindres?|al[ée]sages?|culasse\s+fissur|bloc\s+moteur|r[ée]fections?|[ée]changes?\s+standard|remplacement\s+(?:du\s+)?moteur|casse\s+moteur\s+av[ée]r[ée]e|boîtes?\s+(?:de\s+vitesses|automatique|hybride)|convertisseurs?)\b/i;

export type PanneGravite = {
  titre: string;
  organe?: string | null;
  gravite: string;
  cout_indicatif_eur_min?: number | null;
  cout_indicatif_eur_max?: number | null;
  /**
   * Gravité tranchée à la main, sources relues (ex. les turbos de l'EA824,
   * arbitrés en « casse » parce que la pièce d'origine dépasse 3 500 £ par
   * turbo). Une décision humaine prime sur cette heuristique : le garde-fou
   * n'y touche jamais.
   */
  gravite_arbitree?: boolean;
  [k: string]: unknown;
};

/**
 * « casse » est-il justifié pour cette panne ?
 * Oui si le remède est le moteur ou la boîte, ou si un coût SOURCÉ dépasse
 * le seuil. Non si le remède porte sur un organe remplaçable sans montant
 * au-dessus du seuil.
 */
export function casseJustifiee(p: PanneGravite): boolean {
  // Une gravité tranchée à la main, sources à l'appui, n'est pas relue par
  // une expression régulière.
  if (p.gravite_arbitree === true) return true;
  const texte = `${p.titre ?? ""} ${p.organe ?? ""}`;
  if (REMEDE_EST_LE_MOTEUR.test(texte)) return true;
  const cout = p.cout_indicatif_eur_max ?? p.cout_indicatif_eur_min ?? null;
  if (typeof cout === "number" && cout > SEUIL_CASSE_EUR) return true;
  // Un organe nommé, sans montant qui dépasse le seuil : ce n'est pas une casse.
  if (ORGANES_REMPLACABLES.test(texte)) return false;
  // Rien d'identifiable : on laisse la gravité telle quelle (pas de promotion
  // ni de rétrogradation à l'aveugle).
  return true;
}

/**
 * Applique le garde-fou à une liste de pannes.
 * Renvoie les pannes corrigées et le détail de ce qui a été rétrogradé.
 */
export function appliquerGraviteRemede<T extends PanneGravite>(
  pannes: T[],
): { pannes: T[]; retrogradees: string[] } {
  const retrogradees: string[] = [];
  const out = pannes.map((p) => {
    if (p.gravite !== "casse" || casseJustifiee(p)) return p;
    retrogradees.push(p.titre);
    return { ...p, gravite: "majeure" };
  });
  return { pannes: out, retrogradees };
}
