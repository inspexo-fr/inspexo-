// Test hors ligne du juge stable (sprint 22) : vote et cache. Aucun réseau.
// Usage : node tests/juge-stable.test.mjs
import { readFileSync } from 'node:fs'
import { cleBrute, cleVerif, majorite, verdictsDeLaReponse, voter, VERIF_CACHE_JOURS } from '../supabase/functions/_shared/jugeStable.ts'

let ok_ = 0, ko = 0
const ok = (c, l) => { if (c) ok_++; else { ko++; console.log(`FAIL — ${l}`) } }
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (obtenu ${JSON.stringify(a)}, attendu ${JSON.stringify(b)})`)

// ── Majorité ────────────────────────────────────────────────────────────────
eq(majorite(['soutenue', 'soutenue']), 'soutenue', '2 sur 2')
eq(majorite(['soutenue', 'non_soutenue', 'soutenue']), 'soutenue', '2 sur 3')
eq(majorite(['soutenue', 'non_soutenue', 'mauvais_moteur']), 'non_soutenue', 'dispersion : le doute tranche contre')
eq(majorite(['soutenue', 'mauvais_moteur']), 'non_soutenue', 'égalité à deux : contre')
eq(majorite([]), 'non_soutenue', 'aucun vote : contre')

// ── Clé du cache ────────────────────────────────────────────────────────────
eq(cleBrute('https://a.fr/p#x', 'La Courroie, s’use !', 'eb2-dt'), cleBrute('https://a.fr/p', 'la courroie s use', 'EB2DT'),
  'casse, accents, ponctuation, fragment : même couple')
ok(cleBrute('https://a.fr/p', 'x', 'EB2') !== cleBrute('https://a.fr/p', 'x', 'EP6'), 'autre moteur : autre couple')
ok(cleBrute('https://a.fr/p', 'x', 'EB2') !== cleBrute('https://a.fr/q', 'x', 'EB2'), 'autre page : autre couple')
ok(/^[0-9a-f]{64}$/.test(await cleVerif('https://a.fr', 'x', 'y')), 'clé = sha256 hexadécimal (contrainte de la table)')
eq(VERIF_CACHE_JOURS, 180, 'durée de vie : 180 jours')

// ── Vote ────────────────────────────────────────────────────────────────────
const affs = [{ type: 'panne', texte: 'A' }, { type: 'panne', texte: 'B' }]
const juge = (scenario) => {
  let n = 0
  const appel = async (sous) => {
    const reponse = scenario[n++]
    if (reponse === null) return null
    return { verdicts: sous.map((a, i) => ({ index: i + 1, verdict: reponse[a.texte], justification: `j${n}` })), usage: { input_tokens: 1000, output_tokens: 100 }, modele: 'm' }
  }
  return { appel, appels: () => n }
}
{
  const j = juge([{ A: 'soutenue', B: 'non_soutenue' }, { A: 'soutenue', B: 'non_soutenue' }])
  const v = await voter(j.appel, affs)
  eq(j.appels(), 2, 'deux passages concordants : PAS de troisième')
  eq(v.resultats.map((r) => r.verdict), ['soutenue', 'non_soutenue'], 'verdicts concordants retenus')
  ok(v.resultats.every((r) => r.fiable), 'fiables : à mettre en cache')
}
{
  const j = juge([{ A: 'soutenue', B: 'non_soutenue' }, { A: 'mauvais_moteur', B: 'non_soutenue' }, { A: 'soutenue' }])
  const v = await voter(j.appel, affs)
  eq(j.appels(), 3, 'désaccord : un troisième passage')
  eq(v.resultats[0].verdict, 'soutenue', 'le troisième tranche (2 contre 1)')
  eq(v.resultats[0].votes, ['soutenue', 'mauvais_moteur', 'soutenue'], 'les trois votes sont tracés')
  eq(v.resultats[1].votes.length, 2, 'le troisième passage ne porte QUE sur les affirmations en désaccord')
}
{
  const j = juge([{ A: 'soutenue', B: 'soutenue' }, { A: 'non_soutenue', B: 'soutenue' }, { A: 'mauvais_moteur' }])
  const v = await voter(j.appel, affs)
  eq(v.resultats[0].verdict, 'non_soutenue', 'trois verdicts différents : non soutenue')
}
{
  // Le vote « 2 + 1 si désaccord » rend EXACTEMENT la majorité de trois.
  const V = ['soutenue', 'non_soutenue', 'mauvais_moteur']
  let ecarts = 0
  for (const a of V) for (const b of V) for (const c of V) {
    const j = juge([{ A: a }, { A: b }, { A: c }])
    const v = await voter(j.appel, [{ type: 'panne', texte: 'A' }])
    if (v.resultats[0].verdict !== majorite([a, b, c])) ecarts++
  }
  eq(ecarts, 0, 'équivalent à un vote à trois sur les 27 combinaisons')
}
{
  const j = juge([null, { A: 'soutenue', B: 'soutenue' }, null])
  const v = await voter(j.appel, affs)
  ok(v.resultats.every((r) => !r.fiable), 'un seul passage a répondu : rien n’est fiable, rien ne se fige en cache')
}
{
  // Le silence ne vaut pas accord.
  const appel = async (sous) => ({ verdicts: [], usage: null, modele: 'm' })
  const v = await voter(appel, affs)
  ok(v.resultats.every((r) => r.verdict === 'non_soutenue'), 'aucun verdict rendu : non soutenue')
  // ⚠️ … ET UN SILENCE N'EST JAMAIS FIABLE (défaut du 10 nov. 2026 : deux
  // silences « s'accordaient » et partaient au cache pour 180 jours).
  ok(v.resultats.every((r) => r.fiable === false), 'deux silences ne font pas un verdict fiable : rien au cache')
  ok(v.resultats.every((r) => r.votes.length === 0), 'un silence n’est compté comme aucun vote')
}
{
  // Un vote réel et un silence : pas de majorité, troisième passage, et
  // fiable seulement si deux votes RÉELS existent au bout.
  let n = 0
  const appel = async (sous) => {
    n++
    if (n === 2) return { verdicts: [], usage: null, modele: 'm' }
    return { verdicts: sous.map((_, i) => ({ index: i + 1, verdict: 'soutenue', justification: 'ok' })), usage: null, modele: 'm' }
  }
  const v = await voter(appel, [{ type: 'panne', texte: 'A' }])
  ok(n === 3 && v.resultats[0].verdict === 'soutenue' && v.resultats[0].fiable, 'un silence + deux votes réels concordants : fiable')
}

// ── La forme RÉELLE relevée par le diagnostic du 10 nov. 2026 ──────────────
{
  const brut = { verdicts: '{"verdicts":[{"index":1,"justification":"x","verdict":"non_soutenue"}]}' }
  eq(verdictsDeLaReponse(brut).map((v) => v.verdict), ['non_soutenue'], 'verdicts encodés en chaîne JSON : lus (cause des silences)')
  eq(verdictsDeLaReponse({ verdicts: '[{"index":1,"verdict":"soutenue"}]' }).length, 1, 'chaîne contenant directement la liste : lue')
  eq(verdictsDeLaReponse({ verdicts: [{ index: 1, verdict: 'soutenue' }] }).length, 1, 'liste normale : inchangée')
  eq(verdictsDeLaReponse({ verdicts: 'pas du json' }), [], 'chaîne illisible : vide (donc silence, jamais un vote)')
  eq(verdictsDeLaReponse(null), [], 'réponse absente : vide')
  const fichiers = ['supabase/functions/verification/index.ts', 'supabase/functions/atlas-builder/index.ts',
    'supabase/functions/sources-externes/index.ts', 'supabase/functions/_shared/planBuilder.ts']
  for (const f of fichiers) {
    const src = readFileSync(f, 'utf8')
    ok(/verdictsDeLaReponse\(/.test(src) && !/Array\.isArray\(\w+\.input\?\.verdicts\)/.test(src), `${f} : lit les verdicts par le lecteur partagé`)
  }
}

// ── Garde-fous statiques : le cache AVANT la page, le juge partagé ─────────
const verif = readFileSync('supabase/functions/verification/index.ts', 'utf8')
ok(verif.indexOf('lireCacheVerif(') > 0 && verif.indexOf('lireCacheVerif(') < verif.indexOf('texteDeLaPage(g.url)'),
  'verification : le cache est lu AVANT toute lecture de page')
ok(/aJuger\[i\]\.length \? texteDeLaPage/.test(verif), 'verification : une page entièrement en cache n’est pas lue')
ok(/if \(r\.fiable\)/.test(verif), 'verification : seuls les verdicts fiables sont mis en cache')
const atlas = readFileSync('supabase/functions/atlas-builder/index.ts', 'utf8')
ok(/voter\(/.test(atlas) && /lireCacheVerif\(/.test(atlas), 'atlas-builder : même juge stable (vote + cache)')
ok(/VERIF_SYSTEM/.test(atlas) && /VERIF_TOOL/.test(atlas), 'atlas-builder : même prompt et même outil')
// atlas-builder a gagné un client service role : il ne doit écrire QUE le cache.
const ecritures = [...atlas.matchAll(/\.from\("([a-z_]+)"\)/g)].map((m) => m[1])
eq([...new Set(ecritures)], [], 'atlas-builder n’adresse aucune table en direct (le cache passe par verifSource)')
const vs = readFileSync('supabase/functions/_shared/jugeStable.ts', 'utf8')
eq([...new Set([...vs.matchAll(/\.from\("([a-z_]+)"\)/g)].map((m) => m[1]))], ['verif_cache'], 'le juge stable ne touche que verif_cache')
ok(!/^import /m.test(vs), 'jugeStable.ts : aucun import (testable hors ligne)')
const mig = readFileSync('supabase/migrations/20261125120000_sprint22_juge_cout.sql', 'utf8')
ok(/revoke all on public\.verif_cache from anon, authenticated/.test(mig), 'verif_cache : aucun droit à anon ni authenticated')
ok(!/create policy/i.test(mig), 'aucune policy')

console.log(`\n${ko === 0 ? 'OK' : 'ÉCHEC'} — ${ok_}/${ok_ + ko} contrôles passés`)
if (ko > 0) { console.error(`${ko} échec(s) dans tests/juge-stable.test.mjs`); process.exit(1) }
console.log('Tous les tests juge-stable passent.')
