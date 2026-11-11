// Test hors ligne du statut vendeur déterministe (sprint 23, étape a2).
// Usage : node tests/statut-vendeur.test.mjs
//
// « Pro déguisé » est une accusation : elle ne doit jamais sortir d'une
// variance du modèle. Ce test fige les règles décidées le 11 nov. 2026.
import { readFileSync } from 'node:fs'
import {
  deciderStatut,
  indicesIntermediaire,
  indicesPro,
  seDitParticulier,
} from '../supabase/functions/_shared/statutVendeur.ts'

let ok_ = 0, ko = 0
const ok = (c, l) => { if (c) { ok_++; console.log(`PASS — ${l}`) } else { ko++; console.log(`FAIL — ${l}`) } }
const eq = (a, b, l) => ok(a === b, `${l}${a === b ? '' : ` (obtenu ${JSON.stringify(a)}, attendu ${JSON.stringify(b)})`}`)

const MODELES = ['particulier', 'pro', 'intermediaire_pour_particulier', 'pro_deguise_probable']

// ── Le cas réel : la S7 de l'agence ─────────────────────────────────────────
// Le 11 nov. 2026, deux passages « intermédiaire » et un « pro déguisé » sur
// le même texte. L'annonce dit « agence » ET « plus de 5 000 véhicules » :
// la règle 1 passe avant la règle 2, une agence qui se dit agence ne se
// déguise pas.
const s7 = readFileSync(new URL('./eval/audi-s7-intermediaire/annonce.txt', import.meta.url), 'utf8')
for (const m of MODELES) {
  const r = deciderStatut(s7, m)
  eq(r.statut, 'intermediaire_pour_particulier', `S7, modèle « ${m} » → intermédiaire`)
}
ok(deciderStatut(s7, 'pro_deguise_probable').indices.some((i) => /AGENCE/.test(i)), 'S7 : l’indice affiché cite l’agence')
ok(indicesPro(s7).some((i) => i.libelle === 'plusieurs véhicules'), 'S7 porte bien un indice fort — c’est la priorité qui tranche, pas son absence')
const sorties = new Set()
for (let i = 0; i < 500; i++) sorties.add(deciderStatut(s7, MODELES[i % 4]).statut)
eq(sorties.size, 1, 'S7 : 500 décisions, une seule sortie')

// ── Règle 1 : intermédiaire déclaré ─────────────────────────────────────────
for (const [t, quoi] of [
  ['Véhicule en dépôt-vente, visible sur rendez-vous.', 'dépôt-vente'],
  ['Vendu par notre agence pour le compte d’un particulier.', 'pour le compte d’un particulier'],
  ['Nous agissons en tant que mandataire du propriétaire.', 'mandataire'],
  ['Véhicule sous mandat, vente entre particuliers.', 'sous mandat'],
  ['Depot vente, frais d’agence inclus.', 'sans accents'],
]) {
  eq(deciderStatut(t, 'particulier').statut, 'intermediaire_pour_particulier', `intermédiaire — ${quoi}`)
}

// ── Pièges de négation : un particulier qui refuse les agences ──────────────
for (const t of [
  'Particulier, agences s’abstenir.',
  'Vente entre particuliers. Marchands, agences et mandataires s’abstenir.',
  'Pas de mandataire, pas de dépôt-vente, merci.',
  'Je vends sans agence ni intermédiaire.',
  'Aucun courtier.',
  'Mandataires : ne pas me contacter.',
]) {
  eq(indicesIntermediaire(t).length, 0, `négation ignorée — « ${t} »`)
  eq(deciderStatut(t, 'particulier').statut, 'particulier', `reste particulier — « ${t} »`)
}

