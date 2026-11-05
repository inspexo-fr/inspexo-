#!/usr/bin/env node
// SPRINT 21 — Étendre le Defect Atlas aux défauts HORS MOTEUR.
//
// L'atlas portait 10 entrées, dont UNE SEULE hors moteur (corrosion Mercedes).
// Or le moteur est déjà couvert par les 48 fiches moteur, sourcées par
// construction. C'est donc hors moteur — boîte, électronique, corrosion,
// suspension, climatisation — que l'atlas apporte ce que les fiches n'ont pas.
//
// ⚠️ POURQUOI UN SCRIPT SÉPARÉ de `sourcer-atlas.mjs`. Celui-ci SOURCE des
// entrées qui existent déjà et RÉÉCRIT l'atlas à partir de son relevé ; son
// garde-fou exige même que l'atlas d'entrée porte au moins autant d'entrées
// que le relevé en a traitées. Ici on fait l'inverse : on ÉPROUVE des
// hypothèses nouvelles et on FUSIONNE les survivantes. Mélanger les deux
// relevés rendrait aussi illisible le compte rendu du sprint 16.
//
// ⚠️ CHAQUE CANDIDAT EST UNE HYPOTHÈSE, PAS UNE AFFIRMATION. Il passe par
// `atlas-builder` : recherche web, filtre déterministe à deux marqueurs, puis
// vérification indépendante par le MÊME juge que /fiabilite — et il est
// RETIRÉ si rien ne tient. Au sprint 16, 20 des 30 entrées d'origine ont été
// retirées, surtout faute de source autre que des forums et des pages
// commerciales de garages.
//
// ⚠️ CE SCRIPT DÉPENSE. Compteur dans `.atlas-cout.json` (le même que le
// sprint 16), mur du run via `--budget`, arrêt automatique qui dit ce qui n'a
// pas été joué.
//
// Usage :
//   node scripts/etendre-atlas.mjs --estimer
//   node scripts/etendre-atlas.mjs --collecter --budget 10 [--reset-cout]
//   node scripts/etendre-atlas.mjs --collecter --categorie boite
//   node scripts/etendre-atlas.mjs --appliquer

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { coutProchainCas, murAtteint } from './budget.mjs'
import { defectAtlas } from '../src/data/defectAtlas.js'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const COUT_FICHIER = join(RACINE, '.atlas-cout.json')
const CANDIDATS = join(RACINE, 'docs', 'atlas-hors-moteur-candidats.json')
const RELEVE = join(RACINE, 'docs', 'atlas-hors-moteur-resultats.json')
const JOURNAL = join(RACINE, 'docs', 'atlas-hors-moteur-journal.json')

const args = process.argv.slice(2)
const flag = (n, d = null) => {
  const i = args.indexOf(`--${n}`)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d
}
const BUDGET_RUN_EUR = (() => { const v = Number(flag('budget', '')); return Number.isFinite(v) && v > 0 ? v : null })()
const PLAFOND_EUR = Number(flag('plafond', '15'))
const MARQUE = flag('marque')
const CATEGORIE = flag('categorie')
if (args.includes('--reset-cout') && existsSync(COUT_FICHIER)) rmSync(COUT_FICHIER)

const CATEGORIES = ['boite', 'electronique', 'corrosion', 'suspension', 'climatisation']
if (CATEGORIE && !CATEGORIES.includes(CATEGORIE)) {
  console.error(`✗ catégorie inconnue : « ${CATEGORIE} ». Attendu : ${CATEGORIES.join(', ')}`)
  process.exit(1)
}

