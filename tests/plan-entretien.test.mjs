// Test hors ligne des plans d'entretien sourcés (sprint 22). Aucun réseau.
// Usage : node tests/plan-entretien.test.mjs
import { readFileSync } from 'node:fs'
import {
  affirmationIntervalle, candidats, fusionnerPlan, intervalleAnsPresent, intervalleKmPresent, PLAN_TOOL,
} from '../supabase/functions/_shared/planEntretien.ts'

let ok_ = 0, ko = 0
const ok = (c, l) => { if (c) ok_++; else { ko++; console.log(`FAIL — ${l}`) } }
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (obtenu ${JSON.stringify(a)}, attendu ${JSON.stringify(b)})`)

const PRESSE = 'https://www.largus.fr/actualite-automobile/puretech-courroie'
const GARAGE = 'https://www.vroomly.com/blog/courroie'

// ── Le chiffre doit être LITTÉRALEMENT sur la page ─────────────────────────
ok(intervalleKmPresent('à remplacer tous les 100 000 km ou 6 ans', 100000), '« 100 000 km »')
ok(intervalleKmPresent('tous les 100.000 km', 100000), '« 100.000 km »')
ok(intervalleKmPresent('tous les 100000 km', 100000), '« 100000 km »')
ok(intervalleKmPresent('intervalle : 100 000 km', 100000), 'espaces insécables')
ok(!intervalleKmPresent('tous les 180 000 km', 100000), 'un autre chiffre ne vaut pas')
ok(!intervalleKmPresent('1100000 km', 100000), 'un chiffre inclus dans un plus grand ne vaut pas')
ok(intervalleAnsPresent('ou tous les 6 ans', 6), '« 6 ans »')
ok(intervalleAnsPresent('tous les six ans', 6), '« six ans »')
ok(!intervalleAnsPresent('tous les 16 ans', 6), '« 16 ans » ne vaut pas « 6 ans »')
ok(!intervalleAnsPresent('version 6 du moteur', 6), 'un « 6 » sans unité ne prouve rien')
ok(!intervalleAnsPresent('2,6 ans', 6), 'une décimale ne vaut pas')

// ── Candidats : bornes et rang ──────────────────────────────────────────────
const c = candidats([
  { operation: 'Courroie de distribution', intervalle_km: 100000, intervalle_annees: 6, url_source: [PRESSE, GARAGE] },
  { operation: 'Vidange', intervalle_km: 20, intervalle_annees: 0, url_source: [PRESSE] },
  { operation: 'Liquide de frein', intervalle_km: 0, intervalle_annees: 2, url_source: [GARAGE] },
  { operation: '', intervalle_km: 30000, intervalle_annees: 0, url_source: [PRESSE] },
])
eq(c.length, 3, 'une opération sans nom est ignorée')
eq(c[0].portantes, [PRESSE], 'seules les pages PORTANTES sont retenues pour l’échéance')
eq(c[1].intervalle_km, 0, '20 km n’est pas un intervalle : hors bornes, mis à 0')
eq(c[2].portantes, [], 'un garage seul : aucune page portante')
ok(!JSON.stringify(PLAN_TOOL).includes('cout'), 'l’outil ne demande AUCUN prix (il viendrait mal étiqueté)')
ok(/la rédaction|PRESSE/i.test(affirmationIntervalle('x', 'EB2', 1, null)) === false && /tous les 100000 km ou tous les 6 ans/.test(affirmationIntervalle('Courroie', 'EB2', 100000, 6)),
  'l’affirmation soumise au juge est précise')

// ── Fusion ADDITIVE ─────────────────────────────────────────────────────────
const etablie = { operation: 'Vidange moteur', intervalle_km: 20000, intervalle_annees: 1, critique: true, lie_a_panne: 'Courroie humide', cout_min_eur: null, cout_max_eur: null, url_source: [PRESSE], a_verifier_carnet: false }
const carnet = { operation: 'Courroie de distribution', intervalle_km: null, intervalle_annees: null, critique: true, lie_a_panne: 'Courroie humide', cout_min_eur: null, cout_max_eur: null, url_source: [], a_verifier_carnet: true }
const ajout = (o) => ({ critique: false, lie_a_panne: null, cout_min_eur: 999, cout_max_eur: 999, a_verifier_carnet: false, ...o })
{
  const f = fusionnerPlan([etablie, carnet], [
    ajout({ operation: 'Courroie de distribution', intervalle_km: 100000, intervalle_annees: 6, url_source: [PRESSE] }),
    ajout({ operation: 'Vidange moteur', intervalle_km: 15000, intervalle_annees: 1, url_source: [PRESSE] }),
    ajout({ operation: 'Liquide de frein', intervalle_km: null, intervalle_annees: 2, url_source: [PRESSE] }),
    ajout({ operation: 'Filtre à air', intervalle_km: 40000, intervalle_annees: null, url_source: [GARAGE] }),
  ])
  eq([f.ajoutees, f.completees], [1, 1], 'une opération ajoutée, une complétée')
  eq(f.plan.find((o) => o.operation === 'Vidange moteur').intervalle_km, 20000, '⚠️ une opération DÉJÀ établie n’est JAMAIS écrasée')
  const courroie = f.plan.find((o) => o.operation === 'Courroie de distribution')
  ok(courroie.intervalle_km === 100000 && !courroie.a_verifier_carnet, 'une opération « à vérifier au carnet » est complétée')
  ok(courroie.critique && courroie.lie_a_panne === 'Courroie humide', '… en gardant son lien à la panne')
  ok(f.refusees.some((r) => /Filtre/.test(r)), 'un intervalle porté par un garage seul est REFUSÉ à l’écriture')
  ok(f.plan.every((o) => o.cout_min_eur == null || o === f.plan[0]), 'aucun prix n’entre par le plan')
  eq(f.plan.length, 3, 'rien n’est supprimé : 2 existantes + 1 ajoutée (la courroie est complétée, pas dupliquée)')
}
eq(fusionnerPlan([etablie], []).plan, [etablie], 'un ajout vide ne change rien')

// ── Garde-fous statiques ────────────────────────────────────────────────────
const sb = readFileSync('supabase/functions/sheet-builder/index.ts', 'utf8')
const brancheplan = sb.slice(sb.indexOf('body?.mode === "plan"'), sb.indexOf('Mode « programmes »'))
ok(brancheplan.length > 100 && !/\.update\(|\.insert\(|\.upsert\(|\.delete\(/.test(brancheplan), 'le mode « plan » n’écrit rien dans les fiches')
const pb = readFileSync('supabase/functions/_shared/planBuilder.ts', 'utf8')
ok(!/defect_sheets|repair_costs/.test(pb), 'le générateur ne touche ni aux fiches ni aux coûts')
ok(pb.indexOf('intervalleKmPresent(t') < pb.indexOf('await voter('), 'le contrôle littéral (gratuit) précède le juge (payant)')
ok(pb.indexOf('portantes.length === 0') < pb.indexOf('await texteDeLaPage'), 'aucune page n’est lue sans source portante')
ok(/USD_PAR_RECHERCHE/.test(pb), 'les recherches web sont comptées dans le coût')
const adm = readFileSync('supabase/functions/admin-defect-sheets/index.ts', 'utf8')
ok(adm.indexOf('verifierAdmin(') < adm.indexOf('ajouter_plan'), 'ajouter_plan : réservé à un administrateur')
ok(/fusionnerPlan\(avant, body\.ajouter_plan\)/.test(adm), 'ajouter_plan passe par la fusion additive (rang recontrôlé)')
ok(/plan_avant: avant/.test(adm), 'le plan d’avant est renvoyé pour le retour arrière')

console.log(`\n${ko === 0 ? 'OK' : 'ÉCHEC'} — ${ok_}/${ok_ + ko} contrôles passés`)
if (ko > 0) { console.error(`${ko} échec(s) dans tests/plan-entretien.test.mjs`); process.exit(1) }
console.log('Tous les tests plan-entretien passent.')
