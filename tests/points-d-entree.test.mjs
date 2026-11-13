// Test hors ligne : chaque point d'entrée vérifie son justificatif AVANT de
// lire le corps de la requête.
// Usage : node tests/points-d-entree.test.mjs
//
// ⚠️ POURQUOI CE TEST EXISTE. L'audit du 5 novembre 2026 a sondé les fonctions
// en production : toutes rendaient 401 ou 403 sans justificatif, SAUF `intake`,
// qui rendait 400 « invalid_input ». En lisant le code : son secret de proxy
// était bien vérifié, mais APRÈS la validation du corps — et surtout il ne
// servait qu'à choisir la provenance de l'IP, pas à refuser l'appel. N'importe
// qui pouvait donc obtenir une analyse avec la clé anon (publiée dans le
// bundle du site) en contournant la porte Turnstile.
//
// Un contrôle d'accès placé après la validation du corps n'est pas seulement
// mal ordonné : c'est le signe qu'il n'en est pas un.
import { readFileSync, readdirSync, existsSync } from 'node:fs'

const RACINE = new URL('../supabase/functions/', import.meta.url)
let ko = 0
let total = 0
const ok = (cond, label, detail = '') => {
  total++
  if (!cond) { ko++; console.log(`FAIL — ${label}${detail ? ` (${detail})` : ''}`) }
}
const titre = (t) => console.log(`\n▶ ${t}`)

const fonctions = readdirSync(RACINE).filter((d) => d !== '_shared' && existsSync(new URL(`${d}/index.ts`, RACINE)))
const source = (f) => readFileSync(new URL(`${f}/index.ts`, RACINE), 'utf8')

