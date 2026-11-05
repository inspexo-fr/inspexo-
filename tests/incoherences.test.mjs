// Test hors ligne du filtre d'incohérences (aucun réseau).
// Usage : node tests/incoherences.test.mjs
import { readFileSync } from 'node:fs'
import {
  corroboreeParLeCatalogue,
  filtrerIncoherences,
  opposeDeuxElements,
} from '../supabase/functions/_shared/incoherences.ts'

let ok_ = 0, ko = 0
const ok = (c, l) => { if (c) { ok_++; console.log(`PASS — ${l}`) } else { ko++; console.log(`FAIL — ${l}`) } }
const eq = (a, b, l) => ok(a === b, `${l}${a === b ? '' : ` (obtenu ${JSON.stringify(a)}, attendu ${JSON.stringify(b)})`}`)

// ── Le cas qui a forcé la règle ────────────────────────────────────────────
//
// ⚠️ L'annonce de la S7 écrit « MOTEUR A CHAINE », et l'EA824 EST à chaîne :
// la mention est exacte. Le modèle la signalait comme une contradiction, par
// intermittence — deux passages sur quatre. Un dossier qui invente une
// contradiction est pire qu'un dossier muet : il envoie poser une question
// sans objet.
for (const [texte, quoi] of [
  ["L'annonce mentionne « MOTEUR A CHAINE », une information inhabituelle pour ce segment.", 'simple mention, aucune opposition'],
  ["L'annonce affirme « MOTEUR A CHAINE » alors que cette information n'apporte rien.", 'opposition sans élément opposé nommé'],
  ['Le vendeur écrit « MOTEUR A CHAINE », mais ce type de moteur est généralement réputé fragile.', 'opposition à une généralité'],
  ["L'annonce indique un moteur à chaîne, or les V8 de cette époque varient.", 'opposition à une connaissance non citée'],
]) {
  eq(opposeDeuxElements(texte), false, `écartée — ${quoi}`)
}

// ── Ce qui DOIT rester : une vraie contradiction ───────────────────────────
for (const [texte, quoi] of [
  ["L'annonce indique 120 000 km alors que le compteur photographié affiche 188 452 km.", 'annonce contre photo du compteur'],
  ['Le kilométrage annoncé est inférieur à celui du dernier procès-verbal de contrôle technique.', 'annonce contre PV de CT'],
  ["L'annonce dit la distribution faite, mais aucune facture ne le confirme — le carnet s'arrête en 2019.", 'annonce contre carnet'],
  ["Le prix d'en-tête est de 31 990 € alors que le total à payer plus bas dans la même annonce atteint 33 885 €.", 'deux prix dans la même annonce'],
  ["L'annonce décrit un moteur sans problème connu, alors que la fiche moteur recense un rappel officiel.", 'annonce contre fiche moteur et rappel'],
  ["Le véhicule est annoncé première main, mais la carte grise mentionne trois titulaires.", 'annonce contre carte grise'],
]) {
  eq(opposeDeuxElements(texte), true, `gardée — ${quoi}`)
}

// ── Le filtre complet ──────────────────────────────────────────────────────
{
  const JURIDIQUE = "L'annonce exclut la garantie légale de conformité : ce n'est valable que si l'agence agit comme simple mandataire d'un particulier."
  const CHAINE = "L'annonce mentionne « MOTEUR A CHAINE », information sans objet ici."
  const VRAIE = "L'annonce indique 120 000 km alors que le compteur photographié affiche 188 452 km."

  const r = filtrerIncoherences([JURIDIQUE, CHAINE, VRAIE], [JURIDIQUE])
  eq(r.gardees.length, 2, 'deux incohérences sur trois sont gardées')
  ok(r.gardees.includes(JURIDIQUE), 'l’incohérence POSÉE PAR LE SERVEUR est exempte du filtre')
  ok(r.gardees.includes(VRAIE), 'la vraie contradiction est gardée')
  ok(!r.gardees.includes(CHAINE), 'la mention sans opposition est écartée')
  eq(r.ecartees[0].motif, 'sans_opposition', 'le motif est enregistré')
}

