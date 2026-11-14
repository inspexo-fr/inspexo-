// SPRINT 24, campagne 1 — COÛTS MANQUANTS (décision d'Utku du 13 nov. 2026).
// Phase « releve » (GRATUITE, aucune IA) : pour chaque panne CONFIRMÉE sans
// coût des moteurs courants, relit ses pages portantes et relève les phrases
// qui donnent un montant en euros à côté d'un mot du défaut. Sortie :
// docs/couts-manquants-releve.json, à relire avant tout appel au juge.
//   node scripts/couts-manquants.mjs --releve
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { sourcesPortentLEntree, rangSource } from '../supabase/functions/_shared/atlasSource.ts'

const env = {}
for (const l of (existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '').split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '') }
const U = env.REACT_APP_SUPABASE_URL, K = env.REACT_APP_SUPABASE_ANON_KEY
const COURANTS = /^(K9K|R9M|H5FT|DV6|DV5|EB2DT|EB2DTS|EB2ADTS|EP6|DW10|SDE|EA189|EA288|EA888|N47|OM651|OM654)$/

const MOTS_VIDES = new Set(['avec', 'dans', 'pour', 'sans', 'plus', 'moins', 'leur', 'cette', 'entre', 'ainsi', 'moteur', 'panne', 'défaut', 'defaut'])
const mots = (t) => [...new Set(String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length >= 5 && !MOTS_VIDES.has(w)))]
const MONTANT = /(\d[\d\s.]{1,7})\s?(?:€|euros?)(?:\s*(?:à|-|–)\s*(\d[\d\s.]{1,7})\s?(?:€|euros?))?|entre\s+(\d[\d\s.]{1,7})\s+et\s+(\d[\d\s.]{1,7})\s?(?:€|euros?)/gi
const texte = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&euro;/g, '€').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ')

const liste = await (await fetch(`${U}/functions/v1/moteur-public?liste=1`, { headers: { apikey: K, Authorization: `Bearer ${K}` } })).json()
const sortie = []
const cache = new Map()
for (const p of liste.pages.filter((x) => COURANTS.test(x.famille))) {
  const f = await (await fetch(`${U}/functions/v1/moteur-public?marque=${encodeURIComponent(p.marque)}&famille=${encodeURIComponent(p.famille)}`, { headers: { apikey: K, Authorization: `Bearer ${K}` } })).json()
  for (const pa of f.pannes ?? []) {
    if (pa.cout_indicatif_eur_min != null) continue
    const urls = (pa.url_source ?? []).filter((u) => sourcesPortentLEntree([u]))
    const cles = mots(`${pa.titre} ${pa.organe ?? ''}`)
    const candidats = []
    for (const u of urls) {
      if (!cache.has(u)) {
        try { const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 InspexoVerif' }, signal: AbortSignal.timeout(20000) }); cache.set(u, r.ok ? texte(await r.text()) : null) } catch { cache.set(u, null) }
      }
      const t = cache.get(u)
      if (!t) { candidats.push({ url: u, rang: rangSource(u), lisible: false }); continue }
      for (const phrase of t.split(/(?<=[.!?])\s+/)) {
        if (!MONTANT.test(phrase)) { MONTANT.lastIndex = 0; continue }
        MONTANT.lastIndex = 0
        const n = cles.filter((c) => phrase.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(c)).length
        if (n >= 1 && phrase.length < 400) candidats.push({ url: u, rang: rangSource(u), mots_communs: n, phrase: phrase.trim() })
      }
    }
    sortie.push({ marque: p.marque, famille: p.famille, titre: pa.titre, organe: pa.organe ?? null, urls, candidats: candidats.sort((a, b) => (b.mots_communs ?? 0) - (a.mots_communs ?? 0)).slice(0, 6) })
  }
}
writeFileSync('docs/couts-manquants-releve.json', JSON.stringify({ le: new Date().toISOString(), pannes: sortie }, null, 1))
const avec = sortie.filter((s) => s.candidats.some((c) => c.phrase)).length
console.log(`${sortie.length} pannes sans coût · ${avec} avec au moins une phrase chiffrée sur leurs propres pages · ${cache.size} pages relues`)
