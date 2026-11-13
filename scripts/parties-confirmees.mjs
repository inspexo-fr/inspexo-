// SPRINT 24, chantier A — Rassemble, pour une famille du relevé externe, les
// PARTIES CONFIRMÉES par le juge (verdict « soutenue ») sur une source
// PORTANTE (officiel, presse, éditorial), avec les extraits verbatim relevés.
// Aucune IA, aucun réseau : lecture de docs/candidats-externes-journal.json et
// docs/sources-moteurs-2026-11.json. Module + CLI (`--famille X`).
import { readFileSync } from 'node:fs'

export const CLASSES_PORTANTES = new Set(['officiel', 'presse', 'editorial'])

export const normUrl = (u) => {
  try {
    const x = new URL(String(u).trim())
    x.hash = ''
    return `${x.protocol}//${x.hostname.toLowerCase().replace(/^www\./, '')}${x.pathname.replace(/\/+$/, '')}${x.search}`
  } catch { return null }
}

export function partiesConfirmees(journal, sources, famille) {
  const extraitsPar = new Map() // `${id}|${url}` -> textes
  for (const o of Object.values(sources.objets ?? {})) {
    if (o.famille !== famille) continue
    for (const s of o.sources ?? []) {
      const k = `${o.id}|${normUrl(s.url)}`
      const t = (s.extraits ?? []).filter((e) => e.verbatim !== false).map((e) => String(e.texte ?? '').trim()).filter(Boolean)
      extraitsPar.set(k, [...(extraitsPar.get(k) ?? []), ...t])
    }
  }
  const out = []
  for (const [id, a] of Object.entries(journal.affirmations ?? {})) {
    if (a.famille !== famille) continue
    const idObjet = id.split('#')[0]
    for (const p of a.parties ?? []) {
      const conf = (p.confirmees ?? []).filter((c) => c.verdict === 'soutenue' && CLASSES_PORTANTES.has(c.classe))
      if (!conf.length) continue
      const urls = [...new Set(conf.map((c) => c.url))]
      const extraits = [...new Set(urls.flatMap((u) => extraitsPar.get(`${idObjet}|${normUrl(u)}`) ?? []))].slice(0, 8)
      out.push({ uid: p.uid, type: a.type, texte: String(p.partie ?? '').trim(), urls, extraits })
    }
  }
  return out
}

if (process.argv[1]?.endsWith('parties-confirmees.mjs')) {
  const fam = process.argv[process.argv.indexOf('--famille') + 1]
  const j = JSON.parse(readFileSync('docs/candidats-externes-journal.json', 'utf8'))
  const s = JSON.parse(readFileSync('docs/sources-moteurs-2026-11.json', 'utf8'))
  const r = partiesConfirmees(j, s, fam)
  console.log(JSON.stringify(r, null, 1))
}
