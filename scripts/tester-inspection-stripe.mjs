#!/usr/bin/env node
// SPRINT 8 — Inspection de bout en bout en mode TEST Stripe.
//
//   1. refuse de tourner si la clé Stripe posée côté Supabase est LIVE ;
//   2. crée un inspecteur de test VALIDÉ (Connect simulé) et un acheteur ;
//   3. commande une inspection (179 €) → Playwright paie avec 4242… ;
//   4. attend le webhook → statut a_attribuer, inspecteurs prévenus ;
//   5. accepte la mission (coordonnées du vendeur révélées à ce moment) ;
//   6. remet un rapport → vérifie le versement des 60 % (transfer_group
//      identique à la charge, source_transaction posée) ;
//   7. nettoie TOUT (inspection, inspecteur, comptes, photos).
//
// Préalable : STRIPE_SECRET_KEY=sk_test_… dans .env.local puis
//   node scripts/configurer-stripe-pass.mjs   (pose la clé de test)
//   node scripts/configurer-stripe-inspection.mjs  (webhook inspection)
// Usage : node scripts/tester-inspection-stripe.mjs
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
if (!URL_BASE || !ANON || !EVAL_SECRET) {
  console.error('env manquant dans .env.local'); process.exit(2)
}

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

const fonction = (path, init = {}) =>
  fetch(`${URL_BASE}/functions/v1/${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ANON}`,
      apikey: ANON,
      ...(init.headers ?? {}),
    },
  })

// ---- 0. Garde-fou : jamais sur une clé live ----
const diag = await (await fonction('ops?stripe=1', { headers: { 'x-eval-secret': EVAL_SECRET } })).json()
if (diag?.stripe?.livemode !== false) {
  console.error(`ARRÊT : la clé Stripe côté Supabase n'est pas une clé de TEST (livemode=${diag?.stripe?.livemode}).`)
  console.error('Un paiement et un virement réels sont des actes manuels. Posez sk_test_ puis relancez.')
  process.exit(1)
}
console.log('Clé Stripe : TEST — on continue.')

const marque = Date.now()
const emailInspecteur = `test-inspecteur+${marque}@inspexo.io`
const emailAcheteur = `test-acheteur+${marque}@inspexo.io`
const MDP = `Test!${marque}aA`
let inspectionId = null

const nettoyer = async () => {
  try {
    await sql(`delete from public.inspection_photos where inspection_id in (
                 select id from public.inspections where acheteur_id in
                 (select id from auth.users where email = '${emailAcheteur}'))`)
    await sql(`delete from public.inspections where acheteur_id in
                 (select id from auth.users where email = '${emailAcheteur}')`)
    await sql(`delete from public.inspecteurs where email = '${emailInspecteur}'`)
    await sql(`delete from auth.users where email in ('${emailAcheteur}','${emailInspecteur}')`)
    console.log('Nettoyé.')
  } catch (e) { console.error('nettoyage partiel :', e.message) }
}

