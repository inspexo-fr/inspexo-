// Tests hors ligne : contrôle d'entrée en stock (sprint 24 lot 3).
// Usage : node tests/stock.test.mjs
import fs from 'node:fs'
import {
  validerCarteGrise, energieDuCode, vehiculeDepuisEntree, pannesDeLaFiche, separerFactureRisque,
  prixPlafond, classerLot, controlesSurPlace, CG_TOOL, CG_SYSTEM, MENTION_STOCK, MAX_LOT, choisirParMotorisation,
} from '../supabase/functions/_shared/stock.ts'
import { factureAPrevoir } from '../supabase/functions/_shared/factureAPrevoir.ts'
import { varianteVehicule } from '../supabase/functions/_shared/variantes.ts'
import { decoderVin } from '../supabase/functions/_shared/vin.ts'
import { prixReventeDepuisMarche, PARAMETRES_DEFAUT } from '../supabase/functions/_shared/revendeur.ts'
let ok_ = 0, ko = 0
const ok = (c, l) => { if (c) { ok_++; console.log(`PASS — ${l}`) } else { ko++; console.log(`FAIL — ${l}`) } }
const vinOk = (v) => decoderVin(v).valide === true

// 1. Carte grise : seuls les champs techniques, jamais nom ni adresse.
const props = Object.keys(CG_TOOL.input_schema.properties)
ok(!props.some((p) => /^(nom|prenom|adresse|titulaire|immatriculation|plaque|raison_sociale)/i.test(p)), 'schéma : aucun champ pour le titulaire, l’adresse ou la plaque')
ok(/INTERDIT : nom, prénom, raison sociale, adresse/.test(CG_SYSTEM), 'consigne : nom et adresse interdits')
const cg = validerCarteGrise({ lisible: true, marque: 'RENAULT', type_variante: 'RBK2C', denomination: 'CLIO', premiere_immat: '2016-03-14', vin: 'VF1RFB00X56123456', energie: 'GO', puissance_kw: 66, puissance_fiscale: 4 }, vinOk)
ok(cg.marque === 'RENAULT' && cg.energie === 'diesel' && cg.puissance_ch === 90 && cg.puissance_fiscale === 4, 'champs lus et normalisés (GO ⇒ diesel, 66 kW ⇒ 90 ch)')
ok(cg.premiere_immat === '2016-03-14', 'date de 1re immatriculation gardée')
const sale = validerCarteGrise({ lisible: true, marque: 'Jean Dupont 12 rue des Lilas', type_variante: 'AB-123-CD', denomination: 'CLIO', premiere_immat: '2016-13-40', vin: 'VF1RFB00X5612345', energie: 'GO', puissance_kw: 0, puissance_fiscale: 0 }, vinOk)
ok(sale.type_variante === '' , 'une plaque dans un champ ⇒ champ vidé')
ok(sale.premiere_immat === null && sale.vin === null && sale.puissance_kw === null, 'date impossible, VIN de 16 caractères, puissance nulle ⇒ non retenus')
ok(!/Dupont|Lilas/.test(JSON.stringify(validerCarteGrise({ marque: '12 rue des Lilas' }, vinOk))), 'une adresse ne passe pas dans « marque »')
ok(energieDuCode('EH') === 'hybride' && energieDuCode('ES') === 'essence' && energieDuCode('XX') === '', 'codes d’énergie P.3')

// 2. Entrée.
ok(vehiculeDepuisEntree({ marque: 'Renault', modele: 'Clio IV' }) === null, 'sans kilométrage : refusé')
const v = vehiculeDepuisEntree({ marque: 'Renault', modele: 'Clio IV', premiere_immat: '2015-06', kilometrage: '148 000', motorisation: '1.5 dCi 90', energie: 'diesel', prix_demande: '6 900', operations_non_faites: ['Distribution'] })
ok(v.annee === 2015 && v.kilometrage === 148000 && v.prix_demande === 6900, 'année déduite de la 1re immatriculation, nombres lus')

