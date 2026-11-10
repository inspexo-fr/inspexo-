// Test COMMUN aux 4 appelants du juge (sprint 23, décision d'Utku du 11 nov. 2026) :
// verdicts rendus en liste, en texte JSON, absents ; un silence n'est jamais un vote ;
// alerte au-delà de 10 % de silences dans un passage.
// Usage : node tests/lecture-juge.test.mjs
import { readFileSync } from 'node:fs'
import { passageTropSilencieux, SEUIL_SILENCE_PASSAGE, verdictsDeLaReponse, voter } from '../supabase/functions/_shared/jugeStable.ts'
import { LIBELLE_MOTIF, PREFIXE_URGENT, sujetAlerte } from '../supabase/functions/_shared/alerting.ts'

let ok_ = 0, ko = 0
const ok = (c, l) => { if (c) ok_++; else { ko++; console.log(`FAIL — ${l}`) } }

const deux = [{ type: 'panne', texte: 'A' }, { type: 'panne', texte: 'B' }]
const liste = [{ index: 1, verdict: 'soutenue', justification: 'a' }, { index: 2, verdict: 'non_soutenue', justification: 'b' }]
const FORMES = {
  liste: { verdicts: liste },
  'texte JSON (forme observée le 10 nov.)': { verdicts: JSON.stringify({ verdicts: liste }) },
  'texte JSON de la liste seule': { verdicts: JSON.stringify(liste) },
  absents: { autre: 1 },
}
// L'appel simulé passe par le MÊME lecteur que les 4 fonctions.
const appelDe = (input) => async () => ({ verdicts: verdictsDeLaReponse(input), usage: null, modele: 'm' })

for (const [nom, input] of Object.entries(FORMES)) {
  const v = await voter(appelDe(input), deux)
  if (nom === 'absents') {
    ok(v.resultats.every((r) => r.votes.length === 0), `${nom} : aucun vote compté`)
    ok(v.resultats.every((r) => r.fiable === false), `${nom} : rien de fiable, donc rien au cache`)
    ok(v.silences.length >= 2 && v.silences.every((s) => s.sans === s.n), `${nom} : chaque passage est compté entièrement muet`)
    ok(v.silences.some((s) => passageTropSilencieux(s.sans, s.n)), `${nom} : l’alerte se déclenche`)
  } else {
    ok(v.resultats[0].verdict === 'soutenue' && v.resultats[1].verdict === 'non_soutenue', `${nom} : verdicts lus`)
    ok(v.resultats.every((r) => r.fiable && r.votes.length === 2), `${nom} : deux votes réels, fiables`)
    ok(v.silences.every((s) => s.sans === 0), `${nom} : aucun silence`)
  }
}
// Un passage à moitié muet : un seul vote réel, jamais fiable.
{
  let n = 0
  const v = await voter(async () => { n++; return n === 1 ? { verdicts: liste.slice(0, 1), usage: null, modele: 'm' } : { verdicts: [], usage: null, modele: 'm' } }, deux)
  ok(v.resultats[1].votes.length === 0 && !v.resultats[1].fiable, 'affirmation jamais notée : aucun vote, pas fiable')
}
// Seuil d'alerte.
ok(SEUIL_SILENCE_PASSAGE === 0.1, 'seuil : 10 %')
ok(!passageTropSilencieux(1, 10), '1 sur 10 = 10 % : pas d’alerte (strictement au-delà)')
ok(passageTropSilencieux(2, 10), '2 sur 10 : alerte')
ok(!passageTropSilencieux(0, 0), 'passage vide : pas d’alerte')
ok(sujetAlerte('silences_juge', 'verification').startsWith(PREFIXE_URGENT) && !!LIBELLE_MOTIF.silences_juge, 'alerte préfixée [URGENT], motif libellé')

// Les 4 appelants : lecteur commun, vote, surveillance des silences.
for (const f of ['supabase/functions/verification/index.ts', 'supabase/functions/atlas-builder/index.ts',
  'supabase/functions/sources-externes/index.ts', 'supabase/functions/_shared/planBuilder.ts']) {
  const s = readFileSync(f, 'utf8')
  ok(/verdictsDeLaReponse\(/.test(s), `${f} : lecteur commun`)
  ok(/await voter\(/.test(s), `${f} : vote à deux passages`)
  ok(/surveillerSilences\(/.test(s), `${f} : surveillance des silences`)
  ok(!/input\??\.verdicts(?!\s*\?\?\s*null)/.test(s.replace(/BRUTS\?\.push\([^)]*\)/g, '')), `${f} : aucune lecture directe de input.verdicts`)
}
console.log(`\n${ko === 0 ? 'OK' : 'ÉCHEC'} — ${ok_}/${ok_ + ko} contrôles passés`)
if (ko > 0) { console.error(`${ko} échec(s) dans tests/lecture-juge.test.mjs`); process.exit(1) }
console.log('Tous les tests lecture-juge passent.')
