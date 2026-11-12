// Tests hors ligne des deux règles de rappel (sprint 23, point 3).
// Usage : node tests/rappels-applicables.test.mjs
import fs from 'node:fs'
import { paysDeSource, sourcesToutesEtrangeres, sourcesPortantes, anneesDuRappel, horsPeriode, appliquerReglesRappel, QUESTION_RAPPEL_VIN } from '../supabase/functions/_shared/rappelsApplicables.ts'

let ok_ = 0, ko = 0
const ok = (c, l) => { if (c) { ok_++; console.log(`PASS — ${l}`) } else { ko++; console.log(`FAIL — ${l}`) } }
const eq = (a, b, l) => ok(a === b, `${l}${a === b ? '' : ` (obtenu ${JSON.stringify(a)}, attendu ${JSON.stringify(b)})`}`)

// Pays
eq(paysDeSource('https://amp.consumerreports.org/cars/audi/a7/2013/reliability'), 'US', 'Consumer Reports : US')
eq(paysDeSource('https://static.nhtsa.gov/odi/rcl/2022/x.pdf'), 'US', 'NHTSA : US')
eq(paysDeSource('https://enginescope.gr/x'), 'GR', 'domaine .gr : Grèce')
eq(paysDeSource('https://www.largus.fr/x'), 'FR', 'domaine .fr : France')
eq(paysDeSource('https://www.caradisiac.com/x'), 'FR', 'presse française en .com : France')
eq(paysDeSource('https://www.peugeotforums.com/x'), null, 'pays inconnu : jamais deviné')
eq(paysDeSource('pas une url'), null, 'URL invalide : inconnu')

// Toutes étrangères
ok(sourcesToutesEtrangeres(['https://amp.consumerreports.org/a']).etrangeres, 'une seule source US : étrangère')
ok(!sourcesToutesEtrangeres(['https://www.which.co.uk/a', 'https://www.largus.fr/b']).etrangeres, 'presse UK + presse FR : pas toutes étrangères')
ok(sourcesToutesEtrangeres(['https://www.which.co.uk/a', 'https://www.euroracingparts.fr/b']).etrangeres, 'un vendeur de pièces .fr ne compte pas dans le pays : UK seul décide')
eq(sourcesPortantes(['https://www.bimmergarage.co.uk/a', 'https://www.euroracingparts.fr/b', 'https://bimmer.ai/x']).length, 0, 'NSC B47 : aucune source portante')
ok(!sourcesToutesEtrangeres(['https://www.peugeotforums.com/a']).etrangeres, 'forum seul : pas « étranger » (cas sans source)')
ok(!sourcesToutesEtrangeres([]).etrangeres, 'aucune source : pas étrangère')
ok(!sourcesToutesEtrangeres(['https://ec.europa.eu/safety-gate/x']).etrangeres, 'source UE : vaut pour la France')

// Années
const cr = { rappel_vehicules: 'Audi S6 et S7 millésimes 2013-2014 équipés du moteur 4.0L EA824' }
const a = anneesDuRappel(cr)
ok(a && a.debut === 2013 && a.fin === 2014 && a.tolerance_fin === 0, 'millésimes écrits lus, bornes strictes')
ok(horsPeriode(cr, 2015), 'S7 2015 : hors des millésimes 2013-2014')
ok(!horsPeriode(cr, 2014), '2014 : dans les millésimes')
ok(!horsPeriode(cr, null), 'année inconnue : jamais écarté')
ok(!horsPeriode({ rappel_vehicules: 'Peugeot 308 1.6 BlueHDi' }, 2015), 'aucune année écrite : jamais écarté')
const kgh = { rappel_annee_debut: 2017, rappel_annee_fin: 2018 }
ok(horsPeriode(kgh, 2016), 'production 2017-2018 : un millésime 2016 est hors période (début strict)')
ok(!horsPeriode(kgh, 2019), 'fin de production tolère un an (millésime suivant)')
ok(horsPeriode(kgh, 2020), '2020 : hors période')
ok(!horsPeriode({ rappel_annee_fin: 2019 }, 2012), 'borne de début absente : pas écarté par le début')
ok(anneesDuRappel({ rappel_annee_debut: 2015, rappel_annee_fin: 2016, rappel_vehicules: 'millésimes 2010-2011' }).debut === 2015, 'les champs de la fiche priment sur le texte')

