#!/usr/bin/env node
// SPRINT 1.5 — Éval de non-régression du score d'annonce.
// Rejoue chaque cas de tests/eval/ contre la fonction `score` déployée
// (bypass du rate limit via EVAL_BYPASS_SECRET) et échoue (exit 1) si :
//   - le statut HTTP ne correspond pas,
//   - le verdict sort de la plage [verdict_min, verdict_max],
//   - le score sort de [score_min, score_max],
//   - un must_not_include apparaît dans la sortie (score + rappels),
//   - un must_include manque,
//   - statut_vendeur / famille_moteur ne correspondent pas,
//   - statut_in_raisons12 : le statut vendeur n'est pas en raison 1 ou 2,
//   - rappels_min : pas assez de rappels trouvés.
// BLOQUANT avant tout deploy.
//
// Usage : npm run eval  (ou node scripts/eval.mjs [nom-de-cas])
import { readFileSync, readdirSync, existsSync, writeFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { coutProchainCas, murAtteint } from './budget.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const EVAL_DIR = join(ROOT, 'tests', 'eval')

// ---------- env ----------
function loadEnv() {
  const env = {}
  for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)="?([^"\n]*)"?$/)
    if (m) env[m[1]] = m[2]
  }
  return env
}
const env = loadEnv()
const URL_BASE = env.REACT_APP_SUPABASE_URL
const ANON = env.REACT_APP_SUPABASE_ANON_KEY
const EVAL_SECRET = env.EVAL_BYPASS_SECRET
if (!URL_BASE || !ANON || !EVAL_SECRET) {
  console.error('env manquant : REACT_APP_SUPABASE_URL / REACT_APP_SUPABASE_ANON_KEY / EVAL_BYPASS_SECRET dans .env.local')
  process.exit(2)
}

const SEVERITY = { rouge: 0, orange: 1, vert: 2 }
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const normFam = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')

async function post(path, body, timeoutMs = 170_000) {
  const res = await fetch(`${URL_BASE}/functions/v1/${path}`, {
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ANON}`,
      apikey: ANON,
      'x-eval-secret': EVAL_SECRET,
    },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => null)
  return { status: res.status, json }
}

/**
 * Cas « rappels_cache » : ne consomme aucun token (il n'appelle que la
 * fonction `rappels`). Vérifie contre la fonction DÉPLOYÉE qu'une réponse
 * vide de RappelConso n'est jamais mise en cache, qu'une source injoignable
 * est annoncée comme telle, et qu'un résultat non vide reste caché 24 h.
 * Le signal observable côté client est le drapeau `cache` de la réponse :
 * si un vide avait été mis en cache, le second appel le servirait.
 */
async function runCaseRappelsCache(expected) {
  const t0 = Date.now()
  const failures = []

  // 1. Modèle réel sans aucun rappel : constat exact, mais JAMAIS mis en cache.
  const vide1 = await post('rappels', expected.modele_sans_rappel, 40_000)
  const vide2 = await post('rappels', expected.modele_sans_rappel, 40_000)
  for (const [i, r] of [vide1, vide2].entries()) {
    if (r.status !== 200) failures.push(`appel ${i + 1} (modèle sans rappel) : HTTP ${r.status}`)
    if (r.json?.cache === true) {
      failures.push(`appel ${i + 1} : une réponse VIDE a été servie depuis le cache (incident 28/10)`)
    }
    if (!Array.isArray(r.json?.rappels) || r.json.rappels.length !== 0) {
      failures.push(`appel ${i + 1} : rappels attendus vides, reçu ${JSON.stringify(r.json?.rappels)?.slice(0, 80)}`)
    }
    if (r.json?.indisponible === true) {
      failures.push(`appel ${i + 1} : marque interrogeable, l'état « indisponible » n'a pas lieu d'être`)
    }
  }

  // 2. Source injoignable : on le DIT, on n'affiche pas « aucun rappel ».
  const ko = await post('rappels', expected.marque_non_interrogeable, 40_000)
  if (ko.json?.indisponible !== true) {
    failures.push('source injoignable : drapeau indisponible absent')
  }
  if (ko.json?.rappels !== null) {
    failures.push(`source injoignable : rappels doit être null (reçu ${JSON.stringify(ko.json?.rappels)?.slice(0, 60)})`)
  }
  if (ko.json?.message_indisponible !== expected.message_indisponible) {
    failures.push(`message d'indisponibilité inattendu : « ${ko.json?.message_indisponible} »`)
  }
  if (ko.json?.takata == null) {
    failures.push('source injoignable : le check Takata doit rester rendu')
  }

  // 3. Contrôle positif : un résultat non vide est bien caché 24 h.
  const plein1 = await post('rappels', expected.modele_avec_rappels, 40_000)
  const plein2 = await post('rappels', expected.modele_avec_rappels, 40_000)
  const total = (r) => (r.json?.rappels?.length ?? 0) + (r.json?.autres_rappels?.length ?? 0)
  if (total(plein1) === 0) {
    failures.push('contrôle positif : aucun rappel trouvé pour un modèle qui en a (source en panne ?)')
  } else if (plein2.json?.cache !== true) {
    failures.push('contrôle positif : un résultat non vide devrait être servi depuis le cache au 2e appel')
  }

  return { failures, ms: Date.now() - t0, verdict: null, score: null, id: null }
}

