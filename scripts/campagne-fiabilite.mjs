#!/usr/bin/env node
// CAMPAGNE DE FIABILITÉ — rejoue des annonces RÉELLES avec la version
// actuelle, puis passe la vérification indépendante sur chaque résultat.
//
// Cahier de collecte, panier proposé et budget : docs/campagne-fiabilite.md
//
// ⚠️ POURQUOI PAS LE SECRET D'ÉVAL. `score` pose `is_eval = true` dès que
// l'en-tête `x-eval-secret` est présent, et `get_fiabilite` joint sur
// `is_eval = false` : une campagne lancée par ce chemin dépenserait et
// n'apparaîtrait JAMAIS sur /fiabilite. On passe donc par le jeton d'un
// ADMIN (`adminIllimite`, sprint 15), qui lève le plafond de 5 analyses/24 h
// sans flaguer l'analyse.
//
// ⚠️ CE SCRIPT DÉPENSE. Compteur dans `.campagne-cout.json`, mur du run via
// `scripts/budget.mjs` — qui RÉSERVE le coût de l'unité suivante, donc
// s'arrête AVANT de dépasser et jamais après.
//
// Usage :
//   node scripts/campagne-fiabilite.mjs --etat              # ne dépense RIEN
//   node scripts/campagne-fiabilite.mjs --budget 7
//   node scripts/campagne-fiabilite.mjs --budget 7 --sans-relance
//   node scripts/campagne-fiabilite.mjs --plafond 10 --reset-cout

import { execSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { coutProchainCas, murAtteint } from './budget.mjs'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const COUT_FICHIER = join(RACINE, '.campagne-cout.json')
const PROJECT_REF = 'pspsqtokhqmotzkyqnkj'

// Coûts MESURÉS le 5 nov. 2026 sur les analyses réelles de la base
// (tarifs Sonnet 5 : 3 $/M entrée, 15 $/M sortie, 0,30 $/M lecture de cache).
// Servent à l'estimation et à la réserve du mur, jamais à alimenter le
// compteur : celui-ci ne reçoit que du coût réellement constaté.
const COUT_ANALYSE_ESTIME_EUR = 0.106
const COUT_VERIF_ESTIME_EUR = 0.05
const COUT_UNITE_ESTIME_EUR = COUT_ANALYSE_ESTIME_EUR + COUT_VERIF_ESTIME_EUR

// ── Les 13 annonces réelles déjà en base, à rejouer ─────────────────────────
// Empreintes des 8 premiers caractères de md5(input_text). La liste est
// ÉCRITE, pas re-dérivée : c'est la sélection validée par Utku le 5 nov. 2026,
// et une re-dérivation pourrait la changer en silence au fil des analyses.
// Les doublons de véhicule ont déjà été retirés (même prix, même kilométrage,
// vérifié texte par texte) : une seule des deux Clio IV à 8 990 €, et la S7 à
// 159 000 km comptée une fois.
const A_REJOUER = [
  { h: '6f4d1b44', quoi: 'BMW 320d F30 2012 · 142 000 km · 11 900 €' },
  { h: '0d7b7e03', quoi: 'Audi S7 2015 · 89 000 km · 34 900 € dépôt-vente' },
  { h: '1a89f989', quoi: 'Peugeot 308 PureTech 130 2017' },
  { h: 'dc27dfdd', quoi: 'Renault Clio IV dCi 90 Intens 2016' },
  { h: '3beddb4b', quoi: 'Peugeot 308 PureTech 110 · 9 000 €' },
  { h: 'df412762', quoi: 'Renault Clio IV dCi 90 2016 · 121 000 km' },
  { h: 'eba2bf6f', quoi: 'Renault Clio IV dCi 90 Business 2017' },
  { h: '46bba488', quoi: 'Peugeot 308 PureTech 130 2020 · 78 500 km' },
  { h: '0a9a339d', quoi: 'Peugeot 3008 Hybrid 136 e-DCS6 GT 2025' },
  // Réelles AUSSI, et ce sont les textes dont les cas d'éval ont été tirés :
  // leur résultat sert donc deux fois. On rejoue l'annonce telle qu'elle a été
  // capturée, pas le fichier de fixture.
  { h: 'f8cb8a87', quoi: 'Audi S7 2015 · 159 000 km (cas audi-s7-intermediaire)' },
  { h: '9ea5c96d', quoi: 'Audi A3 Sline+ 2019 · 19 000 € (cas audi-a3-35tdi)' },
  { h: '483a24b7', quoi: 'Mercedes Classe C 2025 · 41 490 € (cas mercedes-2025-societe)' },
  { h: 'cf80299f', quoi: 'Peugeot 308 PureTech 110 2016 (cas 308-puretech-complete)' },
]

// ── Arguments ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const flag = (nom, defaut = null) => {
  const i = args.indexOf(`--${nom}`)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : defaut
}
const ETAT = args.includes('--etat')
const SANS_RELANCE = args.includes('--sans-relance')
const DOSSIER = join(RACINE, flag('dossier', 'tests/fiabilite/annonces'))
const BUDGET_RUN_EUR = (() => { const v = Number(flag('budget', '')); return Number.isFinite(v) && v > 0 ? v : null })()
const PLAFOND_EUR = Number(flag('plafond', '10'))

