#!/usr/bin/env node
// Active Cloudflare Turnstile partout (anti-abus sprint 3.1) :
//  1. secret côté fonctions (score) : supabase secrets set TURNSTILE_SECRET
//  2. captcha GoTrue (lien magique) : PATCH config auth (provider turnstile)
//  3. site key côté front : vercel env REACT_APP_TURNSTILE_SITE_KEY (production)
//
// Préalable : créer un widget Turnstile (dashboard Cloudflare, gratuit) pour
// les domaines www.inspexo.io + inspexo.io, puis coller dans .env.local :
//   TURNSTILE_SITE_KEY=0x...
//   TURNSTILE_SECRET_KEY=0x...
// Puis : node scripts/activer-turnstile.mjs  (et redéployer le front).
import { readFileSync } from 'node:fs'
import { execSync, spawnSync } from 'node:child_process'

const PROJECT_REF = 'pspsqtokhqmotzkyqnkj'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)="?([^"\n]*)"?$/)
  if (m) env[m[1]] = m[2]
}
const SITE_KEY = env.TURNSTILE_SITE_KEY
const SECRET_KEY = env.TURNSTILE_SECRET_KEY
if (!SITE_KEY || !SECRET_KEY) {
  console.error('TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY manquantes dans .env.local (widget à créer dans le dashboard Cloudflare).')
  process.exit(2)
}
const TOKEN = execSync('security find-generic-password -s "Supabase CLI" -w').toString().trim()

// 1. Secret des edge functions (gate /score au-delà de 2 analyses/jour).
execSync(`npx supabase secrets set TURNSTILE_SECRET=${SECRET_KEY}`, {
  stdio: 'inherit',
  env: { ...process.env, SUPABASE_ACCESS_TOKEN: TOKEN },
})

// 2. Captcha GoTrue : exigé sur Tous les endpoints auth (lien magique inclus).
const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    security_captcha_enabled: true,
    security_captcha_provider: 'turnstile',
    security_captcha_secret: SECRET_KEY,
  }),
})
const conf = await res.json()
if (!res.ok) {
  console.error('Échec config auth :', res.status, JSON.stringify(conf).slice(0, 300))
  process.exit(1)
}
console.log('Captcha GoTrue :', conf.security_captcha_enabled, '/', conf.security_captcha_provider)

// 3. Site key côté front (le widget ne se rend que si elle est présente).
for (const cible of ['production', 'preview']) {
  const r = spawnSync('npx', ['vercel', 'env', 'add', 'REACT_APP_TURNSTILE_SITE_KEY', cible],
    { input: SITE_KEY + '\n', stdio: ['pipe', 'inherit', 'inherit'] })
  if (r.status !== 0) console.error(`vercel env add (${cible}) a échoué — la variable existe peut-être déjà (vercel env rm puis relancer).`)
}

console.log('\nTurnstile activé. Dernière étape : redéployer le front (push ou `npx vercel --prod`).')