async function runCase(name) {
  const dir = join(EVAL_DIR, name)
  const expected = JSON.parse(readFileSync(join(dir, 'expected.json'), 'utf8'))
  if (expected.type === 'rappels_cache') return runCaseRappelsCache(expected)
  const annonce = readFileSync(join(dir, 'annonce.txt'), 'utf8').trim()
  const input = existsSync(join(dir, 'input.json'))
    ? JSON.parse(readFileSync(join(dir, 'input.json'), 'utf8'))
    : {}
  // Photos du cas (photos/*.jpg|png) → images base64, comme le ferait /score.
  const photosDir = join(dir, 'photos')
  if (existsSync(photosDir)) {
    input.images = readdirSync(photosDir)
      .filter((f) => /\.(jpe?g|png)$/i.test(f))
      .sort()
      .map((f) => {
        const mime = /\.png$/i.test(f) ? 'image/png' : 'image/jpeg'
        return `data:${mime};base64,${readFileSync(join(photosDir, f)).toString('base64')}`
      })
  }

  const failures = []
  const t0 = Date.now()

  const forcage = MODELE_SECOURS ? { force_model: 'claude-sonnet-4-6' } : {}
  let { status, json } = await post('score', { text: annonce, no_cache: true, ...forcage, ...input })

  // Fiche moteur encore en génération ? Un retry après 50 s.
  if (
    status === 200 &&
    json?.result?.fiche?.cache === 'pending' &&
    (expected.must_include?.length || expected.famille_moteur)
  ) {
    process.stdout.write('  (fiche en génération — retry dans 50 s)\n')
    await new Promise((r) => setTimeout(r, 50_000))
    ;({ status, json } = await post('score', { text: annonce, no_cache: true, ...forcage, ...input }))
  }

  const expectedStatus = expected.http_status ?? 200
  if (status !== expectedStatus) {
    failures.push(`HTTP ${status} ≠ attendu ${expectedStatus} — ${JSON.stringify(json).slice(0, 150)}`)
    return { failures, ms: Date.now() - t0 }
  }
  if (expectedStatus !== 200) return { failures, ms: Date.now() - t0 }

  const r = json.result
  let haystack = JSON.stringify(r)

  // Rappels (inclus dans le texte vérifié + assertion rappels_min)
  let rappels = null
  if (r.vehicule?.marque && r.vehicule?.modele) {
    try {
      const rr = await post('rappels', {
        marque: r.vehicule.marque,
        modele: r.vehicule.modele,
        annee: r.vehicule.annee,
        carburant: r.vehicule.carburant ?? null,
        analysis_id: json.id,
      }, 30_000)
      rappels = rr.json
      haystack += JSON.stringify(rappels)
    } catch (_) { /* rappels indisponibles : rappels_min échouera le cas échéant */ }
  }
  const hay = norm(haystack)

  // Verdict / score
  if (expected.verdict_min && SEVERITY[r.verdict] < SEVERITY[expected.verdict_min]) {
    failures.push(`verdict ${r.verdict} < min ${expected.verdict_min}`)
  }
  if (expected.verdict_max && SEVERITY[r.verdict] > SEVERITY[expected.verdict_max]) {
    failures.push(`verdict ${r.verdict} > max ${expected.verdict_max}`)
  }
  if (expected.score_min != null && r.score < expected.score_min) {
    failures.push(`score ${r.score} < min ${expected.score_min}`)
  }
  if (expected.score_max != null && r.score > expected.score_max) {
    failures.push(`score ${r.score} > max ${expected.score_max}`)
  }

  // Statut vendeur / famille moteur
  if (expected.statut_vendeur && r.statut_vendeur !== expected.statut_vendeur) {
    failures.push(`statut_vendeur ${r.statut_vendeur} ≠ ${expected.statut_vendeur}`)
  }
  if ('famille_moteur' in expected) {
    const actual = r.vehicule?.famille_moteur ?? null
    if (expected.famille_moteur === null) {
      if (actual !== null) failures.push(`famille_moteur ${actual} ≠ null attendu`)
    } else {
      const a = normFam(actual), e = normFam(expected.famille_moteur)
      if (!a || (!a.startsWith(e) && !e.startsWith(a))) {
        failures.push(`famille_moteur ${actual} incompatible avec ${expected.famille_moteur}`)
      }
    }
  }

  // Statut vendeur en raison 1 ou 2
  if (expected.statut_in_raisons12) {
    const deuxPremieres = (r.raisons_principales || []).slice(0, 2).map(norm).join(' ')
    if (!/intermediaire|deguis|depot[- ]vente|mandataire|agence|garantie legale/.test(deuxPremieres)) {
      failures.push('statut vendeur absent des raisons 1-2')
    }
  }

  // Rappels minimum (principaux + bloc replié « autres générations »)
  if (expected.rappels_min != null) {
    const n = (Array.isArray(rappels?.rappels) ? rappels.rappels.length : 0) +
      (Array.isArray(rappels?.autres_rappels) ? rappels.autres_rappels.length : 0)
    if (n < expected.rappels_min) failures.push(`rappels ${n} < min ${expected.rappels_min}`)
  }

  // checklist_must_include : présence exigée DANS la checklist précisément
  if (expected.checklist_must_include?.length) {
    const chk = norm(JSON.stringify(r.checklist_sur_place || []))
    for (const needle of expected.checklist_must_include) {
      const alts = Array.isArray(needle) ? needle : [needle]
      if (!alts.some((a) => chk.includes(norm(a)))) {
        failures.push(`checklist_must_include manquant : "${alts.join('|')}"`)
      }
    }
  }

  // raisons_must_not_include : interdit DANS les raisons principales précisément
  if (expected.raisons_must_not_include?.length) {
    const ra = norm(JSON.stringify(r.raisons_principales || []))
    for (const needle of expected.raisons_must_not_include) {
      if (ra.includes(norm(needle))) failures.push(`raisons_must_not_include présent : "${needle}"`)
    }
  }

  // entretien_non_penalise : l'axe historique_entretien est null OU ≥ 12
  if (expected.entretien_non_penalise) {
    const note = r.score_detail?.historique_entretien?.note
    if (note != null && note < 12) failures.push(`axe entretien pénalisé : ${note}/20`)
  }

  // questions_must_not_include : interdit DANS les questions vendeur précisément
  if (expected.questions_must_not_include?.length) {
    const q = norm(JSON.stringify(r.questions_vendeur || []))
    for (const needle of expected.questions_must_not_include) {
      if (q.includes(norm(needle))) failures.push(`questions_must_not_include présent : "${needle}"`)
    }
  }

  // rappels_principaux_must_not_include : interdit DANS les rappels principaux
  if (expected.rappels_principaux_must_not_include?.length) {
    const rp = norm(JSON.stringify(rappels?.rappels || []))
    for (const needle of expected.rappels_principaux_must_not_include) {
      if (rp.includes(norm(needle))) failures.push(`rappels_principaux_must_not_include présent : "${needle}"`)
    }
  }

  // incoherences_must_include : présence exigée DANS le champ incoherences
  if (expected.incoherences_must_include?.length) {
    const inc = norm(JSON.stringify(r.incoherences || []))
    for (const needle of expected.incoherences_must_include) {
      const alts = Array.isArray(needle) ? needle : [needle]
      if (!alts.some((a) => inc.includes(norm(a)))) {
        failures.push(`incoherences_must_include manquant : "${alts.join('|')}"`)
      }
    }
  }

  // incoherences_must_not_include : interdit DANS le champ incoherences précisément
  if (expected.incoherences_must_not_include?.length) {
    const inc = norm(JSON.stringify(r.incoherences || []))
    for (const needle of expected.incoherences_must_not_include) {
      if (inc.includes(norm(needle))) {
        failures.push(`incoherences_must_not_include présent : "${needle}"`)
      }
    }
  }

  // Invariante produit : une analyse de véhicule publie toujours au moins une
  // raison principale (sinon la page de résultat n'explique rien).
  if (r.type === 'vehicule' && (r.raisons_principales || []).length === 0) {
    failures.push('aucune raison principale (invariante produit)')
  }

  // Invariante produit (cohérence) : un point rassurant « entretien global »
  // (« entretien à jour », « carnet complet »…) ne peut pas coexister avec une
  // opération déclarée non faite ou une contradiction d'entretien.
  {
    const negatifs = [
      ...(r.entretien?.operations_non_faites || []),
      ...(r.entretien?.contradictions || []),
    ]
    const GLOBAL_ENTRETIEN_RE =
      /entretien[^.]{0,40}(a jour|complet|suivi|rigoureux|regulier)|carnet[^.]{0,30}complet|historique[^.]{0,30}(complet|suivi)|revisions?[^.]{0,25}(faites?|a jour|effectu)/
    const prIncoherent = (r.points_rassurants || []).map(norm).find((p) => GLOBAL_ENTRETIEN_RE.test(p))
    if (negatifs.length > 0 && prIncoherent) {
      failures.push(`point rassurant incohérent avec une opération non faite : "${prIncoherent.slice(0, 80)}"`)
    }
  }

  // verdict_conditionnel : couleur attendue si la couverture de garantie joue
  if (expected.verdict_conditionnel) {
    const vc = r.verdict_conditionnel
    if (!vc) failures.push('verdict_conditionnel absent')
    else if (vc.verdict !== expected.verdict_conditionnel) {
      failures.push(`verdict_conditionnel ${vc.verdict} ≠ ${expected.verdict_conditionnel}`)
    } else if (vc.score <= r.score) {
      failures.push(`verdict_conditionnel ${vc.score} ≤ score affiché ${r.score}`)
    }
  }

  // photos_bloc : true = des constats photo doivent exister ; false = aucun
  if ('photos_bloc' in expected) {
    const n = Array.isArray(r.constats_photo) ? r.constats_photo.length : 0
    if (expected.photos_bloc && n === 0) failures.push('photos_bloc attendu mais constats_photo vide')
    if (!expected.photos_bloc && n > 0) failures.push(`photos_bloc interdit mais ${n} constat(s) photo`)
  }

  // ── Mode revendeur (sprint 19) ───────────────────────────────────────────
  //
  // ⚠️ `revendeur_comparables_min: 0` est un cas À PART ENTIÈRE, pas un cas
  // vide : il exige qu'AUCUN chiffre ne sorte sous le seuil de six. C'est la
  // moitié de la règle, et c'est celle qui protège l'utilisateur.
  if ('revendeur_comparables_min' in expected) {
    const rv = r.revendeur
    if (!rv) failures.push('bloc revendeur absent')
    else {
      const n = rv.comparables?.retenus ?? 0
      if (n < expected.revendeur_comparables_min) {
        failures.push(`revendeur : ${n} comparables retenus < ${expected.revendeur_comparables_min} ` +
          `(reçus ${rv.comparables?.recus ?? 0}, écartés : ${JSON.stringify(rv.comparables?.ecartes || [])})`)
      }
      if (expected.revendeur_comparables_min < 6 && rv.revente != null) {
        failures.push('revendeur : un prix de revente est sorti SOUS le seuil de 6 comparables')
      }
    }
  }

  // revendeur_revente : fourchette attendue du prix de revente réaliste.
  if (expected.revendeur_revente_min != null || expected.revendeur_revente_max != null) {
    const v = r.revendeur?.revente?.valeur
    if (v == null) failures.push('revendeur : aucun prix de revente alors qu’il en était attendu un')
    else {
      if (expected.revendeur_revente_min != null && v < expected.revendeur_revente_min) {
        failures.push(`revendeur : revente ${v} € < min ${expected.revendeur_revente_min} €`)
      }
      if (expected.revendeur_revente_max != null && v > expected.revendeur_revente_max) {
        failures.push(`revendeur : revente ${v} € > max ${expected.revendeur_revente_max} €`)
      }
    }
  }

  // revendeur_ordre : les trois chiffres doivent rester ordonnés. Une offre
  // d'ouverture supérieure au prix d'achat maximum, ou un prix d'achat
  // supérieur au prix de revente, ne serait pas une imprécision : ce serait
  // une consigne de perdre de l'argent.
  if (expected.revendeur_ordre) {
    const rv = r.revendeur
    const re = rv?.revente?.valeur, am = rv?.achat_max?.valeur, of = rv?.offre
    // ⚠️ Une affaire qui NE PASSE PAS est un résultat valide, pas un trou :
    // les coûts peuvent dépasser le prix de revente. Dans ce cas il n y a ni
    // offre d ouverture ni message vendeur, et c est ce qu on exige.
    if (rv?.achat_max && rv.achat_max.possible === false) {
      if (of != null) failures.push(`revendeur : offre ${of} € alors qu il n y a aucune marge`)
      if ((rv.message_vendeur || "") !== "") failures.push("revendeur : message vendeur alors qu il n y a aucune marge")
      if (!(rv.achat_max.manque_eur > 0)) failures.push("revendeur : aucune marge mais le manque n est pas chiffré")
    } else if (re == null || am == null || of == null) {
      failures.push(`revendeur_ordre : un des trois chiffres manque (revente ${re}, achat ${am}, offre ${of})`)
    } else {
      if (!(am <= re)) failures.push(`revendeur : achat max ${am} € > revente ${re} €`)
      if (!(of <= am)) failures.push(`revendeur : offre ${of} € > achat max ${am} €`)
      if (of % 50 !== 0) failures.push(`revendeur : offre ${of} € non arrondie à la cinquantaine`)
    }
  }

  // revendeur_mention : la phrase obligatoire doit être là, mot pour mot.
  if (expected.revendeur_mention) {
    const m = r.revendeur?.mention || ''
    if (!m.includes('ni une valeur du véhicule ni une garantie de revente')) {
      failures.push(`revendeur : mention obligatoire absente ou modifiée ("${m.slice(0, 80)}")`)
    }
  }

  // revendeur_vocabulaire_interdit : « valeur », « cote », « expertise » ne
  // doivent apparaître NI dans le message vendeur NI dans les libellés de
  // coût. Déterminer la valeur d'un véhicule est réservé aux experts en
  // automobile inscrits (art. L326-4 I-2° du code de la route).
  if (expected.revendeur_vocabulaire_interdit) {
    const rv = r.revendeur || {}
    const aControler = [
      rv.message_vendeur || '',
      JSON.stringify(rv.achat_max?.lignes || []),
      JSON.stringify(rv.arguments || []),
    ].join(' ')
    for (const mot of ['cote du vehicule', 'expertise', 'valeur du vehicule', 'estimation']) {
      if (norm(aControler).includes(norm(mot))) {
        failures.push(`revendeur : vocabulaire interdit « ${mot} » dans ce qui est restitué`)
      }
    }
  }

  // revendeur_message_doit_chiffrer : chaque ligne d'argument du message
  // vendeur porte un montant. Un argument sans chiffre annonce au vendeur
  // qu'on négocie sans savoir sur quoi.
  if (expected.revendeur_message_doit_chiffrer && r.revendeur?.achat_max?.possible !== false) {
    const msg = r.revendeur?.message_vendeur || ''
    const lignes = msg.split('\n').filter((l) => l.startsWith('- '))
    if (lignes.length < 1) failures.push('revendeur : message vendeur sans aucun argument chiffré')
    for (const l of lignes) {
      if (!/\d/.test(l)) failures.push(`revendeur : argument sans montant dans le message : "${l.slice(0, 60)}"`)
    }
  }

  // must_include / must_not_include (une entrée tableau = alternatives, OU logique)
  for (const needle of expected.must_include || []) {
    const alts = Array.isArray(needle) ? needle : [needle]
    if (!alts.some((a) => hay.includes(norm(a)))) {
      failures.push(`must_include manquant : "${alts.join('|')}"`)
    }
  }
  for (const needle of expected.must_not_include || []) {
    if (hay.includes(norm(needle))) failures.push(`must_not_include présent : "${needle}"`)
  }

  ajouterCout(json.cout_eur)
  return { failures, ms: Date.now() - t0, verdict: r.verdict, score: r.score, id: json.id }
}

