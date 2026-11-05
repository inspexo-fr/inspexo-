// Test hors ligne du résolveur de famille moteur (aucun appel, aucune base).
// Usage : node tests/famille-moteur.test.mjs
//
// ⚠️ CE QUE CE MODULE DOIT GARANTIR, dans l'ordre :
//  1. il ne CHANGE RIEN quand le modèle a déjà répondu juste — c'était
//     l'erreur du premier filet du sprint 13, qui avait attribué à une
//     Mercedes de 2025 des défauts d'OM651, de V6 essence et de caisses W203 ;
//  2. il COMPLÈTE une réponse manquante de façon reproductible — c'est le
//     défaut mesuré le 5 nov. 2026 (OM654 déduit 3 fois sur 4, verdict 71 ou
//     75 selon le passage) ;
//  3. il ne tranche JAMAIS une ambiguïté réelle.
import {
  carburantAnnonce, carburantDuNom, cylindree, FAMILLES, modeleApparie, resoudreFamille,
} from '../supabase/functions/_shared/familleMoteur.ts'

let ko = 0
let total = 0
const ok = (cond, label, detail = '') => {
  total++
  if (!cond) { ko++; console.log(`FAIL — ${label}${detail ? ` (${detail})` : ''}`) }
}
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), label, `obtenu ${JSON.stringify(a)}, attendu ${JSON.stringify(b)}`)
const titre = (t) => console.log(`\n▶ ${t}`)

const cas = (p) => resoudreFamille({
  marque: '', modele: '', motorisation: '', carburant: '', annee: null, propose: '', ...p,
})

// ---------------------------------------------------------------------------
titre('La table est lisible et complète')
eq(FAMILLES.length, 48, '48 familles')
ok(FAMILLES.every((f) => f.famille && f.marque && Array.isArray(f.modeles) && f.debut > 1990 && f.derniere_attestee >= f.debut),
  'chaque entrée porte marque, famille, modèles et des bornes cohérentes')

titre('⚠️ Le modèle n’est JAMAIS second-deviné')
// Les quatre cas de référence de l'éval : le résolveur doit rendre EXACTEMENT
// ce que le modèle a proposé, sans quoi il changerait leurs fiches et donc
// leurs scores.
for (const [marque, modele, moto, annee, propose] of [
  ['Audi', 'S7 Sportback', '4.0 V8 TFSI 450 quattro', 2015, 'EA824'],
  ['Peugeot', '308', '1.2 PureTech 110', 2016, 'EB2DT'],
  ['Peugeot', '308', '1.2 PureTech 130', 2020, 'EB2DTS'],
  ['Mercedes-Benz', 'Classe C 220 d', '220 d', 2025, 'OM654'],
  ['Renault', 'Clio IV', '1.5 dCi 90', 2016, 'K9K'],
  ['Renault', 'Clio II', '1.5 dCi 65', 2004, 'K9K'],
  ['BMW', 'Série 3 320d', '2.0 diesel 184 ch', 2012, 'N47'],
  ['Volkswagen', 'Golf 7', '2.0 TDI 150', 2016, 'EA288'],
]) {
  const r = cas({ marque, modele, motorisation: moto, annee, propose })
  ok(r.famille === propose && r.origine === 'modele',
    `${marque} ${modele} ${annee} : « ${propose} » conservé tel quel`, `${r.famille} / ${r.origine}`)
}
// Même un code que la table NE connaît pas est conservé : elle ne couvre que
// 48 familles, et l'écraser perdrait une information juste.
{
  const r = cas({ marque: 'Porsche', modele: '911', motorisation: '3.0 flat-six', annee: 2019, propose: 'MA2' })
  ok(r.famille === 'MA2' && r.origine === 'modele', 'un code hors table est conservé', JSON.stringify(r))
}

titre('⚠️ LE DÉFAUT DU 5 NOVEMBRE : réponse manquante, complétée')
{
  // Le cas exact, dans les deux écritures de la marque.
  for (const marque of ['Mercedes', 'Mercedes-Benz']) {
    const r = cas({ marque, modele: 'Classe C 220 d', motorisation: '220 d', carburant: 'Diesel', annee: 2025, propose: '' })
    ok(r.famille === 'OM654', `${marque} Classe C 220 d 2025 sans proposition → OM654`, JSON.stringify(r))
    ok(r.origine === 'table_apres_derniere_attestee', 'et l’origine dit que la table a tranché', r.origine)
  }
  // ⚠️ DÉTERMINISME : 500 résolutions du même cas, un seul résultat. C'est la
  // propriété qui manquait — le même texte donnait 71 ou 75.
  const base = { marque: 'Mercedes-Benz', modele: 'Classe C 220 d', motorisation: '220 d', carburant: 'Diesel', annee: 2025, propose: '' }
  const ref = JSON.stringify(cas(base))
  let divergences = 0
  for (let i = 0; i < 500; i++) if (JSON.stringify(cas(base)) !== ref) divergences++
  eq(divergences, 0, '500 résolutions identiques : aucune divergence')
}