if (args.includes('--reset-cout') && existsSync(COUT_FICHIER)) rmSync(COUT_FICHIER)

// ── Configuration ───────────────────────────────────────────────────────────
const env = {}
for (const ligne of readFileSync(join(RACINE, '.env.local'), 'utf8').split('\n')) {
  const m = ligne.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const URL_BASE = env.REACT_APP_SUPABASE_URL
const ANON = env.REACT_APP_SUPABASE_ANON_KEY
const JETON_ADMIN = env.ADMIN_ACCESS_TOKEN || null
if (!URL_BASE || !ANON) {
  console.error('✗ REACT_APP_SUPABASE_URL et REACT_APP_SUPABASE_ANON_KEY requis dans .env.local')
  process.exit(1)
}

// ── Lecture SEULE de la prod (API de gestion) ───────────────────────────────
// Sert à deux choses et deux seules : retrouver le texte des annonces à
// rejouer, et lire le coût RÉEL de chaque analyse dans son event `score_done`.
// ⚠️ Chaque requête est précédée de `set default_transaction_read_only = on` :
// une écriture échouerait au lieu de passer.
let jetonGestion = null
const gestionDisponible = () => {
  if (jetonGestion !== null) return jetonGestion !== ''
  try {
    jetonGestion = execSync('security find-generic-password -s "Supabase CLI" -w', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch { jetonGestion = '' }
  return jetonGestion !== ''
}
async function sql(query) {
  if (!gestionDisponible()) throw new Error('jeton de l’API de gestion absent du trousseau')
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jetonGestion}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `set default_transaction_read_only = on;\n${query}` }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(`SQL ${r.status} : ${JSON.stringify(j).slice(0, 200)}`)
  return j
}

const appel = (chemin, body, { admin = true } = {}) =>
  fetch(`${URL_BASE}/functions/v1/${chemin}`, {
    method: 'POST',
    headers: {
      // ⚠️ Le jeton de l'ADMIN, jamais le secret d'éval : c'est lui qui fait
      // que l'analyse reste `is_eval = false`, donc comptée par /fiabilite.
      Authorization: `Bearer ${admin && JETON_ADMIN ? JETON_ADMIN : ANON}`,
      apikey: ANON,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

// ── Compteur et mur ─────────────────────────────────────────────────────────
let cout = existsSync(COUT_FICHIER) ? (JSON.parse(readFileSync(COUT_FICHIER, 'utf8')).total_eur ?? 0) : 0
const coutDepart = cout
let unitesFaites = 0
const coutDuRun = () => cout - coutDepart
const murDuRun = () => murAtteint({
  coutRun: coutDuRun(), casJoues: unitesFaites, coutSession: cout,
  budgetRun: BUDGET_RUN_EUR, plafondSession: PLAFOND_EUR, estime: COUT_UNITE_ESTIME_EUR,
})
const motifArret = () =>
  murDuRun() === 'run'
    ? `budget annoncé atteint (${coutDuRun().toFixed(3)} € dépensés, ` +
      `${coutProchainCas(coutDuRun(), unitesFaites, COUT_UNITE_ESTIME_EUR).toFixed(3)} € à réserver, ` +
      `mur à ${BUDGET_RUN_EUR.toFixed(2)} €)`
    : `plafond cumulé atteint (${cout.toFixed(2)} € + réserve > ${PLAFOND_EUR} €)`
const ajouter = (eur) => {
  cout += eur || 0
  writeFileSync(COUT_FICHIER, JSON.stringify({ total_eur: Math.round(cout * 10000) / 10000, maj: new Date().toISOString() }, null, 2))
}

// ── Inventaire ──────────────────────────────────────────────────────────────
const nouvelles = existsSync(DOSSIER)
  ? readdirSync(DOSSIER).filter((f) => f.endsWith('.txt')).sort()
      .map((f) => ({ nom: f, texte: readFileSync(join(DOSSIER, f), 'utf8').trim() }))
      .filter((a) => a.texte.length >= 40)
  : []

const unites = [
  ...(SANS_RELANCE ? [] : A_REJOUER.map((r) => ({ type: 'relance', ...r }))),
  ...nouvelles.map((a) => ({ type: 'nouvelle', nom: a.nom, texte: a.texte, quoi: a.nom })),
]

// ── État : ne dépense rien ──────────────────────────────────────────────────
async function compteVerifiees() {
  const r = await fetch(`${URL_BASE}/rest/v1/rpc/get_fiabilite`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ANON}`, apikey: ANON, 'Content-Type': 'application/json' },
    body: '{}',
  })
  const j = await r.json().catch(() => null)
  return j && typeof j === 'object' ? j : null
}

if (ETAT) {
  console.log('État de la campagne — AUCUN appel payant n’est fait.\n')
  console.log(`  ${'Annonces à rejouer (déjà en base)'.padEnd(44)} ${SANS_RELANCE ? '0 (--sans-relance)' : A_REJOUER.length}`)
  console.log(`  ${'Annonces nouvelles déposées'.padEnd(44)} ${nouvelles.length}`)
  for (const a of nouvelles) console.log(`      · ${a.nom} (${a.texte.length} car.)`)
  if (nouvelles.length === 0) console.log(`      (déposer des .txt dans ${DOSSIER.replace(RACINE + '/', '')})`)
  const total = unites.length
  console.log(`  ${'Total d’unités'.padEnd(44)} ${total}`)
  console.log(`  ${'Coût estimé (0,106 € analyse + 0,05 € vérif.)'.padEnd(44)} ${(total * COUT_UNITE_ESTIME_EUR).toFixed(2)} €`)
  console.log(`  ${'Déjà dépensé (compteur de campagne)'.padEnd(44)} ${cout.toFixed(2)} €`)
  console.log(`  ${'Mur du run'.padEnd(44)} ${BUDGET_RUN_EUR ? BUDGET_RUN_EUR.toFixed(2) + ' €' : 'non annoncé (--budget)'}`)
  console.log(`  ${'Jeton admin dans .env.local'.padEnd(44)} ${JETON_ADMIN ? 'présent' : '✗ ABSENT'}`)
  const f = await compteVerifiees()
  if (f) {
    console.log(`\n  /fiabilite : ${f.analyses_verifiees ?? 0} analyses vérifiées sur ${f.seuil ?? 30} — publié : ${f.publie ? 'oui' : 'non'}`)
    const manque = Math.max(0, (f.seuil ?? 30) - (f.analyses_verifiees ?? 0))
    if (manque > 0) console.log(`  Il manque ${manque} analyse(s) vérifiée(s) pour que la page publie un taux.`)
  }
  if (!JETON_ADMIN) {
    console.log('\n⚠️ Sans ADMIN_ACCESS_TOKEN, les analyses partiraient en anonyme : plafond de')
    console.log('   5 analyses / 24 h, et la campagne s’arrêterait au sixième texte.')
    console.log('   Procédure : docs/campagne-fiabilite.md, section « Le jeton admin ».')
  }
  process.exit(0)
}

// ── Garde-fous avant de dépenser ────────────────────────────────────────────
if (!JETON_ADMIN) {
  console.error('✗ ADMIN_ACCESS_TOKEN absent de .env.local.')
  console.error('  Sans lui, soit les analyses sont flaguées `is_eval` (secret d’éval) et')
  console.error('  /fiabilite ne les comptera jamais, soit elles partent en anonyme et le')
  console.error('  plafond de 5 / 24 h arrête tout au sixième texte.')
  console.error('  Procédure : docs/campagne-fiabilite.md, section « Le jeton admin ».')
  process.exit(1)
}
if (BUDGET_RUN_EUR == null) {
  console.error('✗ --budget <eur> est obligatoire : le mur de CE run doit être annoncé avant de dépenser.')
  process.exit(1)
}
if (unites.length === 0) {
  console.error('✗ Rien à jouer. Déposer des annonces, ou retirer --sans-relance.')
  process.exit(1)
}

// ── Résolution des textes à rejouer ─────────────────────────────────────────
// ⚠️ Une empreinte qui ne résout plus ARRÊTE le run : la sélection validée ne
// se joue pas « à peu près ». Mieux vaut échouer bruyamment que mesurer autre
// chose que ce qui a été annoncé.
if (!SANS_RELANCE) {
  const liste = A_REJOUER.map((r) => `'${r.h}'`).join(',')
  const lignes = await sql(
    `select distinct on (left(md5(input_text),8)) left(md5(input_text),8) h, input_text, id
       from public.analyses
      where not is_eval and left(md5(input_text),8) in (${liste})
      order by left(md5(input_text),8), created_at desc`,
  )
  const parH = new Map(lignes.map((l) => [l.h, l]))
  const absentes = A_REJOUER.filter((r) => !parH.has(r.h))
  if (absentes.length > 0) {
    console.error(`✗ ${absentes.length} annonce(s) de la sélection introuvable(s) en base : ${absentes.map((a) => a.h).join(', ')}`)
    console.error('  La sélection validée le 5 nov. 2026 ne correspond plus à la base. Arrêt.')
    process.exit(1)
  }
  for (const u of unites) if (u.type === 'relance') u.texte = parH.get(u.h).input_text
}

/** Coût RÉEL de l'analyse, lu dans son event `score_done`. */
async function coutAnalyse(id) {
  try {
    const r = await sql(
      `select coalesce((select sum(
            coalesce((v->>'input_tokens')::numeric,0)*3e-6
          + coalesce((v->>'output_tokens')::numeric,0)*15e-6
          + coalesce((v->>'cache_read_input_tokens')::numeric,0)*0.3e-6
          + coalesce((v->>'cache_creation_input_tokens')::numeric,0)*3.75e-6)
        from jsonb_each(e.props_json->'calls') t(k,v) where v <> 'null'::jsonb), 0) * 0.92 as eur
       from public.events e
      where e.name = 'score_done' and e.analysis_id = '${id}'
      order by e.created_at desc limit 1`,
    )
    const eur = Number(r?.[0]?.eur)
    return Number.isFinite(eur) ? eur : null
  } catch { return null }
}

// ── Exécution ───────────────────────────────────────────────────────────────
console.log(`Campagne de fiabilité — ${unites.length} unité(s), mur à ${BUDGET_RUN_EUR.toFixed(2)} €.\n`)
const journal = []
let i = 0
for (const u of unites) {
  if (murDuRun()) {
    console.log(`\n⏸ ${motifArret()}.`)
    const reste = unites.slice(i)
    console.log(`   ${reste.length} unité(s) NON jouée(s) : ${reste.map((r) => r.quoi).join(' · ')}`)
    console.log('   Continuer est une décision explicite : relancer avec --budget plus haut.')
    break
  }
  i++
  process.stdout.write(`▶ ${String(i).padStart(2)}/${unites.length} ${u.quoi.slice(0, 54).padEnd(54)} `)

  // 1. analyse — version actuellement déployée, sans no_cache (réservé à l'éval)
  const res = await appel('score', { texte: u.texte })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.id) {
    console.log(`ANALYSE ÉCHOUÉE (${res.status}) ${String(json?.message ?? json?.error ?? '').slice(0, 70)}`)
    journal.push({ ...u, etat: 'analyse_echouee', code: res.status })
    if (res.status === 401) {
      console.error('\n✗ 401 : le jeton admin a expiré (une heure). Le reprendre et relancer —')
      console.error('  les analyses déjà faites ne seront pas refaites, le cache 7 jours les resservira.')
      break
    }
    continue
  }
  const cache = json.cache === true
  const eurAnalyse = cache ? 0 : await coutAnalyse(json.id)
  if (eurAnalyse == null) {
    console.log('COÛT ILLISIBLE — arrêt')
    console.error('\n✗ Impossible de lire le coût réel de l’analyse dans son event `score_done`.')
    console.error('  Le mur budgétaire serait alimenté par une estimation, donc il dériverait.')
    console.error('  Vérifier le jeton de l’API de gestion (trousseau « Supabase CLI »).')
    journal.push({ ...u, etat: 'cout_illisible', id: json.id })
    break
  }
  ajouter(eurAnalyse)

  // 2. vérification indépendante
  // ⚠️ La fonction `verification` refuse d'elle-même une analyse `is_eval`
  // (409 `analyse_eval`), AVANT de dépenser : c'est elle qui fait autorité,
  // et c'est le bon endroit — un garde-fou qui vit dans un script est un
  // garde-fou qu'on peut contourner en n'utilisant pas le script.
  //
  // ⚠️ Pas de pré-contrôle ici : la réponse de `score` ne porte PAS `is_eval`
  // (vérifié). Un `if (json.result?.is_eval)` n'aurait jamais été vrai — un
  // contrôle qui ne se déclenche jamais ressemble à un contrôle qui passe.
  // On traite donc le refus de la fonction, qui lui est réel.
  const resV = await appel('verification', { analysis_id: json.id })
  const v = await resV.json().catch(() => null)
  if (resV.status === 409 && v?.error === 'analyse_eval') {
    console.log('IGNORÉE — analyse marquée is_eval, elle ne compterait jamais')
    journal.push({ ...u, etat: 'is_eval', id: json.id, eur: eurAnalyse })
    unitesFaites++
    continue
  }
  if (!resV.ok || !v) {
    console.log(`verif ÉCHOUÉE (${resV.status}) ${String(v?.message ?? '').slice(0, 60)}`)
    journal.push({ ...u, etat: 'verif_echouee', id: json.id, eur: eurAnalyse })
    unitesFaites++
    continue
  }
  ajouter(v.cout_eur ?? 0)
  unitesFaites++
  const total = eurAnalyse + (v.cout_eur ?? 0)
  journal.push({
    ...u, etat: 'ok', id: json.id, verdict: json.result?.verdict, score: json.result?.score,
    cache, affirmations: v.affirmations ?? 0, soutenues: v.soutenues ?? 0,
    non_soutenues: v.non_soutenues ?? 0, mauvais_moteur: v.mauvais_moteur ?? 0,
    sans_source: v.sans_source ?? 0, injoignables: v.injoignables ?? 0, eur: total,
  })
  console.log(
    `${String(json.result?.verdict ?? '?').padEnd(6)} ${String(json.result?.score ?? '?').padStart(3)} · ` +
    `${v.affirmations ?? 0} aff. (${v.soutenues ?? 0}✓ ${v.non_soutenues ?? 0}✗ ${v.mauvais_moteur ?? 0}⚠ ` +
    `${v.sans_source ?? 0}∅ ${v.injoignables ?? 0}⊘) · ${total.toFixed(4)} €${cache ? ' [cache]' : ''}`,
  )
}

// ── Bilan ───────────────────────────────────────────────────────────────────
const ok = journal.filter((j) => j.etat === 'ok')
const avecAff = ok.filter((j) => j.affirmations > 0)
console.log(`\n${ok.length} analyse(s) rejouée(s) et vérifiée(s), dont ${avecAff.length} portant au moins une affirmation.`)
if (ok.length > avecAff.length) {
  console.log(`⚠️ ${ok.length - avecAff.length} analyse(s) sans aucune affirmation vérifiable : elles ne comptent`)
  console.log('   PAS dans le seuil de 30 de /fiabilite (aucune ligne n’est écrite dans `verifications`).')
}
const somme = (k) => avecAff.reduce((s, j) => s + (j[k] ?? 0), 0)
const verifiables = somme('soutenues') + somme('non_soutenues') + somme('mauvais_moteur')
if (verifiables > 0) {
  const fautes = somme('non_soutenues') + somme('mauvais_moteur')
  console.log(`Affirmations : ${somme('affirmations')} extraites · ${verifiables} vérifiables · ` +
    `${fautes} non soutenue(s) ou mauvais moteur → ${(100 * fautes / verifiables).toFixed(1)} % brut`)
  console.log(`Écartées du dénominateur : ${somme('sans_source')} sans source publique, ${somme('injoignables')} page(s) illisible(s).`)
  console.log('⚠️ Taux BRUT, sans son intervalle : /fiabilite publie l’intervalle de Wilson, pas ce chiffre.')
}
const echecs = journal.filter((j) => j.etat !== 'ok')
if (echecs.length > 0) console.log(`\n${echecs.length} unité(s) en échec : ${echecs.map((e) => `${e.quoi} (${e.etat})`).join(' · ')}`)
const evals = journal.filter((j) => j.etat === 'is_eval')
if (evals.length > 0) {
  console.log(`⚠️ ${evals.length} analyse(s) marquée(s) is_eval et donc ignorée(s) : la campagne a bien`)
  console.log('   tourné avec le jeton admin ? Sans lui, rien ne comptera pour /fiabilite.')
}
console.log(`\n— Coût de ce run : ${coutDuRun().toFixed(4)} € · cumul campagne : ${cout.toFixed(2)} € / mur ${BUDGET_RUN_EUR.toFixed(2)} € / plafond ${PLAFOND_EUR} €`)
const f = await compteVerifiees()
if (f) {
  const manque = Math.max(0, (f.seuil ?? 30) - (f.analyses_verifiees ?? 0))
  console.log(`— /fiabilite : ${f.analyses_verifiees ?? 0}/${f.seuil ?? 30} analyses vérifiées, publié : ${f.publie ? 'OUI' : 'non'}` +
    (manque > 0 ? ` — il manque ${manque} annonce(s) réelle(s) distincte(s).` : ''))
}
