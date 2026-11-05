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

/** Coût à réserver pour la prochaine unité : la moyenne observée sur ce run,
 *  l'estimation prudente avant la première.
 *
 *  ⚠️ `coutUnites` existe parce que « ce qui a été dépensé » et « ce qui a été
 *  dépensé PAR LES UNITÉS COMPTÉES » ne sont pas toujours la même somme. Dans
 *  l'éval, une unité est un CAS pendant la première phase, puis un PASSAGE
 *  pendant la phase de stabilité — trois fois moins cher. En divisant le coût
 *  TOTAL du run par un nombre de passages, la réserve devenait énorme et le mur
 *  se déclenchait beaucoup trop tôt : le 5 nov. 2026, un run annoncé à 1,20 €
 *  s'est arrêté à 1,024 € et un run à 0,30 € à 0,185 €, en rapportant les
 *  passages non joués comme « analyses en erreur ». Le mur protégeait, mais il
 *  mentait sur ce qu'il avait fait.
 *
 *  Par défaut `coutUnites` vaut `coutRun` : aucun appelant existant ne change
 *  de comportement. */
export function coutProchainCas(coutRun, casJoues, estime = COUT_CAS_ESTIME_EUR, coutUnites = null) {
  const numerateur = coutUnites == null ? coutRun : coutUnites
  return casJoues > 0 ? numerateur / casJoues : estime
}

/** Faut-il s'arrêter AVANT de jouer l'unité suivante ?
 *
 *  La RÉSERVE se calcule sur `coutUnites` (le coût des unités comptées), mais
 *  les deux murs se comparent bien au coût TOTAL : on ne s'autorise pas à
 *  dépasser le budget annoncé sous prétexte qu'une partie de la dépense n'est
 *  pas comptée dans la moyenne. */
export function murAtteint({
  coutRun, casJoues, coutSession, budgetRun, plafondSession,
  estime = COUT_CAS_ESTIME_EUR, coutUnites = null,
}) {
  const reserve = coutProchainCas(coutRun, casJoues, estime, coutUnites)
  if (coutSession + reserve > plafondSession) return 'session'
  if (budgetRun != null && coutRun + reserve > budgetRun) return 'run'
  return null
}
