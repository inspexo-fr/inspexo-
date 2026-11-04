// Test HORS LIGNE de la lecture du CSA HistoVec. Aucun appel réseau, aucune IA.
// Usage : node tests/histovec.test.mjs
//
// Le socle est le texte RÉELLEMENT extrait des fixtures générées par le
// générateur officiel d'HistoVec (tests/histovec-fixtures/*.txt) : les règles
// sont éprouvées sur la sortie d'extraction réelle, pas sur une imitation.
import { readFileSync } from 'node:fs'
import {
  estCsa, extraireFaitsCsa, FORMATS_CSA, histovecPublique, MIN_CARACTERES,
  reglesHistovec, sansIdentifiants, verifierConcordance,
} from '../supabase/functions/_shared/histovec.ts'

let ko = 0
let total = 0
const ok = (cond, label, detail = '') => {
  total++
  if (!cond) { ko++; console.log(`FAIL — ${label}${detail ? ` (${detail})` : ''}`) }
}
const eq = (a, b, label) => ok(
  JSON.stringify(a) === JSON.stringify(b),
  label,
  `obtenu ${JSON.stringify(a)}, attendu ${JSON.stringify(b)}`,
)
const titre = (t) => console.log(`\n▶ ${t}`)
const fixture = (n) => readFileSync(new URL(`./histovec-fixtures/${n}.txt`, import.meta.url), 'utf8')
const LE_3_NOVEMBRE = new Date('2026-11-03T12:00:00Z')

// ---------------------------------------------------------------------------
titre('Reconnaissance du document')
// ---------------------------------------------------------------------------
ok(estCsa(fixture('csa-aucune-anomalie')).ok, 'un CSA réel est reconnu')
{
  // Le cas mesuré : un scan de 9 pages ne rend que 2 caractères. « Aucune
  // erreur d'analyse » ne vaut pas « lecture réussie ».
  const r = estCsa('x'.repeat(MIN_CARACTERES - 1))
  ok(!r.ok && /image ou un scan/i.test(r.motif), 'texte trop court → message « image ou scan »')
}
{
  const r = estCsa('a'.repeat(MIN_CARACTERES + 50))
  ok(!r.ok && /Imprimer le CSA/.test(r.motif),
    'texte assez long mais sans les marqueurs → « pas un CSA », avec le bon bouton nommé')
}
ok(extraireFaitsCsa('trop court').lisible === false,
  'document non reconnu → faits illisibles, aucune devinette')

// ---------------------------------------------------------------------------
titre('Identification : appariement POSITIONNEL validé par format')
// ---------------------------------------------------------------------------
{
  const f = extraireFaitsCsa(fixture('csa-gage-et-opposition'))
  ok(f.lisible, 'fixture lisible')
  eq(f.immatriculation, 'BB-456-BB', 'plaque appariée à sa position')
  eq(f.premiere_immatriculation, '2018-09-05', 'date de 1re immatriculation convertie en ISO')
  eq(f.vin, 'VF1YYYYYYYYYYYYYY', 'VIN apparié')
  eq(f.marque, 'RENAULT', 'marque appariée')
}

// ⚠️ LE TEST QUI COMPTE : deux valeurs inversées. L'appariement est positionnel,
// donc un décalage attribuerait silencieusement une valeur au mauvais champ.
// La validation de format doit l'empêcher — et ne rien attribuer de douteux.
{
  const original = fixture('csa-gage-et-opposition')
  // On échange la plaque et le VIN dans le bloc de valeurs.
  const inverse = original
    .replace('BB-456-BB\n05/09/2018\nVF1YYYYYYYYYYYYYY', 'VF1YYYYYYYYYYYYYY\n05/09/2018\nBB-456-BB')
  ok(inverse !== original, 'le texte de test a bien été modifié')
  const f = extraireFaitsCsa(inverse)
  eq(f.immatriculation, null, 'valeurs inversées : aucune plaque attribuée')
  eq(f.vin, null, 'valeurs inversées : aucun VIN attribué')
  // La date, à sa bonne position, reste lue : on n'invalide pas tout le bloc
  // pour un champ douteux, on refuse seulement le champ douteux.
  eq(f.premiere_immatriculation, '2018-09-05', 'le champ resté à sa place est conservé')
}
{
  // Une date mise à la place de la marque ne doit pas devenir une marque.
  const t = fixture('csa-gage-et-opposition').replace('\nRENAULT\n', '\n05/09/2018\n')
  eq(extraireFaitsCsa(t).marque, null, 'une date à la position « marque » n’est pas attribuée')
}

