#!/usr/bin/env node
// Quelles fonctions edge faut-il redéployer ?
//
// ⚠️ La question n'est PAS « quels dossiers de fonction ont changé ». Le
// 4 novembre 2026, le sprint 14 a modifié `_shared/inspection.ts` sans toucher
// à `inspection-annuler`, qui l'importe. `git diff --name-only` ne la citait
// pas. Non redéployée, elle aurait appliqué à une VISIO le barème d'annulation
// de l'INSPECTION : 40 € retenus sur une annulation à moins de 24 h, là où la
// visio s'annule librement jusqu'au créneau. Un module partagé qui change
// oblige à redéployer TOUS ceux qui l'importent, directement ou non.
//
// Ce script lit les imports réels du code, construit le graphe inverse, et
// remonte transitivement (un module `_shared` peut en importer un autre).
//
// Usage :
//   node scripts/fonctions-a-redeployer.mjs                 # depuis main
//   node scripts/fonctions-a-redeployer.mjs sprint14        # depuis cette réf
//   node scripts/fonctions-a-redeployer.mjs main...sprint14 # une plage
//   node scripts/fonctions-a-redeployer.mjs --fichiers a.ts b.ts
//   node scripts/fonctions-a-redeployer.mjs --commande      # juste la commande
//
// Les modifications NON COMMITÉES sont prises en compte : on peut s'en servir
// avant de committer comme après avoir mergé.

import { execSync } from 'node:child_process'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, dirname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FONCTIONS = join(RACINE, 'supabase', 'functions')

// Fonctions déployées SANS vérification du JWT : leur authentification est
// dans le code (signature Stripe, HMAC d'un lien d'email). Les redéployer en
// oubliant le drapeau casserait silencieusement un webhook de paiement ou tous
// les liens de désinscription déjà envoyés.
// Source : CLAUDE.md (sprints 7, 8 et 3.1). Si un nom disparaît du dépôt, le
// script s'arrête : cette liste ne doit pas pourrir en silence.
const SANS_VERIFICATION_JWT = ['pass-webhook', 'inspection-webhook', 'desinscription']

const args = process.argv.slice(2)
const JUSTE_LA_COMMANDE = args.includes('--commande')
const iFichiers = args.indexOf('--fichiers')

function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { cwd: RACINE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return ''
  }
}

/** Tous les fichiers .ts/.json sous supabase/functions. */
function parcourir(dossier, acc = []) {
  for (const e of readdirSync(dossier)) {
    const p = join(dossier, e)
    if (statSync(p).isDirectory()) parcourir(p, acc)
    else if (/\.(ts|json)$/.test(e)) acc.push(p)
  }
  return acc
}

/** Le dossier de fonction auquel appartient un chemin, ou null pour _shared. */
function fonctionDe(chemin) {
  const rel = relative(FONCTIONS, chemin)
  const premier = rel.split('/')[0]
  if (!premier || premier.startsWith('.')) return null
  return premier === '_shared' ? null : premier
}

// ── graphe des imports : module → ceux qui l'importent ──────────────────────
const fichiers = parcourir(FONCTIONS)
const importeursDe = new Map() // chemin absolu → Set(chemins absolus)
for (const f of fichiers) {
  if (!f.endsWith('.ts')) continue
  const src = readFileSync(f, 'utf8')
  // `import x from "./y.ts"`, `export * from "../_shared/z.ts"`,
  // `import t from "../_shared/a.json" with { type: "json" }`
  for (const m of src.matchAll(/(?:from|import)\s*["'](\.[^"']+)["']/g)) {
    const cible = resolve(dirname(f), m[1])
    if (!existsSync(cible)) continue
    if (!importeursDe.has(cible)) importeursDe.set(cible, new Set())
    importeursDe.get(cible).add(f)
  }
}

// ── fichiers modifiés ───────────────────────────────────────────────────────
let modifies = []
let origine
if (iFichiers >= 0) {
  modifies = args.slice(iFichiers + 1).filter((a) => !a.startsWith('--')).map((a) => resolve(RACINE, a))
  origine = 'liste fournie'
} else {
  const ref = args.find((a) => !a.startsWith('--'))
  const branche = git('rev-parse --abbrev-ref HEAD').trim()
  const plage = ref ?? (branche === 'main' ? 'HEAD~1...HEAD' : 'main...HEAD')
  origine = plage
  const sortie = git(`diff --name-only ${plage.includes('...') ? plage : plage + '...HEAD'}`)
  // + ce qui n'est pas encore commité (suivi ou non)
  const enCours = git('status --porcelain').split('\n').map((l) => l.slice(3).trim()).filter(Boolean)
  modifies = [...new Set([...sortie.split('\n'), ...enCours])]
    .filter(Boolean)
    .map((p) => resolve(RACINE, p))
}