// ── Règle 2 : pro déguisé, sur indices nommés seulement ─────────────────────
const P = 'Vente entre particuliers. '
// Indice FORT : un seul suffit.
for (const [t, lib] of [
  [P + 'SIRET 123 456 789 00012.', 'SIRET'],
  [P + 'Voir mes autres annonces.', 'autres annonces'],
  [P + 'Plusieurs véhicules disponibles, appelez-moi.', 'plusieurs véhicules'],
  [P + 'Plus de 30 voitures en stock.', 'plusieurs véhicules'],
]) {
  const r = deciderStatut(t, 'particulier')
  eq(r.statut, 'pro_deguise_probable', `indice fort « ${lib} » → pro déguisé`)
  ok(r.indices.length > 0 && r.indices.every((i) => i.length > 0), `indice fort « ${lib} » : l’indice est affiché`)
  ok(r.indices.some((i) => i.startsWith(lib)), `indice fort « ${lib} » : il est nommé`)
  eq(r.ecart, 'pro_deguise_pose', `indice fort « ${lib} » : l’écart avec le modèle est tracé`)
}
{
  const r = deciderStatut(P + 'SIRET 123 456 789 00012, tél 06 12 34 56 78.', 'particulier')
  ok(r.indices.every((i) => !/\d{3}\s?\d{3}\s?\d{3}/.test(i) && !/06 12/.test(i)), 'l’indice affiché ne recopie ni le SIRET ni le téléphone')
}
// Deux indices FAIBLES DISTINCTS : suffisent.
{
  const r = deciderStatut(P + 'Nos véhicules sont révisés. Reprise possible.', 'particulier')
  eq(r.statut, 'pro_deguise_probable', 'deux indices faibles distincts → pro déguisé')
  eq(r.indices.length, 2, 'les deux indices sont affichés')
}
// UN SEUL indice faible : particulier + question au vendeur (décision du 11 nov.).
for (const t of [
  P + 'Financement possible.',
  P + 'Nos véhicules sont garantis.',
  P + 'Frais de dossier offerts.',
]) {
  for (const m of ['particulier', 'pro_deguise_probable']) {
    const r = deciderStatut(t, m)
    eq(r.statut, 'particulier', `un seul indice faible, modèle « ${m} » → particulier — « ${t} »`)
    eq(r.indices.length, 0, `un seul indice faible : aucune accusation affichée — « ${t} »`)
    ok(typeof r.question === 'string' && /à titre personnel/.test(r.question), `un seul indice faible : il devient une question — « ${t} »`)
  }
}
// Le même indice faible répété ne fait pas deux indices.
eq(deciderStatut(P + 'Nos véhicules. Nos voitures. Nos occasions.', 'particulier').statut, 'particulier', 'un indice faible répété reste UN indice')
// Négation sur un indice pro.
eq(deciderStatut(P + 'Pas de reprise. Pas de financement possible. Voir mes autres annonces.', 'particulier').statut, 'pro_deguise_probable', 'les faibles niés tombent, le fort non nié reste')
eq(indicesPro(P + 'Pas de reprise, sans financement possible.').length, 0, 'indices faibles niés : aucun')

// ── Sans présentation en particulier : jamais d'accusation ──────────────────
for (const t of [
  'SIRET 123 456 789 00012. Voir mes autres annonces.',
  'Nos véhicules sont révisés. Reprise possible. Financement possible.',
]) {
  for (const m of ['particulier', 'pro_deguise_probable']) {
    const r = deciderStatut(t, m)
    ok(r.statut !== 'pro_deguise_probable', `sans « particulier » écrit ni type transmis : pas d’accusation (modèle ${m})`)
    ok(r.question !== null, 'mais les indices deviennent une question')
  }
}

// ── Règle 3 : le modèle ne pose plus l'accusation seul ──────────────────────
{
  const r = deciderStatut('Vente entre particuliers. Golf 7 bien entretenue, carnet complet.', 'pro_deguise_probable')
  eq(r.statut, 'particulier', 'pro déguisé du modèle sans indice → particulier')
  eq(r.ecart, 'pro_deguise_ecarte', 'et l’écart est tracé')
  eq(r.question, null, 'aucun indice : aucune question inventée')
}

// ── Règle 4 : « pro » reste au modèle ───────────────────────────────────────
const mercedes = readFileSync(new URL('./eval/mercedes-2025-societe/annonce.txt', import.meta.url), 'utf8')
eq(deciderStatut(mercedes, 'pro').statut, 'pro', 'Mercedes (société) : « pro » conservé')
eq(deciderStatut('Garage Dupont, SIRET 123 456 789 00012, garantie 12 mois.', 'pro').statut, 'pro', 'contre-épreuve : un garage déclaré reste pro')

// ── Le type transmis par la plateforme ──────────────────────────────────────
ok(seDitParticulier('Type de vendeur affiché par le site : particulier\nGolf 7'), 'type « particulier » transmis : se présente comme particulier')
ok(!seDitParticulier('Type de vendeur affiché par le site : professionnel\nVente entre particuliers'), 'type « professionnel » transmis : l’emporte')
eq(deciderStatut('Type de vendeur affiché par le site : particulier\nVoir mes autres annonces.', 'particulier').statut, 'pro_deguise_probable', 'plateforme « particulier » + indice fort → pro déguisé')
eq(deciderStatut('Golf 7, voir mes autres annonces.', 'particulier').statut, 'particulier', 'texte collé muet, sans type transmis : jamais d’accusation')

// ── Entrée invalide ─────────────────────────────────────────────────────────
eq(deciderStatut('', undefined).statut, 'particulier', 'statut du modèle absent → particulier')
eq(deciderStatut('Golf', 'n_importe_quoi').statut, 'particulier', 'statut du modèle hors liste → particulier')

// ── Les 14 annonces de l'éval : aucun statut attendu ne bouge ───────────────
import { readdirSync, existsSync } from 'node:fs'
const base = new URL('./eval/', import.meta.url)
for (const d of readdirSync(base)) {
  const a = new URL(`./${d}/annonce.txt`, base), e = new URL(`./${d}/expected.json`, base)
  if (!existsSync(a) || !existsSync(e)) continue
  const attendu = JSON.parse(readFileSync(e, 'utf8')).statut_vendeur
  if (!attendu) continue
  eq(deciderStatut(readFileSync(a, 'utf8'), attendu).statut, attendu, `éval ${d} : le statut attendu est conservé`)
}

// ⚠️ La porte de sortie est la DERNIÈRE instruction, fusionnée avec le succès.
console.log(`\n${ok_} contrôles passés, ${ko} échec(s).`)
if (ko > 0) process.exit(1); else console.log('Tous les tests statut vendeur passent.')
