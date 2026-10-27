#!/usr/bin/env node
// Configure Resend comme SMTP de Supabase Auth (expéditeur contact@inspexo.io)
// puis déclenche un VRAI envoi de lien magique pour vérifier la chaîne.
//
// Préalable : coller une clé API Resend (permission « sending » suffit) dans
// .env.local sous la forme :  RESEND_SMTP_KEY=re_xxtill
// (créée dans le dashboard Resend → API Keys ; la clé des edge functions est
// stockée hachée côté Supabase et n'est pas relisible.)
//
// Usage : node scripts/configurer-smtp-auth.mjs [email_de_test]
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const PROJECT_REF = 'pspsqtokhqmotzkyqnkj'
const EMAIL_TEST = process.argv[2] || 'contact@inspexo.io'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)="?([^"\n]*)"?$/)
  if (m) env[m[1]] = m[2]
}
const SMTP_KEY = env.RESEND_SMTP_KEY
if (!SMTP_KEY || !SMTP_KEY.startsWith('re_')) {
  console.error('RESEND_SMTP_KEY manquante dans .env.local (clé Resend « sending », format re_…).')
  process.exit(2)
}
const TOKEN = execSync('security find-generic-password -s "Supabase CLI" -w').toString().trim()

const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    smtp_host: 'smtp.resend.com',
    smtp_port: '465',
    smtp_user: 'resend',
    smtp_pass: SMTP_KEY,
    smtp_admin_email: 'contact@inspexo.io',
    smtp_sender_name: 'Inspexo',
    // Avec un SMTP dédié, la limite par défaut (2 emails/h) n'a plus lieu d'être.
    rate_limit_email_sent: 30,
  }),
})
const conf = await res.json()
if (!res.ok) {
  console.error('Échec de la configuration :', res.status, JSON.stringify(conf).slice(0, 300))
  process.exit(1)
}
console.log('SMTP configuré :', conf.smtp_host, '· expéditeur', conf.smtp_admin_email,
  '· limite', conf.rate_limit_email_sent, 'emails/h')

// Envoi réel d'un lien magique de test.
const otp = await fetch(`${env.REACT_APP_SUPABASE_URL}/auth/v1/otp`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    apikey: env.REACT_APP_SUPABASE_ANON_KEY,
    Authorization: `Bearer ${env.REACT_APP_SUPABASE_ANON_KEY}`,
  },
  body: JSON.stringify({
    email: EMAIL_TEST,
    create_user: true,
    // Si le captcha Turnstile est actif sur GoTrue, ce test API échouera
    // (jeton impossible hors navigateur) : tester alors depuis /dossier.
    options: { email_redirect_to: 'https://www.inspexo.io/dossier' },
  }),
})
const corps = await otp.text()
console.log(otp.ok
  ? `Lien magique envoyé à ${EMAIL_TEST} via Resend — vérifiez la boîte (et le dashboard Resend).`
  : `Échec de l'envoi de test : ${otp.status} ${corps.slice(0, 250)}`)
process.exit(otp.ok ? 0 : 1)
