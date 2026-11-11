// Test hors ligne des fiches multi-marques (sprint 23).
import { readFileSync } from 'node:fs'
import { couvre, couvertureValide, proposerCouverture } from '../supabase/functions/_shared/couverture.ts'
let ok_ = 0, ko = 0
const ok = (c, l) => { if (c) ok_++; else { ko++; console.log(`FAIL — ${l}`) } }
const C = couvertureValide([
  { marque: 'Dacia', modele: 'Duster', annee_debut: 2010, annee_fin: 2017 },
  { marque: 'Nissan', modele: 'Qashqai', annee_debut: null, annee_fin: null },
])
ok(couvre(C, { marque: 'Dacia', modele: 'Duster 1.5 dCi 110', annee: 2014 }), 'Dacia Duster 2014 couvert')
ok(!couvre(C, { marque: 'Dacia', modele: 'Duster', annee: 2019 }), 'hors période : NON couvert (restrictif)')
ok(!couvre(C, { marque: 'Dacia', modele: 'Duster', annee: null }), 'année inconnue sur une couverture bornée : NON couvert')
ok(!couvre(C, { marque: 'Dacia', modele: 'Logan', annee: 2014 }), 'modèle non listé : NON couvert')
ok(!couvre(C, { marque: 'Renault', modele: 'Duster', annee: 2014 }), 'autre marque : NON couvert')
ok(couvre(C, { marque: 'Nissan', modele: 'Qashqai', annee: null }), 'couverture non bornée : l’année n’est pas requise')
ok(!couvre(C, { marque: 'Nissan', modele: null, annee: 2015 }), 'modèle inconnu : NON couvert')
ok(!couvre([], { marque: 'Dacia', modele: 'Duster', annee: 2014 }), 'couverture vide : rien (comportement d’avant)')
ok(couvertureValide([{ marque: 'Dacia', modele: 'Duster', annee_debut: 2017, annee_fin: 2010 }])[0].annee_debut === 2010, 'bornes inversées remises dans l’ordre')
ok(couvertureValide([{ marque: '', modele: 'x' }, { marque: 'Dacia', modele: '' }]).length === 0, 'entrée incomplète rejetée')
const p = proposerCouverture('Renault Clio III, Modus, Kangoo II ; Dacia (dCi 70/85 et 110) ; Nissan Qashqai (09/2009-01/2011), Note — production 09/2009 à 02/2011', ['Renault', 'Dacia', 'Nissan'])
ok(p.some((e) => e.marque === 'nissan' && e.modele === 'qashqai' && e.annee_debut === 2009 && e.annee_fin === 2011), 'Qashqai borné par SA parenthèse')
ok(p.some((e) => e.modele === 'clio' && e.annee_debut === 2009 && e.annee_fin === 2011), 'Clio borné par la période globale')
ok(!p.some((e) => e.marque === 'dacia'), '« Dacia (dCi 70/85 et 110) » ne nomme aucun modèle : rien proposé')
const ds = readFileSync('supabase/functions/_shared/defectSheets.ts', 'utf8')
ok(/couvre\(r\.couverture/.test(ds) && /if \(params\.modele\)/.test(ds), 'la recherche n’ajoute une fiche d’une autre marque QUE si la couverture la couvre')
console.log(`\n${ko === 0 ? 'OK' : 'ÉCHEC'} — ${ok_}/${ok_ + ko} contrôles passés`)
if (ko > 0) process.exit(1)
