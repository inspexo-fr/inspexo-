// Test hors ligne du sourcing de l'atlas (aucun appel réseau).
// Usage : node tests/atlas-source.test.mjs
import { readFileSync } from 'node:fs'
import {
  affirmationSansCout,
  marqueursEntree,
  pageParleDeLEntree,
} from '../supabase/functions/_shared/atlasSource.ts'

let ok_ = 0, ko = 0
const ok = (c, l) => { if (c) { ok_++; console.log(`PASS — ${l}`) } else { ko++; console.log(`FAIL — ${l}`) } }
const eq = (a, b, l) => ok(a === b, `${l}${a === b ? '' : ` (obtenu ${JSON.stringify(a)}, attendu ${JSON.stringify(b)})`}`)

// ── Le prix ne décide pas du sort de l'entrée ───────────────────────────────
//
// ⚠️ DÉFAUT TROUVÉ PAR LA PREMIÈRE CAMPAGNE RÉELLE. Sur BMW, 4 entrées sur 5
// ont été retirées au premier passage — dont la chaîne de distribution N47,
// l'un des défauts les mieux documentés de la marque. Cause : la description
// de l'atlas se termine par « Coût constaté : 2 500 à 4 500€ ». Soumise telle
// quelle, l'affirmation devient un paquet, et une page qui atteste
// parfaitement le défaut sans donner de prix est jugée « non soutenue ».
{
  const d = "Sur les moteurs diesel N47 (2007-2014), la chaîne de distribution placée côté " +
    "boîte de vitesses peut s'étirer et casser. Réparation = dépose moteur. Coût constaté : 2 500 à 4 500€."
  const a = affirmationSansCout('Chaîne de distribution N47 défaillante', d)
  ok(a.includes('N47') && a.includes('chaîne de distribution'), 'le défaut est conservé entier')
  ok(!/€|euro/i.test(a), 'aucun montant ne subsiste dans l’affirmation soumise')
  ok(!/co[ûu]t constat/i.test(a), 'la phrase de coût est retirée, pas seulement le chiffre')
  ok(a.includes('dépose moteur'), 'le remède reste — c’est lui qui fixe la gravité')
}

{
  // Autres formulations de prix rencontrées dans l'atlas.
  for (const [d, quoi] of [
    ['Défaut X. Compter 1 200 € de réparation.', 'compter N €'],
    ['Défaut Y, budget 800 euros environ.', 'budget N euros'],
    ['Défaut Z. Prix : 2 500€.', 'prix : N€'],
    ['Défaut W qui coûte 450 EUR.', 'coûte N EUR'],
  ]) {
    ok(!/\d[\d\s]*\s?(€|eur)/i.test(affirmationSansCout('T', d)), `montant retiré — ${quoi}`)
  }
}

eq(affirmationSansCout('Titre seul', ''), 'Titre seul', 'sans description, le titre suffit')
ok(affirmationSansCout('T', 'x'.repeat(900)).length <= 500, 'l’affirmation est bornée')

// ── Marqueurs : ce qui rend une entrée reconnaissable ───────────────────────
{
  const m = marqueursEntree(
    'Chaîne de distribution N47 défaillante',
    'Moteurs diesel N47 (2007-2014), chaîne côté boîte.',
    'Série 1 (E81/E87), Série 3 (E90/E91)',
  )
  ok(m.includes('n47'), 'le code moteur est un marqueur')
  ok(m.includes('e90') || m.includes('e81'), 'le code de caisse est un marqueur')
  ok(m.includes('distribution'), 'un mot technique long est un marqueur')
  ok(!m.includes('moteur'), '« moteur » est trop banal pour discriminer quoi que ce soit')
  ok(!m.includes('defaut') && !m.includes('panne'), 'les mots du métier ne discriminent rien non plus')
}

{
  const m = marqueursEntree('Courroie de distribution 1.2 PureTech', 'Courroie en bain d’huile.', '208, 2008, 308')
  ok(m.some((x) => x.includes('puretech')), 'une désignation commerciale est un marqueur')
}

// ── La page parle-t-elle de l'entrée ? ──────────────────────────────────────
{
  const marqueurs = marqueursEntree('Chaîne de distribution N47', 'Chaîne côté boîte.', 'Série 3 (E90)')
  ok(pageParleDeLEntree('Le moteur N47 souffre d’une chaîne de distribution fragile sur E90.', marqueurs),
    'une page qui nomme le code ET l’organe passe')
  ok(!pageParleDeLEntree('Comparatif des SUV familiaux de 2024, essais et prix.', marqueurs),
    'une page hors sujet est écartée')
  ok(!pageParleDeLEntree('Le moteur de cette voiture est fiable.', marqueurs),
    'une page qui ne touche qu’un mot banal ne passe pas')
  ok(!pageParleDeLEntree('', marqueurs), 'une page vide ne passe pas')
  // Deux touches minimum : une seule coïncidence ne prouve rien.
  ok(!pageParleDeLEntree('Tout sur la distribution automobile.', marqueurs),
    'un seul marqueur ne suffit pas')
}

{
  // Accents : la page peut écrire « chaine » sans accent circonflexe.
  const m = marqueursEntree('Chaîne de distribution N47', 'étirement de la chaîne', 'E90')
  ok(pageParleDeLEntree('Probleme de chaine de distribution sur le N47 des E90.', m),
    'la comparaison ignore les accents')
}

// ── L'atlas publié et le code concordent ───────────────────────────────────
{
  const js = readFileSync(new URL('../src/data/defectAtlas.js', import.meta.url), 'utf8')
  const json = readFileSync(new URL('../supabase/functions/_shared/defectAtlas.json', import.meta.url), 'utf8')
  const cote = JSON.parse(js.slice(js.indexOf('{')))
  const serveur = JSON.parse(json)
  eq(JSON.stringify(cote), JSON.stringify(serveur),
    'la copie serveur de l’atlas est IDENTIQUE au fichier client')

  const toutes = Object.values(cote).flatMap((b) => b.defects ?? [])
  const sourcees = toutes.filter((d) => Array.isArray(d.url_source) && d.url_source.length > 0)
  eq(sourcees.length, toutes.length,
    'toute entrée encore présente dans l’atlas porte au moins une URL')
  ok(toutes.every((d) => (d.url_source ?? []).every((u) => /^https:\/\//.test(u))),
    'toutes les URL sont en https')
  ok(toutes.every((d) => ['securite', 'casse', 'majeure', 'mineure'].includes(d.gravite)),
    'chaque entrée porte une gravité du BARÈME, pas l’ancienne étiquette à trois niveaux')
  // On ne promeut jamais en « casse » sans coût sourcé.
  ok(toutes.every((d) => d.gravite !== 'casse' || (d.cout_max_eur ?? 0) >= 3000),
    'aucune entrée n’est « casse » sans un coût sourcé qui le justifie')
}

console.log(`\n${ok_} contrôles passés, ${ko} échec(s).`)
if (ko > 0) process.exit(1)
console.log('Tous les tests atlas-source passent.')
