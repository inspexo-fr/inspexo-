// Test hors ligne de la recherche Takata par marque, modèle et année.
// Usage : node tests/takata-recherche.test.mjs
//
// La fonction `chercher` vit dans la page (elle n'a pas d'autre usage) : le
// test la lit et l'évalue, plutôt que de la dupliquer dans un module partagé
// qui divergerait. Ce qui est vérifié, c'est le COMPORTEMENT publié.
import { readFileSync } from 'node:fs'
import takata from '../src/data/takataModels.json' with { type: 'json' }

let ok_ = 0, ko = 0
const ok = (c, l) => { if (c) { ok_++; console.log(`PASS — ${l}`) } else { ko++; console.log(`FAIL — ${l}`) } }
const eq = (a, b, l) => ok(a === b, `${l}${a === b ? '' : ` (obtenu ${JSON.stringify(a)}, attendu ${JSON.stringify(b)})`}`)

const src = readFileSync(new URL('../src/pages/TakataPage.jsx', import.meta.url), 'utf8')
const debut = src.indexOf('function chercher(')
const fin = src.indexOf('export default function TakataPage')
const corps = src.slice(src.indexOf('const norm ='), fin)
// eslint-disable-next-line no-new-func
const chercher = new Function('takata', `${corps}; return chercher`)(takata)
ok(debut > 0 && typeof chercher === 'function', 'la fonction de recherche est extraite de la page')

// ── Sans année : comportement d'avant, inchangé ────────────────────────────
eq(chercher('a', ''), null, 'une saisie trop courte ne cherche rien')
eq(chercher('', ''), null, 'une saisie vide ne cherche rien')
{
  const r = chercher('citroen c3', '')
  ok(Array.isArray(r) && r.length > 0, 'un modèle réellement listé est trouvé')
  ok(r.every((x) => x.dansPlage === null), 'sans année, aucune entrée n’est classée dans ou hors plage')
}
eq(chercher('zzzpasunemarque', '').length, 0, 'un modèle inventé ne trouve rien')

// ── Avec année : le filtre, et sa prudence ─────────────────────────────────
{
  // Une marque et un modèle réels, avec leurs bornes réelles.
  const [marque, entrees] = Object.entries(takata.marques).find(([, v]) =>
    v.some((e) => typeof e.debut === 'number' && typeof e.fin === 'number' && e.fin - e.debut >= 2))
  const e = entrees.find((x) => typeof x.debut === 'number' && typeof x.fin === 'number' && x.fin - x.debut >= 2)
  const requete = `${marque} ${e.nom}`

  const dedans = chercher(requete, String(e.debut + 1))
  ok(dedans.some((x) => x.nom === e.nom && x.dansPlage === true),
    `une année DANS la plage est marquée concernée (${marque} ${e.nom}, ${e.debut}-${e.fin})`)

  const dehors = chercher(requete, String(e.fin + 5))
  const ligne = dehors.find((x) => x.nom === e.nom)
  eq(ligne?.dansPlage, false, 'une année hors plage est marquée NON concernée')

  // Les bornes sont INCLUSIVES : une voiture de l'année de début est visée.
  eq(chercher(requete, String(e.debut)).find((x) => x.nom === e.nom)?.dansPlage, true,
    'l’année de début est incluse')
  eq(chercher(requete, String(e.fin)).find((x) => x.nom === e.nom)?.dansPlage, true,
    'l’année de fin est incluse')

  // ⚠️ Ce qui concerne l'année saisie remonte en tête : c'est ce que le
  // lecteur cherche, et une liste où le « oui » est en bas se lit comme un « non ».
  const melange = chercher(marque, String(e.debut + 1))
  if (melange.some((x) => x.dansPlage === true) && melange.some((x) => x.dansPlage === false)) {
    const premierNon = melange.findIndex((x) => x.dansPlage === false)
    const dernierOui = melange.map((x) => x.dansPlage === true).lastIndexOf(true)
    ok(dernierOui < premierNon, 'les modèles concernés par l’année sont listés en premier')
  } else {
    ok(true, 'pas de mélange oui/non sur cet échantillon — tri non exercé')
  }
}

// ── Une année absurde ne fait pas tomber la recherche ──────────────────────
for (const [an, quoi] of [['12', 'deux chiffres'], ['abcd', 'des lettres'], ['', 'vide'], [null, 'nulle']]) {
  const r = chercher('citroen c3', an)
  ok(Array.isArray(r) && r.every((x) => x.dansPlage === null),
    `une année non exploitable est ignorée, pas interprétée — ${quoi}`)
}

// ── Bornes manquantes : on ne tranche pas ──────────────────────────────────
{
  const faux = { marques: { Essai: [{ nom: 'Modele Sans Bornes' }] } }
  // eslint-disable-next-line no-new-func
  const chercher2 = new Function('takata', `${corps}; return chercher`)(faux)
  const r = chercher2('essai modele sans bornes', '2015')
  eq(r.length, 1, 'une entrée sans bornes reste trouvée')
  eq(r[0].dansPlage, null, 'et n’est jamais écartée sur une donnée absente')
}

// ── Ce que la page promet au lecteur ───────────────────────────────────────
{
  ok(/seul le num[ée]ro de s[ée]rie \(VIN\)/i.test(src),
    'la page rappelle que seul le VIN tranche')
  ok(src.includes("pas une garantie définitive") || src.includes("n'est pas une garantie définitive"),
    'une année hors plage n’est jamais présentée comme une garantie définitive')
  ok(/application\/ld\+json/.test(src) && /FAQPage/.test(src),
    'la FAQ reste en données structurées')
  ok(src.includes('Mon modèle est listé, mais pas pour mon année'),
    'la question de l’année figure dans la FAQ publiée')
  // La date de la liste doit rester visible : une liste sans date ne vaut rien.
  ok(/Liste du \{maj\}/.test(src), 'la date de la liste officielle est affichée')
}

console.log(`\n${ok_} contrôles passés, ${ko} échec(s).`)
if (ko > 0) process.exit(1)
console.log('Tous les tests takata passent.')