{
  // ⚠️ Sans l'exemption, le filtre linguistique effacerait une règle de DROIT.
  // L'incohérence juridique de l'intermédiaire ne porte aucun marqueur
  // d'opposition : c'est une constante serveur, adossée au code de la
  // consommation, pas une phrase à analyser.
  const JURIDIQUE = "L'annonce exclut la garantie légale de conformité : ce n'est valable que si l'agence agit comme simple mandataire d'un particulier."
  eq(opposeDeuxElements(JURIDIQUE), false,
    'la constante juridique ne passerait PAS le filtre linguistique…')
  eq(filtrerIncoherences([JURIDIQUE], [JURIDIQUE]).gardees.length, 1,
    '…et c’est précisément pourquoi elle est exemptée')
  eq(filtrerIncoherences([JURIDIQUE], []).gardees.length, 0,
    'sans exemption elle tomberait — la liste des textes serveur est donc essentielle')
}

{
  // Entrées hostiles.
  const r = filtrerIncoherences(['', '   ', null, undefined], [])
  eq(r.gardees.length, 0, 'les textes vides ne deviennent pas des incohérences')
  eq(filtrerIncoherences([], []).gardees.length, 0, 'une liste vide reste vide')
  // L'exemption compare des textes NORMALISÉS : un espace en trop ne doit pas
  // transformer une constante serveur en texte de modèle.
  const C = 'Le compteur photographié affiche 188 452 km.'
  eq(filtrerIncoherences([`  ${C}  `], [C]).gardees.length, 1,
    'l’exemption résiste à des espaces en bordure')
}

// ── Corroboration par le catalogue ─────────────────────────────────────────
{
  const ficheEb2 = [{ titre: 'Courroie de distribution en bain d’huile', symptome: 'dégradation de la courroie' }]
  ok(corroboreeParLeCatalogue('L’annonce parle de la courroie de distribution.', ficheEb2),
    'une mention que la fiche corrobore est reconnue')
  ok(!corroboreeParLeCatalogue('L’annonce parle du turbo.', ficheEb2),
    'un organe absent de la fiche n’est pas corroboré')
  ok(!corroboreeParLeCatalogue('L’annonce parle de la courroie.', []),
    'sans fiche, rien n’est corroboré')

  // ⚠️ Portée réelle, à ne pas surestimer : la fiche EA824 ne contient PAS le
  // mot « chaîne ». Ce n'est donc pas cette règle qui règle le cas de la S7.
  const ficheEa824 = [
    { titre: 'Défaillance des turbocompresseurs par colmatage de la crépine', symptome: 'perte de puissance' },
    { titre: 'Usure des poussoirs/galets de distribution variable', symptome: 'bruit moteur' },
  ]
  ok(!corroboreeParLeCatalogue('moteur à chaîne', ficheEa824),
    'sur l’EA824, la corroboration ne mord pas — c’est opposeDeuxElements qui règle le cas')
}

// ── L'ordre dans `score` : avant le barème ─────────────────────────────────
{
  const src = readFileSync(new URL('../supabase/functions/score/index.ts', import.meta.url), 'utf8')
  const iFiltre = src.indexOf('filtrerIncoherences(incoherences, incoherencesServeur)')
  const iBareme = src.indexOf('const calcul = calculerAxes(faits)')
  const iFaits = src.indexOf('const faits: FaitsAxes = {')
  const iKm = src.indexOf('incoherencesServeur.push(kmIncoherence)')
  const iJuridique = src.indexOf('incoherencesServeur.push(INTERMEDIAIRE_INCOHERENCE)')
  ok(iFiltre > 0, 'le filtre est branché')
  ok(iKm > 0 && iKm < iFiltre, 'le compteur contredit est déclaré AVANT le filtre')
  ok(iJuridique > 0 && iJuridique < iFiltre, 'la constante juridique est déclarée AVANT le filtre')
  ok(iFiltre < iFaits && iFiltre < iBareme,
    'le filtre s’applique avant le barème : une incohérence écartée ne pèse pas sur la note')
  ok(/name: "incoherence_sans_opposition"/.test(src),
    'les incohérences écartées sont tracées, pas effacées en silence')
}

console.log(`\n${ok_} contrôles passés, ${ko} échec(s).`)
if (ko > 0) process.exit(1)
console.log('Tous les tests incohérences passent.')
