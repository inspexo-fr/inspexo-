// Test hors ligne du module de prix de marché (aucun appel API, aucune base).
// Usage : node tests/marche.test.mjs
//
// Ce que ce test protège, dans l'ordre d'importance :
//  1. le SEUIL de publication (15) — en dessous, aucune fourchette ne sort ;
//  2. la FUSION d'histogrammes : découper les relevés en lots ne change rien
//     au résultat (c'est toute la raison d'être du stockage en agrégats) ;
//  3. l'ajustement kilométrique MESURÉ : pas de pente mesurable, pas
//     d'ajustement — jamais de décote inventée ;
//  4. la région dérivée du seul code postal.
import {
  ANNEE_INCONNUE, KM_INCONNU, PART_API_MAX, SEUIL_FOURCHETTE, TRANCHE_PRIX,
  ajustementKm, boiteDe, departementDe, fondreReleves, fourchetteDepuisAgregats,
  partApiAcceptable, partApiDominante,
  generationDe, ligneCompatible, marqueCanonique, milieuTrancheKm, moisRecents,
  modeleCanonique, normaliserNom, positionPrix, referencePrix, regionDe,
  segmentDe, segmentDepuisTitreAnnonce, segmentsDepuisLibelleModele, technoDe,
  tranchePrix, trancheKm,
} from '../supabase/functions/_shared/marche.ts'

let ko = 0
let total = 0
const ok = (cond, label) => {
  total++
  if (!cond) { ko++; console.log(`FAIL — ${label}`) }
}
const eq = (a, b, label) => ok(
  JSON.stringify(a) === JSON.stringify(b),
  `${label} (obtenu ${JSON.stringify(a)}, attendu ${JSON.stringify(b)})`,
)
const titre = (t) => console.log(`\n▶ ${t}`)

// ---------------------------------------------------------------------------
titre('Normalisation et jetons de segment')
eq(normaliserNom('  Citroën   C3  '), 'citroen c3', 'accents et espaces normalisés')
eq(normaliserNom(null), '', 'null → chaîne vide')
eq(marqueCanonique('VW'), 'volkswagen', 'VW → volkswagen (groupe d’alias)')
eq(marqueCanonique('Mercedes-Benz'), 'mercedes', 'Mercedes-Benz → mercedes')
eq(marqueCanonique('Citroën'), 'citroen', 'accents retirés')
eq(marqueCanonique('Peugeot'), 'peugeot', 'marque sans alias inchangée')
eq(marqueCanonique(''), '', 'marque vide')

eq(technoDe('Peugeot 308 1.2 PureTech 130'), { techno: 'puretech', cyl: '1.2' }, 'techno + cylindrée')
eq(technoDe('Audi A3 35 TDI'), { techno: 'tdi', cyl: '' }, 'TDI sans cylindrée au libellé')
eq(technoDe('Tesla Model 3'), { techno: '', cyl: '' }, 'aucun jeton → vides')
eq(technoDe('Renault Zoe électrique'), { techno: 'electrique', cyl: '' },
  'électrique reconnu, jeton stocké sans accent')

eq(boiteDe('Boîte : Manuelle'), 'manuelle', 'boîte manuelle')
eq(boiteDe('BVA8 Tiptronic'), 'automatique', 'BVA reconnue automatique')
eq(boiteDe('S tronic 7'), 'automatique', 'S tronic reconnue automatique')
eq(boiteDe('EDC 6'), 'automatique', 'EDC reconnue automatique')
eq(boiteDe('6 rapports'), '', 'nombre de rapports seul : jamais deviné')
eq(boiteDe(null), '', 'boîte absente → inconnue')

eq(generationDe('Clio III'), 'iii', 'chiffre romain lu')
eq(generationDe('Golf 7 phase 2'), 'phase2', 'phase lue en priorité')
eq(generationDe('Classe A W177'), 'w177', 'code de caisse lu')
eq(generationDe('308'), '', 'rien d’écrit → génération inconnue')

eq(tranchePrix(15_120), 15_000, 'tranche de prix par pas de 250')
eq(tranchePrix(15_250), 15_250, 'borne basse de tranche')
eq(trancheKm(0), 0, 'km nul → tranche 0')
eq(trancheKm(null), KM_INCONNU, 'km absent → tranche inconnue')
eq(trancheKm(159_000), 7, '159 000 km → tranche 7')
eq(milieuTrancheKm(7), 150_000, 'milieu de la tranche 7')

// ---------------------------------------------------------------------------
titre('Région : dérivée du SEUL code postal')
eq(departementDe('31400'), '31', 'Toulouse → 31')
eq(regionDe('31400'), 'occitanie', 'Haute-Garonne → Occitanie')
eq(regionDe('75011'), 'ile-de-france', 'Paris → Île-de-France')
eq(departementDe('20000'), '2a', 'Ajaccio → Corse-du-Sud')
eq(departementDe('20200'), '2b', 'Bastia → Haute-Corse')
eq(regionDe('20200'), 'corse', 'Corse → région Corse')
eq(regionDe('97400'), 'la-reunion', 'La Réunion')
eq(regionDe('97100'), 'guadeloupe', 'Guadeloupe')
eq(regionDe('97500'), '', 'Saint-Pierre-et-Miquelon : pas une région → inconnue')
eq(regionDe('98800'), '', 'Nouvelle-Calédonie : pas une région → inconnue')
eq(regionDe('Toulouse'), '', 'un nom de ville ne donne JAMAIS de région')
eq(regionDe('3140'), '', 'code postal incomplet → inconnue')
eq(regionDe(''), '', 'code postal absent → inconnue')
eq(regionDe('00000'), '', 'code postal impossible → inconnue')
// Couverture : les 96 départements métropolitains + 5 DOM ont une région.
{
  let sansRegion = []
  for (let d = 1; d <= 95; d++) {
    if (d === 20) continue // la Corse est 2A/2B, testée ci-dessus
    const cp = `${String(d).padStart(2, '0')}000`
    if (!regionDe(cp)) sansRegion.push(cp)
  }
  for (const cp of ['97100', '97200', '97300', '97400', '97600']) {
    if (!regionDe(cp)) sansRegion.push(cp)
  }
  eq(sansRegion, [], 'tous les départements français ont une région')
}