// ---------------------------------------------------------------------------
titre('Formats : ce que la validation accepte et refuse')
// ---------------------------------------------------------------------------
ok(FORMATS_CSA.immatriculation('AA-123-AA'), 'plaque SIV acceptée')
ok(FORMATS_CSA.immatriculation('123 ABC 75'), 'ancien format FNI accepté')
ok(!FORMATS_CSA.immatriculation('RENAULT'), 'une marque n’est pas une plaque')
ok(FORMATS_CSA.vin('VF1YYYYYYYYYYYYYY'), 'VIN de 17 caractères accepté')
ok(!FORMATS_CSA.vin('VF1IOQYYYYYYYYYYY'), 'VIN avec I, O ou Q refusé')
ok(!FORMATS_CSA.vin('VF1YYYY'), 'VIN trop court refusé')
ok(FORMATS_CSA.premiere_immatriculation('29/02/2016'), '29 février d’une année bissextile accepté')
ok(!FORMATS_CSA.premiere_immatriculation('30/02/2016'), '30 février refusé')
ok(!FORMATS_CSA.premiere_immatriculation('2016-02-29'), 'format ISO refusé à cette position')
ok(FORMATS_CSA.marque('PEUGEOT'), 'marque connue acceptée')
ok(!FORMATS_CSA.marque('ZZZZPASUNEMARQUE'), 'marque inconnue refusée — un décalage, pas un exotisme')

// ---------------------------------------------------------------------------
titre('Situation administrative : les trois formes négatives')
// ---------------------------------------------------------------------------
{
  const f = extraireFaitsCsa(fixture('csa-aucune-anomalie'))
  ok(!f.gage && !f.opposition_otci && !f.saisie && !f.vol_vehicule && !f.suspension,
    '« Aucune », « Aucun » et « Non » sont tous lus comme négatifs',
    JSON.stringify({ g: f.gage, o: f.opposition_otci, s: f.saisie, v: f.vol_vehicule, su: f.suspension }))
  ok(!f.vge_en_cours && !f.vge_passee, 'aucune procédure véhicule endommagé')
  eq(f.nb_titulaires, 2, 'deux détenteurs déduits des opérations d’immatriculation')
  ok(!f.ancienne_location, 'pas de location')
}
{
  const f = extraireFaitsCsa(fixture('csa-gage-et-opposition'))
  ok(f.gage, 'gage détecté par son détail (créancier + date)')
  ok(f.opposition_otci, 'opposition OTCI détectée')
  ok(!f.saisie, 'saisie absente')
  ok(!f.vol_vehicule, 'vol absent')
}
{
  const f = extraireFaitsCsa(fixture('csa-vole'))
  ok(f.vol_vehicule, 'véhicule volé détecté')
  ok(f.vol_titre, 'certificat volé détecté')
}
{
  const f = extraireFaitsCsa(fixture('csa-vehicule-irreparable'))
  ok(f.saisie, 'déclaration valant saisie détectée')
  ok(f.suspension, 'suspension détectée par son motif')
  ok(f.vge_en_cours, 'OVEI → procédure en cours')
}

// ---------------------------------------------------------------------------
titre('Les DEUX libellés OVE')
// ---------------------------------------------------------------------------
{
  // Le CSA écrit « Opposition véhicule endommagé » ; le rapport web écrit
  // « Procédure de réparation contrôlée ». Divergence assumée par la DSR,
  // documentée dans leur code : les deux doivent être reconnues.
  const f = extraireFaitsCsa(fixture('csa-vehicule-endommage-en-cours'))
  ok(f.vge_en_cours, 'opposition « véhicule endommagé » active → procédure EN COURS')
  ok(!f.vge_passee, 'et donc pas « levée »')
}
{
  // Réparation contrôlée = oui, mais plus aucune opposition active : levée.
  const t = fixture('csa-vehicule-endommage-en-cours')
    .replace("- Opposition véhicule endommagé\n- Date de l'opposition : 11/07/2023", '- Opposition véhicule endommagé\nAucune')
  const f = extraireFaitsCsa(t)
  ok(!f.vge_en_cours && f.vge_passee, 'oui sans opposition active → procédure LEVÉE',
    JSON.stringify({ en_cours: f.vge_en_cours, passee: f.vge_passee }))
}

// ---------------------------------------------------------------------------
titre('Historique : titulaires déduits, et location')
// ---------------------------------------------------------------------------
{
  const f = extraireFaitsCsa(fixture('csa-ancienne-location'))
  ok(f.ancienne_location, 'CHANG_LOC → véhicule passé en location')
  eq(f.nb_titulaires, 2, 'le changement de locataire n’est pas compté comme un détenteur')
}
{
  const f = extraireFaitsCsa(fixture('csa-certificat-annule'))
  ok(f.certificat_annule, 'certificat annulé détecté')
}

