#!/usr/bin/env node
// SPRINT 20.1 — copie PARTAGÉE de la table des familles moteur.
//
// `src/data/famillesMoteur.js` est la source (48 familles, chacune avec l'URL
// qui atteste SON code). Les fonctions edge ne peuvent pas l'importer — le
// périmètre de build de CRA et celui de Deno ne se croisent pas — donc on en
// fige une copie JSON, exactement comme `_shared/defectAtlas.json`.
//
// ⚠️ On fige le RÉSULTAT, on ne réécrit pas la logique : il n'existe qu'UNE
// table des familles dans le projet. `--verifier` échoue si la copie est
// périmée, et il est chaîné au prebuild et à l'éval.
//
// Usage :
//   node scripts/generer-familles-moteur.mjs
//   node scripts/generer-familles-moteur.mjs --verifier

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const CIBLE = join(RACINE, 'supabase/functions/_shared/famillesMoteur.json')
const { FAMILLES_MOTEUR } = await import(join(RACINE, 'src/data/famillesMoteur.js'))

// Seuls les champs dont le serveur a besoin pour RÉSOUDRE une famille. Les
// sources et les notes restent côté site : les embarquer alourdirait chaque
// démarrage de fonction sans servir au calcul.
const sortie = FAMILLES_MOTEUR.map((f) => {
  const m = String(f.millesimes ?? '').match(/^(\d{4})-(\d{4})$/)
  if (!m) throw new Error(`millésimes illisibles pour ${f.marque} ${f.famille} : « ${f.millesimes} »`)
  return {
    marque: f.marque,
    famille: f.famille,
    nom_commercial: f.nom_commercial,
    // Codes complets déclarés pour une famille (Toyota AD : 1AD-FTV, 2AD-FTV,
    // 2AD-FHV) : le résolveur les ramène à `famille`.
    ...(Array.isArray(f.codes) && f.codes.length ? { codes: f.codes } : {}),
    modeles: f.modeles,
    debut: Number(m[1]),
    // ⚠️ « fin » est la DERNIÈRE ANNÉE ATTESTÉE par la source, pas une fin de
    // production : la table a été dressée au sprint 6 et beaucoup d'entrées
    // s'arrêtent à 2022 pour cette seule raison. Le résolveur en tient compte.
    derniere_attestee: Number(m[2]),
  }
})

const json = JSON.stringify({ familles: sortie }, null, 2) + '\n'

if (process.argv.includes('--verifier')) {
  if (!existsSync(CIBLE)) {
    console.error('✗ supabase/functions/_shared/famillesMoteur.json absent — lancer le script sans --verifier.')
    process.exit(1)
  }
  if (readFileSync(CIBLE, 'utf8') !== json) {
    console.error('✗ famillesMoteur.json est PÉRIMÉ (ou retouché à la main).')
    console.error('  Relancer : node scripts/generer-familles-moteur.mjs')
    process.exit(1)
  }
  console.log(`✓ famillesMoteur.json à jour (${sortie.length} familles)`)
  process.exit(0)
}

writeFileSync(CIBLE, json)
console.log(`✓ supabase/functions/_shared/famillesMoteur.json (${sortie.length} familles) ← src/data/famillesMoteur.js`)
