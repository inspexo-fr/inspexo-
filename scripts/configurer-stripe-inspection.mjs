#!/usr/bin/env node
// SPRINT 8 — Configure le webhook Stripe des INSPECTIONS (distinct de celui
// du Pass : deux produits, deux endpoints, deux secrets — un incident sur
// l'un ne coupe pas l'autre).
//
// Préalable dans .env.local : STRIPE_SECRET_KEY=sk_test_… (ou sk_live_…).
// Usage : node scripts/configurer-stripe-inspection.mjs
//
// ⚠️ Stripe ne révèle le secret de signature QU'À LA CRÉATION de l'endpoint.
// Si INSPECTION_WEBHOOK_SECRET a été perdu, supprimer l'endpoint dans le
// dashboard Stripe puis relancer ce script.
// ⚠️ La fonction inspection-webhook doit être déployée --no-verify-jwt.
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const PROJECT_REF = 'pspsqtokhqmotzkyqnkj'
const WEBHOOK_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/inspection-webhook`
const EVENTS = [
  'checkout.session.completed',
  'charge.refunded',
  // Litiges : consignés en base, la décision de contester reste humaine.
  'charge.dispute.created',
  'charge.dispute.funds_withdrawn',
  // Fin de KYC d'un inspecteur (ou restriction) : met à jour le drapeau de
  // versement sans attendre qu'il rouvre son espace.
  'account.updated',
]

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)="?([^"\n]*)"?$/)
  if (m) env[m[1]] = m[2]
}
const SK = env.STRIPE_SECRET_KEY
if (!SK || !/^sk_(test|live)_/.test(SK)) {
  console.error('STRIPE_SECRET_KEY manquante ou invalide dans .env.local.')
  process.exit(2)
}
const LIVE = SK.startsWith('sk_live_')

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
  if (!res.ok) throw new Error(`${method} /${path} → ${res.status} : ${json?.error?.message ?? ''}`)
  return json
}

const compte = await stripe('account')
console.log(`Clé Stripe : ${LIVE ? 'LIVE' : 'TEST'} — compte ${compte.id}`)

// Les transferts vers des comptes connectés exigent Stripe Connect actif.
if (!compte.charges_enabled) {
  console.warn('⚠️ Le compte Stripe n’accepte pas encore les paiements : terminez l’activation.')
}

const existants = await stripe('webhook_endpoints?limit=100')
let endpoint = (existants.data ?? []).find((e) => e.url === WEBHOOK_URL)
let secret = null
if (endpoint) {
  console.log(`Endpoint déjà présent : ${endpoint.id}`)
  const manquants = EVENTS.filter((e) => !endpoint.enabled_events.includes(e) && !endpoint.enabled_events.includes('*'))
  if (manquants.length > 0) {
    const params = new URLSearchParams()
    ;[...endpoint.enabled_events, ...manquants].forEach((ev, i) => params.append(`enabled_events[${i}]`, ev))
    endpoint = await stripe(`webhook_endpoints/${endpoint.id}`, params)
    console.log(`Événements ajoutés : ${manquants.join(', ')}`)
  }
} else {
  const params = new URLSearchParams({ url: WEBHOOK_URL, description: 'Inspexo — inspections (sprint 8)' })
  EVENTS.forEach((ev, i) => params.append(`enabled_events[${i}]`, ev))
  endpoint = await stripe('webhook_endpoints', params)
  secret = endpoint.secret
  console.log(`Endpoint créé : ${endpoint.id}`)
}

if (secret) {
  const TOKEN = execSync('security find-generic-password -s "Supabase CLI" -w').toString().trim()
  execSync(`npx supabase secrets set 'INSPECTION_WEBHOOK_SECRET=${secret}'`, {
    stdio: 'inherit',
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: TOKEN },
  })
  console.log('INSPECTION_WEBHOOK_SECRET posé.')
} else {
  console.log('Secret inchangé (endpoint existant — Stripe ne le relit pas).')
}

console.log(`
Configuré (${LIVE ? 'LIVE' : 'TEST'}) : ${endpoint.id} → ${WEBHOOK_URL}
Rappel : le service ne s'ouvre au public que si MEDIATEUR_NOM est posé ET
qu'au moins un inspecteur validé a un compte Connect opérationnel.
Vérification : node scripts/tester-inspection-stripe.mjs`)
