// Test hors ligne des règles légales partenaires (aucun appel API, aucune base).
// Usage : node tests/partenaires.test.mjs
//
// Ce que ce test protège, c'est une frontière juridique, pas une préférence :
// sans immatriculation ORIAS, Inspexo ne peut qu'INDIQUER un partenaire. Tout
// texte qui décrirait une couverture, afficherait un chiffre commercial ou
// vanterait la facilité d'un crédit nous ferait basculer dans une activité
// réglementée. La vérification est donc faite À L'ENREGISTREMENT, et c'est ce
// fichier qui garantit qu'elle ne s'affaiblit pas.
import {
  cleDedup, compterNet, contientMentionCredit, CREDIT_ACTIVABLE_LE, estRobot,
  MENTION_CREDIT, normaliserTexte, partenairesAffichables, peutActiver,
  PREALABLE_ROUGE, texteSansMentionCredit, verifierTextePartenaire,
  VERDICTS_PARTENAIRES,
} from '../supabase/functions/_shared/partenaires.ts'

let ko = 0, total = 0
const ok = (cond, label) => { total++; if (!cond) { ko++; console.log(`FAIL — ${label}`) } }
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b),
  `${label} (obtenu ${JSON.stringify(a)}, attendu ${JSON.stringify(b)})`)
const titre = (t) => console.log(`\n▶ ${t}`)

// Un texte neutre et conforme pour chaque type, qui sert de base aux variantes.
const ASSURANCE_OK =
  'Notre partenaire propose des contrats de garantie mécanique pour véhicules ' +
  "d'occasion. Inspexo ne vend pas ce contrat et ne touche pas de commission sur " +
  'son contenu : vous traitez directement avec lui.'
const CREDIT_OK =
  `${MENTION_CREDIT}. Notre partenaire étudie les demandes de financement automobile. ` +
  'Inspexo ne distribue pas de crédit : vous traitez directement avec lui.'

const refuse = (type, texte) => verifierTextePartenaire(type, texte)
const motifsDe = (type, texte) => refuse(type, texte).motifs.join(' | ')

// ---------------------------------------------------------------------------
titre('Textes conformes')
eq(verifierTextePartenaire('assurance', ASSURANCE_OK), { ok: true, motifs: [] },
  'texte assurance neutre accepté')
eq(verifierTextePartenaire('credit', CREDIT_OK), { ok: true, motifs: [] },
  'texte crédit avec mention légale accepté')

titre('Texte vide ou démesuré')
ok(!refuse('assurance', '').ok, 'texte vide refusé')
ok(!refuse('assurance', 'trop court').ok, 'texte trop court refusé')
ok(!refuse('assurance', `${ASSURANCE_OK} ${'blabla '.repeat(120)}`).ok,
  'texte de plus de 600 caractères refusé')

// ---------------------------------------------------------------------------
titre('CRÉDIT — mention légale L312-5 obligatoire')
ok(contientMentionCredit(CREDIT_OK), 'mention détectée')
ok(contientMentionCredit("ATTENTION !  UN CRÉDIT COÛTE DE L'ARGENT ET DOIT ÊTRE REMBOURSÉ."),
  'casse et espaces indifférents')
ok(contientMentionCredit('Attention ! Un crédit coûte de l’argent et doit être remboursé'),
  'apostrophe typographique acceptée')
ok(contientMentionCredit('Attention! Un credit coute de l\'argent et doit etre rembourse'),
  'absence d’accents et d’espace avant « ! » acceptée')
ok(!contientMentionCredit('Un crédit vous engage et doit être remboursé'),
  'formulation approchante REFUSÉE : la loi impose les mots exacts')
{
  const sansMention = CREDIT_OK.replace(MENTION_CREDIT + '. ', '')
  ok(!refuse('credit', sansMention).ok, 'texte crédit sans mention refusé')
  ok(motifsDe('credit', sansMention).includes('L312-5'),
    'le motif cite l’article du code de la consommation')
}
ok(verifierTextePartenaire('assurance', ASSURANCE_OK).ok,
  'la mention crédit n’est PAS exigée d’un texte assurance')
