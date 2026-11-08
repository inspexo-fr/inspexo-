// Test HORS LIGNE du mur budgétaire. Usage : node tests/budget-eval.test.mjs
//
// La règle : « le compteur s'arrête de lui-même au budget annoncé, et tu me
// demandes avant d'aller au-delà, sans exception » (Utku, 5 nov. 2026).
//
// Ce test existe parce que la PREMIÈRE implémentation de cette règle la
// violait : elle s'arrêtait quand le cumul avait déjà dépassé le budget, donc
// le dernier cas démarrait sous le mur et le franchissait en finissant. Un run
// annoncé à 0,40 € a coûté 0,447 €.
import { readFileSync } from 'node:fs'
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

// ---------------------------------------------------------------------------
// ⚠️ L'UNITÉ DU MUR — le défaut du 5 novembre 2026, second tour.
//
// Dans l'éval, une unité est un CAS pendant la première phase, puis un PASSAGE
// pendant la phase de stabilité : trois fois moins cher. Le mur divisait le
// coût TOTAL du run par un nombre de PASSAGES, donc réservait un coût de cas
// avant chaque passage — et s'arrêtait beaucoup trop tôt. Mesuré : un run
// annoncé à 1,20 € arrêté à 1,024 €, un run à 0,30 € arrêté à 0,185 €. Les
// passages non joués étaient rapportés comme « analyses en erreur ».
// ---------------------------------------------------------------------------
{
  // Le cas RÉEL de ce jour-là : 4 cas joués pour 0,94 €, puis la phase de
  // stabilité où un passage coûte 0,08 €. Mur à 1,20 €.
  const coutCas = 0.94
  const parPassage = 0.08

  // AVANT (le défaut) : la réserve valait coutRun / passages, soit presque le
  // coût d'un cas entier. Reproduit en ne passant PAS coutUnites.
  const avant = murAtteint({
    coutRun: coutCas + 2 * parPassage, casJoues: 2, coutSession: coutCas + 2 * parPassage,
    budgetRun: 1.2, plafondSession: 5,
  })
  ok(avant === 'run', 'AVANT : le mur se déclenchait après deux passages seulement')

  // APRÈS : la réserve se calcule sur la dépense de la PHASE.
  const apres = murAtteint({
    coutRun: coutCas + 2 * parPassage, casJoues: 2, coutSession: coutCas + 2 * parPassage,
    budgetRun: 1.2, plafondSession: 5, coutUnites: 2 * parPassage,
  })
  ok(apres === null, 'APRÈS : les trois passages tiennent dans le budget annoncé')

  // ⚠️ Et le mur PROTÈGE TOUJOURS : la comparaison porte sur le coût TOTAL,
  // pas sur celui de la phase. On ne s'autorise pas à dépasser le budget sous
  // prétexte qu'une partie de la dépense n'entre pas dans la moyenne.
  const auBord = murAtteint({
    coutRun: 1.15, casJoues: 2, coutSession: 1.15,
    budgetRun: 1.2, plafondSession: 5, coutUnites: 2 * parPassage,
  })
  ok(auBord === 'run', 'le mur mord encore quand le TOTAL approche le budget')

  // Le plafond de session reste évalué de la même façon.
  const session = murAtteint({
    coutRun: 0.5, casJoues: 2, coutSession: 4.97,
    budgetRun: 10, plafondSession: 5, coutUnites: 2 * parPassage,
  })
  ok(session === 'session', 'le plafond de session mord indépendamment du budget du run')

  // Compatibilité : sans coutUnites, le comportement est EXACTEMENT l'ancien.
  for (const [cr, cj] of [[0.4, 4], [1.0, 3], [0.12, 1], [0, 0]]) {
    ok(coutProchainCas(cr, cj) === coutProchainCas(cr, cj, undefined, null),
      `sans coutUnites, la réserve est inchangée (${cr}/${cj})`)
  }
  ok(Math.abs(coutProchainCas(1.1, 2, undefined, 0.16) - 0.08) < 1e-9,
    'avec coutUnites, la réserve est celle de la phase')
  ok(coutProchainCas(1.1, 0, 0.09, 0.0) === 0.09, 'avant la première unité, l’estimation prudente s’applique quand même')
}


console.log(`\n${ok_} contrôles passés, ${ko} échec(s).`)

// ──────────────────────────────────────────────────────────────────────────
// ⚠️ UN MUR QUI LIT UN CHAMP INEXISTANT N'EST PAS UN MUR (6 nov. 2026)
//
// `scripts/resourcer-fiches.mjs` lisait `cout_usd` ; `atlas-builder` rend
// `cout_eur`. Le coût relevé valait donc 0 € à chaque panne, la réserve du mur
// était nulle, et la campagne annoncée à 9 € aurait joué ses 105 unités à
// ≈ 21 €. Le mur existait, son entrée était muette.
//
// Ce contrôle exige que le script S'ARRÊTE quand le coût n'est pas chiffrable,
// au lieu de le lire comme un zéro.
{
  const src = readFileSync('scripts/resourcer-fiches.mjs', 'utf8')
  ok(/typeof r\.cout_eur !== 'number'/.test(src),
    'resourcer-fiches vérifie que le coût est un nombre')
  ok(/process\.exit\(1\)/.test(src.slice(src.indexOf("typeof r.cout_eur !== 'number'"),
    src.indexOf("typeof r.cout_eur !== 'number'") + 700)),
    'et il s’ARRÊTE au lieu de continuer à l’aveugle')
  // ⚠️ Le champ fautif est NOMMÉ dans le commentaire qui explique le défaut,
  // et c'est très bien ainsi : ce qui est interdit, c'est de le LIRE.
  ok(!/r\??[.[]\s*['"]?cout_usd/.test(src), 'et il ne LIT plus le champ fautif')
  const fn = readFileSync('supabase/functions/atlas-builder/index.ts', 'utf8')
  ok(/cout_eur: Math\.round\(usd/.test(fn),
    'et atlas-builder rend bien `cout_eur` — le nom que le script lit')
}

// ⚠️ LA PORTE DE SORTIE EST LA DERNIÈRE INSTRUCTION DU FICHIER, ET ELLE EST
// FUSIONNÉE AVEC LE MESSAGE DE SUCCÈS. Elle se trouvait ligne 118, donc AVANT
// le bloc ajouté le 6 nov. 2026 : la suite affichait « Mur budgétaire :
// conforme » avec un FAIL à l'écran et sortait en 0. CINQUIÈME occurrence de
// ce motif dans le projet (inspection ×2, atlas-source, visio, ici). On ne
// peut plus annoncer la conformité sans avoir franchi le contrôle.
if (ko > 0) {
  console.error(`\n${ko} échec(s) dans tests/budget-eval.test.mjs`)
  process.exit(1)
}
console.log('Mur budgétaire : conforme.')