// ---------------------------------------------------------------------------
titre('Modèle canonique : UNE écriture par modèle, partagée par toutes les voies')
// C'est l'invariant le plus important du sprint : l'identification d'une
// annonce écrit « Clio IV », une page de résultats affiche « Clio », un
// libellé de famillesMoteur dit « Clio III/IV ». Trois segments séparés
// n'atteindraient jamais 15 relevés, donc aucune fourchette ne sortirait.
eq(modeleCanonique('Clio IV'), 'clio', 'génération romaine retirée')
eq(modeleCanonique('Clio'), 'clio', 'modèle déjà canonique')
eq(modeleCanonique('Clio III/IV'), 'clio', 'double génération retirée')
eq(new Set(['Clio IV', 'Clio', 'Clio III/IV', 'clio v'].map(modeleCanonique)).size, 1,
  'les quatre écritures convergent vers UN segment')
eq(modeleCanonique('Série 3'), 'serie 3', 'le chiffre de Série 3 fait partie du modèle')
eq(modeleCanonique('Classe A'), 'classe a', 'la lettre de Classe A fait partie du modèle')
eq(modeleCanonique('Classe A W177'), 'classe a', 'code de caisse retiré, lettre gardée')
eq(modeleCanonique('308'), '308', 'modèle numérique')
eq(modeleCanonique('308 GT'), '308 gt',
  'finition CONSERVÉE : une 308 GT n’a pas le prix d’une 308 de base')
eq(modeleCanonique('Santa Fe'), 'santa fe', 'nom de modèle en deux mots préservé')
eq(modeleCanonique('C5 Aircross'), 'c5 aircross', 'C5 Aircross ≠ C5')
eq(modeleCanonique('Discovery Sport'), 'discovery sport', 'Discovery Sport ≠ Discovery')
eq(modeleCanonique('Clio 5'), 'clio', 'génération en chiffre arabe retirée')
eq(modeleCanonique('Golf 7'), 'golf', 'génération arabe retirée')
eq(modeleCanonique('Classe A 180 d'), 'classe a',
  'la désignation de puissance s’arrête au modèle')
eq(modeleCanonique('Série 3 320d xDrive'), 'serie 3', 'désignation moteur retirée')
eq(modeleCanonique('Clio IV 1.5 dCi 90 Business'), 'clio',
  'arrêt au premier mot technique : tout le reste décrit le moteur')
eq(modeleCanonique('Golf VII'), 'golf', 'génération retirée')
eq(modeleCanonique('Sandero Stepway'), 'sandero stepway',
  'déclinaison conservée : la Stepway forme son propre segment')
eq(modeleCanonique('1.2 PureTech'), '',
  'une motorisation seule n’est PAS un modèle : rien n’est écrit')
eq(modeleCanonique('1.5'), '', 'une cylindrée seule n’est pas un modèle')
eq(modeleCanonique(''), '', 'vide')
eq(modeleCanonique(null), '', 'absent')

// ---------------------------------------------------------------------------
titre('Segment d’un relevé')
const releve = (p) => ({
  marque: 'Peugeot', modele: '308', libelle: '1.2 PureTech 130 Manuelle',
  annee: 2020, km: 60_000, prix: p, code_postal: '31400',
  date: new Date(Date.UTC(2026, 10, 2)),
})
eq(segmentDe(releve(15_120)), {
  marque_norm: 'peugeot', modele_norm: '308', generation_norm: '',
  techno: 'puretech', cyl: '1.2', boite: 'manuelle', annee: 2020,
  km_tranche: 3, region: 'occitanie', mois: '2026-11', prix_tranche: 15_000,
}, 'segment complet')
ok(segmentDe({ ...releve(15_000), prix: 50 }) === null, 'prix invraisemblable → rejeté')
ok(segmentDe({ ...releve(15_000), prix: 2_000_000 }) === null, 'prix hors bornes → rejeté')
ok(segmentDe({ ...releve(15_000), marque: '' }) === null, 'marque absente → rejeté')
ok(segmentDe({ ...releve(15_000), modele: '  ' }) === null, 'modèle absent → rejeté')
eq(segmentDe({ ...releve(15_000), annee: null, km: null, code_postal: null }).annee,
  ANNEE_INCONNUE, 'année absente → inconnue, pas 2026')
eq(segmentDe({ ...releve(15_000), annee: null, km: null, code_postal: null }).region,
  '', 'code postal absent → région inconnue')
eq(segmentDe({ ...releve(15_000), marque: 'VW', modele: 'Golf' }).marque_norm,
  'volkswagen', 'marque canonisée À L’ÉCRITURE : « VW » ne crée pas un second segment')
eq(segmentDe({ ...releve(15_000), modele: 'Clio IV' }).modele_norm,
  'clio', 'modèle canonisé À L’ÉCRITURE')
ok(segmentDe({ ...releve(15_000), modele: '1.2 PureTech' }) === null,
  'modèle non identifiable → relevé REJETÉ plutôt que mal rangé')

titre('Fonte des relevés : un segment, un effectif')
{
  const fondus = fondreReleves([releve(15_120), releve(15_130), releve(16_400), { ...releve(15_120), prix: 40 }])
  eq(fondus.length, 2, 'deux segments distincts (deux tranches de prix)')
  eq(fondus.find((f) => f.prix_tranche === 15_000).n, 2, 'deux relevés fondus dans la même tranche')
  eq(fondus.find((f) => f.prix_tranche === 16_250).n, 1, 'relevé isolé')
  ok(!fondus.some((f) => f.n > 2), 'le relevé au prix invraisemblable n’est pas compté')
}