// La mention contient « doit être remboursé » : elle ne doit pas se faire
// prendre pour une promesse de prise en charge par ses propres règles.
ok(verifierTextePartenaire('credit', CREDIT_OK).ok,
  'la mention obligatoire ne se déclenche pas elle-même comme interdit')

titre('CRÉDIT — ni chiffre, ni argument de facilité')
for (const [cas, ajout] of [
  ['un taux', 'Taux à partir de 3,9 %.'],
  ['un TAEG', 'TAEG fixe.'],
  ['une mensualité', 'À partir de 150 par mois.'],
  ['une durée', 'Remboursable sur 48 mois.'],
  ['un simulateur', 'Simulez votre financement en ligne.'],
  ['un calcul', 'Calculez votre capacité d’emprunt.'],
  ['un montant', "Jusqu'à 30000 de financement."],
  ['« rapide »', 'Traitement rapide de votre demande.'],
  ['« facile »', 'Un financement facile.'],
  ['« immédiat »', 'Accord immédiat.'],
  ['« en quelques minutes »', 'Votre dossier en quelques minutes.'],
  ['« sans justificatif »', 'Sans justificatif de revenus.'],
  ['« accord garanti »', 'Accord garanti.'],
  ['« réponse immédiate »', 'Réponse immédiate à votre demande.'],
]) {
  ok(!refuse('credit', `${CREDIT_OK} ${ajout}`).ok, `crédit : ${cas} refusé`)
}

titre('ASSURANCE — aucun contenu de contrat')
for (const [cas, ajout] of [
  ['une couverture', 'Le contrat couvre les pannes mécaniques.'],
  ['une prise en charge', 'Réparations prises en charge.'],
  ['une franchise', 'Franchise par sinistre.'],
  ['un plafond', 'Plafond annuel.'],
  ['une exclusion', 'Voir les exclusions.'],
  ['une liste d’organes', 'Moteur et boîte de vitesses inclus.'],
  ['un lien avec les pannes détectées', 'Cette panne serait couverte par le contrat.'],
  ['un prix', 'À partir de 29 euros.'],
  ['un symbole monétaire', 'Dès 29 €.'],
  ['un pourcentage', 'Jusqu’à 80 % des frais.'],
  ['une comparaison', 'La meilleure garantie du marché.'],
  ['« comparez »', 'Comparez les offres.'],
]) {
  ok(!refuse('assurance', `${ASSURANCE_OK} ${ajout}`).ok, `assurance : ${cas} refusé`)
}
ok(motifsDe('assurance', `${ASSURANCE_OK} Cette panne serait couverte.`)
  .includes('lien avec les pannes'),
  'le motif nomme explicitement le lien interdit avec les pannes détectées')

titre('Interdits communs aux deux types')
for (const type of ['assurance', 'credit']) {
  const base = type === 'credit' ? CREDIT_OK : ASSURANCE_OK
  ok(!refuse(type, `${base} Offre à 19 €.`).ok, `${type} : montant en euros refusé`)
  ok(!refuse(type, `${base} Le meilleur du marché.`).ok, `${type} : superlatif refusé`)
  ok(!refuse(type, `${base} Satisfaction garanti.`).ok, `${type} : promesse de résultat refusée`)
}

// ---------------------------------------------------------------------------
titre('Activation : le crédit attend le 20/11/2026')
eq(CREDIT_ACTIVABLE_LE, '2026-11-20', 'date d’entrée en vigueur')
ok(!peutActiver('credit', '2026-11-03').ok, 'crédit non activable le 03/11/2026')
ok(!peutActiver('credit', '2026-11-19').ok, 'crédit non activable la veille')
ok(peutActiver('credit', '2026-11-20').ok, 'crédit activable le jour même')
ok(peutActiver('credit', '2027-01-15').ok, 'crédit activable ensuite')
ok(peutActiver('assurance', '2026-11-03').ok, 'assurance non concernée par cette date')
ok(peutActiver('credit', '2026-11-03').motifs.join(' ').includes('R519-2'),
  'le motif cite l’article du code monétaire et financier')