const { candidats } = JSON.parse(readFileSync(CANDIDATS, 'utf8'))
// ⚠️ ORDRE DÉLIBÉRÉ : les candidats qui pourront PESER sur un score d'abord.
// Si le mur budgétaire coupe, il coupe ce qui n'aurait été que des questions —
// pas l'inverse. Même règle que `npm run eval -- --cas` : on place en tête ce
// qu'on ne veut surtout pas perdre.
//
// ⚠️ Le critère est donné par `ciblesAtlas` ELLE-MÊME, pas par une expression
// régulière écrite à côté. Ma première version en approximait une : elle
// comptait 14 candidats « avec repère » là où la vraie fonction en voit 27.
// Un tri fondé sur une copie approximative de la règle aurait trié selon une
// règle qui n'existe pas.
const { ciblesAtlas } = await import('../supabase/functions/_shared/pannesApplicables.ts')
const aEprouver = candidats
  .filter((c) => !MARQUE || c.cle.toLowerCase() === MARQUE.toLowerCase())
  .filter((c) => !CATEGORIE || c.categorie === CATEGORIE)
  .map((c) => ({
    ...c,
    // Ce que l'entrée visera réellement, selon le filtre du serveur — en lui
    // passant la liste DÉCLARÉE du candidat. ⚠️ Sans `cibles:` dans cet appel,
    // la fonction retombait sur sa déduction par la prose et comptait 35
    // candidats « ciblés » là où 22 seulement le sont réellement : le tri
    // aurait suivi une règle qui n'est plus celle du serveur.
    cibles: ciblesAtlas({
      ref: 'A0', titre: c.title, symptome: c.description, organe: 'autre',
      ...(Array.isArray(c.cibles) ? { cibles: c.cibles } : {}),
    }),
  }))
  .map((c) => ({ ...c, repere: c.cibles.length > 0 }))
  .sort((a, b) => Number(b.repere) - Number(a.repere) || b.cibles.length - a.cibles.length)

// ── Estimation : ne dépense rien ────────────────────────────────────────────
if (args.includes('--estimer') || args.length === 0) {
  const parCat = {}
  const parMarque = {}
  for (const c of aEprouver) {
    parCat[c.categorie] = (parCat[c.categorie] ?? 0) + 1
    parMarque[c.cle] = (parMarque[c.cle] ?? 0) + 1
  }
  const deja = existsSync(COUT_FICHIER) ? (JSON.parse(readFileSync(COUT_FICHIER, 'utf8')).total_eur ?? 0) : 0
  console.log('Estimation — AUCUN appel payant.\n')
  console.log(`  hypothèses à éprouver              ${aEprouver.length}`)
  console.log(`  dont ciblées par ciblesAtlas       ${aEprouver.filter((c) => c.repere).length} (les seules à pouvoir peser sur un score)`)
  console.log(`  ne viseront rien de distinctif     ${aEprouver.filter((c) => !c.repere).length} (questions au vendeur, jamais notées)`)
  console.log(`  par catégorie                      ${Object.entries(parCat).map(([k, v]) => `${k} ${v}`).join(' · ')}`)
  console.log(`  marques                            ${Object.keys(parMarque).length}`)
  console.log('')
  console.log('  coût MESURÉ au sprint 16           0,188 € / entrée (relevé : 5,638 € / 30)')
  console.log(`  attendu                            ${(aEprouver.length * 0.188).toFixed(2)} €`)
  console.log(`  prudent (0,22 € / entrée)          ${(aEprouver.length * 0.22).toFixed(2)} €`)
  console.log(`  déjà dépensé (compteur atlas)      ${deja.toFixed(2)} €`)
  console.log(`  plafond cumulé                     ${PLAFOND_EUR.toFixed(2)} €`)
  console.log(`  mur de ce run                      ${BUDGET_RUN_EUR ? BUDGET_RUN_EUR.toFixed(2) + ' €' : 'non annoncé (--budget)'}`)
  console.log('\n⚠️ Au sprint 16, 20 entrées sur 30 ont été RETIRÉES faute de source')
  console.log('   autre que des forums et des pages commerciales de garages. Ces')
  console.log('   candidats sont plus étroits (chacun nomme un code ou une plage')
  console.log('   précise), donc on attend mieux — aucun taux n’est promis.')
  process.exit(0)
}

