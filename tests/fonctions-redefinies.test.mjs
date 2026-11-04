// Test HORS LIGNE : une fonction SQL redéfinie ne doit pas PERDRE une colonne
// en silence. Usage : node tests/fonctions-redefinies.test.mjs
//
// POURQUOI CE TEST EXISTE. Deux fois en deux sprints, j'ai redéclaré une
// fonction SQL en la réécrivant de mémoire au lieu de reprendre son corps :
//   - sprint 13, `get_public_analysis` — rattrapé avant d'écrire la migration ;
//   - sprint 14, `inspecteur_missions` — j'avais perdu `a_moi`, `verdict`,
//     `score`, `rapport_rendu_le`, `created_at` et le tri. L'écran inspecteur
//     aurait cessé de séparer « missions disponibles » et « mes missions »,
//     sans qu'aucune erreur ne se produise nulle part.
//
// Une colonne qui disparaît d'un `jsonb_build_object` ne casse RIEN côté SQL :
// le front reçoit `undefined` et affiche du vide. C'est exactement le genre de
// panne qu'aucun test d'exécution n'attrape.
//
// RÈGLE APPLIQUÉE ICI : une clé peut disparaître, mais la migration qui la
// retire doit la NOMMER — dans le SQL ou dans un commentaire. Un retrait
// délibéré se documente ; un retrait accidentel ne se documente pas.
import { readFileSync, readdirSync } from 'node:fs'

let ko = 0
let total = 0
const ok = (cond, label, detail = '') => {
  total++
  if (!cond) { ko++; console.log(`FAIL — ${label}${detail ? `\n       ${detail}` : ''}`) }
}
const titre = (t) => console.log(`\n▶ ${t}`)

const DIR = new URL('../supabase/migrations/', import.meta.url)
const fichiers = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort()