// ---------------------------------------------------------------------------
titre('Compatibilité d’une ligne avec le véhicule cible')
const L = (p) => ({ techno: 'puretech', cyl: '1.2', boite: '', generation_norm: '', annee: 2020, km_tranche: 3, region: 'occitanie', prix_tranche: p, effectif: 1 })
const cible = { techno: 'puretech', cyl: '1.2', annee: 2020, km: 60_000 }
ok(ligneCompatible(L(15_000), cible), 'même techno, même cylindrée, même année')
ok(!ligneCompatible({ ...L(15_000), techno: 'bluehdi' }, cible), 'autre motorisation → écartée')
ok(!ligneCompatible({ ...L(15_000), techno: '' }, cible),
  'motorisation EXIGÉE quand le véhicule en a une')
ok(!ligneCompatible({ ...L(15_000), cyl: '1.6' }, cible), 'autre cylindrée → écartée')
ok(ligneCompatible({ ...L(15_000), cyl: '' }, cible), 'cylindrée inconnue → acceptée')
ok(ligneCompatible({ ...L(15_000), boite: 'automatique' }, cible),
  'boîte de la ligne ignorée quand le véhicule n’en déclare pas')
ok(!ligneCompatible({ ...L(15_000), boite: 'automatique' }, { ...cible, boite: 'manuelle' }),
  'contradiction de boîte → écartée')
ok(ligneCompatible({ ...L(15_000), boite: '' }, { ...cible, boite: 'manuelle' }),
  'boîte inconnue de la ligne → acceptée (sinon le segment se vide)')
ok(!ligneCompatible({ ...L(15_000), generation_norm: 'ii' }, { ...cible, generation: 'iii' }),
  'contradiction de génération → écartée')
ok(ligneCompatible({ ...L(15_000), annee: 2018 }, cible), '±2 ans accepté')
ok(!ligneCompatible({ ...L(15_000), annee: 2017 }, cible), 'au-delà de 2 ans → écartée')
ok(ligneCompatible({ ...L(15_000), annee: ANNEE_INCONNUE }, cible), 'année inconnue → acceptée')
ok(!ligneCompatible({ ...L(15_000), km_tranche: 0 }, cible), 'km trop bas (−30 %) → écartée')
ok(!ligneCompatible({ ...L(15_000), km_tranche: 9 }, cible), 'km trop haut (+30 %) → écartée')
ok(ligneCompatible({ ...L(15_000), km_tranche: KM_INCONNU }, cible), 'km inconnu → accepté')

// ---------------------------------------------------------------------------
titre('Fourchette : seuil de publication')
const lignes = (n, prix, extra = {}) => Array.from({ length: n }, () => ({ ...L(prix), ...extra }))
ok(fourchetteDepuisAgregats(lignes(14, 15_000), cible) === null,
  `14 relevés → aucune fourchette (seuil ${SEUIL_FOURCHETTE})`)
ok(fourchetteDepuisAgregats(lignes(15, 15_000), cible) !== null, '15 relevés → fourchette publiée')
eq(fourchetteDepuisAgregats([{ ...L(15_000), effectif: 15 }], cible).n, 15,
  'un effectif de 15 sur une seule ligne suffit')
ok(fourchetteDepuisAgregats([], cible) === null, 'aucun relevé → null')
ok(fourchetteDepuisAgregats(lignes(10, 15_000), cible, SEUIL_FOURCHETTE, [
  15_000, 15_100, 15_200, 15_300, 15_400,
]).n === 15, 'les comparables en mémoire (extension) complètent le seuil')

titre('Fourchette : quantiles lus sur l’histogramme')
{
  // 20 relevés étalés de 10 000 à 19 750 € par tranches de 250.
  const etale = Array.from({ length: 20 }, (_, i) => ({ ...L(10_000 + i * 250), effectif: 1 }))
  const f = fourchetteDepuisAgregats(etale, cible)
  ok(f.p25 < f.mediane && f.mediane < f.p75, 'P25 < médiane < P75')
  eq(f.n, 20, 'effectif total')
  ok(f.p25 >= 10_000 && f.p75 <= 19_750 + TRANCHE_PRIX, 'quantiles dans l’étendue des relevés')
  eq(f.portee, 'national', 'sans région cible → portée nationale')
}

titre('Fourchette : la FUSION par somme est le cœur du dispositif')
{
  const brut = Array.from({ length: 40 }, (_, i) => ({ ...L(10_000 + (i % 20) * 250), effectif: 1 }))
  const entier = fourchetteDepuisAgregats(brut, cible)
  // Découpage en 4 lots puis re-fusion : le résultat doit être IDENTIQUE.
  const lots = [brut.slice(0, 7), brut.slice(7, 19), brut.slice(19, 33), brut.slice(33)]
  const refondu = fourchetteDepuisAgregats(lots.flat(), cible)
  eq(refondu, entier, 'découper les relevés en lots ne change pas la fourchette')
  // Deux lignes du même segment fusionnées à la main = une ligne d'effectif 2.
  const deuxLignes = fourchetteDepuisAgregats(
    [...lignes(10, 15_000), ...lignes(10, 16_000)], cible)
  const fusionnees = fourchetteDepuisAgregats(
    [{ ...L(15_000), effectif: 10 }, { ...L(16_000), effectif: 10 }], cible)
  eq(fusionnees, deuxLignes, 'somme d’effectifs ≡ lignes répétées')
}

