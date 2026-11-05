// Test hors ligne des aperçus de partage (aucun réseau, aucune base).
// Usage : node tests/apercus.test.mjs
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

let ok_ = 0, ko = 0
const ok = (c, l) => { if (c) { ok_++; console.log(`PASS — ${l}`) } else { ko++; console.log(`FAIL — ${l}`) } }
const lire = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

// ── ⚠️ LES DEUX SEULES VALEURS DE `statut_analyse` ─────────────────────────
//
// `score` n'écrit que 'en_cours' et 'terminee'. Au sprint 15 j'ai écrit un
// filtre `= 'fini'` : la condition était TOUJOURS fausse, et la liste « à
// vérifier » de l'onglet Fiabilité restait vide — sans erreur, sans message.
// Un filtre qui ne rend rien ressemble exactement à « il n'y a rien à faire ».
//
// La règle qui en sort : on EXCLUT l'échec ('en_cours'), on n'énumère jamais
// le succès. Ce contrôle balaie tout le code qui touche à ce champ.
{
  const VALEURS_REELLES = ['en_cours', 'terminee']
  const score = lire('supabase/functions/score/index.ts')
  for (const v of VALEURS_REELLES) {
    ok(score.includes(`statut_analyse: "${v}"`) || score.includes(`statut_analyse = "${v}"`),
      `score écrit bien la valeur « ${v} »`)
  }
  ok(!/statut_analyse['"\s:=]+['"]fini['"]/.test(score), 'score n’emploie nulle part « fini »')

  // ⚠️ Les MIGRATIONS sont exclues du balayage, et ce n'est pas une
  // complaisance : une migration appliquée ne se modifie JAMAIS (règle du
  // projet). Celle du sprint 15 porte le filtre fautif `= 'fini'` et le
  // gardera — c'est l'histoire de ce qui a tourné. Ce qui compte est la
  // DERNIÈRE définition, vérifiée séparément plus bas.
  const fichiers = []
  const dirs = ['api', 'scripts', 'src/pages', 'supabase/functions/score']
  for (const d of dirs) {
    for (const f of readdirSync(new URL(`../${d}`, import.meta.url))) {
      if (/\.(sql|js|jsx|mjs|ts)$/.test(f)) fichiers.push(join(d, f))
    }
  }
  const fautifs = []
  for (const f of fichiers) {
    const src = lire(f)
    if (!src.includes('statut_analyse')) continue
    // Toute comparaison littérale doit porter sur une valeur réelle.
    for (const m of src.matchAll(/statut_analyse[^\n]{0,60}?['"]([a-z_]+)['"]/g)) {
      const v = m[1]
      if (!VALEURS_REELLES.includes(v) && !['statut_analyse', 'vehicule', 'preuve_expiree'].includes(v)) {
        fautifs.push(`${f} → « ${v} »`)
      }
    }
  }
  ok(fautifs.length === 0,
    `aucune comparaison de statut_analyse à une valeur inventée${fautifs.length ? ` — ${fautifs[0]}` : ''}`)
}

// ── Le repli : une balise ne désigne qu'une URL qui répond ─────────────────
{
  const og = lire('api/og.js')
  ok(/async function imageDuDossier/.test(og), 'l’existence du fichier est vérifiée')
  ok(/method: 'HEAD'/.test(og), 'par une requête HEAD, sans télécharger l’image')
  ok(/IMAGE_STATIQUE/.test(og) && (og.match(/return IMAGE_STATIQUE/g) || []).length >= 2,
    'tous les chemins d’échec retombent sur l’image statique')
  ok(/AbortController/.test(og) && /2500/.test(og),
    'avec un délai court : un robot d’aperçu n’attend pas')
  ok(og.indexOf('const image = await imageDuDossier(id)') < og.indexOf('content="${image}"'),
    'l’image est résolue AVANT d’être écrite dans la balise')
  ok(!/api\/og-image/.test(og),
    'plus aucune référence à la génération à la volée, qui rendait 500')

  // ⚠️ La page React garde l'image statique, et c'est délibéré : les robots
  // d'aperçu passent par la réécriture serveur (api/og.js), pas par le rendu
  // React. Faire dépendre une balise d'un appel réseau côté client
  // produirait un aperçu différent selon le chemin — donc invérifiable.
  const page = lire('src/pages/ResultPage.jsx')
  ok(/og:image"\s+content="https:\/\/www\.inspexo\.io\/og-image\.png"/.test(page),
    'la page React garde l’image statique, chemin non emprunté par les robots')
}

// ── Ce que l'image a le droit de montrer ───────────────────────────────────
{
  const s = lire('scripts/apercus.mjs')
  for (const champ of ['marque', 'modele', 'annee', 'motorisation', 'verdict', 'score']) {
    ok(s.includes(champ), `l’aperçu porte « ${champ} », déjà affiché par la page publique`)
  }
  for (const interdit of ['prix', 'vendeur', 'telephone', 'email', 'source_url', 'input_text']) {
    ok(!new RegExp(`d\\.${interdit}`).test(s), `l’aperçu ne porte PAS « ${interdit} »`)
  }
  ok(/document\.fonts\.ready/.test(s),
    'le rendu attend la fonte : sinon l’image sortirait dans la fonte système')
  ok(/woff2/.test(s) && /base64/.test(s),
    'la fonte est embarquée en base64 — un @font-face distant qui n’arrive pas donnerait une mauvaise fonte sans erreur')
}

// ── Le dépôt : bucket public, écriture réservée ────────────────────────────
{
  const sql = lire('supabase/migrations/20261118120000_sprint17_apercus.sql')
  ok(/values \('apercus', 'apercus', true\)/.test(sql), 'le bucket est public — un robot d’aperçu ne porte aucun jeton')
  ok(!/create policy/i.test(sql), 'aucune policy : l’écriture reste au service role')
  ok(/RLS active et zéro policy/.test(sql),
    'le piège du bucket `rapports` est rappelé : une policy lisant `analyses` serait toujours fausse')

  // La DERNIÈRE définition d'`analyses_a_verifier` doit porter le bon filtre.
  // C'est elle qui tourne, pas celle du sprint 15 — laquelle ne rendait
  // JAMAIS une ligne, en silence.
  const corrective = sql.slice(sql.indexOf('create or replace function public.analyses_a_verifier'))
  ok(corrective.length > 100, 'la migration redéfinit analyses_a_verifier')
  ok(/coalesce\(a\.result_json->>'statut_analyse', 'terminee'\) <> 'en_cours'/.test(corrective),
    'avec le bon filtre : on exclut « en_cours », on n’énumère pas le succès')
  ok(!/= 'fini'/.test(corrective), 'et plus aucune comparaison à une valeur inventée')
  // ⚠️ On teste le SQL sans ses commentaires : la migration cite la forme
  // fautive pour l'expliquer, et une recherche naïve la prendrait pour le
  // défaut lui-même. Un contrôle qui confond une explication et une faute
  // apprend à ignorer les contrôles.
  const sqlSansCommentaires = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')
  ok(/analyses_sans_apercu/.test(sql) && !/'fini'/.test(sqlSansCommentaires),
    'aucune comparaison à « fini » dans le SQL exécuté')

  const fn = lire('supabase/functions/apercu/index.ts')
  ok(/function estPng/.test(fn) && /0x89, 0x50, 0x4e, 0x47/.test(fn),
    'la signature du fichier est vérifiée : le bucket est public, on ne se fie pas au type déclaré')
  ok(/TAILLE_MAX/.test(fn), 'la taille est bornée')
  ok(/verifierAdmin/.test(fn) && /evalSecretMatches/.test(fn), 'le dépôt est réservé à l’admin ou au harnais')
}

console.log(`\n${ok_} contrôles passés, ${ko} échec(s).`)
if (ko > 0) process.exit(1)
console.log('Tous les tests aperçus passent.')
