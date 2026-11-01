// Test hors ligne de l'identité légale (aucun appel réseau).
// Garantit que les mentions obligatoires sont IDENTIQUES des deux côtés
// (pages React et emails Deno) et conformes aux valeurs confirmées par Utku
// le 1er novembre 2026. Une divergence de SIREN entre deux documents légaux
// est une mention obligatoire fausse, pas un écart de présentation.
// Usage : node tests/identite.test.mjs
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { IDENTITE as CLIENT, IDENTITE_LIGNE } from '../src/data/identite.js'
import { IDENTITE as SERVEUR, piedIdentiteVendeur } from '../supabase/functions/_shared/identite.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

let ko = 0
const verifie = (titre, ok, detail = '') => {
  if (!ok) ko++
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${titre}${ok || !detail ? '' : ` (${detail})`}`)
}

// ---------- Valeurs confirmées (ancrage dur : personne ne les change par accident) ----------
verifie('SIREN confirmé = 941 962 060', CLIENT.siren === '941 962 060', CLIENT.siren)
verifie('SIRET du siège confirmé = 941 962 060 00013', CLIENT.siret === '941 962 060 00013', CLIENT.siret)
verifie('Le SIRET commence par le SIREN', CLIENT.siret.startsWith(CLIENT.siren))
verifie('TVA cohérente avec le SIREN (FR + clé + SIREN sans espaces)',
  CLIENT.tva === `FR33${CLIENT.siren.replace(/\s/g, '')}`, CLIENT.tva)
verifie('RCS cohérent avec le SIREN', CLIENT.rcs.includes(CLIENT.siren) && CLIENT.rcs.includes(CLIENT.ville))

// ---------- Client et serveur strictement identiques ----------
for (const champ of Object.keys(CLIENT)) {
  verifie(`client == serveur : ${champ}`, CLIENT[champ] === SERVEUR[champ],
    `${CLIENT[champ]} ≠ ${SERVEUR[champ]}`)
}
verifie('Aucun champ en trop côté serveur',
  Object.keys(SERVEUR).length === Object.keys(CLIENT).length)
verifie('Le pied des emails de vente porte SIREN et adresse',
  piedIdentiteVendeur().includes(CLIENT.siren) && piedIdentiteVendeur().includes(CLIENT.adresse))
verifie('Ligne compacte du pied de page', IDENTITE_LIGNE === `DUPLEX SAS · SIREN 941 962 060 · Toulouse`, IDENTITE_LIGNE)

// ---------- Plus AUCUN numéro recopié en dur dans les pages et composants ----------
// (hors src/data/identite.js, la source). Un SIREN écrit à la main dans une
// page est exactement ce que ce test existe pour empêcher.
const fichiersSrc = []
const explorer = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) explorer(p)
    else if (/\.(jsx?|tsx?)$/.test(e.name)) fichiersSrc.push(p)
  }
}
explorer(join(ROOT, 'src'))

const SIREN_RE = /941\s*962\s*060|941962060/
const endurcis = fichiersSrc.filter((f) => {
  if (f.endsWith(join('src', 'data', 'identite.js'))) return false
  return SIREN_RE.test(readFileSync(f, 'utf8'))
})
verifie('Aucun SIREN/SIRET écrit en dur dans src/ hors de la source de vérité',
  endurcis.length === 0, endurcis.map((f) => f.replace(ROOT + '/', '')).join(', '))

// Même contrôle côté fonctions edge (hors _shared/identite.ts).
const fichiersFn = []
explorer_fn(join(ROOT, 'supabase', 'functions'))
function explorer_fn(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) explorer_fn(p)
    else if (/\.ts$/.test(e.name)) fichiersFn.push(p)
  }
}
const endurcisFn = fichiersFn.filter((f) => {
  if (f.endsWith(join('_shared', 'identite.ts'))) return false
  return SIREN_RE.test(readFileSync(f, 'utf8'))
})
verifie('Aucun SIREN/SIRET écrit en dur dans les edge functions hors de la source',
  endurcisFn.length === 0, endurcisFn.map((f) => f.replace(ROOT + '/', '')).join(', '))

if (ko > 0) {
  console.error(`\n${ko} échec(s).`)
  process.exit(1)
}
console.log('\nTous les tests identité passent.')
