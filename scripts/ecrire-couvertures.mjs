#!/usr/bin/env node
// ÉCRITURE des couvertures multi-marques RELUES par Utku (sprint 23, étape e).
//
// Lit docs/couvertures-proposees.json (produit par proposer-couvertures.mjs et
// relu), retrouve chaque fiche par « marque famille_moteur » via
// admin-defect-sheets (GET, jeton admin), puis écrit sa couverture
// (PATCH definir_couverture). Aucune dépense IA.
//
//   node scripts/ecrire-couvertures.mjs              simulation : ce qui serait écrit
//   node scripts/ecrire-couvertures.mjs --appliquer  écrit (jeton admin)
//   node scripts/ecrire-couvertures.mjs --restaurer  remet les couvertures d'AVANT
//
// ⚠️ Écrire une couverture CHANGE DES SCORES (des fiches servent désormais à
// d'autres marques) : c'est le changement (e) de la séquence, suivi des
// 4 références × 3. La couverture d'avant est sauvegardée pour le retour
// arrière. Arrêt au premier écart : fiche introuvable ou ambiguë, entrée
// rejetée par le serveur (`couvertureValide`).
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const args = process.argv.slice(2)
const APPLIQUER = args.includes('--appliquer')
const RESTAURER = args.includes('--restaurer')
const PROPOSITION = new URL('../docs/couvertures-proposees.json', import.meta.url)
const JOURNAL = new URL('../docs/couvertures-ecrites-journal.json', import.meta.url)

const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  .split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]))
const U = env.REACT_APP_SUPABASE_URL, ANON = env.REACT_APP_SUPABASE_ANON_KEY
const jeton = () => {
  const j = env.ADMIN_ACCESS_TOKEN ?? ''
  if (!j) { console.error('\nIl manque ADMIN_ACCESS_TOKEN dans .env.local (jeton d’une heure).\n'); process.exit(1) }
  return j
}
const appel = async (method, body) => {
  const res = await fetch(`${U}/functions/v1/admin-defect-sheets`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton()}`, apikey: ANON },
    body: body ? JSON.stringify(body) : undefined,
  })
  const j = await res.json().catch(() => null)
  if (!res.ok) { console.error(`\n  ⚠️ ARRÊT — HTTP ${res.status} : ${JSON.stringify(j)}`); process.exit(1) }
  return j
}

// ── --restaurer ─────────────────────────────────────────────────────────────
if (RESTAURER) {
  if (!existsSync(JOURNAL)) { console.error('Aucun journal d’écriture : rien à restaurer.'); process.exit(1) }
  const J = JSON.parse(readFileSync(JOURNAL, 'utf8'))
  for (const e of J.ecritures) {
    const r = await appel('PATCH', { id: e.id, definir_couverture: e.couverture_avant })
    console.log(`  restaurée  ${e.fiche} → ${r.entrees} entrée(s)`)
  }
  console.log('\n  Couvertures d’avant remises. ⚠️ RETIRER ADMIN_ACCESS_TOKEN de .env.local.')
  process.exit(0)
}

const P = JSON.parse(readFileSync(PROPOSITION, 'utf8'))
const fiches = Object.entries(P.couvertures)
const total = fiches.reduce((n, [, l]) => n + l.length, 0)
console.log(`\nCOUVERTURES — ${total} entrée(s) sur ${fiches.length} fiche(s) (${APPLIQUER ? 'ÉCRITURE' : 'simulation'})\n`)
for (const [fiche, liste] of fiches) {
  console.log(`  ${fiche}`)
  for (const e of liste) console.log(`     ${e.marque} ${e.modele} ${e.annee_debut}-${e.annee_fin}`)
}
if (!APPLIQUER) { console.log('\n  Simulation : rien n’est écrit. --appliquer pour écrire (jeton admin).'); process.exit(0) }

// ── --appliquer ─────────────────────────────────────────────────────────────
const { sheets } = await appel('GET')
const ecritures = []
for (const [fiche, liste] of fiches) {
  const trouvees = (sheets ?? []).filter((s) => `${s.marque} ${s.famille_moteur}` === fiche)
  if (trouvees.length !== 1) { console.error(`\n  ⚠️ ARRÊT — « ${fiche} » : ${trouvees.length} fiche(s) trouvée(s), il en faut exactement une. Rien d’autre n’est écrit.`); break }
  const s = trouvees[0]
  const entrees = liste.map(({ marque, modele, annee_debut, annee_fin }) => ({ marque, modele, annee_debut, annee_fin }))
  const r = await appel('PATCH', { id: s.id, definir_couverture: entrees })
  ecritures.push({ fiche, id: s.id, couverture_avant: r.couverture_avant ?? [], couverture_apres: r.couverture_apres ?? [] })
  writeFileSync(JOURNAL, JSON.stringify({ ecrit_le: new Date().toISOString(), ecritures }, null, 1) + '\n')
  console.log(`  écrite  ${fiche} : ${r.entrees} entrée(s)${r.rejetees ? ` · ⚠️ ${r.rejetees} REJETÉE(S)` : ''}`)
  if (r.rejetees) { console.error('\n  ⚠️ ARRÊT — le serveur a rejeté des entrées. Vérifier avant de continuer (--restaurer pour revenir).'); process.exit(1) }
}
console.log(`\n  ${ecritures.length}/${fiches.length} fiche(s) écrite(s) · journal docs/couvertures-ecrites-journal.json (retour arrière : --restaurer)`)
console.log('  ⚠️ RETIRER ADMIN_ACCESS_TOKEN de .env.local.')
if (ecritures.length !== fiches.length) process.exit(1)
