// Mur budgétaire des scripts qui dépensent du crédit Anthropic.
//
// ⚠️ RÈGLE POSÉE PAR UTKU LE 5 NOVEMBRE 2026 : le compteur s'arrête de
// lui-même au budget annoncé, et on demande avant d'aller au-delà, sans
// exception.
//
// ⚠️ ET LE MUR DOIT RÉSERVER LE COÛT DU PROCHAIN CAS. Première version :
// l'arrêt se déclenchait quand le cumul avait DÉJÀ dépassé le budget — donc
// le dernier cas démarrait sous le mur et le franchissait en terminant. Un run
// annoncé à 0,40 € a ainsi coûté 0,447 € le jour même où la règle a été
// écrite. Un mur qu'on franchit toujours d'un cas n'est pas un mur.
//
// Module PUR, testé hors ligne (tests/budget-eval.test.mjs).

/** Estimation prudente du coût d'un cas, AVANT d'en avoir mesuré un. */
export const COUT_CAS_ESTIME_EUR = 0.12

/** Coût à réserver pour le prochain cas : la moyenne observée sur ce run,
 *  l'estimation prudente avant le premier. */
export function coutProchainCas(coutRun, casJoues, estime = COUT_CAS_ESTIME_EUR) {
  return casJoues > 0 ? coutRun / casJoues : estime
}

/** Faut-il s'arrêter AVANT de jouer le cas suivant ? */
export function murAtteint({
  coutRun, casJoues, coutSession, budgetRun, plafondSession, estime = COUT_CAS_ESTIME_EUR,
}) {
  const reserve = coutProchainCas(coutRun, casJoues, estime)
  if (coutSession + reserve > plafondSession) return 'session'
  if (budgetRun != null && coutRun + reserve > budgetRun) return 'run'
  return null
}