titre('Fourchette : la région est une PRÉFÉRENCE, jamais un filtre')
{
  const mixte = [
    ...lignes(20, 15_000, { region: 'occitanie' }),
    ...lignes(20, 25_000, { region: 'ile-de-france' }),
  ]
  const regionale = fourchetteDepuisAgregats(mixte, { ...cible, region: 'occitanie' })
  eq(regionale.portee, 'region', 'région suffisante → fourchette régionale')
  eq(regionale.n, 20, 'seuls les relevés de la région comptent')
  eq(regionale.region, 'occitanie', 'région publiée')
  const rare = fourchetteDepuisAgregats(
    [...mixte, ...lignes(2, 15_000, { region: 'bretagne' })], { ...cible, region: 'bretagne' })
  eq(rare.portee, 'national', 'région trop peu peuplée → repli national')
  eq(rare.n, 42, 'le national additionne toutes les régions')
  eq(rare.region, null, 'aucune région publiée au national')
}

// ---------------------------------------------------------------------------
titre('Fourchette : aucun client d’API ne pèse plus de 20 % du segment')
// CUA art. 6.3. Deux verrous INDÉPENDANTS : 15 relevés, ET aucune source
// dominante. Atteindre le seuil ne suffit pas — un segment dont un cinquième
// vient d'un seul client d'API n'est plus une observation du marché, c'est le
// reflet de ce client, et nous l'afficherions sous l'étiquette « prix
// observés ».
eq(PART_API_MAX, 0.20, 'le seuil est bien d’un cinquième')

// `L(prix)` porte effectif 1. On attribue en plaçant une carte parts_api.
const avecApi = (prix, parts) => ({ ...L(prix), parts_api: parts })

// Référence : 15 relevés, aucune contribution d’API → publiée.
ok(fourchetteDepuisAgregats(lignes(15, 15_000), cible) !== null,
  '15 relevés sans aucune contribution d’API → publiée')

// 3 sur 15 = exactement 20 % : la borne est INCLUSE, « plus de 20 % » exclut.
ok(fourchetteDepuisAgregats(
  [...lignes(14, 15_000), avecApi(15_000, { A: 3 })], cible) !== null,
  'un client à exactement 20 % → encore publiée (la borne est incluse)')

// 4 sur 15 ≈ 26,7 % : au-delà, le segment ne sort pas.
ok(fourchetteDepuisAgregats(
  [...lignes(14, 15_000), avecApi(15_000, { A: 4 })], cible) === null,
  'un client au-delà de 20 % → segment NON publié')

// La règle est PAR CLIENT, pas sur le cumul : deux clients à 20 % chacun
// (40 % d’API au total) passent, parce qu’aucun des deux ne domine seul.
ok(fourchetteDepuisAgregats(
  [...lignes(13, 15_000), avecApi(15_000, { A: 3 }), avecApi(15_000, { B: 3 })],
  cible) !== null,
  'deux clients à 20 % chacun → publiée (la règle est par client)')
ok(fourchetteDepuisAgregats(
  [...lignes(13, 15_000), avecApi(15_000, { A: 4 }), avecApi(15_000, { B: 4 })],
  cible) === null,
  'deux clients au-delà de 20 % chacun → non publiée')

// Le poids d’un client se CUMULE sur toutes les lignes du segment : le
// répartir en petites contributions ne doit rien changer.
ok(fourchetteDepuisAgregats(
  [...lignes(11, 15_000), avecApi(15_000, { A: 1 }), avecApi(15_250, { A: 1 }),
   avecApi(15_500, { A: 1 }), avecApi(15_750, { A: 1 })], cible) === null,
  'un client éparpillé sur 4 lignes est compté une seule fois, et bloque')

// Le dénominateur est le total PUBLIÉ : des prix bruts fournis en mémoire
// (comparables de l’extension) élargissent la population et peuvent ramener
// un client sous la barre. C’est cohérent — le segment affiché est bien moins
// dominé qu’il ne l’était.
ok(fourchetteDepuisAgregats(
  [...lignes(14, 15_000), avecApi(15_000, { A: 4 })], cible) === null,
  'client à 4 relevés sur 15 → bloquée')
ok(fourchetteDepuisAgregats(
  [...lignes(14, 15_000), avecApi(15_000, { A: 4 })], cible, SEUIL_FOURCHETTE,
  [15_000, 15_100, 15_200, 15_300, 15_400]) !== null,
  'les mêmes relevés élargis par 5 prix bruts → publiée (4 sur 20 = 20 %)')

// Une ligne d’effectif nul ne contribue à rien, pas même à une part d’API.
ok(fourchetteDepuisAgregats(
  [...lignes(15, 15_000), { ...avecApi(15_000, { A: 99 }), effectif: 0 }],
  cible) !== null,
  'une ligne d’effectif nul ne porte aucune part d’API')

// Les deux verrous ne se compensent jamais : sous le seuil, rien ne sort,
// qu’il y ait ou non une source dominante.
ok(fourchetteDepuisAgregats(lignes(14, 15_000), cible) === null,
  'sous le seuil, pas de fourchette même sans aucune part d’API')

// Interaction avec la PRÉFÉRENCE régionale : si le sous-ensemble régional est
// dominé par un client, on ne le publie pas — on retombe sur le national, qui
// est plus large et moins dominé. La préférence ne contourne pas le verrou.
{
  const mixte = [
    ...Array.from({ length: 14 }, () => ({ ...L(15_000), region: 'occitanie' })),
    { ...avecApi(15_000, { A: 5 }), region: 'occitanie' },
    ...Array.from({ length: 30 }, () => ({ ...L(16_000), region: 'bretagne' })),
  ]
  const f = fourchetteDepuisAgregats(mixte, { ...cible, region: 'occitanie' })
  ok(f !== null && f.portee === 'national',
    'région dominée par un client → repli sur le national, jamais de publication dominée')
}

