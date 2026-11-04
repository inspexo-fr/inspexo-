// Test hors ligne des règles de l'inspection à la demande (aucun appel réseau).
// Vérifie : les parts d'argent ne perdent ni ne créent de centime, la clé de
// Luhn du SIRET (avec l'exception La Poste), la zone couverte, le créneau
// sous 48 h, et l'intégrité de la charte signée.
// Usage : node tests/inspection.test.mjs
import { readFileSync } from 'node:fs'
import {
  CHARTE_INDEPENDANCE,
  CHARTE_VERSION,
  dansZoneLancement,
  departementDeCp,
  DELAI_MAX_HEURES,
  formaterSiret,
  partInspecteurCents,
  partPlateformeCents,
  PRIX_INSPECTION_CENTS,
  sirenDeSiret,
  siretValide,
  validerCreneau,
  ZONE_LANCEMENT,
  ZONE_LIBELLE,
  CONSENTEMENT_PHOTOS,
  autorisationExpiree,
  decisionAnnulation,
  DELAI_ANNULATION_GRATUITE_HEURES,
  DELAI_CONFIRMATION_HEURES,
  DEMANDE_EXECUTION_IMMEDIATE,
  DUREE_AUTORISATION_JOURS,
  DELAI_GRACE_CONFIRMATION_HEURES,
  MARGE_AVANT_CRENEAU_HEURES,
  echeanceConfirmation,
  RETENUE_DEPLACEMENT_CENTS,
} from '../supabase/functions/_shared/inspection.ts'