// ---------- main ----------
// Un nom seul : ce cas-là. Plusieurs noms (`--cas a,b,c`) : CES cas, DANS CET
// ORDRE, en UN SEUL run.
//
// ⚠️ Pourquoi c'est important : le mur budgétaire (`--budget`) vit dans un
// run. Jouer cinq cas par cinq invocations remettrait le compteur du run à
// zéro cinq fois, et le mur ne protégerait plus de rien. L'ordre compte
// aussi : on place d'abord ce qu'on ne veut surtout pas perdre si le budget
// s'épuise.
const only = process.argv.slice(2).find((a) => !a.startsWith('--'))
const LISTE = (() => {
  const i = process.argv.indexOf('--cas')
  if (i < 0) return null
  return String(process.argv[i + 1] || '').split(',').map((s) => s.trim()).filter(Boolean)
})()
const tousLesCas = readdirSync(EVAL_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
if (LISTE) {
  const inconnus = LISTE.filter((n) => !tousLesCas.includes(n))
  if (inconnus.length) {
    console.error(`Cas inconnu(s) : ${inconnus.join(', ')}`)
    process.exit(1)
  }
}
const cases = LISTE
  ? LISTE // l'ordre demandé, pas l'ordre alphabétique
  : tousLesCas.filter((n) => !only || n === only).sort()

// ---------------------------------------------------------------------------
// Compteur de coût : chaque analyse renvoie son coût réel (cout_eur).
// Garde-fou : on s'arrête avant de dépasser PLAFOND_EUR dans une même session.
// ---------------------------------------------------------------------------
const SANS_STABILITE = process.argv.includes('--sans-stabilite')
// --stabilite-seule : rejoue uniquement la phase de stabilité (3 cas fixes),
// sans repayer la passe fonctionnelle.
const STABILITE_SEULE = process.argv.includes('--stabilite-seule')
const MODELE_SECOURS = process.argv.includes('--modele-secours')
// --repetitions N : rejoue le cas demandé N fois (campagne de stabilité).
// Les appels directs en curl échappent au compteur de coût : toute campagne
// doit passer par ici (règle posée le 28/10/2026).
const REPETITIONS = (() => {
  const i = process.argv.indexOf('--repetitions')
  const n = i >= 0 ? parseInt(process.argv[i + 1], 10) : 1
  return Number.isFinite(n) && n >= 1 && n <= 10 ? n : 1
})()
const COUT_FICHIER = join(EVAL_DIR, '..', '..', '.eval-cout.json')
// ⚠️ LE BUDGET ANNONCÉ EST UN MUR, PAS UN REPÈRE (règle du 5 nov. 2026).
//
// Le 5 novembre, un correctif annoncé à 0,60 € a coûté 2,31 € : chaque
// relance se justifiait seule — comprendre un motif d'échec, obtenir un
// dossier à inspecter, vérifier les autres références — et personne n'a
// jamais décidé d'y mettre quatre fois la somme. Un plafond de session à 5 €
// ne protège de rien quand le budget du jour est de 0,60 €.
//
// `--budget <eur>` fixe le mur de CE run. Le script s'arrête tout seul en
// l'atteignant et dit ce qu'il n'a pas joué. Pour aller au-delà, il faut une
// décision explicite — relancer avec un budget plus haut.
const PLAFOND_SESSION_EUR = 5
const BUDGET_RUN_EUR = (() => {
  const i = process.argv.indexOf('--budget')
  const v = i >= 0 ? Number(process.argv[i + 1]) : NaN
  return Number.isFinite(v) && v > 0 ? v : null
})()
const PLAFOND_EUR = PLAFOND_SESSION_EUR
if (process.argv.includes('--reset-cout') && existsSync(COUT_FICHIER)) rmSync(COUT_FICHIER)
let coutSession = existsSync(COUT_FICHIER)
  ? (JSON.parse(readFileSync(COUT_FICHIER, 'utf8')).total_eur ?? 0)
  : 0
const coutDepart = coutSession
let coutRun = 0
const ajouterCout = (eur) => {
  if (typeof eur !== 'number') return
  coutRun += eur
  coutSession += eur
  writeFileSync(COUT_FICHIER, JSON.stringify({ total_eur: Math.round(coutSession * 10000) / 10000, maj: new Date().toISOString() }, null, 2))
}
// Le run s'arrête au PREMIER des deux murs atteint : le budget annoncé pour
// ce run, ou le plafond de session. La décision est prise par le module PUR
// `scripts/budget.mjs`, testé hors ligne — elle réserve le coût du PROCHAIN
// cas, sans quoi le mur serait toujours franchi d'un cas (constaté le 5 nov. :
// 0,447 € pour un run annoncé à 0,40 €).
let casJoues = 0
const coutProchain = () => coutProchainCas(coutRun, casJoues)
const murDuRun = () => murAtteint({
  coutRun, casJoues, coutSession, budgetRun: BUDGET_RUN_EUR, plafondSession: PLAFOND_EUR,
})
const budgetDepasse = () => murDuRun() !== null
const motifArret = () =>
  murDuRun() === 'run'
    ? `budget annoncé de ce run atteint (${coutRun.toFixed(3)} € dépensés, ` +
      `${coutProchain().toFixed(3)} € à réserver pour le cas suivant, mur à ${BUDGET_RUN_EUR.toFixed(2)} €)`
    : `plafond de session atteint (${coutSession.toFixed(2)} € + ${coutProchain().toFixed(3)} € > ${PLAFOND_EUR} €)`

let failed = 0
console.log(`Éval Inspexo — ${cases.length} cas contre ${URL_BASE}${MODELE_SECOURS ? ' — MODÈLE DE SECOURS forcé' : ''}\n`)
for (const name of STABILITE_SEULE ? [] : cases) {
  if (budgetDepasse()) {
    console.log(`\n⏸ ${motifArret()}. Cas restants NON joués.`)
    console.log('   Pour aller au-delà, c’est une décision explicite :')
    console.log('   relancer avec --budget <eur> plus haut, ou --reset-cout.')
    break
  }
  process.stdout.write(`▶ ${name}${REPETITIONS > 1 ? ` (${REPETITIONS} passages)` : ''}\n`)
  const passages = []
  for (let rep = 0; rep < REPETITIONS; rep++) {
    if (rep > 0 && budgetDepasse()) {
      console.log(`    ⏸ budget atteint après ${rep} passage(s)`)
      break
    }
    try {
      const { failures, ms, verdict, score, id } = await runCase(name)
      casJoues += 1
      passages.push({ verdict, score })
      if (failures.length === 0) {
        console.log(`  PASS (${(ms / 1000).toFixed(1)}s${verdict ? ` — ${verdict} ${score}` : ''})${id ? ` — /a/${id}` : ''}`)
      } else {
        failed++
        // ⚠️ L'URL SURTOUT EN CAS D'ÉCHEC. Elle n'était imprimée qu'au
        // succès : sur un échec, il fallait relancer une analyse PAYANTE pour
        // pouvoir regarder le dossier. C'est exactement au moment où ça rate
        // qu'on a besoin d'aller voir.
        console.log(`  FAIL (${(ms / 1000).toFixed(1)}s${verdict ? ` — ${verdict} ${score}` : ''})${id ? ` — /a/${id}` : ''}`)
        for (const f of failures) console.log(`    ✗ ${f}`)
      }
    } catch (e) {
      failed++
      console.log(`  FAIL — exception : ${e.message}`)
    }
  }
  // Verdict de stabilité sur la campagne.
  if (REPETITIONS > 1) {
    const scores = passages.map((p) => p.score).filter((s) => typeof s === 'number')
    const couleurs = [...new Set(passages.map((p) => p.verdict).filter(Boolean))]
    if (scores.length > 1) {
      const ecart = Math.max(...scores) - Math.min(...scores)
      const stable = ecart <= 5 && couleurs.length === 1
      if (!stable) failed++
      console.log(
        `  ${stable ? 'STABLE' : 'INSTABLE'} — scores ${scores.join(' / ')} · écart ${ecart} pt${ecart > 1 ? 's' : ''} · ${couleurs.join(', ')}`,
      )
    }
  }
  console.log('')
}
if (!STABILITE_SEULE) {
  console.log(failed === 0 ? `✓ ${cases.length}/${cases.length} cas passent` : `✗ ${failed}/${cases.length} cas échouent`)
}

// ---------------------------------------------------------------------------
// STABILITÉ : chaque cas analysable est rejoué 3 fois sans cache.
// Exigence : écart de score ≤ 5 points ET même couleur de verdict.
// `npm run eval -- --sans-stabilite` saute cette phase.
// ---------------------------------------------------------------------------
const RUNS = 3
const ECART_MAX = 5
let instables = 0

if ((!SANS_STABILITE && failed === 0) || STABILITE_SEULE) {
  // Trois cas fixes suffisent : un rouge chargé, un orange avec rappel, un vert.
  const CAS_STABILITE = ['audi-s7-intermediaire', '308-puretech-complete', 'mercedes-2025-societe']
  const analysables = cases.filter((n) => CAS_STABILITE.includes(n))
  console.log(`\nStabilité — ${analysables.length} cas × ${RUNS} analyses (sans cache)\n`)
  for (const name of analysables) {
    const dir = join(EVAL_DIR, name)
    const annonce = readFileSync(join(dir, 'annonce.txt'), 'utf8').trim()
    const input = existsSync(join(dir, 'input.json'))
      ? JSON.parse(readFileSync(join(dir, 'input.json'), 'utf8'))
      : {}
    const photosDir = join(dir, 'photos')
    if (existsSync(photosDir)) {
      input.images = readdirSync(photosDir)
        .filter((f) => /\.(jpe?g|png)$/i.test(f)).sort()
        .map((f) => `data:${/\.png$/i.test(f) ? 'image/png' : 'image/jpeg'};base64,${readFileSync(join(photosDir, f)).toString('base64')}`)
    }
    // En série : trois analyses simultanées (4 appels modèle chacune) saturent
    // l'API et produisent des faux négatifs par timeout.
    const runs = []
    for (let i = 0; i < RUNS; i++) {
      if (budgetDepasse()) break
      const r = await post('score', { text: annonce, no_cache: true, ...input }).catch(() => null)
      if (r?.json?.cout_eur) ajouterCout(r.json.cout_eur)
      runs.push(r)
    }
    const scores = runs.filter((r) => r?.status === 200).map((r) => r.json.result.score)
    const verdicts = [...new Set(runs.filter((r) => r?.status === 200).map((r) => r.json.result.verdict))]
    if (scores.length < RUNS) {
      instables++
      console.log(`▶ ${name}\n  FAIL — ${RUNS - scores.length}/${RUNS} analyse(s) en erreur`)
      continue
    }
    const ecart = Math.max(...scores) - Math.min(...scores)
    const ok = ecart <= ECART_MAX && verdicts.length === 1
    if (!ok) instables++
    console.log(`▶ ${name}\n  ${ok ? 'PASS' : 'FAIL'} — scores ${scores.join(', ')} (écart ${ecart} ≤ ${ECART_MAX}), verdict${verdicts.length > 1 ? 's' : ''} ${verdicts.join('/')}`)
  }
  console.log(instables === 0 ? '\n✓ stabilité : tous les cas sont reproductibles' : `\n✗ stabilité : ${instables} cas instable(s)`)
}
console.log(`\n— Coût de ce run : ${coutRun.toFixed(3)} €${
  BUDGET_RUN_EUR != null ? ` / ${BUDGET_RUN_EUR.toFixed(2)} € annoncés` : ''
} · cumul session : ${coutSession.toFixed(2)} € / ${PLAFOND_EUR} €` +
  (coutDepart > 0 ? ` (dont ${coutDepart.toFixed(2)} € avant ce run)` : ''))

process.exit(failed === 0 && instables === 0 ? 0 : 1)
