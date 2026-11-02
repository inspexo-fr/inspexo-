// Génère src/data/segmentsModeles.js : pour chaque famille moteur, les couples
// (marque, modèle) interrogeables dans le relevé de prix.
//
// Pourquoi générer plutôt que dupliquer : le découpage d'un libellé de modèle
// (« Renault Clio III/IV » → renault/clio) vit dans
// `supabase/functions/_shared/marche.ts`, hors du périmètre de build de CRA.
// Réécrire cette logique en JS pour le navigateur créerait deux sources de
// vérité qui divergeraient. On fige donc le RÉSULTAT, produit par le module
// serveur lui-même, dans une table de correspondance relue à la main.
//
// Usage : node scripts/generer-segments-modeles.mjs [--verifier]
// `--verifier` ne réécrit rien et sort en 1 si le fichier commité est périmé
// (utilisé par tests/marche.test.mjs, donc par `npm run eval`).
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CIBLE = join(ROOT, 'src', 'data', 'segmentsModeles.js')

const { FAMILLES_MOTEUR } = await import(join(ROOT, 'src', 'data', 'famillesMoteur.js'))
const { segmentsDepuisLibelleModele, normaliserNom } = await import(
  join(ROOT, 'supabase', 'functions', '_shared', 'marche.ts')
)

/** Libellé d'AFFICHAGE d'un segment : le modèle tel qu'il s'écrit pour un
 *  lecteur, accents compris. La clé de segment, elle, est normalisée sans
 *  accent (« serie 3 ») — l'afficher telle quelle donnerait « Serie 3 ».
 *  Règle : on garde du libellé d'origine les mots dont la forme normalisée
 *  figure dans la clé. Un libellé éclaté en plusieurs modèles (« C3/C4 ») n'a
 *  pas de correspondance mot à mot : la clé est alors mise en capitales. */
function libelleAffichage(libelleOrigine, cleModele) {
  const mots = new Set(cleModele.split(' '))
  const gardes = String(libelleOrigine)
    .split(/\s+/)
    .filter((mot) => mots.has(normaliserNom(mot)))
  if (gardes.length === mots.size) return gardes.join(' ')
  return cleModele.replace(/\b[a-z]/g, (c) => c.toUpperCase())
}

const parSlug = {}
for (const f of FAMILLES_MOTEUR) {
  const vus = new Set()
  const segments = []
  for (const libelle of f.modeles ?? []) {
    for (const seg of segmentsDepuisLibelleModele(libelle)) {
      const cle = `${seg.marque}|${seg.modele}`
      if (vus.has(cle)) continue
      vus.add(cle)
      segments.push({ ...seg, libelle: libelleAffichage(libelle, seg.modele) })
    }
  }
  if (segments.length) parSlug[f.slug] = segments
}

const lignes = Object.entries(parSlug)
  .sort(([a], [b]) => (a < b ? -1 : 1))
  .map(([slug, segs]) =>
    `  '${slug}': [\n${segs.map((s) =>
      `    { marque: '${s.marque}', modele: '${s.modele}', libelle: '${s.libelle.replace(/'/g, "\\'")}' },`
    ).join('\n')}\n  ],`
  )

const contenu = `// FICHIER GÉNÉRÉ — ne pas modifier à la main.
// Source : scripts/generer-segments-modeles.mjs, à partir de
// src/data/famillesMoteur.js et de segmentsDepuisLibelleModele()
// (supabase/functions/_shared/marche.ts). Régénérer après toute modification
// de la table des familles moteur :
//   node scripts/generer-segments-modeles.mjs
// tests/marche.test.mjs échoue si ce fichier est périmé.
//
// À quoi ça sert : situer le prix d'un MODÈLE sur une page /moteur. Les
// agrégats de prix sont indexés par modèle canonique ; les libellés de
// famillesMoteur sont écrits pour un lecteur humain. Cette table fait le pont.

/** slug de famille moteur → couples (marque, modèle) du relevé de prix. */
export const SEGMENTS_PAR_SLUG = {
${lignes.join('\n')}
}

/** Segments à interroger pour une famille moteur ([] si aucun). */
export function segmentsPourFamille(slug) {
  return SEGMENTS_PAR_SLUG[slug] ?? []
}
`

if (process.argv.includes('--verifier')) {
  let actuel = null
  try { actuel = readFileSync(CIBLE, 'utf8') } catch (_) { actuel = null }
  if (actuel !== contenu) {
    console.error(
      'src/data/segmentsModeles.js est PÉRIMÉ — lancez : node scripts/generer-segments-modeles.mjs',
    )
    process.exit(1)
  }
  console.log(`segmentsModeles.js à jour (${Object.keys(parSlug).length} familles)`)
  process.exit(0)
}

writeFileSync(CIBLE, contenu)
const nbSegments = new Set(
  Object.values(parSlug).flat().map((s) => `${s.marque}/${s.modele}`),
).size
console.log(
  `src/data/segmentsModeles.js écrit : ${Object.keys(parSlug).length} familles, ${nbSegments} segments distincts`,
)
