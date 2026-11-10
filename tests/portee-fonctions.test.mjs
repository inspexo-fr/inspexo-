// Test HORS LIGNE : aucun identifiant hors de portée dans les fonctions edge.
// Usage : node tests/portee-fonctions.test.mjs
//
// POURQUOI CE TEST EXISTE — un bug trouvé au sprint 19.
//
// Le bloc « mode revendeur » de `score` appelait `candidats`, déclaré en
// `const` À L'INTÉRIEUR du try de la négociation. À l'exécution, Deno aurait
// levé un ReferenceError… attrapé par le try/catch du bloc lui-même. Le mode
// revendeur n'aurait simplement JAMAIS existé en production : pas d'erreur
// HTTP, pas de ligne rouge dans les logs, un champ `null` dans le résultat.
//
// C'est la pire forme de panne : silencieuse, et dans du code qu'aucun test
// hors ligne ne peut exécuter (il faut la clé Anthropic et la base).
//
// COMMENT. Le compilateur TypeScript résout les portées pour de vrai. Avec
// `noLib: true` et `noResolve: true`, les SEULS noms qu'il ne sait pas
// résoudre sont les primitives du runtime — liste fermée ci-dessous. Tout
// autre nom non résolu est un vrai défaut de portée.
import { readdirSync, readFileSync, rmSync, writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

let ko = 0, total = 0
const ok = (cond, label, detail = '') => {
  total++
  if (cond) console.log(`PASS — ${label}`)
  else { ko++; console.log(`FAIL — ${label}${detail ? `\n       ${detail}` : ''}`) }
}

// Primitives du runtime (JS standard + Deno + Web API). Volontairement une
// liste FERMÉE : si une fonction se met à utiliser une API non listée, le test
// le signale et on décide — plutôt que d'ouvrir une porte par commodité.
const RUNTIME = new Set([
  'String', 'Number', 'Boolean', 'Object', 'Array', 'Date', 'Math', 'JSON', 'Error',
  'RegExp', 'Map', 'Set', 'Promise', 'Symbol', 'BigInt', 'Function', 'Infinity', 'NaN',
  'Uint8Array', 'Int8Array', 'Uint16Array', 'Uint32Array', 'Float32Array', 'Float64Array',
  'ArrayBuffer', 'DataView', 'Intl', 'Reflect', 'Proxy', 'WeakMap', 'WeakSet',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask',
  'console', 'globalThis', 'structuredClone', 'atob', 'btoa',
  'fetch', 'Request', 'Response', 'Headers', 'URL', 'URLSearchParams', 'FormData', 'Blob', 'File',
  'AbortSignal', 'AbortController', 'ReadableStream', 'WritableStream', 'TransformStream',
  'TextEncoder', 'TextDecoder', 'crypto', 'CryptoKey', 'SubtleCrypto', 'Deno', 'EdgeRuntime',
  'performance', 'Image', 'process',
  // Types utilitaires de TypeScript (pas des valeurs, mais non résolus sans lib).
  'Record', 'Partial', 'Required', 'Readonly', 'Pick', 'Omit', 'Exclude', 'Extract',
  'NonNullable', 'ReturnType', 'Parameters', 'Awaited', 'Iterable', 'ArrayLike',
  'PropertyKey', 'ThisType', 'InstanceType', 'Uppercase', 'Lowercase', 'ReadonlyArray',
])

const CODES = new Set([
  2304, // Cannot find name 'x'
  2448, // Block-scoped variable 'x' used before its declaration
  2552, // Cannot find name 'x'. Did you mean 'y'?
  // ⚠️ SPRINT 23 — un identifiant DÉCLARÉ DEUX FOIS (même import posé deux
  // fois) : Deno refuse de démarrer la fonction (BOOT_ERROR, HTTP 503).
  // Constaté le 10 nov. 2026 sur `sources-externes`, après le déplacement de
  // `texteCentre` : l'ancienne ligne d'import était restée.
  2300, // Duplicate identifier 'x'
  2451, // Cannot redeclare block-scoped variable 'x'
  // Même jour, second défaut du même déplacement : `DEMI_FENETRE` exporté DEUX
  // fois (constante + ré-export). Deno : « Duplicate export », BOOT_ERROR.
  2323, // Cannot redeclare exported variable 'x'
  2484, // Export declaration conflicts with exported declaration of 'x'
])

const DIR = new URL('../supabase/functions/', import.meta.url).pathname

/** Noms non résolus d'un ensemble de fichiers, hors primitives du runtime. */
function nonResolus(fichiers) {
  const prog = ts.createProgram(fichiers, {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noResolve: true,
    noLib: true,
    skipLibCheck: true,
    allowImportingTsExtensions: true,
    noEmit: true,
  })
  const out = []
  for (const d of ts.getPreEmitDiagnostics(prog)) {
    if (!CODES.has(d.code)) continue
    const texte = ts.flattenDiagnosticMessageText(d.messageText, ' ')
    const m = texte.match(/'([\w$]+)'/)
    const nom = m ? m[1] : '?'
    if (RUNTIME.has(nom)) continue
    const fichier = d.file?.fileName ?? '?'
    const ligne = d.file && d.start != null
      ? d.file.getLineAndCharacterOfPosition(d.start).line + 1
      : 0
    out.push({ nom, fichier: fichier.replace(DIR, ''), ligne, texte })
  }
  return out
}

const entrees = readdirSync(DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name !== '_shared')
  .map((e) => join(DIR, e.name, 'index.ts'))
  .filter((f) => { try { readFileSync(f); return true } catch (_) { return false } })

const partages = readdirSync(join(DIR, '_shared'))
  .filter((f) => f.endsWith('.ts'))
  .map((f) => join(DIR, '_shared', f))

console.log(`\n▶ ${entrees.length} fonctions edge + ${partages.length} modules partagés`)

const defauts = nonResolus([...entrees, ...partages])
ok(defauts.length === 0, 'aucun identifiant hors de portée',
  defauts.slice(0, 12).map((d) => `${d.fichier}:${d.ligne} — ${d.texte}`).join('\n       '))

// ── Contre-épreuve : un import posé deux fois est-il vu ? ─────────────────
{
  const temoin = join(DIR, '_shared', '__temoin_double_import.ts')
  writeFileSync(temoin, [
    'import { a as b } from "./x.ts";',
    'import { a as b } from "./x.ts";',
    'export const c = b;',
  ].join('\n'))
  try {
    const d = nonResolus([temoin])
    ok(d.some((x) => x.nom === 'b'), 'un import posé deux fois est détecté (BOOT_ERROR du 10 nov. 2026)')
  } finally { rmSync(temoin, { force: true }) }
  const temoin2 = join(DIR, '_shared', '__temoin_double_export.ts')
  writeFileSync(temoin2, ['export { A } from "./x.ts";', 'export const A = 1;'].join('\n'))
  try {
    const d = nonResolus([temoin2])
    ok(d.some((x) => x.nom === 'A'), 'un nom exporté deux fois est détecté (« Duplicate export », même jour)')
  } finally { rmSync(temoin2, { force: true }) }
}

// ── Le test MORD-IL ? ──────────────────────────────────────────────────────
//
// ⚠️ Sans cette contre-épreuve, « aucun défaut » pourrait vouloir dire « la
// résolution ne marche pas » plutôt que « tout est en portée ». On rejoue
// EXACTEMENT le bug du sprint 19 : un identifiant déclaré dans un try, utilisé
// après.
{
  const temoin = join(DIR, '_shared', '__temoin_portee.ts')
  writeFileSync(temoin, [
    'export function piege(): number {',
    '  try {',
    '    const interne = 1;',
    '    return interne;',
    '  } catch (_) { /* vide */ }',
    '  // Hors de portée : c est le défaut du sprint 19, mot pour mot.',
    '  return interne;',
    '}',
    '',
  ].join('\n'))
  let trouve = []
  try { trouve = nonResolus([temoin]) } finally { unlinkSync(temoin) }
  ok(trouve.some((d) => d.nom === 'interne'),
    'le test MORD : un const déclaré dans un try et utilisé après est détecté',
    JSON.stringify(trouve))
}

// Et la liste des primitives ne doit pas être un fourre-tout : si elle
// contenait un nom du projet, elle masquerait un vrai défaut.
{
  const sourcesProjet = [...entrees, ...partages]
    .map((f) => readFileSync(f, 'utf8')).join('\n')
  const exportes = new Set()
  for (const m of sourcesProjet.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class|type|interface)\s+([\w$]+)/g)) {
    exportes.add(m[1])
  }
  const collision = [...RUNTIME].filter((n) => exportes.has(n))
  ok(collision.length === 0,
    'la liste des primitives ne masque aucun nom exporté par le projet',
    collision.join(', '))
}


