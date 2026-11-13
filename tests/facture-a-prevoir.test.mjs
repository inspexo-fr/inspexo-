// Tests hors ligne : la facture à prévoir (sprint 24, lot 2).
// Usage : node tests/facture-a-prevoir.test.mjs
import fs from 'node:fs'
import { factureAPrevoir, finProgramme, dateDepart, paliersAlerte, KM_DOUZE_MOIS } from '../supabase/functions/_shared/factureAPrevoir.ts'
import { varianteVehicule } from '../supabase/functions/_shared/variantes.ts'
import { indexerModeles, nommeUnAutreVehicule } from '../supabase/functions/_shared/modeles.ts'
let ok_ = 0, ko = 0
const ok = (c, l) => { if (c) { ok_++; console.log(`PASS — ${l}`) } else { ko++; console.log(`FAIL — ${l}`) } }
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l}${JSON.stringify(a) === JSON.stringify(b) ? '' : ` (obtenu ${JSON.stringify(a)})`}`)
const presse = 'https://www.largus.fr/a', forum = 'https://forum-peugeot.com/t/1', garage = 'https://www.garage-dupont.fr/x'
const base = {
  aujourdhui: '2026-11-13', kilometrage: 100000, premiere_immat: '2016-04', annee: 2016,
  version: varianteVehicule({ motorisation: '1.2 PureTech 110' }), cout3ans: null, pannes: [], prises: [], programmes: [], fiche_maj: '2026-10-29T10:00:00Z',
}
const ids = (f) => f.lignes.map((l) => `${l.rubrique}:${l.statut}:${l.libelle}`)

// Entretien
let f = factureAPrevoir(base)
eq(f.lignes[0].libelle, 'Distribution', 'sans plan : la distribution vient d’abord, en question')
eq([f.lignes[0].statut, f.lignes[0].min], ['question', null], '… sans montant')
f = factureAPrevoir({ ...base, cout3ans: { lignes: [
  { poste: 'entretien_du', libelle: 'Vidange', chiffree: true, min: 90, max: 140, echeance: "dès l'achat", source: { via: 'comparateur', libelle: 'prix moyen affiché par des garages, via Vroomly', urls: ['https://www.vroomly.com/x'] } },
  { poste: 'entretien_du', libelle: 'Courroie de distribution', chiffree: false, min: null, max: null, echeance: "dès l'achat", source: null },
  { poste: 'entretien', libelle: 'Bougies', chiffree: true, min: 80, max: 120, echeance: 'vers 120 000 km', source: null },
], non_etablies: [{ operation: 'Liquide de frein', motif: 'x' }] } })
eq(f.lignes.filter((l) => l.rubrique === 'entretien').map((l) => l.libelle), ['Courroie de distribution', 'Vidange', 'Liquide de frein'], 'distribution d’abord ; seules les opérations dues maintenant ; intervalles non établis en question')
eq(f.lignes.find((l) => l.libelle === 'Vidange').min, 90, 'prix de comparateur repris pour une opération due')
eq(f.lignes.find((l) => l.libelle === 'Courroie de distribution').statut, 'question', 'opération due sans prix : question, pas de montant')

// Défauts
const panne = (o) => ({ titre: 'Courroie de distribution 1.2 PureTech', urls: [presse], km_typique: '50 000 - 120 000 km', cout_min_eur: 850, cout_max_eur: 1500, ...o })
f = factureAPrevoir({ ...base, pannes: [
  panne({}),
  panne({ titre: 'Pompe à eau', urls: [forum] }),
  panne({ titre: 'Chaîne de distribution', km_typique: '150 000 km' }),
  panne({ titre: 'Turbo', usure_lointaine: true }),
  panne({ titre: 'Injecteurs 1.6 THP', km_typique: null }),
  panne({ titre: 'Thermostat', urls: [presse, garage], cout_min_eur: 300, cout_max_eur: 400, km_typique: null }),
] })
const defauts = f.lignes.filter((l) => l.rubrique === 'defaut')
eq(defauts.map((l) => l.libelle), ['Courroie de distribution 1.2 PureTech', 'Thermostat'], 'défauts : portés, dans les 12 mois, même version, pas d’usure lointaine')
eq([defauts[0].statut, defauts[0].min, defauts[0].max, defauts[0].source.date], ['a_prevoir', 850, 1500, '29/10/2026'], 'coût cité par la source portante, daté du relevé')
eq(defauts[0].echeance, 'à partir de 50 000 km', 'kilométrage d’apparition affiché')
ok(/contrôlé ou remplacé/.test(defauts[0].phrase_vendeur) && /Facture/.test(defauts[0].justificatif), 'phrase à dire et justificatif à demander')
eq(factureAPrevoir({ ...base, pannes: [panne({ urls: [presse, garage], cout_min_eur: 850 })] }).lignes.find((l) => l.rubrique === 'defaut').statut, 'a_prevoir', 'coût porté par une source portante accompagnée d’un garage : chiffré')
const coutGarage = factureAPrevoir({ ...base, pannes: [{ titre: 'Embrayage', urls: [presse], km_typique: null, cout_min_eur: 600, cout_max_eur: 900 }] })
ok(coutGarage.lignes.find((l) => l.rubrique === 'defaut').min !== undefined, 'panne sans kilométrage publié : gardée (on ne sait pas l’écarter)')
eq(factureAPrevoir({ ...base, kilometrage: 10000, pannes: [panne({})] }).lignes.filter((l) => l.rubrique === 'defaut').length, 0, `seuil au-delà de km + ${KM_DOUZE_MOIS} : pas dans la facture`)

// Prises en charge
const prog = { titre: 'Extension de garantie Stellantis moteur 1.2 PureTech', conditions: 'x', age_max_ans: 10, km_max: 175000, entretien_exige: 'les 3 dernières factures d’entretien', date_vigueur: '2024-03-19', url_source: [presse] }
eq(dateDepart('2016-04', 2016), '2016-04-01', 'départ : 1re mise en circulation')
eq(dateDepart(null, 2016), '2016-07-01', 'départ : à défaut le milieu de l’année-modèle')
eq(finProgramme(prog, '2016-04-01'), '2026-04-01', 'fin : départ + durée publiée')
let p = factureAPrevoir({ ...base, programmes: [prog] }).lignes.find((l) => l.rubrique === 'prise_en_charge')
eq(p.statut, 'expiree', 'programme de 10 ans sur une voiture d’avril 2016 : expiré au 13/11/2026')
p = factureAPrevoir({ ...base, premiere_immat: '2019-02', programmes: [prog] }).lignes.find((l) => l.rubrique === 'prise_en_charge')
eq([p.statut, p.echeance], ['valable', 'jusqu\'au 01/02/2029 ou 175 000 km'], 'programme valable, date et kilométrage de fin')
ok(/3 dernières factures/.test(p.phrase_vendeur), 'phrase : demande les justificatifs exigés')
eq(factureAPrevoir({ ...base, premiere_immat: '2019-02', kilometrage: 180000, programmes: [prog] }).lignes.find((l) => l.rubrique === 'prise_en_charge').statut, 'expiree', 'kilométrage dépassé : expiré')
eq(factureAPrevoir({ ...base, premiere_immat: '2019-02', kilometrage: null, programmes: [prog] }).lignes.find((l) => l.rubrique === 'prise_en_charge').statut, 'a_verifier', 'kilométrage inconnu : à vérifier')

// Cas réel de la Clio II 1.5 dCi 65 : campagne du Qashqai 110 ch
const familles = JSON.parse(fs.readFileSync(new URL('../supabase/functions/_shared/famillesMoteur.json', import.meta.url), 'utf8')).familles
const catalogue = indexerModeles(familles).map((x) => ({ marque: x.marque, modele: x.modele }))
const clio = { marque: 'Renault', modele: 'Clio II', generation: null, slug_marque: '', slug: '', familles: [] }
const prises = [
  { texte: 'Campagne de service Nissan (reprogrammation) sur Qashqai 1 1.5 dCi 110 contre la surchauffe du FAP', portee: 'france', urls: [presse] },
  { texte: 'Rappel Renault : remplacement des injecteurs sur Clio 1.5 dCi', portee: 'france', urls: [presse], periode: { texte: '2004-2006' } },
  { texte: 'Campagne publiée au Royaume-Uni seulement', portee: 'contexte', urls: [presse] },
]
const fc = factureAPrevoir({ ...base, version: varianteVehicule({ motorisation: '1.5 dCi 65' }), prises, nommeUnAutreVehicule: (t) => nommeUnAutreVehicule(t, clio, catalogue) })
eq(fc.lignes.filter((l) => l.rubrique === 'prise_en_charge').map((l) => [l.statut, l.libelle.slice(0, 30)]), [['a_verifier', 'Rappel Renault : remplacement ']], 'Clio II : la campagne du Qashqai 110 ch et l’information de contexte sont écartées')

// Total
f = factureAPrevoir({ ...base, pannes: [panne({}), panne({ titre: 'Thermostat', km_typique: null, cout_min_eur: 300, cout_max_eur: 400 })] })
eq([f.total_min, f.total_max], [1150, 1900], 'total : seulement les lignes chiffrées')
ok(f.sans_montant >= 1 && /question à poser/.test(f.mention), 'lignes sans montant comptées et expliquées')

// Alertes de fin
eq(paliersAlerte('2027-05-01', '2026-11-13'), ['6_mois'], '6 mois avant : un palier')
eq(paliersAlerte('2026-12-01', '2026-11-13'), ['1_mois'], 'dernier mois : le seul palier « 1 mois » (jamais deux le même jour)')
eq(paliersAlerte('2028-01-01', '2026-11-13'), [], 'plus de 6 mois : rien')
eq(paliersAlerte('2026-01-01', '2026-11-13'), [], 'déjà expirée : rien')

// Hors score ; cron : réservation avant envoi
const lire = (q) => fs.readFileSync(new URL(q, import.meta.url), 'utf8')
for (const q of ['../supabase/functions/_shared/bareme.ts', '../supabase/functions/score/index.ts']) ok(!/factureAPrevoir/.test(lire(q)), `${q.split('/').slice(-2).join('/')} n’importe pas la facture (hors score)`)
const al = lire('../supabase/functions/alertes/index.ts')
const sec = al.slice(al.indexOf('1 ter. Fin de prise en charge'), al.indexOf('// ===== 2. (RETIRÉ'))
ok(/\.eq\("statut", "achete"\)/.test(sec) && /\.eq\("alertes", true\)/.test(sec), 'alerte de fin : dossiers achetés dont les alertes sont actives')
ok(sec.indexOf('from("alertes_fin_prise")') > 0 && sec.indexOf('from("alertes_fin_prise")') < sec.indexOf('emailFinPriseEnCharge('), 'le palier est réservé en base AVANT l’envoi')
const mig = lire('../supabase/migrations/20261129120000_sprint24_alertes_fin_prise.sql')
ok(/unique \(dossier_id, programme, palier\)/.test(mig) && /enable row level security/.test(mig) && /revoke all/.test(mig) && !/create policy/i.test(mig), 'migration : unicité, RLS, aucun droit public')
const no = lire('../supabase/functions/_shared/notify.ts')
const fn = no.slice(no.indexOf('export async function emailFinPriseEnCharge'), no.indexOf('// RETIRÉ au sprint 10'))
ok(/lienDesinscription\(userId\)/.test(fn) && /enTetesDesinscription\(lienUnsub\)/.test(fn), 'désinscription en un clic dans l’alerte de fin')
console.log(`\n${ok_} PASS, ${ko} FAIL`)
if (ko > 0) process.exit(1)
