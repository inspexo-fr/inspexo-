#!/usr/bin/env node
// SPRINT 7 — Paiement du Pass de BOUT EN BOUT en mode test Stripe :
//   1. GET  pass-checkout → la vente doit être active (MEDIATEUR_NOM posé) ;
//   2. POST pass-checkout → session Checkout (CGV acceptées + renonciation) ;
//   3. Playwright remplit la page Stripe hébergée avec la carte de test
//      4242 4242 4242 4242 → paiement → redirection /pass?paiement=ok ;
//   4. attend le webhook, vérifie la ligne `passes` (SQL via l'API de
//      gestion Supabase, lecture ciblée sur l'email de test) ;
//   5. nettoie : supprime la ligne de test et le compte auth créé.
//
// SÉCURITÉ : refuse de tourner si la clé posée côté Supabase est LIVE
// (vérifié via la fonction ops ?stripe=1) — un paiement live est un acte
// d'Utku, jamais d'un script. Préalable : scripts/configurer-stripe-pass.mjs
// exécuté avec une clé sk_test_.
//
// Usage : node scripts/tester-pass-stripe.mjs
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { chromium } from 'playwright'

const PROJECT_REF = 'pspsqtokhqmotzkyqnkj'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)="?([^"\n]*)"?$/)
  if (m) env[m[1]] = m[2]
}
const URL_BASE = env.REACT_APP_SUPABASE_URL
const ANON = env.REACT_APP_SUPABASE_ANON_KEY
const EVAL_SECRET = env.EVAL_BYPASS_SECRET
if (!URL_BASE || !ANON) { console.error('env Supabase manquant dans .env.local'); process.exit(2) }

const fonctions = (path, init = {}) =>
  fetch(`${URL_BASE}/functions/v1/${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ANON}`,
      apikey: ANON,
      ...(init.headers ?? {}),
    },
  })

// ---- 0. La clé Stripe côté Supabase est-elle bien une clé TEST ? ----
if (!EVAL_SECRET) { console.error('EVAL_BYPASS_SECRET manquant (.env.local) — impossible de vérifier le régime de la clé.'); process.exit(2) }
const diag = await (await fonctions('ops?stripe=1', { headers: { 'x-eval-secret': EVAL_SECRET } })).json()
if (diag?.stripe?.livemode !== false) {
  console.error(`ARRÊT : la clé Stripe côté Supabase n'est pas une clé de TEST (livemode=${diag?.stripe?.livemode ?? 'inconnu'}).`)
  console.error('Un paiement live est un acte manuel (carte réelle via /pass, puis remboursement admin). Reconfigurez avec sk_test_ : node scripts/configurer-stripe-pass.mjs')
  process.exit(1)
}
console.log('Clé Stripe côté Supabase : TEST — on continue.')

// ---- 1. Config publique ----
const conf = await (await fonctions('pass-checkout')).json()
console.log('Config /pass :', JSON.stringify(conf))
if (!conf.actif) {
  console.error('La vente est désactivée (MEDIATEUR_NOM ou clé manquants). Configurez puis relancez.')
  process.exit(1)
}

// ---- 2. Session Checkout ----
const email = `test-pass+${Date.now()}@inspexo.io`
const res = await fonctions('pass-checkout', {
  method: 'POST',
  body: JSON.stringify({ email, accepte_cgv: true, renonce_retractation: true }),
})
const session = await res.json()
if (!res.ok || !session.url) {
  console.error('Création de session impossible :', res.status, JSON.stringify(session))
  process.exit(1)
}
console.log('Session Checkout créée, paiement en cours (carte de test)…')

// ---- 3. Paiement sur la page hébergée Stripe ----
const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  await page.goto(session.url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.fill('#cardNumber', '4242424242424242', { timeout: 30_000 })
  await page.fill('#cardExpiry', '12 / 34')
  await page.fill('#cardCvc', '123')
  await page.fill('#billingName', 'Test Inspexo')
  // Selon le compte, Stripe peut demander le pays (select) : France par défaut.
  const pays = page.locator('#billingCountry')
  if (await pays.count()) await pays.selectOption('FR').catch(() => {})
  const postal = page.locator('#billingPostalCode')
  if (await postal.count() && await postal.isVisible().catch(() => false)) {
    await postal.fill('31000').catch(() => {})
  }
  await page.click('.SubmitButton, button[type="submit"]')
  await page.waitForURL(/paiement=ok/, { timeout: 90_000 })
  console.log('Paiement test accepté, redirection /pass?paiement=ok reçue.')
} finally {
  await browser.close()
}

// ---- 4. Le webhook a-t-il activé le Pass ? (lecture SQL ciblée) ----
const TOKEN = execSync('security find-generic-password -s "Supabase CLI" -w').toString().trim()
async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(`SQL ${r.status} : ${JSON.stringify(j).slice(0, 200)}`)
  return j
}

let pass = null
for (let i = 0; i < 20; i++) {
  await new Promise((r) => setTimeout(r, 3000))
  const rows = await sql(`select id, statut, mode, montant_cents, user_id is not null as compte,
    fin > now() + interval '29 days' as fenetre_30j
    from public.passes where email = '${email.replace(/'/g, "''")}'`)
  if (rows.length > 0) { pass = rows[0]; break }
  process.stdout.write('.')
}
console.log('')
if (!pass) {
  console.error('ÉCHEC : aucune ligne passes après 60 s — webhook non reçu ? Vérifiez PASS_WEBHOOK_SECRET et le déploiement --no-verify-jwt de pass-webhook.')
  process.exit(1)
}
const ok = pass.statut === 'actif' && pass.fenetre_30j === true
console.log(`Pass activé par le webhook : statut=${pass.statut}, mode=${pass.mode}, ${pass.montant_cents} cents, compte créé=${pass.compte}, fenêtre 30 j=${pass.fenetre_30j} → ${ok ? 'OK' : 'ECHEC'}`)

// ---- 5. Nettoyage (ligne de test + compte auth de test) ----
await sql(`delete from public.passes where email = '${email.replace(/'/g, "''")}'`)
await sql(`delete from auth.users where email = '${email.replace(/'/g, "''")}'`)
console.log('Nettoyé (ligne passes + compte de test supprimés).')

process.exit(ok ? 0 : 1)
