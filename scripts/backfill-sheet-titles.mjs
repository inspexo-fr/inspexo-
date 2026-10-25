// Rattrapage sprint 2A-bis : ajoute sources: [{url, title}] aux pannes des
// fiches defect_sheets existantes, en récupérant le <title> HTML de chaque
// page (fallback : title null → l'affichage dérive un libellé de l'URL).
//
// Usage : SUPABASE_SERVICE_ROLE_KEY=... node scripts/backfill-sheet-titles.mjs
// La clé service role n'est JAMAIS stockée (ni .env.local ni ailleurs).
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')]),
)
const URL_BASE = env.REACT_APP_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_BASE || !SERVICE_KEY) {
  console.error('REACT_APP_SUPABASE_URL (.env.local) et SUPABASE_SERVICE_ROLE_KEY (env) requis.')
  process.exit(2)
}
const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

async function fetchTitle(url) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; InspexoBot/1.0)', Accept: 'text/html' },
      redirect: 'follow',
    })
    const type = res.headers.get('content-type') ?? ''
    if (!res.ok || !type.includes('html')) return null
    const html = (await res.text()).slice(0, 60_000)
    const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    if (!m) return null
    const title = m[1]
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ').trim().slice(0, 150)
    return title || null
  } catch (_) {
    return null
  }
}

const res = await fetch(`${URL_BASE}/rest/v1/defect_sheets?select=id,marque,famille_moteur,statut,pannes`, { headers: HEADERS })
if (!res.ok) { console.error('lecture defect_sheets:', res.status, await res.text()); process.exit(1) }
const sheets = await res.json()
console.log(`${sheets.length} fiche(s) en base.`)

for (const sheet of sheets) {
  const pannes = Array.isArray(sheet.pannes) ? sheet.pannes : []
  const missing = [...new Set(pannes.flatMap(p =>
    (p.url_source || []).filter(u => !(p.sources || []).some(s => s?.url === u && s.title)),
  ))]
  if (missing.length === 0) {
    console.log(`- ${sheet.marque} ${sheet.famille_moteur} (${sheet.statut}) : déjà complet`)
    continue
  }
  const titles = new Map(await Promise.all(missing.map(async u => [u, await fetchTitle(u)])))
  const updated = pannes.map(p => ({
    ...p,
    sources: (p.url_source || []).map(u => {
      const existing = (p.sources || []).find(s => s?.url === u && s.title)
      return existing || { url: u, title: titles.get(u) ?? null }
    }),
  }))
  const patch = await fetch(`${URL_BASE}/rest/v1/defect_sheets?id=eq.${sheet.id}`, {
    method: 'PATCH',
    headers: { ...HEADERS, Prefer: 'return=minimal' },
    body: JSON.stringify({ pannes: updated }),
  })
  const found = [...titles.values()].filter(Boolean).length
  console.log(`- ${sheet.marque} ${sheet.famille_moteur} (${sheet.statut}) : ${found}/${missing.length} titre(s) récupéré(s)${patch.ok ? '' : ` — PATCH ÉCHOUÉ ${patch.status}`}`)
  if (!patch.ok) process.exitCode = 1
}
console.log('Terminé.')
