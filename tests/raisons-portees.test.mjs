// Tests hors ligne : une panne non confirmée n'est ni une raison ni un poste
// du budget (audit de cohérence, sprint 24). Usage : node tests/raisons-portees.test.mjs
import fs from 'node:fs'
import { affirmePanneNonConfirmee as f, CONSIGNE_NON_CONFIRMEE } from '../supabase/functions/_shared/raisonsPortees.ts'
let ok_ = 0, ko = 0
const ok = (c, l) => { if (c) { ok_++; console.log(`PASS — ${l}`) } else { ko++; console.log(`FAIL — ${l}`) } }

const nc = [
  { ref: 'F3', titre: 'Défaillances injecteurs sur les premières motorisations 220/250 (OM654)' },
  { ref: 'F2', titre: "Surconsommation d'huile moteur (usure des segments)" },
]
const c = [
  { ref: 'F1', titre: 'Usure prématurée des culbuteurs (linguets) à rouleau/galet et des arbres à cames' },
  { ref: 'A1', titre: "Courroie de distribution 1.2 PureTech dans le bain d'huile" },
]
// Les deux cas réels du 13 nov. 2026 (dossiers de référence Mercedes et 308).
ok(f("Des défaillances d'injecteurs ont été rapportées comme défaut de jeunesse sur les premières versions 220/250 de ce moteur.", nc, c), 'Mercedes : raison « injecteurs » retirée')
ok(f("Risque de surconsommation d'huile liée à l'usure des segments, aggravée par la dégradation de la courroie.", nc, c), '308 : raison « surconsommation d’huile » retirée')
// Raisons légitimes conservées.
ok(!f("L'OM654 présente un risque connu d'usure des culbuteurs/arbres à cames, casse coûteuse (jusqu'à 7 000 €).", nc, c), 'panne confirmée : raison gardée')
ok(!f("Distribution jamais faite annoncée par le vendeur alors que le kit en bain d'huile est à surveiller.", nc, c), 'distribution (confirmée) : raison gardée')
ok(!f("Le prix d'en-tête ne correspond pas au montant réellement dû.", nc, c), 'raison sans panne : gardée')
// Références.
ok(f('Défaut signalé (F2) sur ce moteur.', nc, c), 'référence d’une panne non confirmée ⇒ retirée')
ok(!f('Défaut signalé (F21) sur ce moteur.', [{ ref: 'F2', titre: 'x y' }], []), 'F2 ne mord pas sur F21')
ok(!f('Voir A1.', nc, c), 'référence d’une panne confirmée ⇒ gardée')
ok(!f('Les injecteurs ont été remplacés.', nc, c), 'un seul mot commun ne suffit pas')
ok(/JAMAIS dans raisons_principales ni dans budget_12_mois/.test(CONSIGNE_NON_CONFIRMEE), 'consigne au modèle explicite')

// Câblage dans score : marquage du catalogue, budget et raisons filtrés.
const s = fs.readFileSync('supabase/functions/score/index.ts', 'utf8')
ok(/confirmation: CONSIGNE_NON_CONFIRMEE/.test(s), 'score : entrées non confirmées marquées dans le catalogue du modèle')
ok(/refsNonConfirmees\.has\(String\(src\.ref\)\)\) return null/.test(s), 'score : budget sans panne non confirmée')
ok(s.indexOf('affirmePanneNonConfirmee(r, nonConfirmees, confirmees)') > 0 && s.indexOf('affirmePanneNonConfirmee(r, nonConfirmees, confirmees)') < s.indexOf('const raisonsAvantCritique'), 'score : raisons filtrées avant la critique et le filet « jamais zéro raison »')

// Pages /moteur : n'affirment que les pannes confirmées.
const mp = fs.readFileSync('supabase/functions/moteur-public/index.ts', 'utf8')
ok(/pannes: confirmees,/.test(mp) && /sourcesPortentLEntree\(urlsDeLaPanne\(p\)\)/.test(mp), 'moteur-public : `pannes` = confirmées seulement')
ok(/pointProprietaire\(/.test(mp) && /questionSansSourceIndependante\(/.test(mp), 'moteur-public : non confirmées ⇒ point des propriétaires ou question')
const page = fs.readFileSync('src/pages/MoteurPage.jsx', 'utf8')
ok(/Les pannes confirmées, une par une/.test(page) && !/pannes connues du \$\{nom\}/.test(page), 'MoteurPage : plus de « pannes connues » pour des pannes non confirmées')
ok(/questionsNonConfirmees\.slice/.test(page) && /PointsProprietairesBloc points=\{pointsProprietaires\}/.test(page), 'MoteurPage : questions et points des propriétaires affichés')
ok(!/consulter HistoVec \?/.test(page), 'MoteurPage : plus de « VIN pour consulter HistoVec » (un acheteur ne le peut pas)')
const og = fs.readFileSync('api/og.js', 'utf8')
ok(!/result_json\?\.raisons/.test(og), 'aperçu de partage : ne recopie aucune raison du dossier')

if (ko) { console.log(`\n${ko} échec(s), ${ok_} réussite(s)`); process.exit(1) } else console.log(`\nTous les tests passent (${ok_})`)
