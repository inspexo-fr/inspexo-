// Tests hors ligne : pannes d'une autre cylindrée ou puissance (sprint 24, barème 11.17).
// Usage : node tests/variantes.test.mjs
import fs from 'node:fs'
import { lireVariante, varianteVehicule, decisionVariante, questionVariante } from '../supabase/functions/_shared/variantes.ts'
import { composerPage } from '../supabase/functions/_shared/modeles.ts'
let ok_ = 0, ko = 0
const ok = (c, l) => { if (c) { ok_++; console.log(`PASS — ${l}`) } else { ko++; console.log(`FAIL — ${l}`) } }
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l}${JSON.stringify(a) === JSON.stringify(b) ? '' : ` (obtenu ${JSON.stringify(a)})`}`)

// Lecture
eq(lireVariante('Panne moteur sévère (1.0 FireFly T3 120 ch)'), { cylindrees: ['1.0'], puissances: [120] }, 'cylindrée et puissance lues')
eq(lireVariante('Refus de démarrage (1.3 FireFly T4 150 ch)').cylindrees, ['1.3'], '1.3 FireFly')
eq(lireVariante('Consommation > 0,5 l/1 000 km').cylindrees, [], '« 0,5 l » est une consommation, pas une cylindrée')
eq(lireVariante('Mercedes C 220 d et BMW 320d').puissances, [], '« 220 d » et « 320d » ne sont pas des puissances')
eq(lireVariante('Renault 1.5 dCi 90').puissances, [90], '« dCi 90 » : la désignation porte la puissance')
eq(lireVariante('Casse de la courroie à 100 000 km').cylindrees.length + lireVariante('Casse de la courroie à 100 000 km').puissances.length, 0, 'un kilométrage n’est ni cylindrée ni puissance')
eq(lireVariante('Pompe à injection CP4 (2.0 TDI)').cylindrees, ['2.0'], '2.0 TDI')

// Véhicule
eq(varianteVehicule({ motorisation: '1.2 PureTech 130' }), { cylindrees: ['1.2'], puissances: [130] }, 'véhicule : 1.2 PureTech 130')
eq(varianteVehicule({ cylindree: '1461 cm3', motorisation: 'dCi' }).cylindrees, ['1.5'], 'cm3 ramenés au litre')
eq(varianteVehicule({ motorisation: '220 d' }), { cylindrees: [], puissances: [] }, 'Mercedes 220 d : version inconnue')

// Décision
const v500 = varianteVehicule({ motorisation: '1.0 FireFly 70 ch' })
eq(decisionVariante('Panne moteur sévère (1.0 FireFly T3 120 ch)', v500).statut, 'exclue', 'FIREFLY : 120 ch ≠ 70 ch ⇒ exclue')
eq(decisionVariante('Refus de démarrage (1.3 FireFly T4 150 ch)', v500).statut, 'exclue', 'FIREFLY : 1.3 ≠ 1.0 ⇒ exclue')
eq(decisionVariante('Usure prématurée des supports moteur', v500).statut, 'applicable', 'panne sans version : applicable')
eq(decisionVariante('Courroie 1.2 PureTech 131 ch', varianteVehicule({ motorisation: '1.2 PureTech 130' })).statut, 'applicable', 'tolérance de 3 ch')
eq(decisionVariante('Courroie 1.2 PureTech', varianteVehicule({ motorisation: '1.2 PureTech 130' })).statut, 'applicable', 'même cylindrée, aucune puissance citée')
const inconnue = decisionVariante('Turbo du 2.0 diesel 194 ch', varianteVehicule({ motorisation: '220 d' }))
eq(inconnue.statut, 'question', 'version du véhicule inconnue ⇒ question au vendeur')
ok(/P\.1/.test(questionVariante('Turbo', inconnue.motif)) && /kW à la rubrique P\.2/.test(questionVariante('Turbo', inconnue.motif)), 'la question renvoie aux rubriques de la carte grise (P.2 en kW)')
eq(decisionVariante('Turbo 2.0 diesel 194 ch', varianteVehicule({ motorisation: '1.6 diesel' })).statut, 'exclue', 'une seule discordance suffit (cylindrée connue et différente)')

// Page modèle : la règle s'y applique aussi
const page = { marque: 'Fiat', modele: '500 Hybrid', generation: null, slug_marque: 'fiat', slug: '500-hybrid', familles: [{ marque: 'Fiat', famille: 'FIREFLY', nom_commercial: '1.0 FireFly', modeles: [] }] }
const presse = 'https://www.largus.fr/x'
const fiche = { marque: 'Fiat', famille_moteur: 'FIREFLY', pannes: [
  { titre: 'Panne moteur sévère (1.0 FireFly T3 120 ch)', url_source: [presse] },
  { titre: 'Refus de démarrage (1.3 FireFly T4 150 ch)', url_source: [presse] },
  { titre: 'Usure prématurée des supports moteur', url_source: [presse] },
] }
const c = composerPage(page, [fiche], [])
eq([c.n_pannes, c.sections[0].pannes_autre_version, c.publiable], [1, 2, false], 'page 500 Hybrid : 2 pannes d’autres versions retirées ⇒ sous le seuil, non publiée')

// Branchement : avant le modèle, hors barème
const score = fs.readFileSync(new URL('../supabase/functions/score/index.ts', import.meta.url), 'utf8')
const iRegle = score.indexOf('decisionVariante(`${e.titre}'), iPrompt = score.indexOf('const catalogueForPrompt'), iBareme = score.indexOf('calculerAxes(')
ok(iRegle > 0 && iPrompt > 0 && iRegle < iPrompt && iRegle < iBareme, 'catalogue filtré avant le modèle et avant le barème')
ok(/questionsVariante/.test(score.slice(score.indexOf('for (const q of questionsVariante)'))), 'les questions de version rejoignent les questions au vendeur')
console.log(`\n${ok_} PASS, ${ko} FAIL`)
if (ko > 0) process.exit(1)