// 3. Pannes de la fiche : confirmées / propriétaires / questions, versions.
const fiche = { pannes: [
  { titre: 'Casse de la courroie de distribution', organe: 'Distribution', symptomes: 'bruit', km_typique: '120 000 km', gravite: 'casse', cout_indicatif_eur_min: 600, cout_indicatif_eur_max: 900, url_source: ['https://www.largus.fr/a'] },
  { titre: 'Injecteurs Delphi', organe: 'Injection', symptomes: 'fumée noire', km_typique: '150 000 km', gravite: 'majeure', cout_indicatif_eur_min: 1000, cout_indicatif_eur_max: 1600, url_source: ['https://www.caradisiac.com/b'] },
  { titre: 'Turbo 1.5 dCi 110 ch', organe: 'Turbo', symptomes: 'sifflement', km_typique: '100 000 km', gravite: 'majeure', cout_indicatif_eur_min: 900, cout_indicatif_eur_max: 1500, url_source: ['https://www.largus.fr/c'] },
  { titre: 'Coussinets de bielle', organe: 'Bas moteur', symptomes: 'claquement à chaud', km_typique: null, gravite: 'casse', url_source: ['https://forum-a.fr/1', 'https://forum-b.fr/2', 'https://forum-c.com/3'] },
  { titre: 'Vanne EGR', organe: 'EGR', symptomes: 'perte de puissance', gravite: 'mineure', url_source: ['https://forum-a.fr/9'] },
] }
const version = varianteVehicule({ motorisation: v.motorisation })
const { confirmees, points, questions } = pannesDeLaFiche(fiche, version, v.annee)
ok(confirmees.map((p) => p.titre).join('|') === 'Casse de la courroie de distribution|Injecteurs Delphi', 'confirmées seulement, la version 110 ch écartée (90 ch)')
ok(points.length === 1 && points[0].n_sources === 3, '≥ 3 sites indépendants ⇒ point des propriétaires')
ok(questions.length === 1 && /EGR/.test(questions[0]), 'le reste ⇒ question au vendeur')

// 4. AUCUN MONTANT COMPTÉ DEUX FOIS (décision d'Utku).
const cout3ans = { lignes: [{ poste: 'entretien_du', libelle: 'Distribution — déclarée non faite', chiffree: true, min: 500, max: 750, echeance: null, source: { libelle: 'x', urls: ['https://www.largus.fr/d'] } }], non_etablies: [] }
const f = factureAPrevoir({ aujourdhui: '2026-11-13', kilometrage: v.kilometrage, premiere_immat: v.premiere_immat, annee: v.annee, version, cout3ans, pannes: confirmees, prises: [], programmes: [], fiche_maj: null })
const sep = separerFactureRisque(f)
ok(sep.deja_dans_facture.includes('Casse de la courroie de distribution'), 'la courroie, dont le remède est dans la facture, sort du risque')
ok(sep.risque.lignes.map((l) => l.libelle).join('|') === 'Injecteurs Delphi', 'risque = défauts confirmés restants, chiffrés')
const libF = new Set(sep.facture.lignes.map((l) => l.libelle)), libR = sep.risque.lignes.map((l) => l.libelle)
ok(libR.every((l) => !libF.has(l)), 'aucune ligne à la fois dans la facture et dans le risque')
const totalUnique = f.lignes.filter((l) => l.statut === 'a_prevoir' && l.max != null && !sep.deja_dans_facture.includes(l.libelle)).reduce((s, l) => s + l.max, 0)
ok(sep.facture.total_max + sep.risque.total_max === totalUnique, `facture + risque = somme des lignes uniques (${totalUnique} €)`)
ok(sep.facture.total_max === 750 && sep.risque.total_max === 1600, 'totaux attendus : 750 € (facture) + 1 600 € (risque)')
// Contre-épreuve : sans la déduplication, la courroie serait comptée deux fois.
ok(f.lignes.filter((l) => /courroie|distribution/i.test(l.libelle) && l.max != null).length === 2, 'contre-épreuve : la facture brute porte bien la distribution DEUX fois')

// Une ligne de facture SANS montant ne retire pas le défaut chiffré du risque
// (sinon le montant disparaîtrait des deux côtés — cas réel de la Clio K9K).
const fSans = factureAPrevoir({ aujourdhui: '2026-11-13', kilometrage: v.kilometrage, premiere_immat: v.premiere_immat, annee: v.annee, version, cout3ans: { lignes: [], non_etablies: [] }, pannes: confirmees, prises: [], programmes: [], fiche_maj: null })
const sepSans = separerFactureRisque(fSans)
ok(sepSans.risque.lignes.some((l) => /courroie/i.test(l.libelle)) && sepSans.deja_dans_facture.length === 0, 'facture non chiffrée : la courroie reste dans le risque, comptée une fois')
ok(sepSans.facture.total_max === 0 && sepSans.risque.total_max === 900 + 1600, 'totaux : 0 € facture, 2 500 € risque')

