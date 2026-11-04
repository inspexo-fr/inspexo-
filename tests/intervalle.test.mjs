// Test hors ligne de l'intervalle de confiance publié sur /fiabilite.
// Usage : node tests/intervalle.test.mjs
import { tauxLisible, wilson } from '../src/lib/intervalle.js'

let ok_ = 0, ko = 0
const ok = (c, l) => { if (c) { ok_++; console.log(`PASS — ${l}`) } else { ko++; console.log(`FAIL — ${l}`) } }
const eq = (a, b, l) => ok(a === b, `${l}${a === b ? '' : ` (obtenu ${JSON.stringify(a)}, attendu ${JSON.stringify(b)})`}`)
const proche = (a, b, tol, l) => ok(Math.abs(a - b) <= tol, `${l}${Math.abs(a - b) <= tol ? '' : ` (obtenu ${a}, attendu ≈ ${b})`}`)

// ── Wilson ──────────────────────────────────────────────────────────────────
eq(wilson(0, 0), null, 'aucun essai : pas d’intervalle')
eq(wilson(2, 1), null, 'plus de succès que d’essais : refusé')
eq(wilson(-1, 10), null, 'succès négatif : refusé')
eq(wilson(1, NaN), null, 'n non numérique : refusé')

{
  // Le cas réel attendu : 70 affirmations vérifiables, 2 non soutenues.
  const ic = wilson(2, 70)
  proche(ic.bas * 100, 0.8, 0.3, '2/70 : borne basse ≈ 0,8 %')
  proche(ic.haut * 100, 9.8, 0.5, '2/70 : borne haute ≈ 9,8 %')
  ok(ic.haut - ic.bas > 0.07,
    'à 70 observations, l’intervalle fait plus de 7 points : le taux brut seul serait trompeur')
}

{
  // ⚠️ Le cas où l'approximation normale ment : zéro erreur.
  const ic = wilson(0, 70)
  eq(ic.bas, 0, '0/70 : borne basse à zéro')
  ok(ic.haut > 0.04,
    'zéro erreur sur 70 ne veut PAS dire zéro erreur : la borne haute reste au-dessus de 4 %')
  // L'approximation normale donnerait ici un intervalle de largeur NULLE.
  ok(ic.haut - ic.bas > 0, 'l’intervalle n’est jamais de largeur nulle, contrairement à la normale')
}

{
  const ic = wilson(70, 70)
  // 0,9999999999999999 et non 1 : l'arithmétique flottante, pas une erreur de
  // méthode. On ne truque pas le calcul pour faire joli — l'affichage arrondit.
  ok(ic.haut >= 1 - 1e-9, '70/70 : borne haute à 100 % (à l’epsilon flottant près)')
  ok(ic.bas < 1, 'et la borne basse reste sous 100 %')
}

// Les bornes restent dans [0, 1] sur tout le domaine.
{
  let hors = 0
  for (let n = 1; n <= 200; n += 7) {
    for (let k = 0; k <= n; k += Math.max(1, Math.floor(n / 5))) {
      const ic = wilson(k, n)
      if (ic.bas < 0 || ic.haut > 1 || ic.bas > ic.haut) hors++
    }
  }
  eq(hors, 0, 'bornes toujours dans [0,1] et ordonnées, sur tout le domaine balayé')
}

// Plus d'observations, intervalle plus étroit — à proportion constante.
{
  const large = wilson(2, 70)
  const etroit = wilson(20, 700)
  ok((etroit.haut - etroit.bas) < (large.haut - large.bas),
    'dix fois plus d’observations : intervalle nettement plus étroit')
}

// ── Phrase publiée ──────────────────────────────────────────────────────────
{
  const t = tauxLisible(2, 70)
  eq(t.brut, '2 sur 70', 'les nombres bruts sont donnés tels quels, à côté du taux')
  eq(t.taux, '2,9 %', 'le taux est en pourcentage, virgule française')
  ok(t.intervalle !== null, 'à 70 observations, l’intervalle est affiché')
  ok(t.intervalle.includes('à'), 'il se lit « borne à borne »')
}

{
  // Grand échantillon : l'intervalle n'apprend plus rien, il disparaît.
  const t = tauxLisible(200, 20000)
  eq(t.intervalle, null, 'sur un grand échantillon, l’intervalle est omis : il n’apprend rien')
  ok(t.largeur_points < 2, 'parce que sa largeur est sous le seuil de 2 points')
}

{
  const t = tauxLisible(0, 0)
  eq(t.taux, 'non évalué', 'aucune affirmation vérifiable : « non évalué », jamais 0 %')
  eq(t.intervalle, null, 'et pas d’intervalle inventé')
}

{
  // Le seuil porte sur la LARGEUR, pas sur n : c'est la largeur qui dit si le
  // chiffre est solide.
  const t = tauxLisible(1, 30)
  ok(t.largeur_points > 2 && t.intervalle !== null,
    '30 observations : largeur au-dessus du seuil, intervalle affiché')
  eq(tauxLisible(5, 70, { seuilLargeurPoints: 100 }).intervalle, null,
    'le seuil est paramétrable et il est bien respecté')
}

{
  // Entrées hostiles : k > n est ramené à n, pas rejeté silencieusement en 0.
  const t = tauxLisible(99, 10)
  eq(t.brut, '10 sur 10', 'k supérieur à n est borné à n')
  eq(tauxLisible(null, 10).brut, '0 sur 10', 'k absent vaut zéro')
}

console.log(`\n${ok_} contrôles passés, ${ko} échec(s).`)
if (ko > 0) process.exit(1)
console.log('Tous les tests intervalle passent.')
