// Test hors ligne de la règle (c2) du sprint 23 : une opération n'est « non
// faite » que si l'annonce l'écrit. Usage : node tests/operations-non-faites.test.mjs
import { readFileSync } from 'node:fs'
import {
  compterCritiquesNonFaites,
  detecterEntretienDeclare,
  operationsModeleNonEtablies,
  questionOperationModele,
} from '../supabase/functions/_shared/entretienDeclare.ts'

let ok_ = 0, ko = 0
const ok = (c, l) => { if (c) { ok_++; console.log(`PASS — ${l}`) } else { ko++; console.log(`FAIL — ${l}`) } }
const eq = (a, b, l) => ok(a === b, `${l}${a === b ? '' : ` (obtenu ${JSON.stringify(a)}, attendu ${JSON.stringify(b)})`}`)
const lire = (c) => readFileSync(new URL(`./eval/${c}/annonce.txt`, import.meta.url), 'utf8')

// ── Le cas réel : la S7 du 11 nov. 2026 ─────────────────────────────────────
const s7 = lire('audi-s7-intermediaire')
const faitsS7 = detecterEntretienDeclare(s7)
eq(faitsS7.filter((f) => f.statut !== 'fait').length, 0, 'S7 : l’annonce n’écrit aucune opération non faite')
eq(compterCritiquesNonFaites(faitsS7), 0, 'S7 : zéro opération critique non faite, quel que soit le modèle')
const absence = 'Aucune confirmation explicite que le rappel constructeur 21H7 sur les turbocompresseurs a été effectué'
const qS7 = operationsModeleNonEtablies([absence], faitsS7)
eq(qS7.length, 1, 'S7 : l’absence d’information du modèle est écartée des faits…')
ok(/^Point à confirmer : .*facture à l’appui \?$|^Point à confirmer : .*facture à l'appui \?$/.test(questionOperationModele(qS7[0])), '… et devient une question au vendeur')

// ── Ce que l'annonce écrit reste un fait ────────────────────────────────────
const f308 = detecterEntretienDeclare(lire('308-puretech-complete'))
eq(compterCritiquesNonFaites(f308), 1, '308 : « Distribution jamais faite » reste une opération critique non faite')
eq(operationsModeleNonEtablies(['Remplacement de la courroie de distribution jamais effectué'], f308).length, 0,
  '308 : la même opération dite par le modèle n’est pas reposée en question (doublon)')
const fClio = detecterEntretienDeclare(lire('revendeur-clio2-dci'))
eq(compterCritiquesNonFaites(fClio), 1, 'Clio II : la distribution non faite écrite dans l’annonce reste comptée')
eq(compterCritiquesNonFaites(detecterEntretienDeclare(lire('mercedes-2025-societe'))), 0, 'Mercedes : rien')

// ── Le modèle ne peut plus créer une opération non faite ────────────────────
const muet = 'Golf 7 TDI 150, 2016, 120 000 km. Très bon état.'
const fMuet = detecterEntretienDeclare(muet)
eq(compterCritiquesNonFaites(fMuet), 0, 'annonce muette : aucune opération critique')
eq(operationsModeleNonEtablies(['Distribution jamais faite', 'Embrayage d’origine'], fMuet).length, 2,
  'annonce muette : les deux opérations inventées par le modèle deviennent des questions')
eq(operationsModeleNonEtablies(['', '   '], fMuet).length, 0, 'entrées vides ignorées')

// ── La question ne déborde pas ──────────────────────────────────────────────
const longue = questionOperationModele(Array.from({ length: 40 }, (_, i) => `mot${i}`).join(' '))
ok(longue.includes('mot19…') && !longue.includes('mot20') && !longue.includes('….'), 'une opération longue est tronquée à 20 mots, sans « …. »')

// ── Le câblage dans score : la liste ne vient QUE du filet ──────────────────
const src = readFileSync(new URL('../supabase/functions/score/index.ts', import.meta.url), 'utf8')
const iModele = src.indexOf('const opsDuModele = opsNonFaites;')
const mVide = /^[ \t]*opsNonFaites = \[\];/m.exec(src.slice(iModele))
const iVide = mVide ? iModele + mVide.index : -1
const iFilet = src.indexOf('for (const f of declaresNegatifs)', iModele)
ok(iModele > 0 && iVide > iModele && iFilet > iVide, 'score vide la liste du modèle AVANT d’y verser le filet')
ok(!/opsNonFaites\.push\(\s*(?:op|x|q)\b/.test(src.slice(iModele)), 'aucune opération du modèle n’est repoussée dans la liste après le vidage')
ok(/const opsCritiques = Math\.max\(opsCritiquesNonFaites, compterCritiquesNonFaites\(faitsEntretien\)\)/.test(src),
  'le décompte critique repose sur la liste vidée et sur le filet')

// ⚠️ La porte de sortie est la DERNIÈRE instruction, fusionnée avec le succès.
console.log(`\n${ok_} contrôles passés, ${ko} échec(s).`)
if (ko > 0) process.exit(1); else console.log('Tous les tests opérations non faites passent.')
