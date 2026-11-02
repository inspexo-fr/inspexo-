// Test hors ligne des règles de l'inspection à la demande (aucun appel réseau).
// Vérifie : les parts d'argent ne perdent ni ne créent de centime, la clé de
// Luhn du SIRET (avec l'exception La Poste), la zone couverte, le créneau
// sous 48 h, et l'intégrité de la charte signée.
// Usage : node tests/inspection.test.mjs
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
verifie('Charte en 7 engagements', CHARTE_INDEPENDANCE.length === 7)
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

if (ko > 0) {
  console.error(`\n${ko} échec(s).`)
  process.exit(1)
}
console.log('\nTous les tests inspection passent.')
