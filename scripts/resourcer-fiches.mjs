#!/usr/bin/env node
// CAMPAGNE DE RE-SOURCING DES FICHES MOTEUR À TERRE (sprint 21.1, 6 nov. 2026)
//
// Depuis le sprint 21.1, une panne ne pèse sur le score que si au moins une de
// ses sources est OFFICIELLE, de PRESSE ou ÉDITORIALE. L'audit en lecture
// seule a montré que 20 fiches sur 44 n'en ont aucune : toutes leurs pannes
// deviennent des questions au vendeur. Cette campagne cherche, pour chacune de
// ces pannes, une source qui la porte.
//
// ⚠️ ELLE N'EST QUE ADDITIVE, ET C'EST VOULU. Elle ne supprime aucune panne :
// une panne qui ne trouve pas de source reste dans la fiche et continue d'être
// affichée comme une question. C'est le barème, à l'analyse, qui décide de son
// poids — pas cette campagne. Rien à supprimer, donc rien à casser.
//
// Chaque panne passe par la fonction `atlas-builder`, dont le pipeline fait
// déjà exactement ce qu'il faut :
//   1. recherche web contrainte aux sources retenues (NHTSA et RappelConso
//      d'abord) ;
//   2. page RÉCUPÉRÉE — une page illisible est écartée avant de devenir une
//      source (c'est l'ordre qui porte la règle du 6 nov. 2026) ;
//   3. filtre de RANG avant toute dépense : si aucune page proposée n'est de
//      rang portant, la panne est abandonnée sans un seul appel payant ;
//   4. vérification INDÉPENDANTE (le même juge que /fiabilite), qui n'a vu ni
//      la recherche ni ce que l'étape 1 a conclu.
//
// Usage :
//   node scripts/resourcer-fiches.mjs --estimer <fiches.json>     (0 €)
//   node scripts/resourcer-fiches.mjs <fiches.json> [--budget 9]
//   node scripts/resourcer-fiches.mjs <fiches.json> --fiche "Peugeot EP6"
//
// Le compteur cumulé vit dans `.resourcage-cout.json`. Le mur RÉSERVE le coût
// de la panne suivante : un mur qu'on franchit toujours d'une unité n'en est
// pas un (règle du 5 nov. 2026, module `scripts/budget.mjs`).

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { murAtteint } from './budget.mjs'

const { rangSource, sourcesPortentLEntree } =
  await import(new URL('../supabase/functions/_shared/atlasSource.ts', import.meta.url))

// ── Réglages ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const flag = (n, d = null) => { const i = args.indexOf(n); return i >= 0 ? (args[i + 1] ?? d) : d }
const a = (n) => args.includes(n)
const ESTIMER = a('--estimer')
const APPLIQUER = a('--appliquer')
const BUDGET = Number(flag('--budget', '9')) || 9
const PLAFOND_CUMUL = 15
const FICHE_UNE = flag('--fiche')
// ⚠️ LA CAMPAGNE SE JOUE PAR LOTS (décision d'Utku du 8 nov. 2026) : 20 pannes,
// mur de 4 € par lot, puis arrêt avec le RENDEMENT. Un lot qui rend moins de
// 15 % de pannes portées met fin à la campagne — on ne continue pas à payer un
// terrain qui ne donne rien.
const MAX_PANNES = Number(flag('--max-pannes', '0')) || 0
const SEUIL_RENDEMENT = 0.15
const FICHIER = args.find((x) => x.endsWith('.json')) ?? 'fiches.json'
const COMPTEUR = '.resourcage-cout.json'
const JOURNAL = 'docs/resourcage-fiches-journal.json'
const RAPPORT = 'docs/resourcage-fiches-resultats.json'

// Coût mesuré d'une unité. Avant la première, l'estimation prudente ci-dessous.
// Elle vient de la campagne atlas hors moteur du 5 nov. 2026 : 0,188 €/entrée
// en moyenne, recherche + vérifications comprises. Le filtre de rang posé
// AVANT la vérification devrait la faire baisser — on ne compte pas dessus.
const COUT_PANNE_ESTIME = 0.20