const dansFonctions = modifies.filter((p) => p.startsWith(FONCTIONS + '/') && existsSync(p))

// ── remontée transitive ─────────────────────────────────────────────────────
/** @type {Map<string, Set<string>>} nom de fonction → raisons */
const aRedeployer = new Map()
const partages = new Set()

function ajouter(nom, raison) {
  if (!aRedeployer.has(nom)) aRedeployer.set(nom, new Set())
  aRedeployer.get(nom).add(raison)
}

for (const fichier of dansFonctions) {
  const direct = fonctionDe(fichier)
  if (direct) {
    ajouter(direct, 'fichier modifié')
    continue
  }
  // module partagé : remonter à toutes les fonctions qui en dépendent
  partages.add(relative(FONCTIONS, fichier))
  const vus = new Set([fichier])
  const pile = [fichier]
  while (pile.length) {
    for (const importeur of importeursDe.get(pile.pop()) ?? []) {
      if (vus.has(importeur)) continue
      vus.add(importeur)
      const nom = fonctionDe(importeur)
      if (nom) ajouter(nom, `importe ${relative(FONCTIONS, fichier)}`)
      else pile.push(importeur) // _shared qui importe _shared : on continue
    }
  }
  if (vus.size === 1) partages.add(relative(FONCTIONS, fichier) + ' (importé par personne)')
}

// ── garde-fou sur la liste --no-verify-jwt ──────────────────────────────────
for (const nom of SANS_VERIFICATION_JWT) {
  if (!existsSync(join(FONCTIONS, nom))) {
    console.error(`✗ ${nom} est listée comme « --no-verify-jwt » mais n'existe plus dans supabase/functions/.`)
    console.error('  Mettre à jour SANS_VERIFICATION_JWT dans ce script.')
    process.exit(1)
  }
}

// ── sortie ──────────────────────────────────────────────────────────────────
const noms = [...aRedeployer.keys()].sort()

if (JUSTE_LA_COMMANDE) {
  if (noms.length) console.log(`npx supabase functions deploy ${noms.join(' ')} --project-ref pspsqtokhqmotzkyqnkj --yes`)
  process.exit(0)
}

console.log(`Fichiers modifiés lus depuis : ${origine}`)
console.log(`${dansFonctions.length} fichier(s) sous supabase/functions/\n`)

if (noms.length === 0) {
  console.log('Aucune fonction edge à redéployer.')
  process.exit(0)
}

const indirectes = noms.filter((n) => !aRedeployer.get(n).has('fichier modifié'))
const large = Math.max(...noms.map((n) => n.length))
for (const nom of noms) {
  const raisons = [...aRedeployer.get(nom)].sort()
  const jwt = SANS_VERIFICATION_JWT.includes(nom) ? '  ⚠ --no-verify-jwt' : ''
  console.log(`  ${nom.padEnd(large)}  ${raisons.join(', ')}${jwt}`)
}

console.log(`\n${noms.length} fonction(s) à redéployer, dont ${indirectes.length} qu'aucun fichier modifié ne nomme.`)
if (indirectes.length) {
  console.log(`  → ${indirectes.join(', ')} : elles n'apparaissent dans AUCUN git diff.`)
}
if (partages.size) console.log(`Modules partagés touchés : ${[...partages].join(', ')}`)

const avecJwt = noms.filter((n) => SANS_VERIFICATION_JWT.includes(n))
if (avecJwt.length) {
  console.log(`\n⚠ À déployer SÉPARÉMENT avec --no-verify-jwt : ${avecJwt.join(', ')}`)
  console.log('  Leur authentification est dans le code (signature Stripe, HMAC de lien email).')
  console.log('  Oublier le drapeau casse le webhook de paiement ou tous les liens de désinscription déjà envoyés.')
}

const ordinaires = noms.filter((n) => !SANS_VERIFICATION_JWT.includes(n))
console.log('\nCommande :')
if (ordinaires.length) {
  console.log(`  npx supabase functions deploy ${ordinaires.join(' ')} --project-ref pspsqtokhqmotzkyqnkj --yes`)
}
for (const n of avecJwt) {
  console.log(`  npx supabase functions deploy ${n} --no-verify-jwt --project-ref pspsqtokhqmotzkyqnkj --yes`)
}
