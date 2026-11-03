// Test hors ligne des clés d'API et des quotas (aucun appel réseau).
// Usage : node tests/api-clients.test.mjs
//
// Le contrôle le plus important de ce fichier est `estAppelApi` : il décide
// si un appelant échappe à la limite de 5 analyses par 24 heures et au
// captcha. S'il se contentait de l'en-tête `x-api-client`, n'importe qui
// l'ajouterait depuis son navigateur et le service gratuit serait sans
// plafond. LES DEUX FACTEURS SONT EXIGÉS.
import {
  apercuCle, CLE_RE, cleDepuisRequete, cleValide, estAppelApi, evaluerQuota,
  genererCle, hacherCle, jourDe, LONGUEUR_SECRET, memeEmpreinte, moisDe,
  PLAFOND_JOUR_API, PREFIXE_CLE, QUOTA_MENSUEL_DEFAUT,
} from '../supabase/functions/_shared/apiClients.ts'

let ko = 0, total = 0
const ok = (c, label) => { total++; if (!c) { ko++; console.log(`FAIL — ${label}`) } }
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b),
  `${label} (obtenu ${JSON.stringify(a)}, attendu ${JSON.stringify(b)})`)
const titre = (t) => console.log(`\n▶ ${t}`)

/** Faux porteur d'en-têtes, insensible à la casse comme l'objet Headers. */
const entetes = (o) => ({
  get: (n) => {
    const k = Object.keys(o).find(x => x.toLowerCase() === String(n).toLowerCase())
    return k ? o[k] : null
  },
})

// ---------------------------------------------------------------------------
titre('Génération et format des clés')
{
  const cles = Array.from({ length: 200 }, genererCle)
  ok(cles.every(cleValide), 'toutes les clés générées sont valides')
  ok(cles.every(c => c.startsWith(PREFIXE_CLE)), 'préfixe lisible présent')
  ok(cles.every(c => c.length === PREFIXE_CLE.length + LONGUEUR_SECRET), 'longueur constante')
  eq(new Set(cles).size, 200, '200 clés générées, 200 distinctes (aléa réel)')
  ok(cles.every(c => CLE_RE.test(c)), 'format base64url strict')
}
ok(!cleValide(''), 'clé vide refusée')
ok(!cleValide('ix_live_court'), 'clé trop courte refusée')
ok(!cleValide(`${PREFIXE_CLE}${'a'.repeat(43)}!`), 'caractère hors base64url refusé')
ok(!cleValide(`sk_live_${'a'.repeat(43)}`), 'préfixe étranger refusé')
ok(!cleValide(null) && !cleValide(undefined), 'valeurs absentes refusées')

titre('Empreinte : la clé en clair n’est jamais conservée')
{
  const c = genererCle()
  const h1 = await hacherCle(c, 'sel-secret')
  const h2 = await hacherCle(c, 'sel-secret')
  eq(h1, h2, 'empreinte déterministe')
  ok(/^[0-9a-f]{64}$/.test(h1), 'empreinte SHA-256 hexadécimale')
  ok(!h1.includes(c.slice(PREFIXE_CLE.length)), 'l’empreinte ne contient pas la clé')
  const autreSel = await hacherCle(c, 'autre-sel')
  ok(h1 !== autreSel, 'le sel change l’empreinte : une base volée ne suffit pas')
  const autreCle = await hacherCle(genererCle(), 'sel-secret')
  ok(h1 !== autreCle, 'deux clés, deux empreintes')
}
{
  const c = genererCle()
  const a = apercuCle(c)
  ok(a.startsWith(PREFIXE_CLE) && a.endsWith('…'), 'aperçu reconnaissable')
  ok(a.length < c.length - 30, 'l’aperçu laisse l’essentiel du secret inconnu')
  eq(apercuCle('pas-une-cle'), '', 'aperçu vide pour une clé invalide')
}

titre('Comparaison en temps constant')
ok(memeEmpreinte('abc123', 'abc123'), 'empreintes identiques')
ok(!memeEmpreinte('abc123', 'abc124'), 'dernier caractère différent')
ok(!memeEmpreinte('abc123', 'Xbc123'), 'premier caractère différent')
ok(!memeEmpreinte('abc', 'abcd'), 'longueurs différentes')
ok(!memeEmpreinte('', ''), 'deux chaînes vides ne valident jamais')
ok(!memeEmpreinte(null, null), 'valeurs absentes ne valident jamais')
ok(!memeEmpreinte(undefined, ''), 'undefined ne vaut pas chaîne vide')

titre('Lecture de la clé dans la requête')
{
  const c = genererCle()
  eq(cleDepuisRequete(entetes({ Authorization: `Bearer ${c}` })), c, 'en-tête Authorization')
  eq(cleDepuisRequete(entetes({ 'x-api-key': c })), c, 'en-tête X-API-Key')
  eq(cleDepuisRequete(entetes({ AUTHORIZATION: `bearer ${c}` })), c, 'casse indifférente')
  eq(cleDepuisRequete(entetes({ Authorization: 'Bearer pas-une-cle' })), null, 'jeton non conforme ignoré')
  eq(cleDepuisRequete(entetes({})), null, 'aucun en-tête')
  eq(cleDepuisRequete(entetes({ Authorization: c })), null, 'sans le préfixe Bearer')
}

