#!/usr/bin/env node
// SPRINT 7 — Configure Stripe pour le Pass achat (test OU live, selon la clé) :
//  1. crée (ou retrouve) l'endpoint webhook Stripe → fonction pass-webhook,
//     abonné à checkout.session.completed + charge.refunded ;
//  2. pose les secrets Supabase : STRIPE_SECRET_KEY, PASS_WEBHOOK_SECRET,
//     PASS_MODE, MEDIATEUR_NOM.
//
// Préalable — coller dans .env.local (jamais commité) :
//   STRIPE_SECRET_KEY=sk_test_... (ou sk_live_... pour la mise en vente)
//   PASS_MODE=vente              (ou precommande → 19 €)
//   MEDIATEUR_NOM="..."          (médiateur de la consommation désigné —
//                                 SANS lui la vente reste désactivée, par
//                                 décision produit ET obligation légale)
// Puis : node scripts/configurer-stripe-pass.mjs
//
// ⚠️ Un endpoint créé avec une clé TEST ne reçoit que les événements test ;
// rejouer le script avec la clé LIVE au moment de la mise en vente.
// ⚠️ La fonction pass-webhook doit être déployée AVANT (--no-verify-jwt).
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const PROJECT_REF = 'pspsqtokhqmotzkyqnkj'
const WEBHOOK_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/pass-webhook`
const EVENTS = ['checkout.session.completed', 'charge.refunded']

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)="?([^"\n]*)"?$/)
  if (m) env[m[1]] = m[2]
}

const SK = env.STRIPE_SECRET_KEY
if (!SK || !/^sk_(test|live)_/.test(SK)) {
  console.error('STRIPE_SECRET_KEY manquante ou invalide dans .env.local (sk_test_... ou sk_live_...).')
  process.exit(2)
}
const LIVE = SK.startsWith('sk_live_')
const PASS_MODE = env.PASS_MODE === 'precommande' ? 'precommande' : 'vente'
const MEDIATEUR = (env.MEDIATEUR_NOM ?? '').trim()
if (!MEDIATEUR) {
  console.warn('MEDIATEUR_NOM absent de .env.local : les secrets seront posés SANS lui — la vente restera désactivée (/pass en « bientôt »).')
}

async function stripe(path, params = null, method = params ? 'POST' : 'GET') {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${SK}`,
      ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: params ? new URLSearchParams(params) : undefined,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`${method} /${path} → ${res.status} : ${json?.error?.message ?? JSON.stringify(json).slice(0, 200)}`)
  return json
}

// 0. Sanity : la clé répond, et on affiche son régime pour éviter toute surprise.
const compte = await stripe('account')
console.log(`Clé Stripe : ${LIVE ? 'LIVE' : 'TEST'} — compte ${compte.id}${compte.settings?.dashboard?.display_name ? ` (${compte.settings.dashboard.display_name})` : ''}`)

// 1. Endpoint webhook : réutilisé s'il existe déjà pour cette URL (le secret
// de signature n'est fourni par Stripe QU'À LA CRÉATION : si l'endpoint
// existe et que PASS_WEBHOOK_SECRET a été perdu, le supprimer d'abord
// (dashboard Stripe) puis relancer).
const existants = await stripe('webhook_endpoints?limit=100')
let endpoint = (existants.data ?? []).find((e) => e.url === WEBHOOK_URL)
let secretWebhook = null
if (endpoint) {
  console.log(`Endpoint webhook déjà présent : ${endpoint.id} (événements : ${endpoint.enabled_events.join(', ')})`)
  const manquants = EVENTS.filter((e) => !endpoint.enabled_events.includes(e) && !endpoint.enabled_events.includes('*'))
  if (manquants.length > 0) {
    const params = new URLSearchParams()
    for (const [i, ev] of [...endpoint.enabled_events, ...manquants].entries()) params.append(`enabled_events[${i}]`, ev)
    endpoint = await stripe(`webhook_endpoints/${endpoint.id}`, params)
    console.log(`Événements ajoutés : ${manquants.join(', ')}`)
  }
} else {
  const params = new URLSearchParams({ url: WEBHOOK_URL, description: 'Inspexo — Pass achat (sprint 7)' })
  EVENTS.forEach((ev, i) => params.append(`enabled_events[${i}]`, ev))
  endpoint = await stripe('webhook_endpoints', params)
  secretWebhook = endpoint.secret
  console.log(`Endpoint webhook créé : ${endpoint.id}`)
}

// 2. Secrets Supabase (les fonctions pass-checkout / pass-webhook les lisent).
const TOKEN = execSync('security find-generic-password -s "Supabase CLI" -w').toString().trim()
const aPosser = [
  `STRIPE_SECRET_KEY=${SK}`,
  `PASS_MODE=${PASS_MODE}`,
  ...(secretWebhook ? [`PASS_WEBHOOK_SECRET=${secretWebhook}`] : []),
  ...(MEDIATEUR ? [`MEDIATEUR_NOM=${MEDIATEUR}`] : []),
]
execSync(`npx supabase secrets set ${aPosser.map((s) => `'${s}'`).join(' ')}`, {
  stdio: 'inherit',
  env: { ...process.env, SUPABASE_ACCESS_TOKEN: TOKEN },
})

console.log(`
Configuré (${LIVE ? 'LIVE' : 'TEST'}) :
  - webhook ${endpoint.id} → ${WEBHOOK_URL}
  - PASS_MODE=${PASS_MODE} (${PASS_MODE === 'precommande' ? '19 €' : '29 €'})
  - MEDIATEUR_NOM ${MEDIATEUR ? 'posé → vente ACTIVABLE' : 'ABSENT → /pass reste en « bientôt »'}
${secretWebhook ? '  - PASS_WEBHOOK_SECRET posé (nouvel endpoint)' : '  - PASS_WEBHOOK_SECRET inchangé (endpoint existant — le secret ne se relit pas)'}

Vérification : node scripts/tester-pass-stripe.mjs (paiement de bout en bout en mode test).`)