// Les expressions qui CONSTITUENT un contrôle d'accès dans ce projet.
const GARDES = [
  /proxySecretMatches\(/, /secretOk\(/, /evalSecretMatches\(/, /verifierAdmin\(/,
  /estAdminUserId\(/, /passDepuisReq\(/, /SERVICE_ROLE/, /constructEventAsync/,
  /signatureValide\(/, /jetonValide\(/, /utilisateurDeLaRequete\(/, /authorization/i,
]
// Et la lecture du corps.
const CORPS = /await req\.json\(|await req\.text\(|await req\.formData\(/

titre('Les fonctions sans aucun garde sont nommées, et c’est volontaire')
// `desinscription` s'authentifie par la SIGNATURE du lien reçu par email, lue
// dans l'URL : elle n'a pas de garde en tête, et c'est correct.
const SANS_GARDE_ASSUME = new Set([
  'desinscription', // le lien signé EST l'authentification (RFC 8058)
  'ai-chat', 'upload-chat-file', 'send-email', 'create-checkout', 'stripe-webhook',
  'admin-missions', 'admin-applications', 'create-connect-account', 'create-transfer', // retirées (410)
])
const sansGarde = fonctions.filter((f) => !GARDES.some((g) => g.test(source(f))))
const inattendues = sansGarde.filter((f) => !SANS_GARDE_ASSUME.has(f))
ok(inattendues.length === 0,
  'aucune fonction ne se passe de garde sans être nommée dans la liste',
  inattendues.join(', '))

titre('⚠️ Le garde précède la lecture du corps')
let controlees = 0
// ⚠️ LES WEBHOOKS STRIPE SONT UN CAS À PART, ET CE N'EST PAS UNE EXEMPTION DE
// COMPLAISANCE : vérifier une signature Stripe EXIGE le corps brut
// (`constructEventAsync(corps, signature, secret)`). Lire le corps d'abord est
// donc la seule façon de faire. L'invariant qui les concerne est différent et
// il est contrôlé plus bas : AUCUN effet de bord avant la signature.
const WEBHOOKS = new Set(['pass-webhook', 'inspection-webhook', 'pro-webhook'])
for (const f of fonctions) {
  const s = source(f)
  if (SANS_GARDE_ASSUME.has(f) || WEBHOOKS.has(f)) continue
  const mCorps = s.match(CORPS)
  if (!mCorps) continue // la fonction ne lit pas de corps : rien à ordonner
  const iCorps = s.indexOf(mCorps[0])
  const positions = GARDES.map((g) => { const m = s.match(g); return m ? s.indexOf(m[0]) : Infinity })
  const iGarde = Math.min(...positions)
  controlees++
  ok(iGarde < iCorps, `${f} : le justificatif est vérifié avant le corps`,
    iGarde === Infinity ? 'aucun garde trouvé' : `garde à ${iGarde}, corps à ${iCorps}`)
}
ok(controlees >= 20, `le balayage couvre bien les fonctions (${controlees} contrôlées)`)

titre('⚠️ Webhooks : aucun effet de bord avant la signature')
for (const f of WEBHOOKS) {
  const s = source(f)
  const iSignature = s.indexOf('constructEventAsync')
  ok(iSignature > 0, `${f} : la signature est vérifiée par constructEventAsync`)
  // Le premier écrit en base, le premier appel à Stripe, le premier email.
  const effets = [/\.from\("[a-z_]+"\)\s*\n?\s*\.(?:insert|update|upsert|delete)/,
                  /admin\.rpc\(/, /api\.stripe\.com/, /sendMail\(/, /envoyer[A-Z]/]
  const iPremierEffet = Math.min(...effets.map((re) => { const m = s.match(re); return m ? s.indexOf(m[0]) : Infinity }))
  ok(iSignature < iPremierEffet,
    `${f} : rien n'est écrit, envoyé ni appelé avant la vérification de signature`,
    `signature à ${iSignature}, premier effet à ${iPremierEffet}`)
  // Et le secret doit venir de l'environnement, jamais du code.
  ok(/Deno\.env\.get\("(?:PASS|INSPECTION|PRO)_WEBHOOK_SECRET"\)/.test(s),
    `${f} : le secret de signature vient des variables d'environnement`)
}

titre('⚠️ intake : le secret est EXIGÉ, pas seulement consulté')
{
  const s = source('intake')
  // Le défaut exact : le secret servait d'aiguillage (`viaProxy ? … : …`) sans
  // jamais refuser. Il doit maintenant produire un REFUS.
  ok(/if \(!\(await proxySecretMatches\(req\)\)\)[\s\S]{0,200}?403/.test(s),
    'un secret absent ou faux produit un 403')
  const iSecret = s.indexOf('proxySecretMatches(req)')
  const iCorps = s.indexOf('await req.json()')
  ok(iSecret > 0 && iSecret < iCorps, 'et le refus précède la lecture du corps',
    `secret à ${iSecret}, corps à ${iCorps}`)
  // ⚠️ L'aiguillage fautif ne doit pas revenir.
  ok(!/const viaProxy = await proxySecretMatches/.test(s),
    'le secret ne sert plus d’aiguillage silencieux')
  // Et le repli d'IP ne doit pas écraser tout le monde sous une même clé :
  // « unknown » partagé bloquerait le premier utilisateur venu.
  ok(!/\?\?\s*"unknown"\)\.trim\(\)/.test(s),
    'pas de seau de rate limit partagé sous une IP « unknown »')
}

titre('Les deux clients légitimes passent par le proxy')
{
  const ext = readFileSync(new URL('../extension/background.js', import.meta.url), 'utf8')
  const appli = readFileSync(new URL('../src/lib/mobile.js', import.meta.url), 'utf8')
  ok(/https:\/\/www\.inspexo\.io\/api\/intake/.test(ext), 'l’extension appelle le proxy, pas la fonction')
  ok(/https:\/\/www\.inspexo\.io\/api\/intake/.test(appli), 'l’application appelle le proxy, pas la fonction')
  ok(!/functions\/v1\/intake/.test(ext) && !/functions\/v1\/intake/.test(appli),
    'ni l’un ni l’autre n’appelle la fonction en direct — exiger le secret ne casse rien')
  const proxy = readFileSync(new URL('../api/intake.js', import.meta.url), 'utf8')
  ok(/x-proxy-secret/.test(proxy) && /INTAKE_PROXY_SECRET/.test(proxy),
    'le proxy Vercel porte bien le secret')
}

console.log(`\n${ko === 0 ? 'OK' : 'ÉCHEC'} — ${total - ko}/${total} contrôles passés`)
process.exit(ko === 0 ? 0 : 1)