// ──────────────────────────────────────────────────────────────────────────
// LECTURE AVANT DÉCLARATION DANS LES SCRIPTS QUI DÉPENSENT (8 nov. 2026)
//
// ⚠️ Un identifiant hors de portée et une lecture avant déclaration sont deux
// défauts DIFFÉRENTS, et le bloc ci-dessus n'attrape que le premier. Le 8 nov.
// 2026, `scripts/resourcer-fiches.mjs` lisait `porteesLot` dans l'objet
// `rapport` alors que le `const` venait vingt lignes plus bas : le nom EXISTAIT
// dans le module, donc « Cannot find name » ne disait rien. Le script mourait
// en `ReferenceError` APRÈS AVOIR DÉPENSÉ, et n'écrivait jamais son rapport.
//
// Sur un script qui engage de l'argent, mourir à la dernière ligne coûte le run
// entier. TypeScript le voit (TS2448 / TS2454) : on le lui demande.
{
  const SCRIPTS = [
    'scripts/resourcer-fiches.mjs', 'scripts/eval.mjs', 'scripts/budget.mjs',
    'scripts/verifier-analyses.mjs', 'scripts/sourcer-atlas.mjs',
    'scripts/rattraper-atlas.mjs', 'scripts/couverture-moteurs.mjs',
    'scripts/etendre-atlas.mjs', 'scripts/plans-entretien.mjs', 'scripts/rejuger-suspectes.mjs',
  ].filter((f) => existsSync(f))

  const avantDeclaration = (fichiers) => {
    const prog = ts.createProgram(fichiers, {
      allowJs: true, checkJs: true, noEmit: true,
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
      skipLibCheck: true, noResolve: true, noLib: true,
    })
    // ⚠️ UNIQUEMENT 2448 et 2454. « Cannot find name » crierait sur `process`,
    // `console`, `fetch` — tous les globaux de Node, absents faute de `lib`.
    // Un test qui crie à tort finit désactivé (leçon du sprint 10).
    return ts.getPreEmitDiagnostics(prog)
      .filter((d) => (d.code === 2448 || d.code === 2454) && d.file &&
        fichiers.some((f) => d.file.fileName.endsWith(f.replace(/^.*\//, ''))))
      .map((d) => `${d.file.fileName.replace(/^.*\//, '')} — ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`)
  }

  console.log(`\n▶ ${SCRIPTS.length} script(s) qui dépensent du crédit`)
  const tdz = avantDeclaration(SCRIPTS)
  ok(tdz.length === 0, 'aucune lecture avant déclaration dans les scripts qui dépensent',
    tdz.slice(0, 8).join('\n       '))

  // Contre-épreuve : on rejoue le défaut du 8 nov., mot pour mot.
  const temoin = 'scripts/__temoin_tdz.mjs'
  writeFileSync(temoin, [
    'const rapport = { lot: porteesLot }',
    'const porteesLot = 0',
    'export default rapport',
    '',
  ].join('\n'))
  let vu = []
  try { vu = avantDeclaration([temoin]) } finally { unlinkSync(temoin) }
  ok(vu.some((m) => /porteesLot/.test(m)),
    'le test MORD : le défaut réel du 8 nov. 2026 est détecté', JSON.stringify(vu))
}

console.log(`\n${total - ko}/${total} contrôles passés.`)
// ⚠️ Porte de sortie en DERNIÈRE instruction, fusionnée avec le message de
// succès : c'est le motif qui s'est répété cinq fois dans ce projet.
if (ko > 0) {
  console.error(`\n${ko} échec(s) dans tests/portee-fonctions.test.mjs`)
  process.exit(1)
}
console.log('Portée des fonctions edge et des scripts : conforme.')