// ---------------------------------------------------------------------------
titre('Où les partenaires peuvent apparaître')
eq([...VERDICTS_PARTENAIRES], ['vert', 'orange'], 'verdicts autorisés')
ok(partenairesAffichables('vert'), 'vert : autorisé')
ok(partenairesAffichables('orange'), 'orange : autorisé')
ok(!partenairesAffichables('rouge'), 'ROUGE : jamais de partenaire')
ok(!partenairesAffichables(null) && !partenairesAffichables('') && !partenairesAffichables('inconnu'),
  'verdict absent ou inconnu : jamais de partenaire')
ok(PREALABLE_ROUGE.startsWith('Demandez d’abord') || PREALABLE_ROUGE.startsWith("Demandez d'abord"),
  'la phrase de préalable rouge commence par la demande de preuve écrite')
ok(PREALABLE_ROUGE.includes('preuve écrite'), 'elle exige une preuve écrite')

// ---------------------------------------------------------------------------
titre('Comptage : robots écartés')
ok(!estRobot('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Safari/604.1'),
  'un vrai navigateur mobile compte')
ok(!estRobot('Mozilla/5.0 (Macintosh) Chrome/120.0.0.0 Safari/537.36'),
  'un vrai navigateur de bureau compte')
for (const ua of [
  'Googlebot/2.1', 'facebookexternalhit/1.1', 'WhatsApp/2.23', 'curl/8.4.0',
  'python-requests/2.31', 'Scrapy/2.11', 'HeadlessChrome/120', 'Go-http-client/1.1',
  'Slackbot-LinkExpanding 1.0', 'Chrome-Lighthouse',
]) ok(estRobot(ua), `robot écarté : ${ua.split('/')[0]}`)
ok(estRobot(''), 'user-agent ABSENT traité comme robot (un navigateur en envoie toujours un)')
ok(estRobot(null), 'user-agent null traité comme robot')

titre('Comptage : un dossier, un partenaire, un jour')
{
  const j = (d) => `2026-11-${d}T10:00:00.000Z`
  const l = (analysis_id, created_at, robot = false, ip_hash = 'ip1') =>
    ({ analysis_id, ip_hash, created_at, robot })
  eq(cleDedup('p1', 'a1', 'ip1', new Date(j('03'))), 'p1|a1|2026-11-03', 'clé avec dossier')
  eq(cleDedup('p1', null, 'ip1', new Date(j('03'))), 'p1|ip:ip1|2026-11-03',
    'sans dossier, repli sur l’empreinte IP')

  eq(compterNet([l('a1', j('03')), l('a1', j('03')), l('a1', j('03'))], 'p1'), 1,
    'trois clics du même dossier le même jour → 1')
  eq(compterNet([l('a1', j('03')), l('a1', j('04'))], 'p1'), 2,
    'le même dossier deux jours différents → 2')
  eq(compterNet([l('a1', j('03')), l('a2', j('03'))], 'p1'), 2,
    'deux dossiers le même jour → 2')
  eq(compterNet([l('a1', j('03'), true), l('a1', j('03'), true)], 'p1'), 0,
    'les robots ne comptent jamais')
  eq(compterNet([l('a1', j('03'), true), l('a2', j('03'))], 'p1'), 1,
    'le net ne retient que l’humain')
  eq(compterNet([l(null, j('03'), false, 'ipA'), l(null, j('03'), false, 'ipA')], 'p1'), 1,
    'sans dossier, deux clics de la même IP le même jour → 1')
  eq(compterNet([l(null, j('03'), false, 'ipA'), l(null, j('03'), false, 'ipB')], 'p1'), 2,
    'sans dossier, deux IP distinctes → 2')
  eq(compterNet([], 'p1'), 0, 'aucune ligne → 0')
}

