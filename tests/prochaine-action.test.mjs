// Tests hors ligne : la prochaine action du premier écran (sprint 23, lot 3).
// Usage : node tests/prochaine-action.test.mjs
import fs from 'node:fs'
import { prochaineAction } from '../src/data/prochaineAction.js'
let ok_ = 0, ko = 0
const ok = (c, l) => { if (c) { ok_++; console.log(`PASS — ${l}`) } else { ko++; console.log(`FAIL — ${l}`) } }
const base = { type: 'vehicule', verdict: 'orange', message_vendeur: 'Bonjour…', checklist_sur_place: ['x'], securite_transaction: { signaux_arnaque: [] } }
ok(prochaineAction({ ...base, securite_transaction: { signaux_arnaque: [{ code: 'acompte' }] }, verdict: 'vert' })?.ancre === '#transaction', 'un signal d\'arnaque passe avant tout, même sur un vert')
ok(prochaineAction({ ...base, verdict: 'rouge' })?.ancre === '#message', 'rouge : questions au vendeur')
ok(/Ne vous engagez pas/.test(prochaineAction({ ...base, verdict: 'rouge' })?.texte), 'rouge : jamais une incitation à acheter')
ok(prochaineAction({ ...base, verdict: 'rouge', message_vendeur: null })?.ancre === '#motifs', 'rouge sans message : les motifs')
ok(prochaineAction(base)?.ancre === '#message', 'orange : message au vendeur')
ok(prochaineAction({ ...base, verdict: 'vert' })?.ancre === '#checklist', 'vert : préparer la visite')
ok(prochaineAction({ ...base, verdict: 'vert', checklist_sur_place: [] })?.ancre === '#message', 'vert sans checklist : message')
ok(prochaineAction({ ...base, statut_analyse: 'en_cours' }) === null, 'analyse en cours : aucune action')
ok(prochaineAction({ type: 'autre' }) === null, 'pas un véhicule : aucune action')
const src = fs.readFileSync(new URL('../src/data/prochaineAction.js', import.meta.url), 'utf8')
ok(!/partenaire|\/go\/|assurance|cr[ée]dit/i.test(src.replace(/^\/\/.*$/gm, '')), 'jamais de partenaire dans la prochaine action')
const page = fs.readFileSync(new URL('../src/pages/ResultPage.jsx', import.meta.url), 'utf8')
for (const id of ['transaction', 'message', 'checklist', 'motifs']) {
  const n = id === 'transaction' ? fs.readFileSync(new URL('../src/components/SecuriteTransactionBloc.jsx', import.meta.url), 'utf8') : page
  ok(new RegExp(`id="${id}"`).test(n), `l'ancre #${id} existe`)
}
const iVerdict = page.indexOf('{/* Verdict */}'), iMotifs = page.indexOf('id="motifs"'), iAction = page.indexOf('prochaineAction('), iSpecs = page.indexOf('<dl className="specs">')
ok(iVerdict > 0 && iVerdict < iMotifs && iMotifs < iAction && iAction < iSpecs, 'premier écran : verdict, puis motifs, puis prochaine action, puis le reste')
console.log(`\n${ok_} PASS, ${ko} FAIL`)
if (ko > 0) process.exit(1)