// La fonction pure, isolée.
eq(partApiDominante([], 0), { client: null, effectif: 0, part: 0 },
  'aucune ligne → aucune part dominante')
eq(partApiDominante([avecApi(15_000, { A: 2, B: 5 })], 20).client, 'B',
  'le client le plus lourd est identifié')
eq(partApiDominante([avecApi(15_000, { A: 2, B: 5 })], 20).part, 0.25,
  'sa part est calculée sur le total publié')
ok(partApiAcceptable([avecApi(15_000, { A: 2 })], 10) === true, '2/10 = 20 % → acceptable')
ok(partApiAcceptable([avecApi(15_000, { A: 3 })], 10) === false, '3/10 = 30 % → refusé')
// Une carte absente est le cas NORMAL (partage des prix éteint par défaut).
ok(partApiAcceptable(lignes(15, 15_000), 15) === true,
  'absence de carte parts_api → aucune part, segment acceptable')

titre('Position de l’annonce dans la fourchette')
eq(positionPrix(9_000, { p25: 10_000, p75: 20_000 }).cle, 'quart_moins_cher', 'sous le P25')
eq(positionPrix(10_000, { p25: 10_000, p75: 20_000 }).cle, 'quart_moins_cher', 'au P25 : encore le quart bas')
eq(positionPrix(15_000, { p25: 10_000, p75: 20_000 }).cle, 'moyenne', 'entre P25 et P75')
eq(positionPrix(20_000, { p25: 10_000, p75: 20_000 }).cle, 'moyenne', 'au P75 : encore dans la moyenne')
eq(positionPrix(20_001, { p25: 10_000, p75: 20_000 }).cle, 'plus_cher_que_75', 'au-dessus du P75')
eq(positionPrix(25_000, { p25: 10_000, p75: 20_000 }).libelle,
  'plus chère que 75 % des annonces comparables', 'libellé exact')

// ---------------------------------------------------------------------------
titre('Ajustement kilométrique : mesuré dans le segment, ou absent')
// Segment à pente nette : −1 000 € par tranche de 20 000 km = −500 € / 10 000 km.
const cibleKm = { techno: 'puretech', cyl: '1.2', annee: 2020, km: 100_000 }
const pentu = [
  ...Array.from({ length: 5 }, () => ({ ...L(15_000), km_tranche: 3 })),
  ...Array.from({ length: 5 }, () => ({ ...L(14_000), km_tranche: 4 })),
  ...Array.from({ length: 5 }, () => ({ ...L(13_000), km_tranche: 5 })),
  ...Array.from({ length: 5 }, () => ({ ...L(12_000), km_tranche: 6 })),
]
{
  const a = ajustementKm(pentu, cibleKm)
  ok(a !== null, 'pente mesurable sur 4 tranches peuplées')
  eq(a.decote_eur_10000km, 500, 'décote mesurée : 500 € / 10 000 km')
  eq(a.n_tranches, 4, '4 tranches de km exploitées')
  eq(a.km_median_segment, 90_000, 'km médian du segment')
  eq(a.ecart_eur, -500, 'véhicule à 100 000 km, 10 000 km au-dessus du médian → −500 €')
}
ok(ajustementKm(pentu.slice(0, 10), cibleKm) === null,
  'moins de 3 tranches peuplées → AUCUN ajustement')
ok(ajustementKm([
  ...Array.from({ length: 2 }, () => ({ ...L(15_000), km_tranche: 3 })),
  ...Array.from({ length: 2 }, () => ({ ...L(14_000), km_tranche: 4 })),
  ...Array.from({ length: 2 }, () => ({ ...L(13_000), km_tranche: 5 })),
], cibleKm) === null, 'tranches sous l’effectif minimal → aucun ajustement')
ok(ajustementKm([
  ...Array.from({ length: 4 }, () => ({ ...L(13_000), km_tranche: 3 })),
  ...Array.from({ length: 4 }, () => ({ ...L(14_000), km_tranche: 4 })),
  ...Array.from({ length: 4 }, () => ({ ...L(15_000), km_tranche: 5 })),
], cibleKm) === null, 'pente POSITIVE (bruit) → aucun ajustement, jamais de surcote')
ok(ajustementKm([
  ...Array.from({ length: 4 }, () => ({ ...L(15_000), km_tranche: 3 })),
  ...Array.from({ length: 4 }, () => ({ ...L(14_990), km_tranche: 4 })),
  ...Array.from({ length: 4 }, () => ({ ...L(14_980), km_tranche: 5 })),
], cibleKm) === null, 'pente sous le plancher de vraisemblance → aucun ajustement')
ok(ajustementKm(pentu, { ...cibleKm, km: null }) === null,
  'kilométrage du véhicule inconnu → aucun ajustement')
ok(ajustementKm(lignes(20, 15_000, { km_tranche: KM_INCONNU }), cibleKm) === null,
  'relevés sans kilométrage → aucun ajustement')