// ---------------------------------------------------------------------------
titre('appelApiExigeLesDeuxFacteurs — le contrôle qui protège le service gratuit')
const SRK = 'service-role-key-secrete'
// Ce qu'un visiteur peut fabriquer depuis son navigateur : l'en-tête.
ok(!estAppelApi(entetes({ 'x-api-client': 'client-1' }), SRK),
  'EN-TÊTE SEUL : refusé — un appel public reste plafonné à 5/24 h et passe par le captcha')
ok(!estAppelApi(entetes({ 'x-api-client': 'client-1', Authorization: 'Bearer anon-key' }), SRK),
  'en-tête + clé anon : refusé')
ok(!estAppelApi(entetes({ 'x-api-client': 'client-1', Authorization: 'Bearer ' }), SRK),
  'en-tête + Bearer vide : refusé')
ok(!estAppelApi(entetes({ 'x-api-client': 'client-1', Authorization: `Bearer ${SRK}x` }), SRK),
  'clé de service role approchante : refusée')
ok(!estAppelApi(entetes({ 'x-api-client': 'client-1', Authorization: `Bearer ${SRK}` }), null),
  'aucune clé de service role connue du serveur : refusé')
ok(!estAppelApi(entetes({ 'x-api-client': 'client-1', Authorization: `Bearer ${SRK}` }), ''),
  'clé de service role vide : refusé')
// Ce que seul notre propre serveur peut produire : les deux.
ok(estAppelApi(entetes({ 'x-api-client': 'client-1', Authorization: `Bearer ${SRK}` }), SRK),
  'LES DEUX FACTEURS : accepté')
// Le service role seul ne suffit pas non plus : il faut désigner le client.
ok(!estAppelApi(entetes({ Authorization: `Bearer ${SRK}` }), SRK),
  'service role sans en-tête : refusé (aucun client à débiter)')
ok(!estAppelApi(entetes({ 'x-api-client': '   ', Authorization: `Bearer ${SRK}` }), SRK),
  'identifiant de client vide : refusé')

// ---------------------------------------------------------------------------
titre('Quotas : deux plafonds, pas un')
const base = { trouve: true, actif: true, quota_mensuel: 100, appels_mois: 0, appels_jour_global: 0 }
eq(evaluerQuota(base).ok, true, 'client neuf : accepté')
eq(evaluerQuota(base).restant_mois, 99, 'reste 99 après cet appel')
eq(evaluerQuota({ ...base, trouve: false }).raison, 'cle_inconnue', 'clé inconnue')
eq(evaluerQuota({ ...base, actif: false }).raison, 'cle_revoquee', 'clé révoquée')
eq(evaluerQuota({ ...base, appels_mois: 99 }).ok, true, 'dernier appel du quota accepté')
eq(evaluerQuota({ ...base, appels_mois: 99 }).restant_mois, 0, 'et il ne reste rien après')
eq(evaluerQuota({ ...base, appels_mois: 100 }).raison, 'quota_mensuel', 'quota mensuel atteint')
eq(evaluerQuota({ ...base, appels_jour_global: PLAFOND_JOUR_API }).raison, 'plafond_journalier',
  'plafond journalier global atteint')
// Le plafond global prime : il protège la facture, pas le contrat d'un client.
eq(evaluerQuota({ ...base, appels_mois: 100, appels_jour_global: PLAFOND_JOUR_API }).raison,
  'plafond_journalier', 'le plafond global est annoncé en premier')
eq(evaluerQuota({ ...base, quota_mensuel: 0 }).raison, 'quota_mensuel', 'quota nul = aucun appel')
eq(evaluerQuota({ ...base, appels_jour_global: 5, plafond_jour_global: 5 }).raison,
  'plafond_journalier', 'plafond global surchargeable')
for (const r of ['cle_inconnue', 'cle_revoquee', 'quota_mensuel', 'plafond_journalier']) {
  const e = evaluerQuota({
    ...base, trouve: r !== 'cle_inconnue', actif: r !== 'cle_revoquee',
    appels_mois: r === 'quota_mensuel' ? 100 : 0,
    appels_jour_global: r === 'plafond_journalier' ? PLAFOND_JOUR_API : 0,
  })
  ok(e.message.length > 20, `le refus « ${r} » porte un message explicite`)
}
ok(evaluerQuota({ ...base, appels_mois: 100 }).message.includes('1er du mois'),
  'le message mensuel dit quand le quota repart')
ok(evaluerQuota({ ...base, appels_jour_global: PLAFOND_JOUR_API }).message.includes('toutes clés confondues'),
  'le message journalier dit que le plafond est global')
ok(QUOTA_MENSUEL_DEFAUT > 0 && QUOTA_MENSUEL_DEFAUT <= PLAFOND_JOUR_API,
  'le quota par défaut reste sous le plafond journalier global')

titre('Périodes')
eq(moisDe(new Date(Date.UTC(2026, 10, 3))), '2026-11', 'mois courant')
eq(moisDe(new Date(Date.UTC(2026, 0, 1))), '2026-01', 'janvier sur deux chiffres')
eq(jourDe(new Date(Date.UTC(2026, 10, 3, 23, 59))), '2026-11-03', 'jour UTC')

titre('Déterminisme')
{
  const attendu = JSON.stringify(evaluerQuota({ ...base, appels_mois: 42 }))
  let stable = true
  for (let i = 0; i < 200; i++) {
    if (JSON.stringify(evaluerQuota({ ...base, appels_mois: 42 })) !== attendu) stable = false
  }
  ok(stable, '200 évaluations identiques → résultat identique')
}

console.log(`\n${ko === 0 ? 'OK' : 'ÉCHEC'} — ${total - ko}/${total} contrôles passés`)
process.exit(ko === 0 ? 0 : 1)
