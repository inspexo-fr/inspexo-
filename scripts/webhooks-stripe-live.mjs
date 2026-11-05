#!/usr/bin/env node
// SPRINT 20.1 — Les DEUX endpoints de webhook Stripe LIVE, et rien d'autre.
//
// ⚠️ POURQUOI UN SCRIPT DÉDIÉ plutôt que `configurer-stripe-pass.mjs`. Celui-ci
// fait plus que ce qu'on demande ici : il repose `STRIPE_SECRET_KEY` et
// `PASS_MODE`, et il poserait `MEDIATEUR_NOM` s'il le trouvait — c'est-à-dire
// qu'il OUVRIRAIT LA VENTE. La consigne du 5 nov. 2026 est explicite :
// « crée les deux endpoints, pose les deux secrets, n'ouvre aucune vente ».
// Ce script ne fait que ça, et ne peut rien faire d'autre.
//
// ⚠️ CE QUE L'AUDIT A TROUVÉ, et qui rend ce script nécessaire :
//   · la clé Stripe posée en production est une clé LIVE ;
//   · PASS_WEBHOOK_SECRET et INSPECTION_WEBHOOK_SECRET sont ABSENTS ;
//   · un endpoint live subsiste vers `stripe-webhook`, fonction retirée en 410
//     au sprint 8 : Stripe lui livre des événements qui échouent tous.
// Or l'activation d'un Pass passe UNIQUEMENT par le webhook. Ouvrir la vente
// dans cet état, c'est encaisser sans délivrer.
//
// ⚠️ LA CLÉ NE PEUT PAS ÊTRE LUE DEPUIS LE POSTE : l'API de gestion Supabase
// ne rend qu'un condensé de ses secrets, jamais leur valeur. Elle doit donc
// être fournie dans .env.local (jamais commité) le temps de ce script.
//
// Usage :
//   node scripts/webhooks-stripe-live.mjs --verifier     # aucune clé requise
//   node scripts/webhooks-stripe-live.mjs                # crée ce qui manque
//   node scripts/webhooks-stripe-live.mjs --supprimer-orphelin

import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const PROJECT_REF = 'pspsqtokhqmotzkyqnkj'
const BASE = `https://${PROJECT_REF}.supabase.co/functions/v1`

// Les événements sont ceux que le CODE traite. Toute divergence serait soit un
// événement livré que personne ne lit, soit un événement attendu qui n'arrive
// jamais — le second se découvre quand un paiement reste sans effet.
const ENDPOINTS = [
  {
    cle: 'PASS_WEBHOOK_SECRET',
    url: `${BASE}/pass-webhook`,
    description: 'Inspexo — Pass achat',
    events: ['checkout.session.completed', 'charge.refunded'],
    fonction: 'pass-webhook',
  },
  {
    cle: 'INSPECTION_WEBHOOK_SECRET',
    url: `${BASE}/inspection-webhook`,
    description: 'Inspexo — Inspection et visio',
    events: [
      'checkout.session.completed',
      'charge.refunded',
      'charge.dispute.created',
      'charge.dispute.funds_withdrawn',
      'account.updated',
    ],
    fonction: 'inspection-webhook',
  },
]

const args = process.argv.slice(2)
const VERIFIER = args.includes('--verifier')
const SUPPRIMER_ORPHELIN = args.includes('--supprimer-orphelin')

const env = {}
for (const ligne of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = ligne.match(/^([A-Z0-9_]+)="?([^"\n]*)"?$/)
  if (m) env[m[1]] = m[2].trim()
}