// ── Configuration ───────────────────────────────────────────────────────────
const env = {}
for (const l of readFileSync(join(RACINE, '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const URL_BASE = env.REACT_APP_SUPABASE_URL
const ANON = env.REACT_APP_SUPABASE_ANON_KEY
const SECRET = env.EVAL_BYPASS_SECRET
if (!URL_BASE || !ANON || !SECRET) {
  console.error('✗ REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY et EVAL_BYPASS_SECRET requis.')
  process.exit(1)
}

let cout = existsSync(COUT_FICHIER) ? (JSON.parse(readFileSync(COUT_FICHIER, 'utf8')).total_eur ?? 0) : 0
const coutDepart = cout
const COUT_UNITE_ESTIME_EUR = 0.22
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
const ajouter = (e) => {
  unitesFaites += 1
  cout += e || 0
  writeFileSync(COUT_FICHIER, JSON.stringify({ total_eur: Math.round(cout * 10000) / 10000, maj: new Date().toISOString() }, null, 2))
}

// ── Phase 1 : collecte ──────────────────────────────────────────────────────
if (args.includes('--collecter')) {
  if (BUDGET_RUN_EUR == null) {
    console.error('✗ --budget <eur> est obligatoire : le mur de CE run doit être annoncé avant de dépenser.')
    process.exit(1)
  }
  const deja = existsSync(RELEVE) ? JSON.parse(readFileSync(RELEVE, 'utf8')) : { resultats: [] }
  const faites = new Set(deja.resultats.map((r) => `${r.cle}|${r.title}`))
  const nonJoues = []

  for (const c of aEprouver) {
    const id = `${c.cle}|${c.title}`
    if (faites.has(id)) { console.log(`· ${c.cle.padEnd(9)} ${c.title.slice(0, 46)} (déjà fait)`); continue }
    if (murDuRun() !== null) { nonJoues.push(c); continue }
    process.stdout.write(`▶ ${c.cle.padEnd(9)} ${c.categorie.padEnd(14)} ${c.title.slice(0, 42).padEnd(44)} `)
    let r = null
    try {
      const res = await fetch(`${URL_BASE}/functions/v1/atlas-builder`, {
        method: 'POST',
        signal: AbortSignal.timeout(170_000),
        headers: { Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json', 'x-eval-secret': SECRET },
        // `atlas-builder` attend une entrée au format de l'atlas : on lui
        // passe le candidat tel quel, sans `severity` — il n'y a pas de rang
        // d'origine à préserver pour une entrée qui n'existe pas encore.
        body: JSON.stringify({ entree: { cle: c.cle, marque: c.cle, title: c.title, description: c.description, models: c.models, years: c.years } }),
      })
      r = await res.json()
      if (!res.ok) { console.log(`ÉCHEC ${res.status} ${r?.error ?? ''}`); continue }
    } catch (err) {
      console.log('ÉCHEC réseau ' + String(err?.message ?? err).slice(0, 60))
      continue
    }
    ajouter(r.cout_eur ?? 0)
    deja.resultats.push({ cle: c.cle, categorie: c.categorie, repere: c.repere, candidat: c, ...r })
    writeFileSync(RELEVE, JSON.stringify(deja, null, 2))
    console.log(
      r.garde
        ? `GARDÉE  ${r.sources.length} source(s) · ${r.gravite} · ${(r.cout_eur ?? 0).toFixed(3)} €`
        : `RETIRÉE (${r.motif}) · ${(r.cout_eur ?? 0).toFixed(3)} €`,
    )
  }

  const res = JSON.parse(readFileSync(RELEVE, 'utf8')).resultats
  const g = res.filter((r) => r.garde)
  console.log(`\n${g.length} gardée(s), ${res.length - g.length} retirée(s), sur ${res.length} traitée(s).`)
  if (g.length > 0) {
    const parCat = {}
    for (const r of g) parCat[r.categorie] = (parCat[r.categorie] ?? 0) + 1
    console.log(`Gardées par catégorie : ${Object.entries(parCat).map(([k, v]) => `${k} ${v}`).join(' · ')}`)
  }
  // ⚠️ AUCUN PLAFOND SILENCIEUX : ce qui n'a pas été joué est NOMMÉ.
  if (nonJoues.length > 0) {
    console.log(`\n⏸ ${motifArret()}`)
    console.log(`   ${nonJoues.length} hypothèse(s) NON jouée(s) :`)
    for (const c of nonJoues) console.log(`     · ${c.cle} ${c.categorie} — ${c.title.slice(0, 56)}${c.repere ? '' : ' (ne viserait rien de distinctif)'}`)
    console.log('   Continuer est une décision explicite : relancer avec --budget plus haut.')
  }
  console.log(`\n— Coût de ce run : ${coutDuRun().toFixed(3)} € / ${BUDGET_RUN_EUR.toFixed(2)} € annoncés · cumul atlas : ${cout.toFixed(2)} € / ${PLAFOND_EUR} €`)
  process.exit(nonJoues.length > 0 ? 1 : 0)
}

// ── Phase 2 : fusion dans l'atlas ───────────────────────────────────────────
if (args.includes('--appliquer')) {
  if (!existsSync(RELEVE)) { console.error('✗ Relevé absent : lancer --collecter d’abord.'); process.exit(1) }
  const { resultats } = JSON.parse(readFileSync(RELEVE, 'utf8'))
  const gardees = resultats.filter((r) => r.garde)

  // ⚠️ LE FILTRE PAR HÔTE S'APPLIQUE AUSSI À LA FUSION, et pas seulement à la
  // collecte : un relevé déjà collecté avec l'ancien garde-fou ne doit pas
  // entrer dans l'atlas sous prétexte qu'il a été payé. Appliqué aux 9 entrées
  // gardées le 5 nov. 2026, il n'en laisse passer que 2.
  const { coutUtilisable, rangSource, sourcesPortentLEntree } =
    await import('../supabase/functions/_shared/atlasSource.ts')
  const sortie = JSON.parse(JSON.stringify(defectAtlas))
  const journal = []
  let ajoutees = 0, doublons = 0
  const RANG = { mineure: 0, majeure: 1, casse: 2, securite: 3 }

  let sansSourcePortante = 0
  for (const r of gardees) {
    const urls = (r.sources ?? []).map((s2) => s2.url)
    if (!sourcesPortentLEntree(urls)) {
      sansSourcePortante++
      journal.push({
        cle: r.cle, title: r.title, action: 'refusee_source_commerciale',
        rangs: urls.map(rangSource),
      })
      continue
    }
    const bloc = sortie[r.cle] ?? (sortie[r.cle] = {
      label: r.candidat.label ?? r.cle.charAt(0) + r.cle.slice(1).toLowerCase(),
      // ⚠️ PAS de champ `logo` pour un nouveau bloc : `public/logos/` n'existe
      // pas et aucun écran ne lit ce champ. On ne désigne pas un fichier absent.
      defects: [],
    })
    bloc.defects = bloc.defects ?? []

    // ⚠️ Jamais d'écrasement silencieux d'une entrée existante.
    if (bloc.defects.some((d) => d.title === r.title)) {
      doublons++
      journal.push({ cle: r.cle, title: r.title, action: 'doublon_ignore' })
      continue
    }

    // ⚠️ GRAVITÉ D'UNE ENTRÉE NEUVE, et c'est un choix qu'il faut expliquer.
    // Il n'y a pas de rang d'origine à préserver — la règle « on ne promeut
    // jamais sans coût publié » du sprint 16 ne s'applique donc pas telle
    // quelle. On retient :
    //   · un coût sourcé            ⇒ c'est le coût qui décide (ce que la
    //     fonction a déjà calculé via `appliquerGraviteRemede`) ;
    //   · une source qui qualifie un DANGER ⇒ `securite` ;
    //   · ni l'un ni l'autre        ⇒ `mineure`.
    // Le dernier cas est volontairement BAS : écrire « majeure » (500 à
    // 3 000 €) sans qu'aucune page ne donne de prix serait affirmer une
    // fourchette qu'on n'a pas lue. L'entrée reste affichée avec ses sources
    // et son remède — c'est la NOTE qu'on refuse de fonder sur rien.
    // Un coût publié par un site commercial ne fixe pas la gravité.
    const coutSource = (r.cout_max_eur || 0) > 0 && coutUtilisable(urls)
    const gravite = coutSource ? r.gravite : (r.gravite === 'securite' ? 'securite' : 'mineure')
    if (!coutSource && RANG[r.gravite] > RANG[gravite]) {
      journal.push({ cle: r.cle, title: r.title, action: 'gravite_abaissee', de: r.gravite, vers: gravite, motif: 'aucun coût publié' })
    }

    const id = `${r.cle.toLowerCase()}-${r.candidat.categorie}-${r.title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 44)}`
    bloc.defects.push({
      id,
      severity: gravite === 'securite' || gravite === 'casse' ? 'CRITIQUE' : gravite === 'majeure' ? 'MAJEUR' : 'MINEUR',
      title: r.title,
      description: r.candidat.description,
      models: r.candidat.models,
      years: r.candidat.years,
      categorie: r.candidat.categorie,
      // ⚠️ DÉCLARÉ, jamais déduit de la prose. Liste vide = cette entrée ne
      // vise rien de distinctif et restera une question au vendeur.
      cibles: Array.isArray(r.candidat.cibles) ? r.candidat.cibles : [],
      gravite,
      sources: r.sources.map((s) => ({ url: s.url, title: s.titre || null })),
      url_source: r.sources.map((s) => s.url),
      ...(r.cout_min_eur ? { cout_min_eur: r.cout_min_eur } : {}),
      ...(r.cout_max_eur ? { cout_max_eur: r.cout_max_eur } : {}),
      ...(r.remede ? { remede: r.remede } : {}),
    })
    ajoutees++
    journal.push({ cle: r.cle, title: r.title, action: 'ajoutee', categorie: r.candidat.categorie, gravite, sources: r.sources.length })
  }

  const entete = readFileSync(join(RACINE, 'src/data/defectAtlas.js'), 'utf8').split('export const defectAtlas = ')[0]
    .replace(' * Relevé de sourcing : docs/atlas-sourcing-resultats.json',
      ' * Relevé de sourcing : docs/atlas-sourcing-resultats.json (sprint 16, moteur)\n'
      + ' * et docs/atlas-hors-moteur-resultats.json (sprint 21, hors moteur).\n'
      + ' *\n'
      + ' * ⚠️ Une entrée dont AUCUNE page ne donne le coût est enregistrée en\n'
      + ' * `mineure`, même si son remède est manifestement cher : écrire « majeure »\n'
      + ' * sans avoir lu de fourchette serait affirmer un montant. L\'entrée reste\n'
      + ' * affichée avec ses sources ; c\'est la NOTE qu\'on refuse de fonder sur rien.')
  writeFileSync(join(RACINE, 'src/data/defectAtlas.js'), entete + 'export const defectAtlas = ' + JSON.stringify(sortie, null, 2) + '\n')
  writeFileSync(join(RACINE, 'supabase/functions/_shared/defectAtlas.json'), JSON.stringify(sortie, null, 2) + '\n')
  writeFileSync(JOURNAL, JSON.stringify(journal, null, 2) + '\n')

  const total = Object.values(sortie).reduce((n, b) => n + (b.defects?.length ?? 0), 0)
  const abaissees = journal.filter((j) => j.action === 'gravite_abaissee').length
  console.log(`Atlas fusionné : ${ajoutees} entrée(s) ajoutée(s), ${doublons} doublon(s) ignoré(s).`)
  console.log(`  ${sansSourcePortante} refusée(s) : aucune source officielle ni de presse reconnue.`)
  console.log(`  ${abaissees} gravité(s) abaissée(s) faute de coût publié.`)
  console.log(`  ${Object.keys(sortie).length} marques, ${total} entrées au total.`)
  console.log(`Journal : ${JOURNAL.replace(RACINE + '/', '')}`)
  process.exit(0)
}

console.error('Rien à faire : passer --estimer, --collecter ou --appliquer.')
process.exit(1)
