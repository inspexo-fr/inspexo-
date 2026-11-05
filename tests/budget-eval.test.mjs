// Test HORS LIGNE du mur budgétaire. Usage : node tests/budget-eval.test.mjs
//
// La règle : « le compteur s'arrête de lui-même au budget annoncé, et tu me
// demandes avant d'aller au-delà, sans exception » (Utku, 5 nov. 2026).
//
// Ce test existe parce que la PREMIÈRE implémentation de cette règle la
// violait : elle s'arrêtait quand le cumul avait déjà dépassé le budget, donc
// le dernier cas démarrait sous le mur et le franchissait en finissant. Un run
// annoncé à 0,40 € a coûté 0,447 €.
import { COUT_CAS_ESTIME_EUR, coutProchainCas, murAtteint } from '../scripts/budget.mjs'

let ok_ = 0, ko = 0
const ok = (c, l) => { if (c) { ok_++; console.log(`PASS — ${l}`) } else { ko++; console.log(`FAIL — ${l}`) } }
const eq = (a, b, l) => ok(a === b, `${l}${a === b ? '' : ` (obtenu ${JSON.stringify(a)}, attendu ${JSON.stringify(b)})`}`)

// ── Réservation ────────────────────────────────────────────────────────────
eq(coutProchainCas(0, 0), COUT_CAS_ESTIME_EUR, 'avant le premier cas : estimation prudente')
eq(coutProchainCas(0.36, 4), 0.09, 'après 4 cas à 0,09 € : la moyenne observée')

// ── LE CAS RÉEL DU 5 NOVEMBRE ──────────────────────────────────────────────
//
// Cinq cas à ≈ 0,0894 €, budget annoncé 0,40 €. L'ancienne règle laissait
// partir le cinquième (cumul 0,358 € < 0,40 €) et finissait à 0,447 €.
// La nouvelle doit s'arrêter après le quatrième.
{
  const C = 0.0894
  const budgetRun = 0.40, plafondSession = 5, coutSession0 = 2.63
  let coutRun = 0, casJoues = 0, joues = 0
  for (let i = 0; i < 5; i++) {
    const m = murAtteint({ coutRun, casJoues, coutSession: coutSession0 + coutRun, budgetRun, plafondSession })
    if (m) break
    coutRun += C; casJoues += 1; joues += 1
  }
  eq(joues, 4, 'budget 0,40 € et cas à 0,0894 € : quatre cas joués, pas cinq')
  ok(coutRun <= budgetRun, `et le total reste SOUS le mur (${coutRun.toFixed(3)} € ≤ 0,40 €)`)
}

// ── Le mur de session l'emporte quand il est plus proche ────────────────────
eq(murAtteint({ coutRun: 0, casJoues: 0, coutSession: 4.95, budgetRun: 2, plafondSession: 5 }), 'session',
  'plafond de session atteint : motif « session », même si le budget du run est large')
eq(murAtteint({ coutRun: 0.35, casJoues: 4, coutSession: 3, budgetRun: 0.40, plafondSession: 5 }), 'run',
  'budget du run atteint : motif « run »')
eq(murAtteint({ coutRun: 0.1, casJoues: 2, coutSession: 1, budgetRun: 1, plafondSession: 5 }), null,
  'loin des deux murs : on continue')

// ── Sans budget annoncé, seul le plafond de session protège ─────────────────
eq(murAtteint({ coutRun: 9, casJoues: 10, coutSession: 4.2, budgetRun: null, plafondSession: 5 }), 'session',
  'sans --budget, le plafond de session garde la main')
eq(murAtteint({ coutRun: 1, casJoues: 10, coutSession: 1, budgetRun: null, plafondSession: 5 }), null,
  'sans --budget et loin du plafond : on continue')

// ⚠️ Un budget inférieur au coût d'un seul cas doit tout bloquer. Autrement
// « --budget 0.01 » laisserait passer un cas à 0,10 €, ce qui est exactement
// le contraire de ce qu'on demande.
eq(murAtteint({ coutRun: 0, casJoues: 0, coutSession: 0, budgetRun: 0.01, plafondSession: 5 }), 'run',
  'budget plus petit que le coût d’un cas : AUCUN cas joué')

console.log(`\n${ok_} contrôles passés, ${ko} échec(s).`)
if (ko > 0) process.exit(1)
console.log('Mur budgétaire : conforme.')