// ---------------------------------------------------------------------------
titre('Règle 0 — concordance, et ce qu’elle interdit ensuite')
// ---------------------------------------------------------------------------
const faitsRenault = extraireFaitsCsa(fixture('csa-gage-et-opposition'))
{
  const c = verifierConcordance(faitsRenault, {
    marque: 'Renault', vin: 'VF1YYYYYYYYYYYYYY', immatriculation: 'BB-456-BB',
    premiere_immatriculation: '2018-09-05',
  })
  ok(c.concorde, 'tout concorde')
  ok(c.compares.length === 4, 'les quatre champs ont été comparés', c.compares.join(','))
}
{
  const c = verifierConcordance(faitsRenault, { marque: 'Peugeot' })
  ok(!c.concorde && /marque/.test(c.discordances[0]), 'marque différente → discordance')
}
{
  const c = verifierConcordance(faitsRenault, { marque: 'Renault', vin: 'VF1ZZZZZZZZZZZZZZ' })
  ok(!c.concorde && /VIN/.test(c.discordances.join(' ')), 'VIN différent → discordance')
}
{
  // Modèle et énergie ne sont pas dans le CSA : ils ne peuvent PAS faire
  // échouer la concordance.
  const c = verifierConcordance(faitsRenault, { marque: 'Renault', modele: 'Clio', energie: 'diesel' })
  ok(c.concorde, 'modèle et énergie absents du CSA → jamais une discordance')
  ok(!c.compares.includes('modele') && !c.compares.includes('energie'),
    'et ils ne figurent pas parmi les champs comparés')
}
{
  const c = verifierConcordance(faitsRenault, { marque: 'Renault', annee: 2018 })
  ok(c.concorde && c.compares.includes('annee'), 'à défaut de date exacte, l’année est comparée')
  const c2 = verifierConcordance(faitsRenault, { marque: 'Renault', annee: 2019 })
  ok(c2.concorde, 'tolérance d’un an (immatriculation de fin d’année)')
  const c3 = verifierConcordance(faitsRenault, { marque: 'Renault', annee: 2022 })
  ok(!c3.concorde, 'écart de 4 ans → discordance')
}
{
  const c = verifierConcordance(faitsRenault, {})
  ok(c.concorde && c.compares.length === 0,
    'annonce sans aucun champ comparable → pas de discordance inventée')
}
{
  // Un rapport discordant ne doit produire AUCUN autre signal : sinon on
  // prêterait à cette voiture l'historique d'une autre.
  const c = verifierConcordance(faitsRenault, { marque: 'Peugeot' })
  const r = reglesHistovec(faitsRenault, { marque: 'Peugeot' }, c, LE_3_NOVEMBRE)
  eq(r.signaux.length, 1, 'rapport discordant → un seul signal')
  eq(r.signaux[0].niveau, 'rouge', 'et il est rouge')
  ok(/ne correspond pas à ce véhicule/.test(r.signaux[0].texte), 'avec le texte demandé')
  ok(r.faits.histovec_discordant && !r.faits.histovec_opposition,
    'le gage du rapport n’est PAS repris : il concerne un autre véhicule')
}

