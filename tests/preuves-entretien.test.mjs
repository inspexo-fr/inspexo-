// Test hors ligne : un signal d'entretien vient du TEXTE, jamais du modèle,
// et une garantie n'en est jamais un (décision d'Utku du 9 nov. 2026).
// Usage : node tests/preuves-entretien.test.mjs
import { readFileSync } from 'node:fs'
import { detecterEntretienDeclare, detecterPreuvesEntretien, signauxEntretienDeterministes } from '../supabase/functions/_shared/entretienDeclare.ts'

let ok_ = 0, ko = 0
const ok = (c, l) => { if (c) ok_++; else { ko++; console.log(`FAIL — ${l}`) } }
const n = (t) => signauxEntretienDeterministes(t).length

// ── La garantie ne compte JAMAIS ────────────────────────────────────────────
for (const t of [
  'Garantie constructeur en cours.',
  'Véhicule sous garantie Mercedes jusqu’en 2027.',
  'Garantie 12 mois, extension de garantie possible.',
  'Garantie constructeur en cours, véhicule récent.',
]) ok(n(t) === 0, `garantie seule : aucun signal (${t})`)

// ── Ce que l'annonce ÉCRIT compte ───────────────────────────────────────────
ok(n('Carnet d’entretien complet.') === 1, 'carnet d’entretien')
ok(n('Entretien à jour.') === 1, 'entretien à jour')
ok(n('Entretien effectué en concession.') === 1, 'entretien en concession')
ok(n('Toutes les factures d’entretien disponibles.') === 1, 'factures d’entretien')
ok(n('Historique d’entretien fourni.') === 1, 'historique d’entretien')
ok(n('Je viens de faire la vidange et les plaquettes avant en septembre.') === 2, 'verbe en tête + énumération : vidange ET plaquettes')
ok(n('Contrôle technique : fait en mars 2025, OK') === 1, 'contrôle technique « : fait »')
ok(n('CT OK de moins de 6 mois.') === 1, 'CT OK')
ok(n('Distribution faite à 95 000 km.') === 1, 'opération déclarée faite (filet existant)')

// ── … mais pas ce qu'elle nie, ni ce qu'elle projette ─────────────────────
ok(n('Pas de carnet.') === 0, '« pas de carnet »')
ok(n('Vendu sans facture.') === 0, '« sans facture »')
ok(n('Carnet perdu.') === 0, '« carnet perdu »')
ok(n('Facture d’achat disponible.') === 0, 'une facture d’ACHAT n’est pas une preuve d’entretien')
ok(n('Prévoir de faire la vidange.') === 0, 'une intention n’est pas une opération faite')
ok(n('Il faudra changer les pneus.') === 0, '« il faudra changer » : intention')
ok(n('Freins OK.') === 0, '« freins OK » ne dit pas qu’une opération a été faite')
ok(detecterEntretienDeclare('Distribution jamais faite.').every((f) => f.statut === 'non_fait'), 'le négatif garde la priorité')

// ── Les 4 références ────────────────────────────────────────────────────────
const lire = (c) => readFileSync(`tests/eval/${c}/annonce.txt`, 'utf8')
ok(n(lire('mercedes-2025-societe')) === 0, 'Mercedes : aucun signal écrit (l’annonce ne cite que sa garantie)')
for (const c of ['audi-s7-intermediaire', '308-puretech-complete', 'revendeur-clio2-dci']) {
  ok(n(lire(c)) >= 2, `${c} : au moins 2 signaux écrits (l’axe garde son plafond de +4)`)
}

// ── Déterminisme ────────────────────────────────────────────────────────────
{
  const t = lire('308-puretech-complete')
  const ref = JSON.stringify(signauxEntretienDeterministes(t))
  let d = 0
  for (let i = 0; i < 500; i++) if (JSON.stringify(signauxEntretienDeterministes(t)) !== ref) d++
  ok(d === 0, 'même texte, mêmes signaux, 500 fois')
}

// ── Câblage : les signaux du modèle sont REMPLACÉS, pas complétés ──────────
{
  const s = readFileSync('supabase/functions/score/index.ts', 'utf8')
  const i = s.indexOf('signauxEntretien = signauxEntretienDeterministes(text);')
  ok(i > 0, 'score : les signaux viennent du détecteur')
  ok(i > s.indexOf('signauxEntretien = signauxEntretien.filter((x, i) => {'),
    'score : l’affectation vient APRÈS l’audit de la critique (rien ne la défait ensuite)')
  const apres = s.slice(i + 60)
  ok(!/signauxEntretien\.push\(/.test(apres), 'score : aucun signal ajouté ensuite')
  ok(!/garantie/i.test(String(detecterPreuvesEntretien)), 'le détecteur ne nomme pas la garantie')
}

console.log(`\n${ko === 0 ? 'OK' : 'ÉCHEC'} — ${ok_}/${ok_ + ko} contrôles passés`)
if (ko > 0) { console.error(`${ko} échec(s) dans tests/preuves-entretien.test.mjs`); process.exit(1) }
console.log('Tous les tests preuves-entretien passent.')