// ---------------------------------------------------------------------------
titre('Référence de prix : fourchette observée + correction km')
{
  const r = referencePrix(pentu, cibleKm, 15_000)
  ok(r !== null, 'référence produite (20 relevés)')
  eq(r.fourchette.n, 20, 'effectif')
  eq(r.ajustement.ecart_eur, -500, 'correction km retenue')
  eq(r.mediane_reference, r.fourchette.mediane - 500, 'médiane de référence corrigée du km')
  ok(r.ecart_au_dessus_eur > 0, 'annonce au-dessus de la référence corrigée')
  eq(r.ecart_au_dessus_eur, 15_000 - r.mediane_reference, 'écart = prix − référence')
  eq(r.position.cle, 'plus_cher_que_75', 'position calculée sur la fourchette corrigée')
}
{
  // Même segment, véhicule AU km médian : la correction tombe sous le seuil
  // significatif et n'est donc pas appliquée.
  const r = referencePrix(pentu, { ...cibleKm, km: 90_000 }, 13_000)
  eq(r.ajustement, null, 'correction négligeable → non appliquée')
  eq(r.mediane_reference, r.fourchette.mediane, 'référence = médiane observée')
  eq(r.ecart_au_dessus_eur, 0, 'annonce sous la référence → aucun écart à négocier')
}
{
  const r = referencePrix(lignes(20, 15_000), cible, null)
  eq(r.position, null, 'prix affiché inconnu → aucune position')
  eq(r.ecart_au_dessus_eur, 0, 'aucun écart sans prix affiché')
}
ok(referencePrix(lignes(5, 15_000), cible, 15_000) === null,
  'sous le seuil → aucune référence (le prix reste « non évalué »)')

titre('Déterminisme')
{
  const attendu = JSON.stringify(referencePrix(pentu, cibleKm, 15_000))
  let stable = true
  for (let i = 0; i < 200; i++) {
    if (JSON.stringify(referencePrix(pentu, cibleKm, 15_000)) !== attendu) stable = false
  }
  ok(stable, '200 appels identiques → résultat identique')
}

// ---------------------------------------------------------------------------
titre('Fenêtre de relevé')
eq(moisRecents(new Date(Date.UTC(2026, 10, 2))), ['2026-11', '2026-10', '2026-09'],
  '3 mois glissants, mois courant inclus')
eq(moisRecents(new Date(Date.UTC(2026, 0, 15))), ['2026-01', '2025-12', '2025-11'],
  'passage d’année')

// ---------------------------------------------------------------------------
titre('Pages /moteur : libellé de modèle → segments')
const seg = (l) => segmentsDepuisLibelleModele(l).map((x) => `${x.marque}/${x.modele}`)
eq(seg('Renault Clio III/IV'), ['renault/clio'], 'chiffres romains retirés')
eq(seg('Dacia Duster I/II'), ['dacia/duster'], 'générations retirées')
eq(seg('Renault Clio V'), ['renault/clio'], 'romain « V » retiré sans toucher au modèle')
eq(seg('Mercedes Classe A W177'), ['mercedes/classe a'],
  'code de caisse retiré, la LETTRE DE MODÈLE conservée')
eq(seg('Mercedes Classe C W204/W205'), ['mercedes/classe c'],
  'groupe de codes de caisse retiré, « classe c » préservée')
eq(seg('Mini Cooper S R56'), ['mini/cooper s'], 'finition « S » conservée')
eq(seg('Hyundai Santa Fe'), ['hyundai/santa fe'], 'modèle en deux mots')
eq(seg('Citroën C5 Aircross'), ['citroen/c5 aircross'], 'C5 Aircross distinct du C5')
eq(seg('Opel Corsa D/E'), ['opel/corsa'], 'lettres de génération EN GROUPE retirées')
eq(seg('Audi A1 GB'), ['audi/a1'], 'code à deux lettres derrière « A1 » retiré')
eq(seg('Toyota Corolla E210'), ['toyota/corolla'], 'code de caisse à 3 chiffres retiré')
eq(seg('Toyota Prius XW30/XW50'), ['toyota/prius'], 'codes de caisse doubles retirés')
eq(seg('Ford Focus Mk4'), ['ford/focus'], 'notation Mk retirée')
eq(seg('VW Golf VII'), ['volkswagen/golf'], 'marque canonisée À LA LECTURE aussi')
eq(seg('Land Rover Discovery Sport'), ['land rover/discovery sport'], 'marque en deux mots')
eq(seg('Peugeot 308 II'), ['peugeot/308'], 'modèle numérique conservé')
eq(seg('BMW Série 3 F30/G20'), ['bmw/serie 3'], 'le « 3 » de Série 3 n’est pas une génération')
eq(seg('Citroën C3/C4'), ['citroen/c3', 'citroen/c4'], 'libellé à DEUX modèles éclaté')
eq(seg('Peugeot 207/208'), ['peugeot/207', 'peugeot/208'], 'deux modèles numériques')
eq(seg('Hyundai Tucson/ix35'), ['hyundai/tucson', 'hyundai/ix35'], 'deux modèles hétérogènes')
eq(seg('Ford Fiesta/Focus'), ['ford/fiesta', 'ford/focus'], 'deux modèles alphabétiques')
eq(seg('Peugeot 308 GT'), ['peugeot/308 gt'],
  'finition CONSERVÉE : une 308 GT n’a pas le prix d’une 308')
eq(seg('DS 7 Crossback'), ['ds/7 crossback'],
  'le « 7 » de DS 7 est le modèle, pas une génération')
eq(seg('Marque Inconnue Modele'), [], 'marque non reconnue → aucun segment (jamais devinée)')
eq(seg('Peugeot'), [], 'marque seule sans modèle → aucun segment')
eq(seg(''), [], 'libellé vide → aucun segment')
eq(seg(null), [], 'libellé absent → aucun segment')
// Couverture réelle : les 143 libellés de famillesMoteur.js doivent tous
// produire au moins un segment, sinon une page /moteur perd son bloc prix.
{
  const { FAMILLES_MOTEUR } = await import('../src/data/famillesMoteur.js')
  const libelles = new Set()
  for (const f of FAMILLES_MOTEUR) for (const m of f.modeles ?? []) libelles.add(m)
  const orphelins = [...libelles].filter((l) => segmentsDepuisLibelleModele(l).length === 0)
  eq(orphelins, [], `les ${libelles.size} libellés de famillesMoteur produisent un segment`)
}