// Moteur : la puissance SAISIE désigne un seul candidat ⇒ retenu ; sinon on demande.
const cands = [{ famille: 'EB2DT', nom_commercial: '1.2 PureTech 110' }, { famille: 'EB2DTS', nom_commercial: '1.2 PureTech 130' }, { famille: 'EB2ADTS', nom_commercial: '1.2 PureTech 100' }]
const lire = (t) => varianteVehicule({ motorisation: t })
ok(choisirParMotorisation(cands, '1.2 PureTech 130', lire)?.famille === 'EB2DTS', '« 1.2 PureTech 130 » ⇒ EB2DTS')
ok(choisirParMotorisation(cands, '1.2 PureTech', lire) === null, 'sans puissance : on demande')
ok(choisirParMotorisation(cands, '1.2 PureTech 150', lire) === null, 'puissance inconnue de la table : on demande')

// 5. Plafond, ligne par ligne.
const rv = prixReventeDepuisMarche({ mediane: 9000, n: 22, ajustement_eur: -400 }, 15, PARAMETRES_DEFAUT)
ok(rv.valeur === Math.round(8600 - Math.round(8600 * 0.08)), 'revente réaliste = (médiane + ajustement km) − 8 % de négociation')
ok(prixReventeDepuisMarche({ mediane: 9000, n: 14, ajustement_eur: 0 }, 15, PARAMETRES_DEFAUT) === null, 'sous 15 relevés : pas de revente')
const pl = prixPlafond({ valeur: rv.valeur, mediane_observee: 9000, nb: 22, retrait_negociation_eur: rv.retrait_negociation_eur, ajustement_km_eur: -400 }, '', sep, 500)
ok(pl.calcule && pl.valeur === rv.valeur - 750 - 1600 - 500, 'plafond = revente − facture − risque − marge')
ok(pl.lignes.map((l) => l.cle).join(',') === 'revente,facture,risque,marge', 'quatre lignes affichées, dans l’ordre')
const sans = prixPlafond(null, 'Moins de 15 prix relevés…', sep, 500)
ok(!sans.calcule && /15 prix/.test(sans.motif), 'sans prix de revente : pas de plafond, et le motif est dit')
const neg = prixPlafond({ valeur: 1000, mediane_observee: 1100, nb: 20, retrait_negociation_eur: 88, ajustement_km_eur: 0 }, '', sep, 500)
ok(neg.calcule && !neg.possible && neg.valeur === 0 && neg.manque_eur === 1850, 'coûts > revente : « impossible », jamais un faux 0 €')

// 6. Contrôles et lot.
const c3 = controlesSurPlace(confirmees, points, v.kilometrage)
ok(c3.length === 3 && c3[2].origine === 'proprietaires', '3 contrôles : confirmés d’abord, puis points des propriétaires')
const lot = classerLot([
  { id: 'a', libelle: 'A', prix_demande: 5000, plafond: 1, revente: 8000, facture_max: 500, risque_max: 500, marge_nette: null, motif: null },
  { id: 'b', libelle: 'B', prix_demande: null, plafond: null, revente: 8000, facture_max: 0, risque_max: 0, marge_nette: null, motif: 'prix demandé manquant' },
  { id: 'c', libelle: 'C', prix_demande: 4000, plafond: 1, revente: 8000, facture_max: 1000, risque_max: 0, marge_nette: null, motif: null },
])
ok(lot.map((l) => l.id).join('') === 'cab' && lot[0].marge_nette === 3000, 'lot classé par marge nette, lignes incomplètes en fin')
ok(MAX_LOT === 20, 'lot plafonné à 20')

// 7. Vocabulaire et accès.
const src = fs.readFileSync('supabase/functions/_shared/stock.ts', 'utf8') + fs.readFileSync('supabase/functions/stock/index.ts', 'utf8')
const sansCommentaires = src.replace(/\/\/.*$/gm, '').replace(MENTION_STOCK, '')
ok(!/\b(cote|estimation|expertise)\b/i.test(sansCommentaires) && !/valeur du véhicule/i.test(sansCommentaires.replace(/ni une valeur du véhicule/g, '')), 'vocabulaire : ni cote, ni estimation, ni expertise')
ok(/ni une valeur du véhicule ni une garantie de revente/.test(MENTION_STOCK), 'mention obligatoire')
const fn = fs.readFileSync('supabase/functions/stock/index.ts', 'utf8')
ok(fn.indexOf('drapeau_actif", { p_cle: "stock_revendeur" }') > 0 && fn.indexOf('drapeau_actif') < fn.indexOf('req.json()'), 'drapeau stock_revendeur vérifié côté serveur, AVANT la lecture du corps')
ok(!/\.from\("analyses"\)\.insert|\.storage/.test(fn), 'aucune écriture d’analyse ni de fichier : rien n’est remis à un acheteur, la photo n’est pas stockée')

if (ko) { console.log(`\n${ko} échec(s), ${ok_} réussite(s)`); process.exit(1) } else console.log(`\nTous les tests passent (${ok_})`)
