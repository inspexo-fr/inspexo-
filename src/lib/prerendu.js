// Pont entre le pré-rendu statique (scripts/prerendu.mjs) et le client.
//
// Une page pré-rendue est peinte très tôt, mais si le premier rendu client
// diffère du HTML livré, React jette le DOM et le reconstruit : le contenu
// disparaît puis réapparaît, et le LCP n'est plus mesuré au premier paint mais
// à l'exécution du bundle (3,5 s mesurées sur /moteur/... avant ce correctif).
//
// Le pré-rendu dépose donc les données déjà chargées dans le HTML, et la page
// s'en sert comme état initial : le premier rendu client est identique, React
// HYDRATE, et la page publique ne touche plus la base pour son premier paint.
//
// En navigation interne (clic depuis une autre page), aucune charge utile ne
// correspond : la page charge ses données normalement.

/**
 * Déclare ce que cette page a chargé, pour que le pré-rendu puisse le figer
 * dans le HTML. Sans effet en production.
 */
export function declarerPrerendu(cle, donnees) {
  if (typeof window === 'undefined') return
  window.__DONNEES_PAGE__ = { cle, donnees }
}

/**
 * Données figées dans le HTML pour cette clé, ou `undefined` s'il n'y en a pas
 * (navigation interne, ou page non pré-rendue).
 */
export function lirePrerendu(cle) {
  if (typeof window === 'undefined') return undefined
  const charge = window.__PRERENDU__
  if (!charge || charge.cle !== cle) return undefined
  return charge.donnees
}