// ---------------------------------------------------------------------------
titre('Titre d’annonce libre (extension) → segment')
const tit = (x) => { const r = segmentDepuisTitreAnnonce(x); return r ? `${r.marque}/${r.modele}` : null }
eq(tit('Renault Clio IV 1.5 dCi 90 Business'), 'renault/clio', 'titre de résultats courant')
eq(tit('BMW Série 3 320d xDrive Sport'), 'bmw/serie 3', 'Série 3 préservée')
eq(tit('Mercedes-Benz Classe A 180 d AMG Line'), 'mercedes/classe a', 'marque à alias + Classe A')
eq(tit('VW Golf VII 1.6 TDI 115 Confortline'), 'volkswagen/golf', 'marque abrégée canonisée')
eq(tit('Peugeot 208 1.2 PureTech 100 Allure'), 'peugeot/208', 'modèle numérique')
eq(tit('Dacia Sandero Stepway 0.9 TCe 90'), 'dacia/sandero stepway',
  'déclinaison conservée')
eq(tit('Hyundai Santa Fe 2.2 CRDi 197'), 'hyundai/santa fe', 'modèle en deux mots')
eq(tit('Citroën C5 Aircross 1.5 BlueHDi 130'), 'citroen/c5 aircross', 'C5 Aircross distinct du C5')
eq(tit('Land Rover Discovery Sport 2.0 TD4 180'), 'land rover/discovery sport',
  'marque en deux mots + modèle en deux mots')
eq(tit('Ford Fiesta ST 1.5 EcoBoost 200'), 'ford/fiesta st', 'finition ST conservée')
eq(tit('Renault Clio 5 1.0 TCe 90'), 'renault/clio', 'génération arabe retirée du titre')
eq(tit('Citroën C3 III 1.2 PureTech 83'), 'citroen/c3', 'accent et génération')
eq(tit('Marque Inconnue 1.5 dCi'), null, 'marque non reconnue → relevé perdu, jamais deviné')
eq(tit('Peugeot'), null, 'marque seule → aucun modèle')
eq(tit('Renault 1.5 dCi 90'), null, 'motorisation à la place du modèle → rejeté')
eq(tit(''), null, 'titre vide')
eq(tit(null), null, 'titre absent')
// L'écriture de l'extension et celle d'une analyse doivent se rejoindre.
{
  const parTitre = segmentDepuisTitreAnnonce('Renault Clio IV 1.5 dCi 90')
  const parAnalyse = segmentDe({
    marque: 'Renault', modele: 'Clio IV', libelle: '1.5 dCi 90',
    annee: 2017, km: 90_000, prix: 9_500,
  })
  eq([parTitre.marque, parTitre.modele], [parAnalyse.marque_norm, parAnalyse.modele_norm],
    'extension et analyse écrivent dans LE MÊME segment')
}

// ---------------------------------------------------------------------------
titre('Table générée des segments de modèles')
{
  // src/data/segmentsModeles.js est GÉNÉRÉ depuis ce module : s'il est périmé,
  // les pages /moteur interrogeraient des segments qui n'existent plus.
  const { execFileSync } = await import('node:child_process')
  let aJour = true
  try {
    execFileSync(process.execPath, ['scripts/generer-segments-modeles.mjs', '--verifier'],
      { stdio: 'pipe' })
  } catch (_) { aJour = false }
  ok(aJour, 'src/data/segmentsModeles.js est à jour (sinon : node scripts/generer-segments-modeles.mjs)')

  const { SEGMENTS_PAR_SLUG, segmentsPourFamille } = await import('../src/data/segmentsModeles.js')
  const { FAMILLES_MOTEUR } = await import('../src/data/famillesMoteur.js')
  const avecModeles = FAMILLES_MOTEUR.filter((f) => (f.modeles ?? []).length > 0)
  eq(Object.keys(SEGMENTS_PAR_SLUG).length, avecModeles.length,
    'chaque famille qui déclare des modèles a ses segments')
  ok(avecModeles.every((f) => segmentsPourFamille(f.slug).length > 0),
    'aucune famille sans segment interrogeable')
  eq(segmentsPourFamille('slug-inexistant'), [], 'slug inconnu → tableau vide, jamais undefined')
  // Chaque segment porte un libellé d'AFFICHAGE : la clé est normalisée sans
  // accent (« serie 3 »), l'afficher telle quelle donnerait « Serie 3 ».
  const tous = Object.values(SEGMENTS_PAR_SLUG).flat()
  ok(tous.every((sg) => typeof sg.libelle === 'string' && sg.libelle.length > 0),
    'tout segment porte un libellé d’affichage')
  const parCle = new Map(tous.map((sg) => [`${sg.marque}/${sg.modele}`, sg.libelle]))
  eq(parCle.get('bmw/serie 3'), 'Série 3', 'accent restitué à l’affichage')
  eq(parCle.get('renault/megane'), 'Mégane', 'Mégane accentuée')
  eq(parCle.get('renault/scenic'), 'Scénic', 'Scénic accentué')
  eq(parCle.get('mercedes/classe a'), 'Classe A', 'Classe A en capitales d’origine')
  eq(parCle.get('hyundai/santa fe'), 'Santa Fe', 'modèle en deux mots')
  eq(parCle.get('peugeot/308 gt'), '308 GT', 'finition en capitales')
  eq(parCle.get('citroen/c3'), 'C3', 'libellé éclaté → clé en capitales')
  ok(tous.every((sg) => normaliserNom(sg.libelle) === sg.modele),
    'le libellé d’affichage se renormalise EXACTEMENT vers la clé de segment')
  // Les segments de la table doivent correspondre au module, famille par famille.
  let ecarts = 0
  for (const f of avecModeles) {
    const attendu = new Set()
    for (const l of f.modeles) {
      for (const sg of segmentsDepuisLibelleModele(l)) attendu.add(`${sg.marque}/${sg.modele}`)
    }
    const obtenu = new Set(segmentsPourFamille(f.slug).map((sg) => `${sg.marque}/${sg.modele}`))
    if (attendu.size !== obtenu.size || [...attendu].some((x) => !obtenu.has(x))) ecarts++
  }
  eq(ecarts, 0, 'table générée ≡ segmentsDepuisLibelleModele, pour les 48 familles')
}