titre('La règle « au-delà de la dernière année attestée »')
// Elle ne s'applique QUE vers le futur, jamais avant la première année.
{
  const avant = cas({ marque: 'Mercedes', modele: 'Classe C', motorisation: '220 d', carburant: 'Diesel', annee: 1998, propose: '' })
  ok(avant.famille === null, 'une année ANTÉRIEURE à toutes les plages ne déduit rien', JSON.stringify(avant))
  // Et une ambiguïté réelle reste une ambiguïté : sur 2018, l'OM651 et
  // l'OM654 se chevauchent tous deux sur la Classe C W205.
  const chevauche = cas({ marque: 'Mercedes', modele: 'Classe C 220 d', motorisation: '220 d', carburant: 'Diesel', annee: 2018, propose: '' })
  ok(chevauche.famille === null && chevauche.candidats.length >= 2,
    '⚠️ deux familles possibles sur 2018 : le résolveur ne tranche PAS', JSON.stringify(chevauche))
}

titre('Appariement de modèle : ni trop large, ni trop étroit')
const mb654 = FAMILLES.find((f) => f.famille === 'OM654')
ok(modeleApparie(mb654, 'Classe C 220 d'), '« Classe C 220 d » apparie « Mercedes Classe C W205 »')
ok(modeleApparie(mb654, 'Classe C'), '« Classe C » seule apparie aussi (la caisse est optionnelle)')
ok(modeleApparie(mb654, 'classe c w205'), 'casse et caisse indifférentes')
// ⚠️ Attention au contre-exemple choisi : « Classe A » apparie BIEN l'OM654,
// qui équipe la W177 — la table le dit, et elle a raison. Il faut un modèle
// réellement absent de SA liste.
ok(modeleApparie(mb654, 'Classe A'), '« Classe A » apparie l’OM654 (il équipe la W177)')
ok(!modeleApparie(mb654, 'Vito'), '« Vito » n’apparie pas l’OM654 (il est à l’OM651)')
ok(!modeleApparie(mb654, 'Classe G'), '« Classe G » n’apparie aucune entrée OM654')
ok(!modeleApparie(mb654, ''), 'un modèle vide n’apparie rien')
const k9k = FAMILLES.find((f) => f.famille === 'K9K')
ok(modeleApparie(k9k, 'Clio IV'), '« Clio III/IV » est éclaté sur la barre oblique')
ok(modeleApparie(k9k, 'Clio'), '« Clio » seule apparie (la génération est optionnelle)')
ok(!modeleApparie(k9k, 'Captur'), '« Captur » n’apparie pas l’entrée Clio/Mégane/Duster/Qashqai')

titre('Carburant et cylindrée lus, jamais devinés')
eq(carburantDuNom('2.1 CDI (OM651)'), 'diesel', 'CDI → diesel')
eq(carburantDuNom('1.2 PureTech 110'), 'essence', 'PureTech → essence')
eq(carburantDuNom('4.0 V8 TFSI'), 'essence', 'TFSI → essence')
eq(carburantDuNom('2.0 diesel (OM654)'), 'diesel', '« diesel » explicite')
eq(carburantDuNom('1.6 16V'), '', 'un libellé muet ne rend rien')
eq(carburantAnnonce('220 d', 'Diesel'), 'diesel', 'le champ carburant de l’annonce fait foi')
eq(carburantAnnonce('1.5 dCi 90', ''), 'diesel', 'à défaut, les marqueurs de la motorisation')
eq(carburantAnnonce('', ''), '', 'rien à rien')
eq(cylindree('1.2 PureTech 110'), '1.2', 'cylindrée lue')
eq(cylindree('220 d'), '', 'une désignation commerciale ne donne pas de cylindrée')

titre('Rien de tranché quand il n’y a rien à trancher')
{
  const inconnu = cas({ marque: 'Ferrari', modele: 'F40', motorisation: '2.9 V8', annee: 1990, propose: '' })
  ok(inconnu.famille === null && inconnu.origine === 'aucune', 'marque absente de la table → null assumé', JSON.stringify(inconnu))
  const sansRien = cas({})
  ok(sansRien.famille === null, 'entrée vide → null')
}

console.log(`\n${ko === 0 ? 'OK' : 'ÉCHEC'} — ${total - ko}/${total} contrôles passés`)
process.exit(ko === 0 ? 0 : 1)
