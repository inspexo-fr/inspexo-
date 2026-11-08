// Test hors ligne du comparateur (sprint 22). Recommandation PAR RÈGLES.
// Usage : node tests/comparateur.test.mjs
import { readFileSync } from 'node:fs'
import { ECART_BUDGET_MAX, ficheDepuisAnalyse, percentilePrix, recommander, SEUIL_COUT_EUR, SEUIL_PERCENTILE, SEUIL_SCORE } from '../supabase/functions/_shared/comparateur.ts'

let ok_ = 0, ko = 0
const ok = (c, l) => { if (c) ok_++; else { ko++; console.log(`FAIL — ${l}`) } }
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (obtenu ${JSON.stringify(a)}, attendu ${JSON.stringify(b)})`)

const PRESSE = 'https://www.largus.fr/p'
const GARAGE = 'https://www.vroomly.com/g'
const fiche = (id, o = {}) => ({
  analysis_id: id, titre: `Voiture ${id}`, verdict: 'orange', score: 60, eliminatoire: null,
  pannes_portees: [], gravite_max: 'aucune', questions: 4,
  travaux: { min: 300, max: 600, postes: 2 },
  prix: { demande: 10_000, position: 'dans la moyenne', n: 12, source: 'recherche', percentile: null },
  critair: "Crit'Air 2",
  cout_3ans: { total_min: 11_000, total_max: 11_500, non_chiffrees: [{ libelle: 'Carte grise', motif: 'x' }], partiel: true },
  ...o,
})

// ── Construction d'une fiche depuis result_json ─────────────────────────────
{
  const rj = {
    vehicule: { marque: 'Peugeot', modele: '308', motorisation: '1.2 PureTech 130', annee: 2020, prix_affiche: 14_000 },
    pannes_connues: [
      { titre: 'Courroie humide', gravite: 'majeure', urls: [PRESSE, GARAGE] },
      { titre: 'Fuite garage', gravite: 'casse', urls: [GARAGE] }, // non portée : ignorée
      { titre: 'Usure lointaine', gravite: 'securite', urls: [PRESSE], usure_lointaine: true },
    ],
    questions_vendeur: ['a', 'b'],
    negociation: { total_min_eur: 400, total_max_eur: 750, nb_postes_chiffres: 2 },
    prix: { fourchette: { position: 'dans la moyenne', n: 18, source: 'releve' } },
    critair: { libelle: "Crit'Air 1" },
    recalcul: { faits: {} },
  }
  const f = ficheDepuisAnalyse('a', rj, { verdict: 'orange', score: 55 }, null)
  eq(f.pannes_portees.map((p) => p.titre), ['Courroie humide'], 'seules les pannes portées par une source indépendante sont comptées')
  eq(f.gravite_max, 'majeure', 'gravité max des pannes portées')
  eq(f.questions, 2, 'questions au vendeur')
  eq(f.travaux, { min: 400, max: 750, postes: 2 }, 'travaux chiffrés')
  eq(f.eliminatoire, null, 'orange sans fait grave : pas éliminé')
  eq(ficheDepuisAnalyse('a', { ...rj, recalcul: { faits: { compteur_contredit: true } } }, { verdict: 'orange', score: 55 }, null).eliminatoire,
    'kilométrage contredit par un document ou une photo', 'compteur contredit : éliminé')
  eq(ficheDepuisAnalyse('a', rj, { verdict: 'rouge', score: 30 }, null).eliminatoire, 'verdict rouge', 'rouge : éliminé')
}

// ── Recommandation ──────────────────────────────────────────────────────────
{
  const b = fiche('b', { score: 60, gravite_max: 'majeure', pannes_portees: [{ titre: 'x', gravite: 'majeure' }] })
  const r = recommander([fiche('a', { score: 72, prix: { demande: 9_200, position: null, n: null, source: null, percentile: null } }), b])
  eq(r.issue, 'recommande', 'A gagne score ET pannes : recommandée')
  eq(r.analysis_id, 'a', '… c’est bien A')
  eq(r.raisons.length, 3, 'trois raisons')
  ok(r.raisons.every((x) => /\d/.test(x.texte)), 'chaque raison est chiffrée')
  eq(r.raisons[2].critere, 'complement', 'la troisième est un complément chiffré (prix demandé plus bas)')
  // Aucun troisième fait favorable : on ne l'invente pas.
  const r2 = recommander([fiche('a', { score: 72 }), b])
  eq(r2.raisons.length, 2, 'sans fait favorable de plus : deux raisons, pas une troisième inventée')
}
{
  const r = recommander([fiche('a', { score: 63 }), fiche('b', { score: 60 })])
  eq(r.issue, 'indecis', `écart de score < ${SEUIL_SCORE} et rien d’autre : on ne tranche pas`)
  ok(/Impossible de départager/.test(r.motif), '… et on le dit')
}
{
  // Gagne le score, mais le coût n'est pas comparable (trous différents).
  const a = fiche('a', { score: 75, cout_3ans: { total_min: 9_000, total_max: 9_200, non_chiffrees: [{ libelle: 'Courroie de distribution', motif: '' }], partiel: true } })
  const b = fiche('b', { score: 60 })
  const r = recommander([a, b])
  eq(r.issue, 'indecis', 'un seul critère gagné, le coût non comparable : indécis')
  ok(r.manque.some((m) => /non comparable/.test(m) && /Courroie/.test(m)), 'la donnée qui manque est NOMMÉE')
}
{
  const a = fiche('a', { score: 75, cout_3ans: { total_min: 10_000, total_max: 10_400, non_chiffrees: [{ libelle: 'Carte grise', motif: '' }], partiel: true } })
  const b = fiche('b', { score: 66 })
  const r = recommander([a, b])
  eq(r.issue, 'recommande', 'score + coût sur 3 ans (mêmes trous) : recommandée')
  ok(r.raisons.some((x) => x.critere === 'cout_3ans'), 'le coût figure dans les raisons')
}
{
  // A gagne deux critères mais en PERD un : pas recommandée.
  const a = fiche('a', { score: 75, gravite_max: 'aucune', cout_3ans: { total_min: 14_000, total_max: 14_000, non_chiffrees: [{ libelle: 'Carte grise', motif: '' }], partiel: true } })
  const b = fiche('b', { score: 60, gravite_max: 'majeure' })
  eq(recommander([a, b]).issue, 'indecis', 'gagner deux critères en perdant le troisième ne suffit pas')
}
{
  const r = recommander([fiche('a', { eliminatoire: 'verdict rouge', verdict: 'rouge' }), fiche('b')])
  eq(r.issue, 'recommande', 'un seul restant après élimination')
  eq(r.analysis_id, 'b', '… le non éliminé')
  eq(r.ecartes.length, 1, 'l’écarté est listé avec son motif')
}
eq(recommander([fiche('a', { eliminatoire: 'verdict rouge' }), fiche('b', { eliminatoire: 'verdict rouge' })]).issue, 'aucune',
  'tous éliminés : aucune recommandation')
{
  // À trois : il faut battre CHACUN des deux autres.
  const r = recommander([
    fiche('a', { score: 80 }), fiche('b', { score: 70, gravite_max: 'majeure' }), fiche('c', { score: 78, gravite_max: 'majeure' }),
  ])
  eq(r.issue, 'indecis', 'à trois, A ne bat C que sur la gravité (écart de score 2) : indécis')
}
{
  // À trois : chaque raison nomme TOUS les rivaux battus sur le critère.
  const r = recommander([
    fiche('a', { score: 71 }),
    fiche('b', { score: 55, gravite_max: 'majeure', pannes_portees: [{ titre: 'x', gravite: 'majeure' }] }),
    fiche('c', { score: 51, gravite_max: 'mineure', pannes_portees: [{ titre: 'y', gravite: 'mineure' }] }),
  ])
  eq(r.issue, 'recommande', 'à trois, A bat B et C sur score et pannes')
  const sc = r.raisons.find((x) => x.critere === 'score')?.texte ?? ''
  ok(/55\/100/.test(sc) && /51\/100/.test(sc), `la raison de score cite les DEUX rivaux (${sc})`)
  const pa = r.raisons.find((x) => x.critere === 'pannes')?.texte ?? ''
  ok(/majeure/.test(pa) && /mineure/.test(pa), `la raison de pannes cite les DEUX rivaux (${pa})`)
}
// ── Garde-fou de budget (décision du 8 nov. 2026) ───────────────────────────
const prixDe = (demande, percentile = null) => ({ demande, position: null, n: null, source: null, percentile })
{
  const r = recommander([fiche('a', { score: 71, prix: prixDe(41_490) }), fiche('b', { score: 51, prix: prixDe(2_450) })])
  eq(r.issue, 'budgets', 'Mercedes 41 490 € face à Clio 2 450 € : pas de recommandation')
  eq(r.motif, 'Budgets trop différents pour comparer (écart de 39\u00a0040\u00a0€).', 'le motif donne l’écart en euros')
  eq(ECART_BUDGET_MAX, 0.30, 'seuil : 30 %')
  eq(recommander([fiche('a', { score: 80, prix: prixDe(10_000) }), fiche('b', { score: 60, gravite_max: 'majeure', prix: prixDe(13_000) })]).issue,
    'recommande', '30 % tout juste : comparaison permise')
  eq(recommander([fiche('a', { score: 80, prix: prixDe(10_000) }), fiche('b', { score: 60, gravite_max: 'majeure', prix: prixDe(13_001) })]).issue,
    'budgets', 'au-delà de 30 % : refus')
  eq(recommander([fiche('a', { score: 80, prix: prixDe(10_000), eliminatoire: 'verdict rouge' }), fiche('b', { prix: prixDe(20_000) }), fiche('c', { prix: prixDe(20_500) })]).issue,
    'budgets', 'le garde-fou porte sur TOUS les dossiers comparés, éliminés compris')
  const sansPrix = recommander([fiche('a', { score: 80 }), fiche('b', { score: 60, prix: prixDe(null) })])
  eq(sansPrix.issue, 'indecis', 'un prix manquant : budget invérifiable, on ne tranche pas')
  ok(sansPrix.manque.some((m) => /prix demandé/.test(m)), '… et le prix manquant est nommé')
}

// ── 4e critère : position du prix dans les comparables ─────────────────────
{
  const f = { p25: 9_000, mediane: 10_000, p75: 11_000 }
  eq(percentilePrix(10_000, f), { min: 50, max: 50 }, 'à la médiane : 50e')
  eq(percentilePrix(9_500, f), { min: 38, max: 38 }, 'entre P25 et médiane : interpolé')
  eq(percentilePrix(8_000, f), { min: 0, max: 25 }, 'sous P25 : intervalle, pas un chiffre inventé')
  eq(percentilePrix(12_000, f), { min: 75, max: 100 }, 'au-dessus de P75 : intervalle')
  eq(percentilePrix(10_000, { ...f, mediane_reference: 10_500 }), { min: 38, max: 38 }, 'bornes décalées comme la médiane de référence (kilométrage)')
  eq(percentilePrix(10_000, null), null, 'sans fourchette : rien')
  eq(SEUIL_PERCENTILE, 10, 'seuil : 10 points')

  // Score + position : recommandée.
  const r = recommander([
    fiche('a', { score: 70, prix: prixDe(10_000, { min: 30, max: 30 }) }),
    fiche('b', { score: 62, prix: prixDe(10_500, { min: 45, max: 45 }) }),
  ])
  eq(r.issue, 'recommande', 'score + position du prix (15 points) : 2 critères gagnés')
  ok(r.raisons.some((x) => x.critere === 'prix_position' && /30e percentile/.test(x.texte)), 'la raison de position est chiffrée')

  // Écart non garanti : intervalle [0,25] contre 30 → 5 points au mieux, pas gagné.
  eq(recommander([
    fiche('a', { score: 70, prix: prixDe(10_000, { min: 0, max: 25 }) }),
    fiche('b', { score: 62, prix: prixDe(10_500, { min: 30, max: 30 }) }),
  ]).issue, 'indecis', 'écart de percentile non garanti par les intervalles : critère non gagné')

  // Gagner 2 critères en PERDANT la position : pas de recommandation.
  eq(recommander([
    fiche('a', { score: 75, prix: prixDe(10_000, { min: 75, max: 100 }) }),
    fiche('b', { score: 60, gravite_max: 'majeure', prix: prixDe(9_000, { min: 0, max: 25 }) }),
  ]).issue, 'indecis', 'deux critères gagnés mais la position perdue : on ne tranche pas')

  const m = recommander([fiche('a', { score: 63 }), fiche('b', { score: 60 })])
  ok(m.manque.some((x) => /position du prix/.test(x)), 'position non évaluée : nommée dans ce qui manque')
}
// Déterminisme : même entrée, même sortie, 200 fois.
{
  const ent = [fiche('a', { score: 72 }), fiche('b', { score: 60, gravite_max: 'casse' })]
  const ref = JSON.stringify(recommander(ent))
  let diff = 0
  for (let i = 0; i < 200; i++) if (JSON.stringify(recommander(ent)) !== ref) diff++
  eq(diff, 0, 'déterministe sur 200 appels')
}
ok(SEUIL_COUT_EUR === 500, 'seuil de coût : 500 €')

// ── Garde-fous statiques ────────────────────────────────────────────────────
const src = readFileSync('supabase/functions/_shared/comparateur.ts', 'utf8')
ok(!/api\.anthropic\.com|fetch\(/.test(src), 'le comparateur n’appelle AUCUN modèle')
ok(!/\bvaleur\b|\bcote\b|estimation|expertise/i.test(src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')),
  'vocabulaire interdit absent du code exécuté')
const fn = readFileSync('supabase/functions/comparer/index.ts', 'utf8')
ok(fn.indexOf('passActif') < fn.indexOf('await req.json('), 'comparer : Pass vérifié avant de lire la demande')
ok(/hors_dossier/.test(fn) && fn.indexOf('hors_dossier') < fn.indexOf('.from("analyses")'),
  'comparer : l’appartenance au dossier est vérifiée AVANT de lire une analyse')

console.log(`\n${ko === 0 ? 'OK' : 'ÉCHEC'} — ${ok_}/${ok_ + ko} contrôles passés`)
if (ko > 0) { console.error(`${ko} échec(s) dans tests/comparateur.test.mjs`); process.exit(1) }
console.log('Tous les tests comparateur passent.')
