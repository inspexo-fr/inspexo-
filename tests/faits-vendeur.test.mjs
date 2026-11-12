// Tests hors ligne : registre des faits déclarés par le vendeur (sprint 23, lot 2).
// Usage : node tests/faits-vendeur.test.mjs
import fs from 'node:fs'
import {
  validerLecturePiece, verifierPiece, appliquerPieces, plaquesDansTexte, normaliserPlaque,
  faitsDeclaresDepuisTexte, familleCritique, MENTION_PIECE,
} from '../supabase/functions/_shared/faitsVendeur.ts'
import { calculerAxes } from '../supabase/functions/_shared/bareme.ts'

let ok_ = 0, ko = 0
const ok = (c, l) => { if (c) { ok_++; console.log(`PASS — ${l}`) } else { ko++; console.log(`FAIL — ${l}`) } }
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l}${JSON.stringify(a) === JSON.stringify(b) ? '' : ` (obtenu ${JSON.stringify(a)}, attendu ${JSON.stringify(b)})`}`)

// ---------- plaques
eq(normaliserPlaque('ab-123-cd'), 'AB123CD', 'SIV normalisée')
eq(normaliserPlaque('AB 123 CD'), 'AB123CD', 'SIV avec espaces')
eq(normaliserPlaque('IO-123-CD'), null, 'lettres I/O interdites en SIV')
eq(normaliserPlaque('1234 AB 31'), '1234AB31', 'FNI')
eq(plaquesDansTexte('Immatriculée FG-456-HJ, visible à Toulouse'), ['FG456HJ'], 'plaque SIV dans l\'annonce')
eq(plaquesDansTexte('150 CV 20 pouces'), [], 'FNI seul ignoré (faux positif)')
eq(plaquesDansTexte('immatriculation : 345 ABC 31'), ['345ABC31'], 'FNI après le mot immatriculation')

// ---------- lecture
const brut = { lisible: true, type_piece: 'facture', date: '12/03/2024', km: 88000, operations: [{ libelle: 'Remplacement kit distribution et pompe à eau', categorie: 'distribution' }], code_rappel: '', vin: 'VF1RFB00X56789012', immatriculation: 'FG-456-HJ' }
const l = validerLecturePiece(brut)
eq(l.vin, 'VF1RFB00X56789012', 'VIN gardé en mémoire')
eq(l.immatriculation, 'FG456HJ', 'plaque normalisée')
eq(validerLecturePiece({ ...brut, date: '31/02/2024' }).date, '31/02/2024', 'format accepté à la lecture (validité contrôlée à la vérification)')
eq(validerLecturePiece({ ...brut, vin: 'VF1RFB00O56789012' }).vin, null, 'VIN avec O : rejeté')
eq(validerLecturePiece({ ...brut, operations: [{ libelle: 'x', categorie: 'inventee' }] }).operations[0].categorie, 'autre', 'catégorie inconnue → autre')

// ---------- vérification
const ctx = {
  vin_empreinte_dossier: 'H-VIN-OK', vin_empreinte_piece: 'H-VIN-OK', plaques_dossier: ['FG456HJ'],
  premiere_immat: '2017-04', annee_modele: 2017, km_annonce: 98000, aujourd_hui: '2026-11-12',
}
const v = verifierPiece(l, ctx)
eq(v.statut, 'justifie', 'pièce conforme → justifiée')
eq(v.verifie, { vehicule: 'vin', date: true, km: true }, 'ce qui a été vérifié : véhicule, date, km')
ok(!('vin' in v) && !('immatriculation' in v) && !JSON.stringify(v).includes('VF1RFB') && !JSON.stringify(v).includes('FG456HJ'), 'ni VIN ni plaque dans la sortie')

const sansId = verifierPiece({ ...l, vin: null, immatriculation: null }, { ...ctx, vin_empreinte_piece: null })
eq(sansId.statut, 'declare', 'ni VIN ni plaque lisibles → déclarée')
eq(sansId.incoherences.length, 0, '… sans incohérence')
ok(sansId.non_verifiable.length > 0, '… et le motif est dit')

const dossierMuet = verifierPiece(l, { ...ctx, vin_empreinte_dossier: null, plaques_dossier: [] })
eq(dossierMuet.statut, 'declare', 'dossier sans VIN ni plaque → déclarée')

const parPlaque = verifierPiece({ ...l, vin: null }, { ...ctx, vin_empreinte_piece: null, vin_empreinte_dossier: null })
eq([parPlaque.statut, parPlaque.verifie.vehicule], ['justifie', 'immatriculation'], 'plaque seule identique → justifiée')

const autreVin = verifierPiece(l, { ...ctx, vin_empreinte_piece: 'H-AUTRE' })
eq(autreVin.statut, 'declare', 'VIN différent → ne lève rien')
ok(autreVin.incoherences.some((i) => /VIN/.test(i)), '… et c\'est signalé')

const vinOkPlaqueKo = verifierPiece(l, { ...ctx, plaques_dossier: ['ZZ999ZZ'] })
eq(vinOkPlaqueKo.statut, 'declare', 'VIN identique mais plaque différente → une incohérence suffit')

const future = verifierPiece({ ...l, date: '01/01/2027' }, ctx)
eq([future.statut, future.incoherences.length], ['declare', 1], 'date à venir → incohérence')
const avantImmat = verifierPiece({ ...l, date: '01/01/2017' }, ctx)
eq([avantImmat.statut, avantImmat.incoherences.length], ['declare', 1], 'date avant la 1re immatriculation → incohérence')
const borneModele = verifierPiece({ ...l, date: '01/06/2016' }, { ...ctx, premiere_immat: null })
eq([borneModele.statut, borneModele.borne_date], ['justifie', 'annee_modele'], 'sans 1re immat : borne année-modèle − 1, dite')
const dateImpossible = verifierPiece({ ...l, date: '31/02/2024' }, ctx)
eq(dateImpossible.statut, 'declare', 'date impossible (31/02) → non vérifiable')

const kmTrop = verifierPiece({ ...l, km: 120000 }, ctx)
eq([kmTrop.statut, kmTrop.incoherences.length], ['declare', 1], 'km de la pièce > km annoncé → incohérence')
eq(verifierPiece({ ...l, km: 98000 }, ctx).statut, 'justifie', 'km égal → accepté')
eq(verifierPiece({ ...l, km: null }, ctx).statut, 'declare', 'km absent → déclarée')
eq(verifierPiece({ ...l, type_piece: 'devis' }, ctx).statut, 'declare', 'un devis n\'atteste rien de fait')

// ---------- application aux faits du barème
const base = {
  annee_courante: 2026, statut_vendeur: 'particulier', annee: 2017, kilometrage: 98000, prix_affiche: 9000,
  fourchette: null, comparables_count: 0,
  entretien_renseigne: true, signaux_entretien: 1, contradictions_entretien: 0, operations_critiques_non_faites: 1,
  catalogue_vide: false, famille_identifiee: true,
  pannes: [{ gravite: 'majeure', rappel_officiel: true, rappel_confirme_effectue: false, rappel_code: 'KGH' }],
  incoherences: 0, compteur_contredit: false, histovec_opposition: false,
}
const opsNF = ['Distribution jamais faite']
const sansPiece = appliquerPieces(base, [], opsNF)
eq(sansPiece.faits, base, 'sans pièce : faits strictement identiques')
eq(calculerAxes(sansPiece.faits).score, calculerAxes(base).score, 'sans pièce : score strictement identique')

const declarees = appliquerPieces(base, [sansId, autreVin, kmTrop], opsNF)
eq(declarees.faits, base, 'pièces déclarées ou incohérentes : faits identiques')
eq(declarees.leves, [], '… rien n\'est levé')

const distri = appliquerPieces(base, [v], opsNF)
eq(distri.leves, ['operation_critique_55'], 'facture de distribution justifiée → lève le 55')
eq(distri.faits.operations_critiques_non_faites, 0, '… opérations critiques à 0')
ok(calculerAxes(base).plafond_raison && calculerAxes(distri.faits).score >= calculerAxes(base).score, '… le score ne baisse pas')

const vidange = verifierPiece({ ...l, operations: [{ libelle: 'Vidange', categorie: 'vidange' }] }, ctx)
eq(appliquerPieces(base, [vidange], opsNF).leves, [], 'opération qui ne correspond pas (vidange ≠ distribution) → 55 maintenu')
eq(appliquerPieces(base, [v], ['Distribution jamais faite', 'Embrayage à prévoir']).leves, [], 'deux familles à couvrir, une seule prouvée → 55 maintenu')

const rappel = verifierPiece({ ...l, type_piece: 'attestation_rappel', code_rappel: 'KGH', operations: [{ libelle: 'Campagne KGH', categorie: 'rappel' }] }, ctx)
const r = appliquerPieces(base, [rappel], opsNF)
eq(r.leves, ['rappel_48'], 'attestation du rappel KGH justifiée → lève le 48')
eq(r.faits.pannes[0].rappel_confirme_effectue, true, '… rappel confirmé effectué')
eq(appliquerPieces(base, [{ ...rappel, code_rappel: 'ZZZ' }], opsNF).leves, [], 'code de rappel différent → 48 maintenu')
eq(appliquerPieces(base, [{ ...rappel, code_rappel: null }], opsNF).leves, [], 'rappel sans code → 48 maintenu')
const ancien = { ...base, pannes: [{ gravite: 'majeure', rappel_officiel: true, rappel_confirme_effectue: false }] }
eq(appliquerPieces(ancien, [rappel], opsNF, ['KGH']).leves, ['rappel_48'], 'analyse antérieure : un seul rappel, un seul code affiché, identique → levé')
eq(appliquerPieces({ ...ancien, pannes: [...ancien.pannes, { gravite: 'mineure', rappel_officiel: true, rappel_confirme_effectue: false }] }, [rappel], opsNF, ['KGH', 'ABC']).leves, [], 'analyse antérieure ambiguë → rien')

const muet = { ...base, entretien_renseigne: false, signaux_entretien: 0, operations_critiques_non_faites: 0, pannes: [] }
const e = appliquerPieces(muet, [vidange], [])
eq(e.leves, ['entretien_65'], 'facture d\'entretien justifiée sur annonce muette → lève le 65')
eq([e.faits.entretien_renseigne, e.faits.signaux_entretien], [true, 1], '… entretien renseigné')
eq(appliquerPieces(muet, [rappel], []).leves, [], 'une attestation de rappel n\'est pas une preuve d\'entretien')

// Hors d'atteinte : compteur, HistoVec, sécurité
const grave = { ...base, compteur_contredit: true, histovec_opposition: true, pannes: [{ gravite: 'securite', rappel_officiel: false, rappel_confirme_effectue: false }] }
const g = appliquerPieces(grave, [v, rappel, vidange], opsNF)
eq([g.faits.compteur_contredit, g.faits.histovec_opposition, g.faits.pannes[0].gravite], [true, true, 'securite'], 'compteur, opposition et sécurité : intouchés')
ok(calculerAxes(g.faits).score <= 30, '… le verdict reste plafonné par l\'opposition')
const src = fs.readFileSync(new URL('../supabase/functions/_shared/faitsVendeur.ts', import.meta.url), 'utf8')
ok(!/(?:compteur_contredit|histovec_\w+|fraude_suspectee|juridique_grave)\s*=/.test(src) && !/\.gravite\s*=/.test(src), 'le module n\'écrit aucun champ hors d\'atteinte (contrôle statique)')

// Contre-épreuve : le contrôle statique mord
ok(/(?:compteur_contredit|histovec_\w+)\s*=/.test('x.compteur_contredit = false'), 'contre-épreuve : le motif statique détecte une écriture')

// ---------- texte collé : toujours déclaré
const fd = faitsDeclaresDepuisTexte('Bonjour, la distribution a été faite à 90 000 km. Le rappel a été effectué chez Renault. Factures disponibles.')
ok(fd.length >= 2 && fd.every((f) => f.statut === 'declare'), 'réponse collée → faits déclarés uniquement')
ok(fd.some((f) => /Rappel/.test(f.fait)), 'rappel déclaré fait relevé')
eq(faitsDeclaresDepuisTexte(''), [], 'texte vide → rien')
eq(familleCritique('chaîne de distribution'), 'chaine', 'chaîne de distribution = chaîne')
ok(/non authentifiée par Inspexo/.test(MENTION_PIECE), 'mention obligatoire')

// ---------- fonction : le VIN et la plaque ne sortent pas de la mémoire
const fn = fs.readFileSync(new URL('../supabase/functions/reponse-vendeur/index.ts', import.meta.url), 'utf8')
const lignesVin = fn.split('\n').filter((x) => /\.vin\b|\.immatriculation\b/.test(x) && !/^\s*\/\//.test(x))
ok(lignesVin.length > 0, 'le VIN est bien lu dans la fonction (contre-épreuve : le contrôle n\'est pas vide)')
ok(lignesVin.every((x) => /sha256Hex\(|=\s*null;/.test(x)), 'le VIN et la plaque ne servent qu\'à une empreinte, puis sont effacés')
ok(!/jsonResponse\(\{[^}]*\blecture\b/.test(fn.replace(/\s+/g, ' ')), 'la lecture brute n\'est jamais renvoyée')
ok(/passDepuisReq\(/.test(fn) && fn.indexOf('passDepuisReq(') < fn.indexOf('await req.json('), 'Pass vérifié avant la lecture du corps')

console.log(`\n${ok_} PASS, ${ko} FAIL`)
if (ko > 0) process.exit(1)
