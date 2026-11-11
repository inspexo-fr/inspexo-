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
const cumulDepart = () => (existsSync(COMPTEUR) ? (JSON.parse(readFileSync(COMPTEUR, 'utf8')).eur ?? 0) : 0)

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
const fiches = ((APPLIQUER || a('--rejouer-non-soutenues') || a('--candidats-externes')) && !existsSync(FICHIER)) ? [] : JSON.parse(readFileSync(FICHIER, 'utf8'))
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
if (ESTIMER && !a('--rejouer-non-soutenues') && !a('--candidats-externes')) {
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


// ── MODE --candidats-externes (sprint 23) — JUGE SEULEMENT ─────────────────
//
// Fichier docs/sources-moteurs-2026-11.json. Ce mode JUGE ; il n'écrit RIEN
// dans les fiches (cache du juge et journal seulement). La fusion est un
// second geste, avec le jeton d'administrateur.
//
// Règles (décisions d'Utku du 10 nov. 2026) :
//   - pages injoignables au pré-contrôle (docs/precontrole-sources.json)
//     EXCLUES : on ne paie pas pour elles ;
//   - sources prises par MEILLEURE CLASSE d'abord, arrêt à 2 confirmées ;
//   - lots de 20 affirmations, une page jugée UNE fois par lot pour toutes
//     les affirmations du lot qui la citent ;
//   - mur par lot (--mur-lot, 1,30 €) ET mur du run (--budget) ;
//   - ARRÊT IMMÉDIAT si un lot confirme moins de 50 % de ses affirmations :
//     ces pages ont déjà été ouvertes, un taux bas signale un problème de
//     lecture, pas de source.
//   - type=constat : jamais jugé comme une panne (exclu).
if (a('--candidats-externes')) {
  const { decouperNoyau, defautsNoyau, detailsAffichables, extraireNoyau } =
    await import(new URL('../supabase/functions/_shared/noyau.ts', import.meta.url))
  const SRC = JSON.parse(readFileSync('docs/sources-moteurs-2026-11.json', 'utf8'))
  const PRE = existsSync('docs/precontrole-sources.json') ? JSON.parse(readFileSync('docs/precontrole-sources.json', 'utf8')).pages : null
  if (!PRE) { console.error('Pré-contrôle absent : node scripts/precontrole-sources.mjs (gratuit) d’abord.'); process.exit(1) }
  const CORR = existsSync('docs/correspondance-familles.json') ? JSON.parse(readFileSync('docs/correspondance-familles.json', 'utf8')) : { lignes: [] }
  const codesDe = Object.fromEntries(CORR.lignes.map((l) => [l.cle, l.codes ?? []]))
  const JOURNAL_EXT = 'docs/candidats-externes-journal.json'
  const MUR_LOT = Number(flag('--mur-lot', '1.30')) || 1.3
  const NB_LOTS = Number(flag('--lots', '1')) || 1
  // Projection : on continue tant que (dépensé + projeté) ≤ ce plafond.
  const PLAFOND_PROJETE = Number(flag('--plafond-projete', '30')) || 30
  const DEJA_DEPENSE = Number(flag('--deja-depense', '0')) || 0
  const SEUIL_LOT = 0.5
  const RANG = { officiel: 0, presse: 1, consommateurs: 1, editorial: 2 }
  const FORTE = new Set(['officiel', 'presse', 'consommateurs'])
  const classeDe = (u) => SRC.hotes[new URL(u).hostname.replace(/^www\./, '')]?.classe
  const joignable = (u) => PRE[u]?.joignable === true

  // ⚠️ ORDRE RÉEL (décision d'Utku du 10 nov. 2026) : ces moteurs d'abord,
  // puis le groupe H (modèles anciens), puis VAG, puis le reste.
  const PRIORITE = ['K9K', 'EB2', 'DV6', 'DW10', 'H5FT', 'EP6', 'DV5']
  const rangObjet = (o) => {
    const codes = codesDe[o.famille] ?? []
    const k = PRIORITE.findIndex((p) => codes.some((c) => c === p || c.startsWith(p)))
    if (k >= 0) return k
    if (o.groupe === 'H') return 100
    if (o.groupe === 'C') return 200
    return 300
  }

  const journal = existsSync(JOURNAL_EXT) ? JSON.parse(readFileSync(JOURNAL_EXT, 'utf8')) : { lots: [], affirmations: {} }
  // Le pilote du 10 nov. a jugé l'INTITULÉ entier : ses verdicts ne valent pas
  // pour le noyau. Seules les affirmations jugées en mode « noyau » comptent.
  // ⚠️ Seules comptent les affirmations jugées au FORMAT ACTUEL (vote corrigé,
  // un défaut par partie : champ `parties`). Le lot K9K + EB2 du premier
  // passage — ancien vote, silences comptés « non » — est REJOUÉ.
  const faites = new Set(Object.entries(journal.affirmations).filter(([, v]) => v.mode === 'noyau' && Array.isArray(v.parties)).map(([k]) => k))
  // Corrections manuelles de noyaux (même règle) et affirmations RETIRÉES par
  // Utku le 10 nov. 2026 : un constat, et des pénalités américaines sans
  // intérêt pour l'acheteur.
  const NOYAUX_CORRIGES = JSON.parse(readFileSync('docs/noyaux-corriges.json', 'utf8'))
  const RETIREES = new Set(['B-PSA-EAT8-02', 'F-HYUNDAI-KIA-2.0-2.4-THETA-II-02'])
  const noyauDe = (o) => NOYAUX_CORRIGES[o.id] ?? extraireNoyau(o.intitule, o.type).noyau
  const objets = SRC.objets
    .filter((o) => o.type !== 'constat' && !faites.has(o.id) && !RETIREES.has(o.id))
    .sort((x, y) => (rangObjet(x) - rangObjet(y)) || x.famille.localeCompare(y.famille) || x.id.localeCompare(y.id))
  const sourcesDe = (o) => [...(o.sources ?? [])]
    .filter((s) => joignable(s.url))
    .sort((x, y) => (RANG[classeDe(x.url)] ?? 9) - (RANG[classeDe(y.url)] ?? 9))
  const cibleDe = (o) => `${(o.marques ?? []).join('/')} ${o.libelle_moteur}${o.modeles_annees ? ` — ${o.modeles_annees}` : ''}`.slice(0, 200)
  const extraitsVerbatim = (o, url) => (o.sources.find((s) => s.url === url)?.extraits ?? [])
    .filter((e) => e?.verbatim === true && typeof e.texte === 'string').map((e) => e.texte)
  const totalRestant = objets.filter((o) => sourcesDe(o).length > 0).length

  let coutRun = 0, affirmationsJouees = 0
  // Une UNITÉ = une partie de noyau (un défaut). `groupe` est une liste
  // d'unités de la MÊME page.
  // ⚠️ UN DÉLAI DÉPASSÉ NE FAIT PLUS TOMBER LE RUN (11 nov. 2026 : TimeoutError
  // non attrapée au lot 27, après 23 lots complets). L'appel rend null ; le
  // lanceur réserve un coût PRUDENT (le serveur a pu dépenser sans le dire),
  // marque les unités « à rejuger », et s'arrête après trois échecs d'affilée.
  const appelJuge = async (url, groupe) => {
    try { return await appelJugeBrut(url, groupe) } catch (e) {
      console.error(`\n  ⚠️ appel en échec (${String(e?.name ?? e).slice(0, 40)}) sur ${url.slice(0, 80)} — unités à rejuger, coût réservé`)
      return null
    }
  }
  const appelJugeBrut = async (url, groupe) => {
    const res = await fetch(`${env.REACT_APP_SUPABASE_URL}/functions/v1/sources-externes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON}`, 'x-eval-secret': EVAL_SECRET },
      body: JSON.stringify({ mode: 'juger', url, cible: cibleDe(groupe[0].o), moteur: groupe[0].o.famille,
        affirmations: groupe.map((u) => ({ id: u.uid, texte: `Sur ${String(u.o.libelle_moteur).trim()} : ${u.partie}`.slice(0, 400), extraits: extraitsVerbatim(u.o, url) })) }),
      signal: AbortSignal.timeout(150_000),
    })
    const j = await res.json().catch(() => null)
    if (!res.ok || typeof j?.cout_eur !== 'number') {
      console.error(`\n  ⚠️ ARRÊT — juge sur ${url} : HTTP ${res.status}, coût non chiffrable.`)
      process.exit(1)
    }
    return j
  }

  // --melange K9K,EB2 : le PREMIER lot puise à parts égales dans ces moteurs
  // (pilote du 10 nov. 2026 : « un seul lot K9K + EB2 »).
  const MELANGE = flag('--melange') ? String(flag('--melange')).split(',') : null
  const premierLot = () => {
    if (!MELANGE) return objets.splice(0, 20)
    const part = Math.floor(20 / MELANGE.length)
    const pris = []
    for (const m of MELANGE) {
      const candidats = objets.filter((o) => (codesDe[o.famille] ?? []).some((c) => c === m || c.startsWith(m)) && sourcesDe(o).length > 0).slice(0, part)
      for (const o of candidats) { pris.push(o); objets.splice(objets.indexOf(o), 1) }
    }
    return pris
  }

  // ⚠️ UN NOYAU SALE N'EST JAMAIS ENVOYÉ AU JUGE (décision d'Utku du 10 nov.
  // 2026 : « relis les noyaux par script avant l'envoi »). Il est mis de côté,
  // listé, et reste à jouer : on ne paie pas pour une phrase mal formée.
  journal.noyaux_a_reprendre = journal.noyaux_a_reprendre ?? {}
  for (let i = objets.length - 1; i >= 0; i--) {
    const o = objets[i]
    const d = defautsNoyau(noyauDe(o), o.intitule, o.type)
    if (d.length) { journal.noyaux_a_reprendre[o.id] = d; objets.splice(i, 1) }
    else delete journal.noyaux_a_reprendre[o.id]
  }
  console.log(`  ${Object.keys(journal.noyaux_a_reprendre).length} noyau(x) mis de côté (forme à reprendre), jamais envoyés`)

  const SEUIL_SILENCE = 0.2
  let echecsDAffilee = 0, echecsEstimes = 0
  for (let k = 0; k < NB_LOTS && objets.length; k++) {
    const lot = (k === 0 ? premierLot() : objets.splice(0, 20)).filter((o) => sourcesDe(o).length > 0)
    if (lot.length === 0) continue
    // Unités : un défaut par partie (décision du 10 nov. 2026).
    const unites = lot.flatMap((o) => {
      const parts = decouperNoyau(noyauDe(o), o.type)
      return parts.map((partie, i) => ({ o, partie, uid: parts.length > 1 ? `${o.id}#${i + 1}` : o.id }))
    })
    const etat = Object.fromEntries(unites.map((u) => [u.uid, { confirmees: [], ecartees: [], silences: [], restantes: sourcesDe(u.o).map((x) => x.url), close: false }]))
    let coutLot = 0, appels = 0, arretLot = null, mauvaisMoteur = 0
    // Une unité est CLOSE dès : une source forte confirmée ; ou deux
    // éditoriales confirmées ; ou deux rejets RÉELS ; ou plus de page.
    const close = (e) => e.confirmees.some((c) => FORTE.has(c.classe)) || e.confirmees.length >= 2 ||
      e.ecartees.length >= 2 || e.restantes.length === 0
    for (let tour = 0; tour < 4; tour++) {
      const parPage = new Map()
      for (const u of unites) {
        const e = etat[u.uid]
        if (e.close || close(e)) { e.close = true; continue }
        const url = e.restantes.shift()
        if (!parPage.has(url)) parPage.set(url, [])
        parPage.get(url).push(u)
      }
      if (parPage.size === 0) break
      for (const [url, groupe] of parPage) {
        // 6 par appel : 8 approchaient les 150 s d'une fonction edge.
        for (let i = 0; i < groupe.length; i += 6) {
          const sous = groupe.slice(i, i + 6)
          const reserve = appels ? coutLot / appels : 0.063
          if (coutLot + reserve > MUR_LOT) { arretLot = `mur du lot (${MUR_LOT.toFixed(2)} €)`; break }
          if (coutRun + reserve > BUDGET) { arretLot = `mur du run (${BUDGET.toFixed(2)} €)`; break }
          const j = await appelJuge(url, sous)
          if (!j) {
            const RESERVE_ECHEC = 0.063
            coutLot += RESERVE_ECHEC; coutRun += RESERVE_ECHEC; echecsEstimes += RESERVE_ECHEC
            for (const u of sous) etat[u.uid].silences.push(url)
            if (++echecsDAffilee >= 3) { arretLot = 'trois appels en échec d’affilée'; break }
            continue
          }
          echecsDAffilee = 0
          appels++; coutLot += j.cout_eur; coutRun += j.cout_eur
          for (const u of sous) {
            const r = j.verdicts?.[u.uid] ?? {}
            // Un silence (aucun vote réel) n'est pas un rejet : à rejuger.
            if (Array.isArray(r.votes) && r.votes.length === 0 && !r.depuis_cache) { etat[u.uid].silences.push(url); continue }
            const v = r.verdict ?? 'non_soutenue'
            if (v === 'mauvais_moteur') mauvaisMoteur++
            ;(v === 'soutenue' ? etat[u.uid].confirmees : etat[u.uid].ecartees)
              .push({ url, verdict: v, classe: classeDe(url), lecture: r.lecture ?? null, cache: r.depuis_cache === true,
                justification: typeof r.justification === 'string' ? r.justification.slice(0, 400) : null })
          }
        }
        if (arretLot) break
      }
      if (arretLot) break
    }
    // Bilan PAR AFFIRMATION MÈRE.
    let confirmees = 0, silencieuses = 0
    for (const o of lot) {
      const us = unites.filter((u) => u.o === o)
      const conf = us.filter((u) => etat[u.uid].confirmees.length > 0)
      const jugees = us.filter((u) => etat[u.uid].confirmees.length + etat[u.uid].ecartees.length > 0)
      const silence = jugees.length === 0 && us.some((u) => etat[u.uid].silences.length > 0)
      if (conf.length) confirmees++
      if (silence) silencieuses++
      const { details, periodes } = extraireNoyau(o.intitule, o.type)
      const extraitsConfirmes = conf.flatMap((u) => etat[u.uid].confirmees.flatMap((c) => extraitsVerbatim(o, c.url)))
      journal.affirmations[o.id] = {
        mode: silence ? 'a_rejuger' : 'noyau', famille: o.famille, type: o.type, intitule: o.intitule,
        noyau: noyauDe(o), periodes, details, details_affichables: detailsAffichables(details, extraitsConfirmes),
        // Seules les parties CONFIRMÉES sont affichables, jamais l'intitulé
        // d'origine complet ; chacune garde la période de la mère.
        parties: us.map((u) => ({ uid: u.uid, partie: u.partie, confirmees: etat[u.uid].confirmees, ecartees: etat[u.uid].ecartees, silences: etat[u.uid].silences })),
        parties_affichables: conf.map((u) => u.partie),
        lot: journal.lots.length + 1,
      }
    }
    const jugees = lot.length - silencieuses
    const taux = jugees ? confirmees / jugees : 0
    const partSilence = silencieuses / lot.length
    affirmationsJouees += lot.length
    const coutParAff = coutLot / lot.length
    journal.lots.push({ n: journal.lots.length + 1, mode: 'noyau', affirmations: lot.length, unites: unites.length, confirmees, jugees,
      silencieuses, mauvais_moteur: mauvaisMoteur, appels, cout_eur: Number(coutLot.toFixed(4)), cout_par_affirmation: Number(coutParAff.toFixed(4)),
      arret: arretLot, familles: [...new Set(lot.map((o) => o.famille))], le: new Date().toISOString() })
    writeFileSync(JOURNAL_EXT, JSON.stringify(journal, null, 1))
    writeFileSync(COMPTEUR, JSON.stringify({ eur: Number((cumulDepart() + coutLot).toFixed(4)), maj: new Date().toISOString() }))
    const restant = totalRestant - affirmationsJouees
    const projete = DEJA_DEPENSE + coutRun + restant * (coutRun / affirmationsJouees)
    console.log(`  lot ${journal.lots.length} · ${lot.length} affirmations, ${unites.length} unités (${[...new Set(lot.map((o) => o.famille))].join(', ')})`)
    console.log(`    confirmées ${confirmees}/${jugees} jugées (${Math.round(taux * 100)} %) · silencieuses ${silencieuses} (${Math.round(partSilence * 100)} %) · mauvais moteur ${mauvaisMoteur} · ${appels} appel(s) · ${coutLot.toFixed(3)} € · ${coutParAff.toFixed(4)} €/affirmation`)
    console.log(`    projection : ${projete.toFixed(2)} € cumulés (plafond ${PLAFOND_PROJETE} €)${arretLot ? ` · ARRÊT : ${arretLot}` : ''}`)
    if (arretLot?.startsWith('mur du run') || arretLot?.startsWith('trois appels')) { console.log(`\n⏸ ${arretLot} : le reste n’est pas joué.`); break }
    if (partSilence > SEUIL_SILENCE) { console.log(`\n⏹ ARRÊT : plus de ${SEUIL_SILENCE * 100} % du lot est resté silencieux.`); break }
    if (taux < SEUIL_LOT) { console.log(`\n⏹ ARRÊT IMMÉDIAT : le lot confirme moins de ${SEUIL_LOT * 100} % de ce qui a été jugé.`); break }
    if (projete > PLAFOND_PROJETE) { console.log(`\n⏹ ARRÊT : la projection dépasse ${PLAFOND_PROJETE} € cumulés. Décision d’Utku requise.`); break }
  }
  if (echecsEstimes) console.log(`  dont ${echecsEstimes.toFixed(3)} € RÉSERVÉS pour des appels en échec (coût réel inconnu)`)
  console.log(`\n— Coût du run : ${coutRun.toFixed(3)} € / ${BUDGET.toFixed(2)} € · journal ${JOURNAL_EXT} · rien n’est écrit dans les fiches.`)
  process.exit(0)
}

