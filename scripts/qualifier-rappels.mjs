// SPRINT 23 (point 3) — Qualifie « etranger » les rappels de fiche dont TOUTES
// les sources sont d'un pays connu autre que la France (règle de
// `_shared/rappelsApplicables.ts`). Correction de donnée : ni la panne, ni ses
// sources, ni son code ne changent. La fonction admin RE-VÉRIFIE la règle.
//   node scripts/qualifier-rappels.mjs <fiches.json>   → liste, sans jeton
//   node scripts/qualifier-rappels.mjs --appliquer       → écrit (ADMIN_ACCESS_TOKEN)
import { readFileSync, writeFileSync } from 'node:fs'
import { sourcesToutesEtrangeres } from '../supabase/functions/_shared/rappelsApplicables.ts'

const JOURNAL = new URL('../docs/rappels-qualifies-journal.json', import.meta.url)
const aQualifier = (sheets) => sheets.flatMap((s) => {
  const pannes = typeof s.pannes === 'string' ? JSON.parse(s.pannes) : (s.pannes ?? [])
  return pannes.filter((p) => p.rappel_code && p.rappel_portee !== 'mondiale' && p.rappel_portee !== 'etranger'
    && sourcesToutesEtrangeres(p.url_source ?? []).etrangeres)
    .map((p) => ({ id: s.id, fiche: `${s.marque} ${s.famille_moteur}`, panne_titre: p.titre, rappel_code: p.rappel_code,
      pays: sourcesToutesEtrangeres(p.url_source ?? []).pays, sources: p.url_source }))
})

if (!process.argv.includes('--appliquer')) {
  const liste = aQualifier(JSON.parse(readFileSync(process.argv[2], 'utf8')))
  for (const x of liste) console.log(`${x.fiche} · ${x.rappel_code} · ${x.pays.join('/')} · « ${x.panne_titre} »`)
  console.log(`${liste.length} rappel(s) à qualifier`)
} else {
  const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]))
  if (!env.ADMIN_ACCESS_TOKEN) { console.error('Il manque ADMIN_ACCESS_TOKEN dans .env.local.'); process.exit(1) }
  const appel = async (method, body) => {
    const res = await fetch(`${env.REACT_APP_SUPABASE_URL}/functions/v1/admin-defect-sheets`, {
      method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.ADMIN_ACCESS_TOKEN}`, apikey: env.REACT_APP_SUPABASE_ANON_KEY },
      body: body ? JSON.stringify(body) : undefined,
    })
    const j = await res.json().catch(() => null)
    if (!res.ok) { console.error(`  ⚠️ ARRÊT — HTTP ${res.status} : ${JSON.stringify(j)}`); process.exit(1) }
    return j
  }
  const { sheets } = await appel('GET')
  const liste = aQualifier(sheets)
  // Attendus relus : 20U6/L8 (EA824, US) et 61DT02 (G3LC, GR). Autre chose ⇒ arrêt.
  const attendus = ['20U6/L8 (NHTSA 13V450)', '61DT02']
  const codes = liste.map((x) => x.rappel_code).sort()
  if (JSON.stringify(codes) !== JSON.stringify([...attendus].sort())) {
    console.error(`  ⚠️ ARRÊT — liste différente de celle relue : ${JSON.stringify(codes)}`); process.exit(1)
  }
  writeFileSync(JOURNAL, JSON.stringify({ sauvegarde_le: new Date().toISOString(), avant: liste }, null, 1) + '\n')
  for (const x of liste) {
    const r = await appel('PATCH', { id: x.id, qualifier_rappel: { panne_titre: x.panne_titre, rappel_code: x.rappel_code, rappel_portee: 'etranger' } })
    console.log(`  ${x.fiche} : ${r.rappel_code} → information de contexte`)
  }
  console.log('  ⚠️ RETIRER ADMIN_ACCESS_TOKEN de .env.local.')
}