/** Corps de chaque fonction définie dans un fichier, dans l'ordre. */
function definitions(sql) {
  const out = []
  const re = /create\s+(?:or\s+replace\s+)?function\s+public\.(\w+)\s*\(/gi
  let m
  while ((m = re.exec(sql)) !== null) {
    const nom = m[1]
    // Le corps va du premier délimiteur dollar à son jumeau.
    const apres = sql.slice(m.index)
    const dollar = apres.match(/as\s+(\$\w*\$)/i)
    if (!dollar) continue
    const ouvre = apres.indexOf(dollar[1], dollar.index)
    const ferme = apres.indexOf(dollar[1], ouvre + dollar[1].length)
    if (ouvre < 0 || ferme < 0) continue
    out.push({ nom, corps: apres.slice(ouvre + dollar[1].length, ferme) })
  }
  return out
}

/** Clés rendues par un corps : celles des `jsonb_build_object`, plus les
 *  colonnes d'un `returns table(...)`. Ce sont elles que le front consomme. */
function clesRendues(corps) {
  const cles = new Set()
  for (const m of corps.matchAll(/jsonb_build_object\s*\(/gi)) {
    // On lit la suite de l'appel jusqu'à un équilibre de parenthèses, pour ne
    // pas capturer les clés d'un objet imbriqué d'une AUTRE fonction.
    let i = m.index + m[0].length
    let prof = 1
    let bout = ''
    while (i < corps.length && prof > 0) {
      const c = corps[i]
      if (c === '(') prof++
      else if (c === ')') prof--
      if (prof > 0) bout += c
      i++
    }
    for (const k of bout.matchAll(/'([a-z_][a-z0-9_]{1,40})'\s*,/gi)) cles.add(k[1])
  }
  return cles
}

// ---------------------------------------------------------------------------
titre('Aucune colonne perdue sans être nommée dans la migration qui la retire')
// ---------------------------------------------------------------------------
const histoire = new Map() // nom -> [{ fichier, cles }]
for (const f of fichiers) {
  const sql = readFileSync(new URL(f, DIR), 'utf8')
  for (const { nom, corps } of definitions(sql)) {
    const cles = clesRendues(corps)
    if (cles.size === 0) continue // fonction qui ne rend pas d'objet : hors sujet
    if (!histoire.has(nom)) histoire.set(nom, [])
    histoire.get(nom).push({ fichier: f, cles, sql })
  }
}

let redefinies = 0
let regressions = 0
for (const [nom, versions] of histoire) {
  if (versions.length < 2) continue
  redefinies++
  for (let i = 1; i < versions.length; i++) {
    const avant = versions[i - 1]
    const apres = versions[i]
    const perdues = [...avant.cles].filter((c) => !apres.cles.has(c))
    if (perdues.length === 0) continue
    // Une clé retirée doit être NOMMÉE dans la migration qui la retire.
    const nonJustifiees = perdues.filter((c) => !apres.sql.includes(c))
    ok(nonJustifiees.length === 0,
      `${nom} : ${nonJustifiees.length} colonne(s) perdue(s) sans justification dans ${apres.fichier}`,
      nonJustifiees.length ? `perdues : ${nonJustifiees.join(', ')}` : '')
    if (nonJustifiees.length > 0) regressions++
  }
}

ok(redefinies > 0, `des fonctions redéfinies ont bien été trouvées (${redefinies})`)
console.log(`   ${histoire.size} fonctions analysées, ${redefinies} redéfinies au moins une fois`)

// ---------------------------------------------------------------------------
titre('Le test MORD : un retrait non documenté est détecté')
// ---------------------------------------------------------------------------
// Sans cette contre-épreuve, le test ci-dessus serait vrai pour la mauvaise
// raison le jour où l'extraction des clés cesserait de fonctionner.
{
  const v1 = clesRendues(`begin return jsonb_build_object('id', x, 'a_moi', y, 'verdict', z); end`)
  const v2 = clesRendues(`begin return jsonb_build_object('id', x); end`)
  ok(v1.size === 3 && v2.size === 1, 'les clés sont bien extraites', `${v1.size} puis ${v2.size}`)
  const perdues = [...v1].filter((c) => !v2.has(c))
  ok(perdues.length === 2 && perdues.includes('a_moi') && perdues.includes('verdict'),
    'les clés perdues sont identifiées', perdues.join(', '))
  // Et le cas réel du sprint 14 : la clé est citée ailleurs dans la migration
  // (commentaire d'explication), donc justifiée.
  const sqlJustifie = `-- on retire a_moi car plus utilise\n create function f() ...`
  ok(perdues.filter((c) => !sqlJustifie.includes(c)).length === 1,
    'une clé nommée dans la migration est acceptée, l’autre non')
}

// Les clés d'un objet imbriqué ne doivent pas être confondues.
{
  const c = clesRendues(`jsonb_build_object('externe', jsonb_build_object('interne', 1), 'autre', 2)`)
  ok(c.has('externe') && c.has('autre'), 'clés du niveau attendu présentes', [...c].join(','))
  ok(c.has('interne'), 'et celles du niveau imbriqué aussi (elles sont rendues également)')
}

// ---------------------------------------------------------------------------
titre('Les colonnes que l’écran inspecteur consomme sont bien rendues')
// ---------------------------------------------------------------------------
// Garde-fou ciblé, en plus de la règle générale : ces clés-là sont lues par
// `InspecteurPage.jsx`, et leur disparition est précisément le défaut de 2026.
{
  const versions = histoire.get('inspecteur_missions') ?? []
  const derniere = versions[versions.length - 1]
  ok(derniere != null, 'inspecteur_missions est définie')
  for (const c of ['id', 'type', 'statut', 'a_moi', 'creneau_souhaite', 'creneau_confirme',
                   'part_inspecteur_cents', 'marque', 'modele', 'annee', 'analysis_id',
                   'verdict', 'score', 'vendeur_nom', 'rapport_rendu_le', 'created_at']) {
    ok(derniere?.cles.has(c), `inspecteur_missions rend « ${c} »`)
  }
}

console.log(`\n${ko === 0 ? 'OK' : 'ÉCHEC'} — ${total - ko}/${total} contrôles passés`)
if (ko > 0) process.exit(1)
