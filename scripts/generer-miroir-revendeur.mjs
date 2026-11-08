#!/usr/bin/env node
// Génère src/data/revendeur.gen.js et src/data/critair.gen.js à partir des
// modules serveur `supabase/functions/_shared/{revendeur,critair}.ts`.
//
// ⚠️ POURQUOI GÉNÉRER PLUTÔT QUE RECOPIER. Le périmètre de build de CRA
// interdit d'importer hors de `src/` : il faut donc une copie côté client. Le
// projet en comptait déjà deux écrites à la main (`src/data/marche.js`,
// `src/data/charte.js`), chacune protégée par un test de parité — c'est-à-dire
// par un filet qui constate la dérive APRÈS qu'elle a eu lieu.
//
// Ici, la copie est produite par le COMPILATEUR TypeScript : il n'existe
// qu'une implémentation, et la copie en est la traduction mécanique. La
// dérive n'est plus rattrapée, elle est impossible.
//
// Le mode `--verifier` échoue si le fichier sur disque n'est pas celui que ce
// script produirait : un fichier généré périmé, ou retouché à la main, fait
// échouer `npm run eval` et le build.
//
// Usage : node scripts/generer-miroir-revendeur.mjs [--verifier]
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const VERIFIER = process.argv.includes('--verifier')

const MODULES = [
  { ts: 'revendeur.ts', js: 'revendeur.gen.js' },
  { ts: 'critair.ts', js: 'critair.gen.js' },
  { ts: 'cibles.ts', js: 'cibles.gen.js' },
  // SPRINT 20 — le décodage du VIN était écrit à la main dans src/lib/vin.js,
  // et le serveur ne savait pas lire un VIN. La source est désormais
  // _shared/vin.ts ; src/lib/vin.js n'est qu'un ré-export du miroir, de sorte
  // que tests/vin.test.mjs et VinBloc continuent de passer par le même code.
  { ts: 'vin.ts', js: 'vin.gen.js' },
  // SPRINT 22 — le coût sur 3 ans se recalcule à l'écran (kilométrage annuel,
  // corrections) avec le MÊME code que le serveur.
  { ts: 'cout3ans.ts', js: 'cout3ans.gen.js' },
]

const ENTETE = (source) => `// GÉNÉRÉ par scripts/generer-miroir-revendeur.mjs — NE PAS ÉDITER À LA MAIN.
//
// Traduction du module serveur supabase/functions/_shared/${source} par le
// compilateur TypeScript. Toute correction se fait DANS CE MODULE SERVEUR,
// puis on relance le script (il tourne de lui-même au \`prebuild\`).
//
// \`tests/revendeur.test.mjs\` rejoue des centaines de cas tirés au hasard dans
// les deux fichiers et exige des résultats identiques : si cette copie est
// périmée, l'éval échoue.

`

let divergences = 0

for (const m of MODULES) {
  const chemin = join(ROOT, 'supabase', 'functions', '_shared', m.ts)
  const source = readFileSync(chemin, 'utf8')

  // ⚠️ Un vrai compilateur, pas une expression régulière. Retirer « : Type »
  // à coups de regex casse sur un type ternaire, une union dans un littéral
  // d'objet ou un commentaire qui contient un deux-points — et ce qui casse
  // ici produirait un calcul client silencieusement différent du serveur.
  const { outputText, diagnostics } = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      removeComments: false,
      newLine: ts.NewLineKind.LineFeed,
    },
    reportDiagnostics: true,
    fileName: m.ts,
  })
  if (diagnostics && diagnostics.length) {
    console.error(`${m.ts} : ${diagnostics.length} diagnostic(s) de transpilation`)
    for (const d of diagnostics) console.error('  ' + ts.flattenDiagnosticMessageText(d.messageText, ' '))
    process.exit(1)
  }

  const attendu = ENTETE(m.ts) + outputText.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
  const cible = join(ROOT, 'src', 'data', m.js)

  if (VERIFIER) {
    let actuel = null
    try { actuel = readFileSync(cible, 'utf8') } catch (_) { /* absent */ }
    if (actuel !== attendu) {
      console.error(`✗ src/data/${m.js} ${actuel == null ? 'est absent' : 'ne correspond plus à'} ` +
        `supabase/functions/_shared/${m.ts}`)
      divergences++
    }
  } else {
    writeFileSync(cible, attendu)
    console.log(`✓ src/data/${m.js} (${attendu.split('\n').length} lignes) ← _shared/${m.ts}`)
  }
}

if (VERIFIER) {
  if (divergences > 0) {
    console.error('\nRelancer : node scripts/generer-miroir-revendeur.mjs')
    process.exit(1)
  }
  console.log(`✓ miroirs revendeur à jour (${MODULES.length} modules)`)
}