// ── MODE --rejouer-non-soutenues (sprint 22) ───────────────────────────────
//
// Décision d'Utku du 8 nov. 2026 : rejouer avec le JUGE À VOTE uniquement les
// pannes pour lesquelles une page avait été TROUVÉE mais jugée « non
// soutenue » par le juge à un seul passage. Pas les « aucune page » : il n'y a
// rien à rejuger.
//
// Mode RATTRAPAGE d'atlas-builder : les URL sont fournies, AUCUNE recherche
// n'est payée — seul le juge tourne. Et la requête est construite EXACTEMENT
// comme la mesure du 8 nov. (marque, titre, symptômes, famille, années), pour
// que les couples déjà jugés sortent du cache à 0 €.
//
// Le journal est mis à jour EN PLACE (la ligne gagne `rejeu`, et `porte` si une
// page tient désormais) : `--appliquer` le lit tel quel, avec le jeton admin.
if (a('--rejouer-non-soutenues')) {
  const lus = existsSync(JOURNAL) ? JSON.parse(readFileSync(JOURNAL, 'utf8')) : []
  const cibles = lus.filter((j) => !j.porte && !j.rejeu &&
    (j.ecartees ?? []).some((e) => e.motif === 'non_soutenue'))
  const pagesDe = (j) => [...new Set((j.ecartees ?? []).filter((e) => e.motif === 'non_soutenue').map((e) => e.url))]
  const nPages = cibles.reduce((n, j) => n + pagesDe(j).length, 0)
  // Mesuré le 8 nov. 2026 : 0,021 € par passage et par page ; 2 passages si
  // les deux concordent, 3 sinon. Page déjà jugée : 0 €.
  const PAR_PAGE_MIN = 0.042, PAR_PAGE_MAX = 0.063
  console.log(`\nREJEU AU JUGE À VOTE — ${cibles.length} panne(s), ${nPages} page(s) « non soutenue »`)
  for (const j of cibles) console.log(`  ${j.fiche.padEnd(18)} ${j.titre.slice(0, 60).padEnd(60)} ${pagesDe(j).length} page(s)`)
  console.log(`\n  coût si aucune page n'est en cache : ${(nPages * PAR_PAGE_MIN).toFixed(2)} à ${(nPages * PAR_PAGE_MAX).toFixed(2)} €`)
  console.log(`  mur de ce run : ${BUDGET.toFixed(2)} €`)
  if (ESTIMER) process.exit(0)

  let coutRun = 0, joues = 0
  for (const j of cibles) {
    const mur = murAtteint({ coutRun, casJoues: joues, coutSession: cumulDepart() + coutRun,
      budgetRun: BUDGET, plafondSession: PLAFOND_CUMUL, estime: PAR_PAGE_MAX * pagesDe(j).length })
    if (mur) { console.log(`\n⏸ mur atteint (${mur}) avant « ${j.titre.slice(0, 50)} » : NON jouée.`); break }
    const res = await fetch(URL_FN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON}`, apikey: ANON, 'x-eval-secret': EVAL_SECRET },
      body: JSON.stringify({
        entree: { marque: j.marque, title: j.titre, description: j.symptomes ?? '', models: j.famille, years: j.annees ?? '' },
        urls: pagesDe(j),
      }),
      signal: AbortSignal.timeout(240_000),
    })
    const r = await res.json().catch(() => null)
    if (!res.ok || r == null || typeof r.cout_eur !== 'number') {
      console.error(`\n  ⚠️ ARRÊT — ${j.titre.slice(0, 50)} : HTTP ${res.status}, coût non chiffrable. Rien n'est écrit pour elle.`)
      console.error(`     Coût du rejeu jusqu'ici : ${coutRun.toFixed(3)} €. Sans coût relevé, le mur ne protège de rien.`)
      process.exit(1)
    }
    joues++
    coutRun += r.cout_eur
    const retenues = (r.sources ?? []).map((x) => ({ url: x.url, rang: rangSource(x.url), titre: x.titre ?? '' }))
    const porte = retenues.length > 0 && sourcesPortentLEntree(retenues.map((x) => x.url))
    j.rejeu = { le: new Date().toISOString(), juge: r.juge ?? null, cout_eur: r.cout_eur,
      verdicts: [...retenues.map((x) => [x.url, 'soutenue']), ...(r.ecartees ?? []).map((e) => [e.url, e.motif])] }
    if (porte) {
      j.porte = true
      j.sources_trouvees = [...(j.sources_trouvees ?? []), ...retenues.filter((x) => !(j.sources_trouvees ?? []).some((y) => y.url === x.url))]
      j.motif = null
    }
    console.log(`  ${porte ? 'PORTÉE ' : 'retirée'}  ${j.fiche.padEnd(18)} ${j.titre.slice(0, 50).padEnd(50)} ` +
      `${JSON.stringify(r.juge)}  ${r.cout_eur.toFixed(3)} €`)
    writeFileSync(JOURNAL, JSON.stringify(lus, null, 1))
    writeFileSync(COMPTEUR, JSON.stringify({ eur: Number((cumulDepart() + coutRun).toFixed(4)), maj: new Date().toISOString() }))
  }
  console.log(`\n— Coût du rejeu : ${coutRun.toFixed(3)} € / ${BUDGET.toFixed(2)} € annoncés`)
  console.log('  Écriture dans les fiches : node scripts/resourcer-fiches.mjs --appliquer (jeton admin).')
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
