// Intervalle de confiance d'une proportion — méthode de Wilson.
//
// Pourquoi Wilson et pas l'approximation normale (p ± 1,96·√(p(1-p)/n)) :
// sur un petit échantillon, ou quand la proportion est proche de 0, la normale
// donne des bornes aberrantes — un intervalle négatif, ou de largeur nulle dès
// que k vaut 0. Avec 70 affirmations vérifiées et 2 erreurs, l'écart entre les
// deux méthodes n'est pas cosmétique : il change ce qu'on a le droit de dire.
//
// ⚠️ Un taux publié sans son incertitude est une affirmation plus forte que ce
// que les données permettent. C'est la même faute que la page qui promettait
// un taux « dès 50 dossiers relus » sans en avoir relu un seul : annoncer plus
// que ce qu'on a.
//
// Module pur, testé hors ligne (tests/intervalle.test.mjs).

/** Intervalle de Wilson à 95 % pour k succès sur n essais.
 *  Rend des proportions (0 à 1), ou null si n vaut 0. */
export function wilson(k, n, z = 1.96) {
  const K = Number(k)
  const N = Number(n)
  if (!Number.isFinite(K) || !Number.isFinite(N) || N <= 0 || K < 0 || K > N) return null
  const p = K / N
  const z2 = z * z
  const denom = 1 + z2 / N
  const centre = (p + z2 / (2 * N)) / denom
  const demi = (z * Math.sqrt((p * (1 - p)) / N + z2 / (4 * N * N))) / denom
  return {
    bas: Math.max(0, centre - demi),
    haut: Math.min(1, centre + demi),
  }
}

const pourcent = (x) => `${(x * 100).toFixed(1).replace('.', ',')} %`

/** La phrase complète : nombres bruts, taux, et incertitude quand elle compte.
 *
 *  L'intervalle n'est affiché que s'il est LARGE (≥ 2 points) : sur un grand
 *  échantillon il n'apprend rien et alourdit la lecture, sur un petit il est
 *  l'information principale. Le seuil porte sur la largeur, pas sur n — c'est
 *  la largeur qui dit si le chiffre est solide. */
export function tauxLisible(k, n, { seuilLargeurPoints = 2 } = {}) {
  const N = Number(n)
  if (!Number.isFinite(N) || N <= 0) {
    return { brut: 'aucune affirmation vérifiable', taux: 'non évalué', intervalle: null }
  }
  const K = Math.max(0, Math.min(Number(k) || 0, N))
  const ic = wilson(K, N)
  const largeurPoints = ic ? (ic.haut - ic.bas) * 100 : 0
  return {
    brut: `${K} sur ${N}`,
    taux: pourcent(K / N),
    intervalle: ic && largeurPoints >= seuilLargeurPoints
      ? `${pourcent(ic.bas)} à ${pourcent(ic.haut)}`
      : null,
    largeur_points: Math.round(largeurPoints * 10) / 10,
  }
}