// ---------------------------------------------------------------------------
titre('Normalisation')
eq(normaliserTexte('  Crédit   À  L’ÉTUDE  '), "credit a l'etude", 'accents, casse, apostrophe, espaces')
eq(normaliserTexte(null), '', 'null → chaîne vide')

// ---------------------------------------------------------------------------
titre('Déterminisme')
{
  const attendu = JSON.stringify(verifierTextePartenaire('credit', `${CREDIT_OK} Taux à 3 %.`))
  let stable = true
  for (let i = 0; i < 200; i++) {
    if (JSON.stringify(verifierTextePartenaire('credit', `${CREDIT_OK} Taux à 3 %.`)) !== attendu) stable = false
  }
  ok(stable, '200 vérifications identiques → résultat identique')
}

// ---------------------------------------------------------------------------
titre('La mention légale s’affiche UNE fois, à sa place')
// Elle est obligatoire DANS le texte validé (c'est ainsi qu'on vérifie
// qu'elle existe) mais s'affiche à part, en évidence. La laisser aussi dans
// le paragraphe la ferait lire deux fois et la banaliserait.
ok(!texteSansMentionCredit(CREDIT_OK).toLowerCase().includes('coûte de l'),
  'la mention est retirée du corps du texte')
ok(texteSansMentionCredit(CREDIT_OK).includes('Notre partenaire étudie'),
  'le reste du texte est intact')
eq(texteSansMentionCredit('Attention! Un credit coute de l\'argent et doit etre rembourse. Suite.'),
  'Suite.', 'variante sans accent ni espace retirée aussi')
eq(texteSansMentionCredit('ATTENTION ! UN CRÉDIT COÛTE DE L’ARGENT ET DOIT ÊTRE REMBOURSÉ Suite.'),
  'Suite.', 'variante en capitales avec apostrophe typographique')
eq(texteSansMentionCredit(ASSURANCE_OK), ASSURANCE_OK, 'un texte assurance est inchangé')
eq(texteSansMentionCredit(''), '', 'texte vide')
eq(texteSansMentionCredit(null), '', 'texte absent')
// Garde-fou : retirer la mention ne doit pas rendre un texte crédit acceptable.
ok(!verifierTextePartenaire('credit', texteSansMentionCredit(CREDIT_OK)).ok,
  'le texte amputé de sa mention est REFUSÉ à l’enregistrement')

// ---------------------------------------------------------------------------
titre('Copie CLIENT ≡ source SERVEUR')
// src/data/partenaires.js est une copie imposée par le périmètre de build de
// CRA. Une divergence ferait apparaître un partenaire sur un verdict rouge
// sans que personne ne s'en aperçoive : ce bloc l'interdit.
{
  const client = await import('../src/data/partenaires.js')
  eq([...client.VERDICTS_PARTENAIRES], [...VERDICTS_PARTENAIRES],
    'mêmes verdicts autorisés')
  eq(client.PREALABLE_ROUGE, PREALABLE_ROUGE, 'même phrase de préalable rouge, mot pour mot')
  eq(client.MENTION_CREDIT, MENTION_CREDIT, 'même mention légale, mot pour mot')
  for (const t of [CREDIT_OK, ASSURANCE_OK, '', 'Attention! Un credit coute de l\'argent et doit etre rembourse. X']) {
    eq(client.texteSansMentionCredit(t), texteSansMentionCredit(t),
      'même retrait de mention côté client')
  }
  let divergences = 0
  for (const v of ['vert', 'orange', 'rouge', '', null, undefined, 'VERT', 'inconnu']) {
    if (client.partenairesAffichables(v) !== partenairesAffichables(v)) divergences++
  }
  eq(divergences, 0, 'même décision d’affichage sur tous les verdicts possibles')
  ok(!client.partenairesAffichables('rouge'), 'côté client aussi : ROUGE n’affiche jamais de partenaire')
}

console.log(`\n${ko === 0 ? 'OK' : 'ÉCHEC'} — ${total - ko}/${total} contrôles passés`)
process.exit(ko === 0 ? 0 : 1)