// ---------------------------------------------------------------------------
titre('Règles de verdict')
// ---------------------------------------------------------------------------
const regles = (nom, annonce = {}) => {
  const f = extraireFaitsCsa(fixture(nom))
  return reglesHistovec(f, annonce, verifierConcordance(f, annonce), LE_3_NOVEMBRE)
}
{
  const r = regles('csa-gage-et-opposition')
  const s = r.signaux.find((x) => x.cle === 'opposition')
  ok(s && s.niveau === 'rouge', 'gage + opposition → ROUGE')
  ok(/ne rien payer avant lev/i.test(s.texte), 'avec « ne rien payer avant levée »')
  ok(s.toujours_visible, 'et toujours visible, même sans Pass')
  ok(r.faits.histovec_opposition === true, 'fait de barème posé')
}
{
  const r = regles('csa-vole')
  ok(r.signaux.some((x) => x.cle === 'opposition' && /vol/i.test(x.texte)), 'vol → ROUGE')
}
{
  const r = regles('csa-vehicule-endommage-en-cours')
  const s = r.signaux.find((x) => x.cle === 'vge_en_cours')
  ok(s && s.niveau === 'rouge' && s.toujours_visible, 'VGE non levée → ROUGE toujours visible')
  ok(r.faits.histovec_vge_en_cours === true, 'fait de barème posé')
}
{
  const t = fixture('csa-vehicule-endommage-en-cours')
    .replace("- Opposition véhicule endommagé\n- Date de l'opposition : 11/07/2023", '- Opposition véhicule endommagé\nAucune')
  const f = extraireFaitsCsa(t)
  const r = reglesHistovec(f, {}, verifierConcordance(f, {}), LE_3_NOVEMBRE)
  const s = r.signaux.find((x) => x.cle === 'vge_levee')
  ok(s && s.niveau === 'orange', 'VGE levée → ORANGE')
  ok(/réparation a été contrôlée/i.test(s.texte), 'et l’information que la réparation a été contrôlée')
  ok(r.faits.histovec_vge_en_cours === false, 'aucun plafond rouge pour une procédure levée')
}
{
  const r = regles('csa-aucune-anomalie')
  const s = r.signaux.find((x) => x.cle === 'titulaires')
  ok(s && s.niveau === 'orange' && /premi[èe]re main/.test(s.texte),
    'deux détenteurs → « première main » inexacte, ORANGE')
  ok(!s.toujours_visible, 'ce signal-là est réservé au Pass')
}
{
  const r = regles('csa-ancienne-location')
  const s = r.signaux.find((x) => x.cle === 'location')
  ok(s && s.niveau === 'orange', 'ancienne location → ORANGE')
}
{
  const r = regles('csa-certificat-annule')
  ok(r.signaux.some((x) => x.cle === 'annule' && x.niveau === 'rouge'), 'certificat annulé → ROUGE')
  ok(r.faits.histovec_opposition === true, 'et il empêche la vente, donc plafond')
}

// ---------------------------------------------------------------------------
titre('Validité du certificat : moins de 15 jours à la vente')
// ---------------------------------------------------------------------------
{
  // Les fixtures portent « jusqu'au 2026-11-16 », donc valides au 3 novembre.
  const r = regles('csa-aucune-anomalie')
  ok(!r.signaux.some((x) => x.cle === 'perime'), 'certificat encore valable → aucun avertissement')
  const f = extraireFaitsCsa(fixture('csa-aucune-anomalie'))
  const tard = reglesHistovec(f, {}, verifierConcordance(f, {}), new Date('2026-12-01T12:00:00Z'))
  const s = tard.signaux.find((x) => x.cle === 'perime')
  ok(s && s.niveau === 'avertissement', 'certificat dépassé → avertissement, pas un signal de verdict')
  ok(/moins de 15 jours/.test(s.texte), 'et le texte rappelle la règle des 15 jours')
}

// ---------------------------------------------------------------------------
titre('VIN et plaque retirés APRÈS la concordance')
// ---------------------------------------------------------------------------
{
  const f = extraireFaitsCsa(fixture('csa-gage-et-opposition'))
  ok(f.vin !== null && f.immatriculation !== null,
    'avant le filtre, les deux identifiants sont là — la règle 0 en a besoin')
  const net = sansIdentifiants(f)
  eq(net.vin, null, 'VIN retiré')
  eq(net.immatriculation, null, 'plaque retirée')
  // L'invariant qui protège l'ordre des opérations : aucun identifiant ne doit
  // survivre dans ce qui sort de la mémoire.
  const serialise = JSON.stringify(net)
  ok(!/VF1YYYYYYYYYYYYYY/.test(serialise), 'aucun VIN dans les faits sérialisés')
  ok(!/BB-?456-?BB/.test(serialise), 'aucune plaque dans les faits sérialisés')
  ok(net.gage === f.gage && net.nb_titulaires === f.nb_titulaires,
    'les faits utiles sont conservés')
}

// ---------------------------------------------------------------------------
titre('Projection publique : le rouge passe, le reste est masqué')
// ---------------------------------------------------------------------------
{
  const r = regles('csa-ancienne-location')
  const pub = histovecPublique(r)
  ok(pub.signaux.every((s) => s.toujours_visible), 'seuls les signaux toujours visibles sortent')
  ok(pub.nb_masques > 0, 'et le nombre de signaux masqués est annoncé')
}
{
  const r = regles('csa-vole')
  const pub = histovecPublique(r)
  ok(pub.signaux.some((s) => /vol/i.test(s.texte)),
    'un danger passe TOUJOURS, même sans Pass — on ne cache pas un vol derrière un paiement')
}
eq(histovecPublique(null), null, 'aucune lecture → aucune projection')

console.log(`\n${ko === 0 ? 'OK' : 'ÉCHEC'} — ${total - ko}/${total} contrôles passés`)
process.exit(ko === 0 ? 0 : 1)