let ko = 0
const verifie = (titre, ok, detail = '') => {
  if (!ok) ko++
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${titre}${ok || !detail ? '' : ` (${detail})`}`)
}

// ---------- Argent ----------
verifie('Prix de l’inspection = 179,00 € TTC', PRIX_INSPECTION_CENTS === 17900)
verifie('Part inspecteur = 60 % = 107,40 €', partInspecteurCents() === 10740)
verifie('Part plateforme = 71,60 €', partPlateformeCents() === 7160)
verifie('Les deux parts font EXACTEMENT le prix payé',
  partInspecteurCents() + partPlateformeCents() === PRIX_INSPECTION_CENTS)
// Aucun centime perdu quel que soit le prix (arrondis) — invariant monétaire.
{
  let mauvais = []
  for (let p = 1; p <= 50_000; p++) {
    if (partInspecteurCents(p) + partPlateformeCents(p) !== p) mauvais.push(p)
    if (partInspecteurCents(p) < 0 || partPlateformeCents(p) < 0) mauvais.push(p)
  }
  verifie('Invariant sur 50 000 montants : parts == total, jamais négatif',
    mauvais.length === 0, `${mauvais.length} cas`)
}

// ---------- SIRET ----------
// SIRET réels et valides au sens de Luhn (sociétés connues, donnée publique).
verifie('SIRET valide (Luhn) accepté', siretValide('55210055400013'))
verifie('SIRET valide avec espaces et tirets accepté', siretValide('552 100 554 00013'))
verifie('SIRET faux (dernier chiffre changé) refusé', siretValide('55210055400014') === false)
verifie('SIRET trop court refusé', siretValide('5521005540001') === false)
verifie('SIRET non numérique refusé', siretValide('5521005540001X') === false)
verifie('SIRET vide refusé', siretValide('') === false && siretValide(null) === false)
// La Poste : exception officielle à Luhn (somme des 14 chiffres multiple de 5).
// 356000000 00001 → somme 15 ✓ ; 356000000 00011 → somme 16 ✗.
verifie('SIRET La Poste accepté malgré Luhn', siretValide('35600000000001'))
verifie('Second SIRET La Poste valide (somme 20)', siretValide('35600000000015'))
verifie('Faux SIRET La Poste (somme non multiple de 5) refusé', siretValide('35600000000011') === false)
verifie('Un SIRET La Poste valide échouerait au Luhn ordinaire',
  // preuve que l'exception sert à quelque chose : sans elle, il serait rejeté
  siretValide('35600000000001') && !siretValide('45600000000001'))
verifie('SIREN extrait du SIRET', sirenDeSiret('55210055400013') === '552100554')
verifie('Formatage lisible', formaterSiret('55210055400013') === '552 100 554 00013')

// ---------- Zone ----------
verifie('31000 → département 31', departementDeCp('31000') === '31')
verifie('97400 (La Réunion) → 974', departementDeCp('97400') === '974')
verifie('Code postal invalide → null', departementDeCp('abc') === null && departementDeCp('3100') === null)
verifie('Toulouse dans la zone de lancement', dansZoneLancement('31000') && dansZoneLancement('31400'))
verifie('Muret (31600) dans la zone', dansZoneLancement('31600'))
verifie('Paris hors zone', dansZoneLancement('75001') === false)
verifie('Zone de lancement = Haute-Garonne seule', JSON.stringify(ZONE_LANCEMENT) === '["31"]')

// ---------- Créneau ----------
{
  const maintenant = new Date('2026-11-01T10:00:00Z')
  const dans = (h) => new Date(maintenant.getTime() + h * 3600_000).toISOString()
  verifie('Créneau à +24 h accepté', validerCreneau(dans(24), maintenant).ok === true)
  verifie('Créneau à +47 h accepté', validerCreneau(dans(47), maintenant).ok === true)
  verifie('Créneau à +49 h refusé (hors engagement 48 h)', validerCreneau(dans(49), maintenant).ok === false)
  verifie('Créneau à +1 h refusé (trop tôt)', validerCreneau(dans(1), maintenant).ok === false)
  verifie('Créneau dans le passé refusé', validerCreneau(dans(-5), maintenant).ok === false)
  verifie('Créneau absent refusé', validerCreneau(null, maintenant).ok === false)
  verifie('Créneau illisible refusé', validerCreneau('bientôt', maintenant).ok === false)
  const r = validerCreneau(dans(60), maintenant)
  verifie('Le refus cite l’engagement de 48 h', !r.ok && r.raison.includes(String(DELAI_MAX_HEURES)))
}

// ---------- Charte ----------
verifie('Charte versionnée', /^\d{4}-\d{2}-\d{2}$/.test(CHARTE_VERSION))
verifie('Charte en 8 engagements', CHARTE_INDEPENDANCE.length === 8)
verifie('Le premier engagement est « payé par l’acheteur, jamais par le vendeur »',
  /jamais par le vendeur/i.test(CHARTE_INDEPENDANCE[0]))
verifie('La charte interdit la commission du vendeur',
  CHARTE_INDEPENDANCE.some(c => /commission/i.test(c)))
verifie('La charte impose SIRET et RC pro',
  CHARTE_INDEPENDANCE.some(c => /SIRET/.test(c) && /responsabilité civile/i.test(c)))
verifie('Aucun engagement vide', CHARTE_INDEPENDANCE.every(c => c.trim().length > 40))

// ---------- Client et serveur : le texte signé doit être CELUI affiché ----------
{
  const client = await import('../src/data/charte.js')
  verifie('Charte : même version client/serveur', client.CHARTE_VERSION === CHARTE_VERSION,
    `${client.CHARTE_VERSION} ≠ ${CHARTE_VERSION}`)
  verifie('Charte : même nombre d’engagements',
    client.CHARTE_INDEPENDANCE.length === CHARTE_INDEPENDANCE.length)
  const ecarts = CHARTE_INDEPENDANCE
    .map((t, i) => (client.CHARTE_INDEPENDANCE[i] === t ? null : i))
    .filter(i => i !== null)
  verifie('Charte : chaque engagement identique mot pour mot', ecarts.length === 0,
    `écart(s) à l’index ${ecarts.join(', ')}`)
  verifie('Consentement photos identique',
    JSON.stringify(client.CONSENTEMENT_PHOTOS) === JSON.stringify(CONSENTEMENT_PHOTOS))
  verifie('Prix et part identiques côté client',
    client.PRIX_INSPECTION_CENTS === PRIX_INSPECTION_CENTS &&
    client.PART_INSPECTEUR_CENTS === partInspecteurCents())
  verifie('Libellé de zone identique', client.ZONE_LIBELLE === ZONE_LIBELLE)
  // Le validateur de SIRET client doit rendre le MÊME verdict que le serveur.
  const echantillons = [
    '55210055400013', '55210055400014', '35600000000001', '35600000000011',
    '1234', '', '00000000000000', '552 100 554 00013',
  ]
  const divergents = echantillons.filter(s => client.siretValide(s) !== siretValide(s))
  verifie('SIRET : client et serveur rendent le même verdict', divergents.length === 0,
    divergents.join(', '))
}

// ---------------------------------------------------------------------------
// Petits adaptateurs : le reste du fichier utilise `verifie(titre, ok)`, les
// blocs ci-dessous sont écrits dans le style des autres suites du projet.
const titre = (t) => console.log(`\n▶ ${t}`)
const ok = (c, label) => verifie(label, !!c)
const eq = (a, b, label) => verifie(
  label,
  JSON.stringify(a) === JSON.stringify(b),
  `obtenu ${JSON.stringify(a)}, attendu ${JSON.stringify(b)}`,
)

// ---------------------------------------------------------------------------
titre('Paiement en deux temps : la fenêtre de confirmation tient dans l’autorisation')
// ---------------------------------------------------------------------------
// ⚠️ L'invariant qui compte : une autorisation de carte ne vit que 7 jours.
// Si la fenêtre de confirmation l'approchait, une mission pourrait devenir
// confirmable alors que l'autorisation a déjà expiré chez Stripe — donc
// impayable, après qu'un inspecteur s'est engagé.
ok(DELAI_CONFIRMATION_HEURES < DUREE_AUTORISATION_JOURS * 24,
  'la fenêtre de confirmation est strictement plus courte que la durée d’autorisation')
ok(DELAI_CONFIRMATION_HEURES * 2 <= DUREE_AUTORISATION_JOURS * 24,
  'et elle garde une marge d’au moins un facteur deux')
eq(DELAI_CONFIRMATION_HEURES, 48, 'fenêtre de confirmation à 48 heures')

const T0 = new Date('2026-11-10T08:00:00Z')
ok(autorisationExpiree(new Date('2026-11-08T07:59:00Z'), T0) === true,
  'autorisation de plus de 48 h → expirée')
ok(autorisationExpiree(new Date('2026-11-08T08:01:00Z'), T0) === false,
  'autorisation de moins de 48 h → encore valable')
ok(autorisationExpiree(null, T0) === false,
  'sans date d’autorisation, rien n’expire — on n’annule pas sur une donnée absente')

// ⚠️ L'ÉCHÉANCE A DEUX BORNES. Le créneau peut être à 2 h de la commande
// alors que la confirmation a 48 h pour arriver : c'est la borne la plus
// PROCHE qui s'applique. Sans celle du créneau, une mission restait
// confirmable après l'heure du rendez-vous.
eq(MARGE_AVANT_CRENEAU_HEURES, 2, 'marge de 2 heures avant le créneau')
{
  const autorisee = new Date('2026-11-10T08:00:00Z')
  // Créneau proche (+3 h) : l'échéance est le créneau moins 2 h, pas les 48 h.
  const proche = echeanceConfirmation(autorisee, new Date('2026-11-10T11:00:00Z'))
  eq(proche.toISOString(), '2026-11-10T09:00:00.000Z',
    'créneau à +3 h → échéance à 2 h avant le créneau')
  // Créneau lointain : c'est la borne des 48 h qui mord.
  const loin = echeanceConfirmation(autorisee, new Date('2026-11-20T11:00:00Z'))
  eq(loin.toISOString(), '2026-11-12T08:00:00.000Z',
    'créneau lointain → échéance à 48 h après l’autorisation')
  // Et le cas qui motivait la correction : une mission ne doit plus être
  // confirmable 1 h avant le rendez-vous, même si les 48 h courent encore.
  ok(autorisationExpiree(autorisee, new Date('2026-11-10T10:00:00Z'), new Date('2026-11-10T11:00:00Z')) === true,
    'une heure avant le créneau → expirée, même dans la fenêtre des 48 h')
  ok(autorisationExpiree(autorisee, new Date('2026-11-10T08:30:00Z'), new Date('2026-11-10T11:00:00Z')) === false,
    'trois heures avant le créneau → encore confirmable')
  eq(echeanceConfirmation(null, null), null, 'aucune borne connue → aucune échéance')
}

// ---------------------------------------------------------------------------
titre('Heure de grâce après la confirmation')
// ---------------------------------------------------------------------------
// Un créneau choisi à +3 h rendrait l'annulation payante AVANT que l'acheteur
// ait pu réagir à la confirmation qu'il vient de recevoir. L'heure de grâce
// l'emporte donc sur la règle des 24 h.
eq(DELAI_GRACE_CONFIRMATION_HEURES, 1, 'délai de grâce d’une heure')
{
  const confirmee = new Date('2026-11-10T08:00:00Z')
  const creneau = new Date('2026-11-10T11:00:00Z') // dans 3 h : sous les 24 h
  const base = { statut: 'acceptee', creneau, prix_cents: PRIX_INSPECTION_CENTS, confirmee_le: confirmee }

  const dansLHeure = decisionAnnulation({ ...base, maintenant: new Date('2026-11-10T08:45:00Z') })
  eq(dansLHeure.action, 'rembourser_integral',
    'dans l’heure suivant la confirmation → remboursement intégral malgré un créneau proche')
  eq(dansLHeure.retenue_cents, 0, 'aucune retenue pendant la grâce')

  const apres = decisionAnnulation({ ...base, maintenant: new Date('2026-11-10T09:30:00Z') })
  eq(apres.action, 'retenue_deplacement',
    'passé l’heure de grâce, le créneau proche fait jouer la retenue')

  // La grâce ne crée pas de passe-droit : au-delà, les 24 h reprennent.
  const loin = decisionAnnulation({
    ...base,
    creneau: new Date('2026-11-13T11:00:00Z'),
    maintenant: new Date('2026-11-10T09:30:00Z'),
  })
  eq(loin.action, 'rembourser_integral', 'créneau à plus de 24 h → gratuit de toute façon')

  // Sans instant de confirmation connu, la grâce ne s'applique pas — et on ne
  // la devine pas depuis le créneau.
  const sans = decisionAnnulation({ ...base, confirmee_le: null, maintenant: new Date('2026-11-10T09:30:00Z') })
  eq(sans.action, 'retenue_deplacement', 'sans instant de confirmation, pas de grâce')

  // Une confirmation dans le FUTUR (horloge décalée) ne doit pas ouvrir une
  // grâce perpétuelle.
  const futur = decisionAnnulation({
    ...base,
    confirmee_le: new Date('2026-11-10T12:00:00Z'),
    maintenant: new Date('2026-11-10T09:30:00Z'),
  })
  eq(futur.action, 'retenue_deplacement', 'confirmation dans le futur → aucune grâce')
}

// ---------------------------------------------------------------------------
titre('Charte : devoir d’information du vendeur (art. 14 RGPD)')
// ---------------------------------------------------------------------------
{
  const info = CHARTE_INDEPENDANCE.find(e => /informe le vendeur/i.test(e))
  ok(!!info, 'un engagement porte l’information du vendeur')
  ok(/politique-de-confidentialite/.test(info ?? ''),
    'il indique où lire la politique de confidentialité')
  ok(/suppression/i.test(info ?? ''), 'et le droit de demander la suppression')
}

// ---------------------------------------------------------------------------
titre('Barème d’annulation : la somme revient toujours au prix payé')
// ---------------------------------------------------------------------------
eq(RETENUE_DEPLACEMENT_CENTS, 4_000, 'indemnité de déplacement : 40,00 €')
eq(DELAI_ANNULATION_GRATUITE_HEURES, 24, 'annulation gratuite jusqu’à 24 heures du créneau')

const ctx = (p) => ({
  statut: 'acceptee',
  creneau: new Date('2026-11-12T10:00:00Z'),
  maintenant: new Date('2026-11-10T10:00:00Z'),
  prix_cents: PRIX_INSPECTION_CENTS,
  ...p,
})

// Avant confirmation : rien n'a été débité, donc rien à rembourser.
for (const statut of ['a_payer', 'a_attribuer', 'refusee']) {
  const d = decisionAnnulation(ctx({ statut }))
  eq(d.action, 'annuler_autorisation', `statut ${statut} → autorisation relâchée`)
  eq(d.rembourse_cents, 0, `statut ${statut} → aucun remboursement (rien n’a été pris)`)
  eq(d.retenue_cents, 0, `statut ${statut} → aucune retenue`)
}

// Après confirmation, à plus de 24 h : tout revient à l'acheteur.
{
  const d = decisionAnnulation(ctx({}))
  eq(d.action, 'rembourser_integral', 'à 48 h du créneau → remboursement intégral')
  eq(d.rembourse_cents, PRIX_INSPECTION_CENTS, 'l’acheteur récupère tout')
  eq(d.retenue_cents, 0, 'rien n’est retenu')
}

// La borne des 24 h : au-delà c'est gratuit, en dessous la retenue s'applique.
{
  const juste = decisionAnnulation(ctx({ maintenant: new Date('2026-11-11T09:59:00Z') }))
  eq(juste.action, 'rembourser_integral', 'à 24 h et 1 minute → encore gratuit')
  const dedans = decisionAnnulation(ctx({ maintenant: new Date('2026-11-11T10:01:00Z') }))
  eq(dedans.action, 'retenue_deplacement', 'à 23 h 59 → la retenue s’applique')
  eq(dedans.retenue_cents, 4_000, 'la retenue vaut 40 €')
  eq(dedans.rembourse_cents, PRIX_INSPECTION_CENTS - 4_000, 'le reste est remboursé')
}

// Vendeur absent : l'emporte sur le délai. Un inspecteur déplacé pour rien est
// indemnisé même si le constat a lieu bien avant le créneau.
{
  const d = decisionAnnulation(ctx({ absence_vendeur: true, maintenant: new Date('2026-11-01T10:00:00Z') }))
  eq(d.action, 'retenue_deplacement', 'absence constatée → retenue, quel que soit le délai')
  eq(d.retenue_cents, 4_000, 'indemnité de 40 €')
}

// Créneau inconnu : jamais de barème sur une donnée manquante.
{
  const d = decisionAnnulation(ctx({ creneau: null }))
  eq(d.action, 'rembourser_integral',
    'créneau inconnu → au plus favorable pour l’acheteur, aucune retenue')
}

// Rien à faire sur une inspection déjà réalisée ou déjà annulée.
for (const statut of ['faite', 'annulee']) {
  const d = decisionAnnulation(ctx({ statut }))
  eq(d.action, 'rien', `statut ${statut} → aucun mouvement`)
}

// INVARIANT MONÉTAIRE, sur 20 000 cas : remboursé + retenu ne dépasse JAMAIS
// le prix payé, et aucune part n’est négative. C’est la garantie qu’aucun
// barème ne peut rendre plus que ce qui a été encaissé.
{
  let fuites = 0
  for (let i = 0; i < 20_000; i++) {
    const prix = 1_000 + (i * 37) % 40_000
    const heures = ((i * 13) % 200) - 50 // de -50 h à +149 h
    const d = decisionAnnulation({
      statut: i % 7 === 0 ? 'a_attribuer' : 'acceptee',
      creneau: new Date(T0.getTime() + heures * 3_600_000),
      maintenant: T0,
      prix_cents: prix,
      absence_vendeur: i % 5 === 0,
    })
    const total = d.rembourse_cents + d.retenue_cents
    if (d.rembourse_cents < 0 || d.retenue_cents < 0) fuites++
    else if (d.action === 'annuler_autorisation' && total !== 0) fuites++
    else if (d.action !== 'annuler_autorisation' && total !== prix) fuites++
  }
  eq(fuites, 0, '20 000 annulations : remboursé + retenu = prix encaissé, jamais de part négative')
}

// ⚠️ Un prix inférieur à la retenue rendrait un remboursement négatif. Le
// barème ne doit pas pouvoir produire ça — à 179 € le cas n'arrive pas, mais
// la fonction est générique et le prix est un paramètre.
{
  const d = decisionAnnulation(ctx({ prix_cents: 3_000, maintenant: new Date('2026-11-12T09:00:00Z') }))
  ok(d.rembourse_cents >= 0 || d.action === 'rien',
    'prix inférieur à la retenue : le remboursement ne devient pas négatif')
}

// ---------------------------------------------------------------------------
titre('Demande expresse d’exécution immédiate (L221-25)')
// ---------------------------------------------------------------------------
ok(/avant la fin du délai de rétractation de 14 jours/.test(DEMANDE_EXECUTION_IMMEDIATE),
  'le texte nomme le délai de 14 jours')
ok(/perdre ce droit/.test(DEMANDE_EXECUTION_IMMEDIATE),
  'et dit explicitement que le droit est perdu')
{
  // Le texte affiché à l'acheteur doit être CELUI-LÀ, mot pour mot.
  const bloc = readFileSync(new URL('../src/components/InspectionBloc.jsx', import.meta.url), 'utf8')
  const normaliser = (t) => t.replace(/\s+/g, ' ').trim()
  ok(normaliser(bloc).includes(normaliser(DEMANDE_EXECUTION_IMMEDIATE)),
    'InspectionBloc affiche le texte exact de la demande d’exécution')
  ok(/checked=\{executionImmediate\}/.test(bloc), 'la case est bien liée à son état')
  // Jamais pré-cochée : l'état initial doit être `false`, et le serveur refuse
  // la commande sans la demande (vérifié séparément dans inspection-checkout).
  ok(/\[executionImmediate, setExecutionImmediate\] = useState\(false\)/.test(bloc),
    'la case n’est JAMAIS pré-cochée')
  ok(/execution_immediate: true/.test(bloc), 'la demande est transmise au serveur')
}


if (ko > 0) {
  console.error(`\n${ko} échec(s).`)
  process.exit(1)
}

console.log('\nTous les tests inspection passent.')