const env = {}
for (const l of (existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const URL_FN = `${env.REACT_APP_SUPABASE_URL ?? ''}/functions/v1/atlas-builder`
const ANON = env.REACT_APP_SUPABASE_ANON_KEY ?? ''
const EVAL_SECRET = env.EVAL_BYPASS_SECRET ?? ''

// ── Les unités de travail ───────────────────────────────────────────────────
// ⚠️ Le mode --appliquer ne lit QUE le journal : il n'a pas besoin du dump des
// fiches, et l'exiger ferait échouer la fusion pour un fichier absent du
// dépôt — alors qu'il n'a plus rien à y faire.
const fiches = (APPLIQUER && !existsSync(FICHIER)) ? [] : JSON.parse(readFileSync(FICHIER, 'utf8'))
const urlsDe = (p) => {
  const u = []
  for (const s of (p.sources ?? [])) if (s?.url) u.push(s.url)
  for (const s of (Array.isArray(p.url_source) ? p.url_source : [])) if (typeof s === 'string') u.push(s)
  return [...new Set(u)]
}

const unites = []
for (const f of fiches) {
  const pannes = Array.isArray(f.pannes) ? f.pannes : []
  // ⚠️ On ne re-source QUE les fiches dont AUCUNE panne ne tient. Une fiche qui
  // garde une panne portée n'est pas « à terre » : elle dit encore quelque
  // chose, et dépenser pour elle avant les autres serait mal ordonné.
  if (pannes.some((p) => sourcesPortentLEntree(urlsDe(p)))) continue
  const nom = `${f.marque} ${f.famille_moteur}`
  if (FICHE_UNE && nom.toLowerCase() !== FICHE_UNE.toLowerCase()) continue
  for (const p of pannes) {
    unites.push({
      fiche: nom, fiche_id: f.id, marque: f.marque, famille: f.famille_moteur,
      annees: `${f.annee_debut ?? ''}-${f.annee_fin ?? ''}`.replace(/^-|-$/g, ''),
      titre: p.titre, symptomes: p.symptomes ?? '', gravite: p.gravite ?? null,
      sources_actuelles: urlsDe(p).map((u) => ({ url: u, rang: rangSource(u) })),
    })
  }
}

// ⚠️ L'ORDRE EST UNE DÉCISION, PAS UN HASARD.
//
// 105 pannes à ≈ 0,20 € font ≈ 21 €, soit plus du double du mur de 9 €. Le mur
// s'arrêtera donc en route : ce qui est joué en premier est ce qui sera joué.
// L'ordre suit le PARC FRANÇAIS D'OCCASION, pas l'alphabet — une fiche Hyundai
// G3LC sauvée vaut moins qu'une fiche PureTech, qui est le moteur du cas de
// référence le plus joué du projet et l'un des plus vendus en France.
//
// Les quatre EB2* en tête : ce sont les 1.2 PureTech. Le 308 ne tient
// aujourd'hui que parce que sa courroie vient de l'ATLAS, pas de sa fiche.
const PRIORITE = [
  'Peugeot EB2DT', 'Peugeot EB2DTS', 'Peugeot EB2F', 'Peugeot EB2ADTS',
  'Peugeot EP6', 'Peugeot DV6', 'Peugeot DW12',
  'Renault H4M', 'Renault H4D',
  'Volkswagen EA288', 'Volkswagen CRBC',
  'BMW N47',
  'Toyota 2ZR-FXE',
  'Nissan MR16DDT', 'Nissan MR20DE',
  'Hyundai G3LC', 'Hyundai G4LD', 'Hyundai G4KD', 'Hyundai G4FD',
  'Volvo D4204T',
]
const rang = (n) => { const i = PRIORITE.indexOf(n); return i < 0 ? 999 : i }
unites.sort((x, y) => rang(x.fiche) - rang(y.fiche))

// ── Mode estimation : aucune dépense ────────────────────────────────────────
const parFiche = {}
for (const u of unites) parFiche[u.fiche] = (parFiche[u.fiche] ?? 0) + 1
if (ESTIMER) {
  console.log(`\nCAMPAGNE DE RE-SOURCING — estimation (aucune dépense)\n`)
  console.log(`  fiches à terre            : ${Object.keys(parFiche).length}`)
  console.log(`  pannes à re-sourcer       : ${unites.length}`)
  console.log(`  coût estimé par panne     : ${COUT_PANNE_ESTIME.toFixed(3)} € (mesuré sur la campagne atlas du 5 nov.)`)
  console.log(`  ATTENDU                   : ${(unites.length * COUT_PANNE_ESTIME).toFixed(2)} €`)
  console.log(`  mur de ce run             : ${BUDGET.toFixed(2)} €`)
  console.log(`\n  Dans l'ordre où elles seront jouées (parc français d'occasion) :`)
  let cum = 0, coupe = false
  for (const n of PRIORITE) {
    const c = parFiche[n]; if (!c) continue
    cum += c * COUT_PANNE_ESTIME
    const franchi = cum > BUDGET
    if (franchi && !coupe) { console.log(`    ─────── mur de ${BUDGET.toFixed(2)} € atteint ici ───────`); coupe = true }
    console.log(`    ${String(c).padStart(2)} panne(s)  ${n.padEnd(18)} cumul ${cum.toFixed(2)} €${franchi ? '   (non joué)' : ''}`)
  }
  console.log(`\n  ⚠️ Le mur s'arrêtera avant d'atteindre ${BUDGET.toFixed(2)} € et dira ce qui n'a pas été joué.`)
  process.exit(0)
}


// ── MODE --appliquer : écrire les sources trouvées dans les fiches ──────────
//
// ⚠️ IL EXIGE UN JETON ADMIN, et aucune authentification n'a été affaiblie
// pour lui. J'avais commencé par ouvrir ce chemin au secret d'éval ; le
// garde-fou de l'environnement l'a refusé, et il avait raison — affaiblir une
// authentification admin pour qu'un secret de test écrive en production n'est
// pas une décision d'outillage. Décision d'Utku du 8 nov. 2026 : un jeton de
// COURTE DURÉE, posé le temps de la fusion, retiré ensuite.
//
// ⚠️ L'écriture est purement ADDITIVE : elle fusionne des sources de rang
// portant dans des pannes qui EXISTENT DÉJÀ. Elle ne crée aucune panne, n'en
// supprime aucune, ne touche aucune gravité. Une panne absente du corps de la
// requête est une panne qu'on ne touche pas — réécrire la liste entière pour
// ajouter une URL donnerait à une opération additive le pouvoir de tout
// remplacer.
if (APPLIQUER) {
  const JETON = env.ADMIN_ACCESS_TOKEN ?? ''
  if (!JETON) {
    console.error(`\nIl manque ADMIN_ACCESS_TOKEN dans .env.local.\n`)
    console.error(`Comment l'obtenir (jeton d'une heure, à retirer après) :`)
    console.error(`  1. ouvrir https://www.inspexo.io/admin/audit`)
    console.error(`  2. demander le lien magique pour contact@inspexo.io, puis cliquer dessus`)
    console.error(`  3. dans la console du navigateur, sur www.inspexo.io :`)
    console.error(`     JSON.parse(localStorage.getItem('sb-pspsqtokhqmotzkyqnkj-auth-token')).access_token`)
    console.error(`  4. coller la valeur dans .env.local : ADMIN_ACCESS_TOKEN=eyJ...\n`)
    process.exit(1)
  }
  const lus = existsSync(JOURNAL) ? JSON.parse(readFileSync(JOURNAL, 'utf8')) : []
  const aEcrire = lus.filter((j) => j.porte && (j.sources_trouvees ?? []).length > 0)
  if (aEcrire.length === 0) {
    console.log('\nAucune source portante à écrire : le journal n\'en contient pas.')
    process.exit(0)
  }
  // Un appel par fiche : la fonction fusionne un lot de pannes à la fois.
  const parFicheId = {}
  for (const j of aEcrire) {
    parFicheId[j.fiche_id] = parFicheId[j.fiche_id] ?? { nom: j.fiche, ajouts: [] }
    parFicheId[j.fiche_id].ajouts.push({
      panne_titre: j.titre,
      sources: j.sources_trouvees.map((s) => ({ url: s.url, title: s.titre || null })),
    })
  }
  console.log(`\nFUSION — ${aEcrire.length} panne(s) sur ${Object.keys(parFicheId).length} fiche(s)\n`)
  let okN = 0, koN = 0
  for (const [id, f] of Object.entries(parFicheId)) {
    const res = await fetch(`${env.REACT_APP_SUPABASE_URL}/functions/v1/admin-defect-sheets`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${JETON}`,
        apikey: env.REACT_APP_SUPABASE_ANON_KEY ?? '',
      },
      body: JSON.stringify({ id, ajouter_sources: f.ajouts }),
    })
    const t = await res.text()
    if (res.ok) {
      const d = JSON.parse(t)
      okN += d.pannes_touchees ?? 0
      console.log(`  OK     ${f.nom.padEnd(20)} ${d.pannes_touchees} panne(s), ${d.sources_ajoutees} source(s)`)
    } else {
      koN++
      console.log(`  ÉCHEC  ${f.nom.padEnd(20)} HTTP ${res.status} — ${t.slice(0, 160)}`)
      if (res.status === 401) {
        console.error(`\n  ⚠️ Jeton refusé ou expiré (il ne vaut qu'une heure). Reprendre à l'étape 2.`)
        process.exit(1)
      }
    }
  }
  console.log(`\n  ${okN} panne(s) enrichie(s)${koN ? `, ${koN} fiche(s) en échec` : ''}.`)
  console.log(`\n  ⚠️ RETIRER MAINTENANT ADMIN_ACCESS_TOKEN de .env.local.`)
  process.exit(koN ? 1 : 0)
}

// ── La campagne ─────────────────────────────────────────────────────────────
if (!URL_FN.startsWith('http') || !ANON || !EVAL_SECRET) {
  console.error('Il manque REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY ou EVAL_BYPASS_SECRET dans .env.local.')
  process.exit(1)
}
let cumul = existsSync(COMPTEUR) ? (JSON.parse(readFileSync(COMPTEUR, 'utf8')).eur ?? 0) : 0
if (a('--reset-cout')) cumul = 0

// ⚠️ LA CAMPAGNE REPREND LÀ OÙ ELLE S'EST ARRÊTÉE.
//
// Une panne demande ≈ 90 s (recherche web, récupération des pages,
// vérification indépendante) : 50 pannes font plus d'une heure, et aucune
// invocation ne tient aussi longtemps. Sans reprise, chaque relance
// recommencerait par les pannes DÉJÀ PAYÉES — on paierait plusieurs fois le
// même travail, et le mur de 9 € n'achèterait qu'une fraction du terrain.
//
// Le journal est la mémoire : une panne qui y figure n'est pas rejouée. Le
// compteur de coût, lui, est cumulatif de son côté — les deux doivent
// repartir ensemble, sans quoi le mur s'appuierait sur un cumul faux.
const journalBrut = existsSync(JOURNAL) ? JSON.parse(readFileSync(JOURNAL, 'utf8')) : []

// ⚠️ UN APPEL QUI A ÉCHOUÉ N'EST PAS UNE PANNE JOUÉE.
//
// Première version de la reprise : elle sautait toute panne présente au
// journal. Or le run du 6 nov. 2026 a enregistré 56 pannes en
// « TimeoutError » — l'API a cessé de répondre à partir de la onzième — et
// chacune portait le libellé « retirée ». La reprise les aurait écartées
// DÉFINITIVEMENT, sans qu'aucune n'ait jamais été examinée, et le rapport
// aurait annoncé 70 pannes jouées pour 14 réelles.
//
// « L'appel a échoué » et « aucune source ne tient » sont deux choses que rien
// n'autorise à confondre : la première est un incident, la seconde est un
// résultat. Les lignes en échec sont donc PURGÉES du journal à la reprise, et
// leurs pannes rejouées.
const journal = journalBrut.filter((j) => !j.erreur)
const abandonnees = journalBrut.length - journal.length
const dejaJouees = new Set(journal.map((j) => `${j.fiche}|${j.titre}`))
let coutRun = 0, jouees = 0, nonJouees = 0, motifMur = null
let reprises = 0
let echecsDAffilee = 0
let finDeLot = false

console.log(`\nCAMPAGNE DE RE-SOURCING — ${unites.length} panne(s) sur ${Object.keys(parFiche).length} fiche(s)`)
if (journalBrut.length > 0) {
  console.log(`reprise : ${journal.length} panne(s) déjà jouée(s), non rejouée(s)` +
    (abandonnees ? ` · ${abandonnees} appel(s) en échec REMIS en file` : ''))
}
console.log(`mur de ce run : ${BUDGET.toFixed(2)} €  ·  cumul déjà dépensé : ${cumul.toFixed(2)} € / ${PLAFOND_CUMUL} €\n`)

for (const u of unites) {
  if (dejaJouees.has(`${u.fiche}|${u.titre}`)) { reprises++; continue }
  if (MAX_PANNES > 0 && jouees >= MAX_PANNES) { finDeLot = true; break }
  const mur = murAtteint({
    coutRun, casJoues: jouees, coutSession: cumul + coutRun,
    budgetRun: BUDGET, plafondSession: PLAFOND_CUMUL, estime: COUT_PANNE_ESTIME,
  })
  if (mur) { motifMur = mur; nonJouees = unites.length - jouees; break }

  let r = null, erreur = null
  try {
    const res = await fetch(URL_FN, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ANON}`,
        apikey: ANON,
        'x-eval-secret': EVAL_SECRET,
      },
      body: JSON.stringify({
        entree: {
          marque: u.marque,
          title: u.titre,
          description: u.symptomes,
          models: u.famille,
          years: u.annees,
          severity: u.gravite,
        },
      }),
      // ⚠️ 300 s laissaient le serveur dépenser bien après l'abandon du
      // client. La fonction borne désormais sa propre recherche à 150 s : on
      // lui laisse de la marge, puis on considère qu'elle ne répondra pas.
      signal: AbortSignal.timeout(240_000),
    })
    const t = await res.text()
    if (!res.ok) erreur = `HTTP ${res.status} — ${t.slice(0, 200)}`
    else r = JSON.parse(t)
  } catch (e) { erreur = String(e).slice(0, 200) }

  jouees++

  // ⚠️ UN MUR QUI LIT UN CHAMP INEXISTANT N'EST PAS UN MUR.
  //
  // Première version de ce script : elle lisait `cout_usd` et multipliait par
  // le change. `atlas-builder` rend `cout_eur`, déjà converti. Le coût relevé
  // valait donc 0,000 € à chaque panne — la réserve du mur était nulle, le mur
  // ne se serait JAMAIS déclenché, et la campagne aurait joué les 105 pannes à
  // ≈ 21 € au lieu des 9 € annoncés. Vu sur les trois premières lignes de
  // sortie et arrêté là.
  //
  // Le silence du champ est donc une ERREUR D'ARRÊT, jamais un zéro. C'est la
  // même leçon que les quatre `process.exit(1)` placés trop tôt : un contrôle
  // qui n'échoue pas bruyamment ne contrôle rien.
  if (!erreur && (r == null || typeof r.cout_eur !== 'number')) {
    console.error(`\n  ⚠️ ARRÊT — la réponse ne porte pas de champ \`cout_eur\` chiffrable.`)
    console.error(`     Sans coût relevé, le mur de ${BUDGET.toFixed(2)} € ne protège de rien.`)
    console.error(`     Champs reçus : ${r ? Object.keys(r).join(', ') : '(aucune réponse)'}`)
    process.exit(1)
  }
  const coutUnite = Number(r?.cout_eur) || 0
  coutRun += coutUnite

  const retenues = (r?.sources ?? []).map((s) => ({ url: s.url, rang: rangSource(s.url), titre: s.titre ?? '' }))
  const porte = retenues.length > 0 && sourcesPortentLEntree(retenues.map((s) => s.url))
  const motif = erreur
    ? `appel en échec : ${erreur}`
    : porte ? null
      : (r?.motif_rejet && String(r.motif_rejet).trim())
        || (() => {
          const e = r?.ecartees ?? []
          if (e.length === 0) return 'aucune page proposée par la recherche'
          const c = {}
          for (const x of e) c[x.motif ?? 'inconnu'] = (c[x.motif ?? 'inconnu'] ?? 0) + 1
          return Object.entries(c).map(([m, n]) => `${m} ×${n}`).join(', ')
        })()

  // ⚠️ UNE SÉRIE D'ÉCHECS N'EST PAS UN RÉSULTAT : ON S'ARRÊTE.
  //
  // Le 6 nov. 2026, l'API a cessé de répondre à la onzième panne et le script
  // a continué à dérouler 56 appels en échec en les notant « retirée ». Il
  // dépensait zéro, donc le mur ne le voyait pas — mais il produisait un
  // rapport faux, ce qui est pire que de ne rien produire.
  if (erreur) echecsDAffilee++; else echecsDAffilee = 0
  if (echecsDAffilee >= 3) {
    console.error(`\n  ⚠️ ARRÊT — ${echecsDAffilee} appels en échec d'affilée.`)
    console.error(`     Dernier motif : ${erreur}`)
    console.error(`     Les pannes concernées restent À JOUER (les échecs ne sont pas des résultats).`)
    journal.push({ ...u, porte: false, sources_trouvees: [], ecartees: [], cout_eur: 0, motif: null, erreur })
    writeFileSync(JOURNAL, JSON.stringify(journal, null, 1))
    writeFileSync(COMPTEUR, JSON.stringify({ eur: Number((cumul + coutRun).toFixed(4)), maj: new Date().toISOString() }))
    console.error(`     Journal conservé : ${journal.filter((j) => !j.erreur).length} panne(s) réellement jouée(s).`)
    process.exit(3)
  }

  journal.push({
    ...u, porte, sources_trouvees: retenues, ecartees: r?.ecartees ?? [],
    gravite_apres: r?.gravite ?? null, cout_eur: Number(coutUnite.toFixed(4)), motif, erreur,
  })
  console.log(`  ${porte ? 'PORTÉE ' : 'retirée'}  ${u.fiche.padEnd(20)} ${u.titre.slice(0, 54).padEnd(54)} ` +
    `${porte ? retenues.map((s) => s.rang).join(',') : (motif ?? '').slice(0, 42)}  ${coutUnite.toFixed(3)} €`)
  writeFileSync(JOURNAL, JSON.stringify(journal, null, 1))
  writeFileSync(COMPTEUR, JSON.stringify({ eur: Number((cumul + coutRun).toFixed(4)), maj: new Date().toISOString() }))
}

// ── Rapport ─────────────────────────────────────────────────────────────────
// ⚠️ CE CALCUL PRÉCÈDE LE RAPPORT QUI LE LIT, et il doit rester ici.
// Première version : il était placé juste avant l'affichage, donc APRÈS
// l'objet `rapport` qui s'en sert — `ReferenceError: Cannot access
// 'porteesLot' before initialization`, le script mourait après avoir dépensé
// et le rapport n'était jamais écrit. Même classe de défaut que le `candidats`
// hors portée du sprint 19, que `tests/portee-fonctions.test.mjs` attrape pour
// les fonctions edge — mais ce test ne balaie pas `scripts/`.
// ⚠️ LE RENDEMENT SE MESURE SUR CE LOT, PAS SUR LE CUMUL. Un bon premier lot
// masquerait un terrain devenu stérile : c'est le lot courant qui dit s'il
// vaut la peine d'en payer un autre.
const duLot = journal.slice(journal.length - jouees)
const porteesLot = duLot.filter((j) => j.porte).length
const rendement = jouees > 0 ? porteesLot / jouees : 0


const portees = journal.filter((j) => j.porte)
const fichesSauvees = [...new Set(portees.map((j) => j.fiche))]
const rapport = {
  date: new Date().toISOString().slice(0, 10),
  fiches_visees: Object.keys(parFiche).length,
  pannes_visees: unites.length,
  pannes_jouees: journal.length,
  pannes_jouees_ce_run: jouees,
  pannes_non_jouees: unites.length - journal.length,
  pannes_portees: portees.length,
  fiches_sauvees: fichesSauvees,
  cout_eur: Number(coutRun.toFixed(3)),
  mur: motifMur,
  lot_jouees: jouees,
  lot_portees: porteesLot,
  lot_rendement: Number(rendement.toFixed(3)),
  fin_de_lot: finDeLot,
  retirees: journal.filter((j) => !j.porte).map((j) => ({ fiche: j.fiche, titre: j.titre, motif: j.motif })),
}
writeFileSync(RAPPORT, JSON.stringify(rapport, null, 1))

console.log(`\n── RÉSULTAT ──`)
if (MAX_PANNES > 0) {
  console.log(`  LOT : ${porteesLot}/${jouees} portées = ${(rendement * 100).toFixed(0)} % ` +
    `(seuil de poursuite : ${SEUIL_RENDEMENT * 100} %)`)
}
console.log(`  pannes jouées         : ${journal.length}/${unites.length}${reprises ? ` (dont ${reprises} reprises, ${jouees} ce run)` : ''}`)
console.log(`  pannes PORTÉES        : ${portees.length}`)
console.log(`  fiches SAUVÉES        : ${fichesSauvees.length}/${Object.keys(parFiche).length}${fichesSauvees.length ? ' — ' + fichesSauvees.join(', ') : ''}`)
console.log(`  coût de ce run        : ${coutRun.toFixed(3)} € / ${BUDGET.toFixed(2)} € annoncés · cumul ${(cumul + coutRun).toFixed(2)} € / ${PLAFOND_CUMUL} €`)
if (motifMur) {
  console.log(`\n  ⚠️ MUR ${motifMur.toUpperCase()} ATTEINT — ${unites.length - journal.length} panne(s) NON JOUÉE(S).`)
  console.log(`     Reprendre : node scripts/resourcer-fiches.mjs ${FICHIER} --budget <eur>`)
  console.log(`     Coût estimé du reste : ${((unites.length - journal.length) * (jouees ? coutRun / jouees : COUT_PANNE_ESTIME)).toFixed(2)} €`)
}
console.log(`\n  journal : ${JOURNAL}\n  rapport : ${RAPPORT}`)

if (MAX_PANNES > 0 && jouees > 0) {
  if (rendement < SEUIL_RENDEMENT) {
    console.log(`\n  ⛔ RENDEMENT SOUS LE SEUIL (${(rendement * 100).toFixed(0)} % < ${SEUIL_RENDEMENT * 100} %)`)
    console.log(`     La campagne s'ARRÊTE ici : on ne paie pas un terrain qui ne donne rien.`)
    console.log(`     ${unites.length - journal.length} panne(s) non jouée(s), conservées comme questions au vendeur.`)
    process.exit(4)
  }
  console.log(`\n  ✓ Rendement au-dessus du seuil — un lot de plus est justifié.`)
}
// ⚠️ Code de sortie 2 tant qu'il reste des pannes à jouer : une campagne
// incomplète ne doit pas ressembler à une campagne finie. 0 = tout est joué.
if (journal.length < unites.length) process.exit(2)