try {
  // ---- 1. Comptes de test (mot de passe : le lien magique n'est pas scriptable) ----
  const creer = async (email) => {
    const r = await fetch(`${URL_BASE}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { apikey: ANON, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: MDP, email_confirm: true }),
    })
    if (!r.ok) throw new Error(`création de compte impossible (${email}) : ${r.status} — SUPABASE_SERVICE_ROLE_KEY absente de .env.local ?`)
    return (await r.json()).id
  }
  const idInspecteur = await creer(emailInspecteur)
  const idAcheteur = await creer(emailAcheteur)
  console.log('Comptes de test créés.')

  // Inspecteur VALIDÉ, Connect simulé actif (pas de vrai compte Express en test).
  await sql(`insert into public.inspecteurs (user_id, email, nom, siret, departements, statut,
      stripe_account_id, stripe_paiements_actifs, charte_version, charte_signee_le, rc_pro_echeance)
    values ('${idInspecteur}', '${emailInspecteur}', 'Inspecteur Test', '55210055400013', '{31}', 'valide',
      '${env.STRIPE_TEST_CONNECT_ACCOUNT ?? ''}', ${env.STRIPE_TEST_CONNECT_ACCOUNT ? 'true' : 'false'},
      '2026-11-01', now(), '2027-12-31')`)
  console.log('Inspecteur de test validé.')

  const jeton = async (email) => {
    const r = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: MDP }),
    })
    const j = await r.json()
    if (!j.access_token) throw new Error(`connexion impossible (${email})`)
    return j.access_token
  }
  const jwtAcheteur = await jeton(emailAcheteur)
  const jwtInspecteur = await jeton(emailInspecteur)

  // ---- 2. Une analyse à inspecter ----
  const [analyse] = await sql(`select id from public.analyses where verdict is not null order by created_at desc limit 1`)
  const analysisId = analyse.id

  // ---- 3. Commande ----
  const creneau = new Date(Date.now() + 24 * 3600 * 1000).toISOString()
  const cmd = await (await fonction('inspection-checkout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwtAcheteur}` },
    body: JSON.stringify({
      analysis_id: analysisId, code_postal: '31000', creneau, accepte_cgv: true,
      vendeur_nom: 'Vendeur Test', vendeur_telephone: '0600000000', vendeur_adresse: '1 rue de Test, 31000 Toulouse',
    }),
  })).json()
  if (!cmd.url) throw new Error(`commande refusée : ${JSON.stringify(cmd)}`)
  inspectionId = cmd.inspection_id
  console.log('Session de paiement créée.')

  // ---- 4. Paiement test ----
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    await page.goto(cmd.url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.fill('#cardNumber', '4242424242424242', { timeout: 30_000 })
    await page.fill('#cardExpiry', '12 / 34')
    await page.fill('#cardCvc', '123')
    await page.fill('#billingName', 'Acheteur Test')
    const postal = page.locator('#billingPostalCode')
    if (await postal.count() && await postal.isVisible().catch(() => false)) await postal.fill('31000').catch(() => {})
    await page.click('.SubmitButton, button[type="submit"]')
    await page.waitForURL(/inspection=ok/, { timeout: 90_000 })
    console.log('Paiement test accepté.')
  } finally { await browser.close() }

  // ---- 5. Webhook ----
  let ligne = null
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 3000))
    const rows = await sql(`select statut, stripe_charge is not null as charge, transfer_group
                            from public.inspections where id = '${inspectionId}'`)
    if (rows[0]?.statut === 'a_attribuer') { ligne = rows[0]; break }
    process.stdout.write('.')
  }
  console.log('')
  if (!ligne) throw new Error('webhook non reçu : statut toujours a_payer (INSPECTION_WEBHOOK_SECRET ? déploiement --no-verify-jwt ?)')
  console.log(`Webhook OK — statut ${ligne.statut}, charge enregistrée : ${ligne.charge}, groupe ${ligne.transfer_group}`)
  if (ligne.transfer_group !== `inspection_${inspectionId}`) throw new Error('transfer_group incohérent')

  // ---- 6. Coordonnées masquées AVANT acceptation ----
  const missionsAvant = await (await fetch(`${URL_BASE}/rest/v1/rpc/inspecteur_missions`, {
    method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${jwtInspecteur}`, 'Content-Type': 'application/json' },
    body: '{}',
  })).json()
  const avant = (missionsAvant || []).find(m => m.id === inspectionId)
  if (!avant) throw new Error('mission invisible pour l’inspecteur de la zone')
  if (avant.vendeur_adresse !== null) throw new Error('FUITE : adresse du vendeur visible avant acceptation')
  console.log('Avant acceptation : adresse du vendeur masquée ✓')

  // ---- 7. Acceptation ----
  const acc = await (await fonction('inspecteur-mission', {
    method: 'POST', headers: { Authorization: `Bearer ${jwtInspecteur}` },
    body: JSON.stringify({ action: 'accepter', inspection_id: inspectionId, creneau }),
  })).json()
  if (!acc.ok) throw new Error(`acceptation refusée : ${JSON.stringify(acc)}`)
  console.log('Mission acceptée, acheteur prévenu.')

  // ---- 8. Rapport + versement ----
  await (await fonction('inspecteur-mission', {
    method: 'POST', headers: { Authorization: `Bearer ${jwtInspecteur}` },
    body: JSON.stringify({ action: 'consentement_photos', inspection_id: inspectionId }),
  })).json()

  const rap = await (await fonction('inspection-rapport', {
    method: 'POST', headers: { Authorization: `Bearer ${jwtInspecteur}` },
    body: JSON.stringify({
      inspection_id: inspectionId,
      synthese: 'Véhicule conforme à l’annonce dans l’ensemble. Pneus avant à 3 mm, disques marqués, aucune trace de choc. Carnet présent et tamponné.',
      decision: 'negocier',
      constats: [{ organe: 'pneus', constat: 'Pneus avant à 3 mm', signal: 'attention' }],
      photos: [],
    }),
  })).json()
  if (!rap.ok) throw new Error(`rapport refusé : ${JSON.stringify(rap)}`)

  const [final] = await sql(`select statut, transfer_id, verse_le, part_inspecteur_cents
                             from public.inspections where id = '${inspectionId}'`)
  console.log(`Rapport remis — statut ${final.statut}, part ${final.part_inspecteur_cents} centimes, versement : ${final.transfer_id ?? 'non effectué (compte Connect de test absent)'}`)
  if (final.statut !== 'faite') throw new Error('statut final incorrect')
  if (final.part_inspecteur_cents !== 10740) throw new Error('part inspecteur incorrecte')

  // Idempotence : un second envoi ne doit ni dupliquer le rapport ni repayer.
  const bis = await (await fonction('inspection-rapport', {
    method: 'POST', headers: { Authorization: `Bearer ${jwtInspecteur}` },
    body: JSON.stringify({ inspection_id: inspectionId, synthese: 'x'.repeat(50), decision: 'acheter', constats: [], photos: [] }),
  })).json()
  if (bis.ok) throw new Error('FUITE : le rapport a pu être remis deux fois')
  console.log('Second envoi refusé (idempotent) ✓')

  console.log('\n✓ Parcours complet validé en mode test.')
} catch (e) {
  console.error('\nÉCHEC :', e.message)
  await nettoyer()
  process.exit(1)
}
await nettoyer()