// ── Mode vérification : passe par la fonction `ops`, aucune clé nécessaire ──
if (VERIFIER) {
  const url = env.REACT_APP_SUPABASE_URL
  const anon = env.REACT_APP_SUPABASE_ANON_KEY
  const secret = env.EVAL_BYPASS_SECRET
  if (!url || !anon || !secret) {
    console.error('✗ REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY et EVAL_BYPASS_SECRET requis.')
    process.exit(1)
  }
  const r = await fetch(`${url}/functions/v1/ops?webhooks=1`, {
    headers: { Authorization: `Bearer ${anon}`, 'x-eval-secret': secret },
  })
  const j = await r.json().catch(() => null)
  const liste = j?.webhooks
  if (!Array.isArray(liste)) {
    console.error('✗ lecture impossible :', JSON.stringify(j).slice(0, 200))
    process.exit(1)
  }
  console.log(`État des endpoints Stripe déclarés sur la clé posée (${liste.length}) :\n`)
  for (const e of liste) {
    const attendu = ENDPOINTS.find((x) => e.url === x.url)
    const marque = attendu ? '✓' : '⚠️'
    console.log(`  ${marque} ${e.url}`)
    console.log(`     ${e.status} · live=${e.livemode} · ${e.enabled_events.join(', ')}`)
    if (attendu) {
      const manquants = attendu.events.filter((ev) => !e.enabled_events.includes(ev) && !e.enabled_events.includes('*'))
      if (manquants.length) console.log(`     ⚠️ événements MANQUANTS : ${manquants.join(', ')}`)
    } else {
      console.log('     ⚠️ endpoint INCONNU de ce script — vers une fonction retirée ?')
    }
  }
  for (const att of ENDPOINTS) {
    if (!liste.some((e) => e.url === att.url)) {
      console.log(`\n  ✗ ABSENT : ${att.url}`)
      console.log(`     ⇒ ${att.cle} ne peut pas exister, donc ${att.fonction} rejettera toute livraison.`)
    }
  }
  console.log('\n⚠️ Stripe ne donne le secret de signature QU\'À LA CRÉATION d\'un endpoint.')
  console.log('   Un endpoint présent dont le secret est perdu doit être SUPPRIMÉ puis recréé.')
  process.exit(0)
}

// ── Création : exige la clé live ────────────────────────────────────────────
const SK = env.STRIPE_SECRET_KEY
if (!SK) {
  console.error('✗ STRIPE_SECRET_KEY absente de .env.local.')
  console.error('')
  console.error('  Elle ne peut PAS être relue depuis la production : l’API de gestion')
  console.error('  Supabase ne rend qu’un condensé de ses secrets. Collez la clé live')
  console.error('  (Stripe → Développeurs → Clés API) dans .env.local, le temps de ce')
  console.error('  script, puis retirez-la. .env.local n’est jamais commité.')
  console.error('')
  console.error('  Pour voir l’état sans clé : node scripts/webhooks-stripe-live.mjs --verifier')
  process.exit(1)
}
// ⚠️ Ce script crée des endpoints LIVE. Une clé de test produirait des
// endpoints de test dont les secrets seraient posés sous les MÊMES noms, et la
// production se retrouverait avec des secrets qui ne valident rien.
if (!SK.startsWith('sk_live_')) {
  console.error(`✗ la clé fournie n’est pas une clé LIVE (préfixe « ${SK.slice(0, 8)} »).`)
  console.error('  Ce script ne crée que des endpoints live, parce que les secrets qu’il')
  console.error('  pose sont ceux de la production. Pour les endpoints de test, utilisez')
  console.error('  scripts/configurer-stripe-pass.mjs avec une clé sk_test.')
  process.exit(1)
}