// Règles appliquées
const p20u6 = { titre: 'Fuite de carburant', rappel_code: '20U6/L8 (NHTSA 13V450)', rappel_vehicules: cr.rappel_vehicules, urls: ['https://amp.consumerreports.org/cars/audi/a7/2013/reliability'] }
const r1 = appliquerReglesRappel(p20u6, 2015)
eq(r1.rappel_code, null, 'S7 2015 : 20U6/L8 retiré')
eq(r1.rappel_ecarte, 'hors_periode', 'hors période l’emporte (rien d’affiché)')
eq(r1.rappel_contexte, null, 'hors période : pas même en contexte')
eq(r1.titre, 'Fuite de carburant', 'la panne elle-même reste')
const r2 = appliquerReglesRappel(p20u6, 2013)
eq(r2.rappel_code, null, 'S7 2013 : source américaine seule ⇒ plus un rappel')
eq(r2.rappel_ecarte, 'etranger', 'motif : étranger')
ok(/États-Unis/.test(r2.rappel_contexte) && /contexte/.test(r2.rappel_contexte), 'contexte dit le pays et la nature')
ok(!/couvert|concern[ée] par/i.test(r2.rappel_contexte), 'jamais « couvert » ni « concerné par »')
const p21h7 = { rappel_code: '21H7', rappel_portee: 'mondiale', rappel_annee_debut: 2012, rappel_annee_fin: 2017, urls: ['https://www.auto-motor-und-sport.de/x'] }
const r3 = appliquerReglesRappel(p21h7, 2015)
eq(r3.rappel_code, '21H7', 'campagne mondiale confirmée : reste un rappel malgré une source allemande')
eq(r3.rappel_ecarte, null, '21H7 : rien d’écarté')
eq(appliquerReglesRappel(p21h7, 2020).rappel_code, null, 'campagne mondiale : la période s’applique quand même')
const qualifie = appliquerReglesRappel({ rappel_code: 'X1', rappel_portee: 'etranger', urls: ['https://www.which.co.uk/a', 'https://www.largus.fr/b'] }, 2015)
eq(qualifie.rappel_ecarte, 'etranger', 'qualification « etranger » en fiche : appliquée')
eq(qualifie.rappel_portee, null, 'les champs de rappel sont vidés, rien ne peut peser')
const fr = appliquerReglesRappel({ rappel_code: 'MXX', rappel_annee_debut: 2022, rappel_annee_fin: 2024, urls: ['https://rappel.conso.gouv.fr/x'] }, 2023)
eq(fr.rappel_code, 'MXX', 'rappel français dans sa période : inchangé')
eq(appliquerReglesRappel({ titre: 't' }, 2015).rappel_ecarte, null, 'sans rappel : rien')
const g3 = appliquerReglesRappel({ titre: 'Rappel officiel : durit de dépression du servofrein (i20)', rappel_code: '61DT02', rappel_annee_debut: 2015, rappel_annee_fin: 2020, urls: ['https://enginescope.gr/x'] }, 2018)
eq(g3.titre, 'Durit de dépression du servofrein (i20)', 'titre « Rappel officiel : » retiré')
eq(g3.rappel_ecarte, 'sans_source_portante', '61DT02 (compilation seule) : pas un rappel affichable')
eq(g3.rappel_code, null, 'sans source portante : champs de rappel vidés')
eq(g3.rappel_contexte, null, 'sans source portante : pas même « étranger » (le rappel a touché la France)')
const jmk = appliquerReglesRappel({ titre: 'Rappel logiciel - campagne JMK', rappel_code: 'JMK', rappel_annee_debut: 2015, rappel_annee_fin: 2016, urls: ['https://www.peugeotforums.com/a'] }, 2015)
eq(jmk.rappel_ecarte, 'sans_source_portante', 'JMK (forum seul) : retiré des rappels')
eq(appliquerReglesRappel({ titre: 'x', rappel_code: '0D9F', rappel_annee_fin: 2019, urls: ['https://carverif.fr/a'] }, 2016).rappel_ecarte, 'sans_source_portante', '0D9F (vendeur seul) : retiré')
const hp = appliquerReglesRappel({ titre: 'x', rappel_code: 'JMK', rappel_annee_debut: 2015, rappel_annee_fin: 2016, urls: ['https://www.peugeotforums.com/a'] }, 2020)
eq(hp.rappel_ecarte, 'hors_periode', 'hors période passe avant : rien, pas même une question')
const uk = appliquerReglesRappel({ titre: 'EGR', rappel_code: 'R1', urls: ['https://www.which.co.uk/a', 'https://www.euroracingparts.fr/b'] }, 2016)
ok(uk.rappel_ecarte === 'etranger' && /Royaume-Uni/.test(uk.rappel_contexte), 'presse UK + vendeur .fr : contexte Royaume-Uni')
ok(/VIN/.test(QUESTION_RAPPEL_VIN) && !/couvert/i.test(QUESTION_RAPPEL_VIN), 'la question renvoie au VIN, sans affirmer de couverture')
ok(/rappelSansSourcePortante && !questions\.includes\(QUESTION_RAPPEL_VIN\)/.test(fs.readFileSync(new URL('../supabase/functions/score/index.ts', import.meta.url), 'utf8')), 'score : la question VIN est ajoutée quand un rappel est retiré')
eq(appliquerReglesRappel({ titre: 'Rappel officiel : x', rappel_code: 'MXX', urls: ['https://rappel.conso.gouv.fr/x'] }, 2023).titre, 'Rappel officiel : x', 'rappel français : titre intact')

// Câblage dans score : la règle passe AVANT le prompt et le barème
const score = fs.readFileSync(new URL('../supabase/functions/score/index.ts', import.meta.url), 'utf8')
const iRegle = score.indexOf('appliquerReglesRappel(e, anneeV)')
const iPrompt = score.indexOf('const catalogueForPrompt')
const iBareme = score.indexOf('rappel_officiel: Boolean(p.rappel_code)')
ok(iRegle > 0 && iRegle < iPrompt && iRegle < iBareme, 'règles appliquées au catalogue avant le prompt et le barème')
ok(!/rappel_contexte[^\n]*(raisons|rappel_officiel:)/.test(score), 'le contexte ne nourrit ni les raisons ni rappel_officiel')
const bareme = fs.readFileSync(new URL('../supabase/functions/_shared/bareme.ts', import.meta.url), 'utf8')
ok(!/rappel_contexte/.test(bareme) && !/import[^\n]*rappelsApplicables/.test(bareme), 'le barème ignore le contexte')

console.log(`\n${ok_} PASS, ${ko} FAIL`)
if (ko > 0) process.exit(1)