// ---------------------------------------------------------------------------
titre('Copie CLIENT ≡ source SERVEUR')
// `src/data/marche.js` est une copie, imposée par le périmètre de build de CRA
// (impossible d'importer un module de supabase/functions). Ce bloc prouve
// qu'elle se comporte À L'IDENTIQUE, plutôt que de l'espérer : constantes,
// libellés de région, et la fonction de fourchette rejouée sur des centaines
// d'histogrammes tirés au hasard — y compris les cas sous le seuil.
{
  const client = await import('../src/data/marche.js')
  const serveur = await import('../supabase/functions/_shared/marche.ts')

  eq(client.SEUIL_FOURCHETTE, serveur.SEUIL_FOURCHETTE, 'même seuil de publication')
  eq(client.PART_API_MAX, serveur.PART_API_MAX, 'même plafond de part d’un client d’API')
  eq(client.TRANCHE_PRIX, serveur.TRANCHE_PRIX, 'même largeur de tranche de prix')
  eq(client.TRANCHE_KM, serveur.TRANCHE_KM, 'même largeur de tranche de km')
  eq(client.KM_INCONNU, serveur.KM_INCONNU, 'même sentinelle de km inconnu')
  eq(client.ANNEE_INCONNUE, serveur.ANNEE_INCONNUE, 'même sentinelle d’année inconnue')
  eq(Object.keys(client.LIBELLES_REGION).sort(), Object.keys(serveur.LIBELLES_REGION).sort(),
    'mêmes régions')
  eq(Object.entries(client.LIBELLES_REGION).sort(), Object.entries(serveur.LIBELLES_REGION).sort(),
    'mêmes libellés de région, mot pour mot')

  // Générateur déterministe (pas de Math.random : un échec doit se rejouer).
  let graine = 20260904
  const rnd = (n) => { graine = (graine * 1103515245 + 12345) & 0x7fffffff; return graine % n }
  const TECHNOS = ['', 'puretech', 'tdi', 'dci']
  const CYLS = ['', '1.2', '1.5', '2.0']
  const BOITES = ['', 'manuelle', 'automatique']
  const REGIONS = ['', 'occitanie', 'ile-de-france', 'bretagne']
  let divergences = 0
  let avecFourchette = 0
  let bloquesParPartApi = 0
  for (let cas = 0; cas < 400; cas++) {
    const lignes = Array.from({ length: rnd(30) }, () => ({
      generation_norm: '',
      techno: TECHNOS[rnd(TECHNOS.length)],
      cyl: CYLS[rnd(CYLS.length)],
      boite: BOITES[rnd(BOITES.length)],
      annee: rnd(4) === 0 ? 0 : 2014 + rnd(10),
      km_tranche: rnd(5) === 0 ? -1 : rnd(10),
      region: REGIONS[rnd(REGIONS.length)],
      prix_tranche: 2_000 + rnd(80) * 250,
      effectif: 1 + rnd(6),
      // Une contribution d'API sur six lignes environ, attribuée à l'un de
      // trois clients : le tirage doit traverser le verrou des 20 % dans les
      // deux implémentations, pas seulement le seuil de 15.
      ...(rnd(6) === 0 ? { parts_api: { [`c${rnd(3)}`]: 1 + rnd(5) } } : {}),
    }))
    const cible = {
      techno: TECHNOS[rnd(TECHNOS.length)],
      cyl: CYLS[rnd(CYLS.length)],
      boite: BOITES[rnd(BOITES.length)],
      annee: rnd(3) === 0 ? null : 2016 + rnd(8),
      km: rnd(3) === 0 ? null : 20_000 + rnd(15) * 10_000,
      region: REGIONS[rnd(REGIONS.length)],
    }
    const bruts = Array.from({ length: rnd(6) }, () => 2_000 + rnd(80) * 250)
    const a = client.fourchetteDepuisAgregats(lignes, cible, client.SEUIL_FOURCHETTE, bruts)
    const b = serveur.fourchetteDepuisAgregats(lignes, cible, serveur.SEUIL_FOURCHETTE, bruts)
    if (JSON.stringify(a) !== JSON.stringify(b)) divergences++
    if (a) avecFourchette++
    // Cas bloqué par le SEUL verrou des 20 % : la fourchette serait sortie
    // si on ignorait les parts d'API.
    if (!a) {
      const sansParts = lignes.map(({ parts_api, ...reste }) => reste)
      if (serveur.fourchetteDepuisAgregats(sansParts, cible, serveur.SEUIL_FOURCHETTE, bruts)) {
        bloquesParPartApi++
      }
    }
  }
  eq(divergences, 0, '400 histogrammes tirés au hasard : aucune divergence client/serveur')
  ok(avecFourchette > 20 && avecFourchette < 380,
    `le tirage couvre les deux cas (${avecFourchette}/400 au-dessus du seuil)`)
  // Et le tirage doit RÉELLEMENT exercer le verrou des 20 %, sans quoi la
  // parité ne prouverait rien à son sujet : on recompte les cas où il mord.
  ok(bloquesParPartApi > 0,
    `le tirage exerce bien le verrou des 20 % (${bloquesParPartApi} cas bloqués par lui seul)`)
}

// ---------------------------------------------------------------------------
console.log(`\n${ko === 0 ? 'OK' : 'ÉCHEC'} — ${total - ko}/${total} contrôles passés`)
process.exit(ko === 0 ? 0 : 1)