async function stripe(chemin, params, methode) {
  const r = await fetch(`https://api.stripe.com/v1/${chemin}`, {
    method: methode ?? (params ? 'POST' : 'GET'),
    headers: {
      Authorization: `Bearer ${SK}`,
      ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    ...(params ? { body: params.toString() } : {}),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(`Stripe ${r.status} : ${j?.error?.message ?? JSON.stringify(j).slice(0, 160)}`)
  return j
}

const existants = (await stripe('webhook_endpoints?limit=100')).data ?? []
console.log(`${existants.length} endpoint(s) déjà déclaré(s).\n`)

// ── L'orphelin : un endpoint vers une fonction retirée ──────────────────────
const connus = new Set(ENDPOINTS.map((e) => e.url))
const orphelins = existants.filter((e) => !connus.has(e.url))
for (const o of orphelins) {
  console.log(`⚠️ ORPHELIN : ${o.url}`)
  console.log(`   ${o.status} · ${o.enabled_events.join(', ')}`)
  if (/stripe-webhook|create-transfer|create-connect-account/.test(o.url)) {
    console.log('   Cette fonction a été RETIRÉE (410) au sprint 8 : Stripe lui livre des')
    console.log('   événements qui échouent tous, et finira par désactiver l’endpoint.')
  }
  if (SUPPRIMER_ORPHELIN) {
    await stripe(`webhook_endpoints/${o.id}`, null, 'DELETE')
    console.log('   → SUPPRIMÉ.')
  } else {
    console.log('   → conservé. Pour le supprimer : --supprimer-orphelin')
  }
}

// ── Les deux endpoints attendus ─────────────────────────────────────────────
const aPoser = []
for (const att of ENDPOINTS) {
  const deja = existants.find((e) => e.url === att.url)
  if (deja) {
    // ⚠️ Un endpoint existant ne redonnera JAMAIS son secret. On ne le
    // supprime pas de notre propre initiative : supprimer puis recréer est une
    // décision, pas une réparation automatique.
    console.log(`\n⚠️ ${att.fonction} : endpoint DÉJÀ présent (${deja.id}).`)
    console.log('   Stripe ne redonne pas son secret de signature. Si le secret est perdu')
    console.log(`   (c'est le cas : ${att.cle} est absent côté Supabase), il faut SUPPRIMER`)
    console.log('   cet endpoint dans le tableau de bord Stripe puis relancer ce script.')
    const manquants = att.events.filter((ev) => !deja.enabled_events.includes(ev) && !deja.enabled_events.includes('*'))
    if (manquants.length) console.log(`   ⚠️ il lui manque aussi : ${manquants.join(', ')}`)
    continue
  }
  const params = new URLSearchParams({ url: att.url, description: att.description })
  att.events.forEach((ev, i) => params.append(`enabled_events[${i}]`, ev))
  const cree = await stripe('webhook_endpoints', params)
  if (!cree.secret) throw new Error(`endpoint créé sans secret pour ${att.fonction} — ne rien poser`)
  console.log(`\n✓ ${att.fonction} : endpoint créé (${cree.id})`)
  console.log(`  événements : ${att.events.join(', ')}`)
  aPoser.push(`${att.cle}=${cree.secret}`)
}

// ── Pose des secrets, et RIEN D'AUTRE ───────────────────────────────────────
if (aPoser.length === 0) {
  console.log('\nAucun secret à poser.')
} else {
  // ⚠️ Deux secrets, nommément. Ni MEDIATEUR_NOM, ni PASS_MODE, ni la clé
  // Stripe : la vente doit rester fermée, et c'est `MEDIATEUR_NOM` qui
  // l'ouvre. Le relevé ci-dessous le redit à l'écran.
  execSync(`npx supabase secrets set ${aPoser.map((s) => `'${s}'`).join(' ')} --project-ref ${PROJECT_REF}`, {
    stdio: 'inherit',
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: execSync('security find-generic-password -s "Supabase CLI" -w').toString().trim() },
  })
  console.log(`\n✓ ${aPoser.length} secret(s) posé(s) : ${aPoser.map((s) => s.split('=')[0]).join(', ')}`)
}

console.log('\n⚠️ AUCUNE VENTE N’A ÉTÉ OUVERTE.')
console.log('   MEDIATEUR_NOM n’est pas posé, donc /pass reste en « bientôt » et')
console.log('   inspection-checkout rend `ouvert: false`. À vérifier :')
console.log(`     curl -s ${BASE}/pass-checkout -H "Authorization: Bearer <anon>"`)
console.log('   Et retirez maintenant STRIPE_SECRET_KEY de .env.local.')
