// Test hors ligne des décisions de cache de /rappels (aucun appel API).
// Reproduit l'incident du 28/10/2026 : l'API RappelConso répond 200 avec
// ZÉRO enregistrement pendant une réindexation, et ce vide se retrouve figé
// 24 h en cache, affiché à l'acheteur comme « aucun rappel ».
// Vérifie : une réponse vide ou en erreur n'est JAMAIS mise en cache, le TTL
// 24 h ne porte que sur un résultat non vide, une entrée vide héritée n'est
// jamais servie, et un zéro global pour la marque est déclaré indisponible
// plutôt qu'« aucun rappel ».
// Usage : node tests/rappels-cache.test.mjs
import {
  cacheServable,
  classerReponse,
  doitMettreEnCache,
  doitRetenter,
  echec,
  MAX_ESSAIS,
  MESSAGE_INDISPONIBLE,
} from '../supabase/functions/_shared/rappelsCache.ts'

let ko = 0
const verifie = (titre, ok, detail = '') => {
  if (!ok) ko++
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${titre}${ok || !detail ? '' : ` (${detail})`}`)
}

const TTL = 24 * 3600 * 1000
const MAINTENANT = Date.parse('2026-10-28T14:00:00Z')
const fiche = { titre: 'a6, a7 voiture particulière', lien: 'https://rappel.conso.gouv.fr/fiche-rappel/49959/rapex' }

/* ---------- 1. Ce qui part (ou non) en cache ---------- */

verifie(
  'résultat non vide → mis en cache',
  doitMettreEnCache(classerReponse(64, [fiche])) === true,
)

verifie(
  'INCIDENT 28/10 — zéro enregistrement pour la marque → JAMAIS mis en cache',
  doitMettreEnCache(classerReponse(0, [])) === false,
)

verifie(
  'marque présente mais aucun rappel visant le modèle → pas de cache non plus',
  doitMettreEnCache(classerReponse(64, [])) === false,
)

for (const raison of ['http', 'reseau', 'aucun_enregistrement_marque', 'marque_non_interrogeable']) {
  verifie(
    `erreur « ${raison} » → jamais mise en cache`,
    doitMettreEnCache(echec(raison)) === false,
  )
}

/* ---------- 2. « Aucun rappel » vs « indisponible » ---------- */

verifie(
  'INCIDENT 28/10 — zéro enregistrement global = indisponible, pas « aucun rappel »',
  classerReponse(0, []).etat === 'indisponible' &&
    classerReponse(0, []).raison === 'aucun_enregistrement_marque',
)

verifie(
  'la marque a des fiches mais aucune pour ce modèle = constat exact « aucun rappel »',
  classerReponse(64, []).etat === 'ok' && classerReponse(64, []).matches.length === 0,
)

verifie(
  'un échec ne fabrique jamais de rappels',
  echec('http').matches.length === 0 && echec('reseau').etat === 'indisponible',
)

verifie(
  'message d\'indisponibilité posé une seule fois, au bon libellé',
  MESSAGE_INDISPONIBLE === 'Vérification RappelConso indisponible, réessayez plus tard.',
)

/* ---------- 3. Second essai avant de conclure ---------- */

verifie(
  'zéro enregistrement au 1er essai → on retente',
  doitRetenter(0, 1) === true,
)

verifie(
  'zéro enregistrement au dernier essai → on arrête (pas de boucle)',
  doitRetenter(0, MAX_ESSAIS) === false,
)

verifie(
  'des enregistrements dès le 1er essai → aucun second appel',
  doitRetenter(64, 1) === false,
)

/* ---------- 4. Ce que le cache accepte de servir ---------- */

const frais = new Date(MAINTENANT - 3600 * 1000).toISOString()
const perime = new Date(MAINTENANT - 25 * 3600 * 1000).toISOString()

verifie(
  'entrée fraîche et non vide → servie',
  cacheServable({ payload: { rappels: [fiche] }, fetched_at: frais }, MAINTENANT, TTL) === true,
)

verifie(
  'entrée non vide mais périmée (> 24 h) → non servie',
  cacheServable({ payload: { rappels: [fiche] }, fetched_at: perime }, MAINTENANT, TTL) === false,
)

verifie(
  'INCIDENT 28/10 — entrée VIDE héritée d\'une version antérieure → jamais servie',
  cacheServable({ payload: { rappels: [] }, fetched_at: frais }, MAINTENANT, TTL) === false,
)

verifie(
  'entrée sans payload exploitable → non servie',
  cacheServable({ payload: null, fetched_at: frais }, MAINTENANT, TTL) === false &&
    cacheServable({ payload: { rappels: null }, fetched_at: frais }, MAINTENANT, TTL) === false,
)

verifie(
  'absence d\'entrée → non servie',
  cacheServable(null, MAINTENANT, TTL) === false &&
    cacheServable({ payload: { rappels: [fiche] }, fetched_at: null }, MAINTENANT, TTL) === false,
)

verifie(
  'date de cache illisible → non servie (jamais d\'âge NaN accepté)',
  cacheServable({ payload: { rappels: [fiche] }, fetched_at: 'pas-une-date' }, MAINTENANT, TTL) === false,
)

/* ---------- 5. Scénario complet de l'incident ---------- */

// 14:06 — réindexation : l'API répond 200 avec 0 enregistrement pour Audi.
const pendantPanne = classerReponse(0, [])
const cacheEcrit = doitMettreEnCache(pendantPanne)
// 14:30 — l'API est revenue : 64 enregistrements, 0 visant la S7 précisément.
const apresPanne = classerReponse(64, [])

verifie(
  'SCÉNARIO — pendant la panne : rien n\'est caché et l\'acheteur lit « indisponible »',
  cacheEcrit === false && pendantPanne.etat === 'indisponible',
)
verifie(
  'SCÉNARIO — après la panne : la vérification est refaite, constat exact, toujours pas de cache',
  apresPanne.etat === 'ok' && doitMettreEnCache(apresPanne) === false,
)
verifie(
  'SCÉNARIO — un vrai rappel trouvé ensuite : lui est bien caché 24 h',
  doitMettreEnCache(classerReponse(64, [fiche])) === true &&
    cacheServable({ payload: { rappels: [fiche] }, fetched_at: frais }, MAINTENANT, TTL) === true,
)

console.log(ko === 0 ? '\n✓ cache rappels conforme' : `\n✗ ${ko} test(s) en échec`)
process.exit(ko === 0 ? 0 : 1)
