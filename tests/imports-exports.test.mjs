// Tests hors ligne : chaque nom importé d'un module LOCAL par une fonction
// edge ou un module partagé existe bien dans ce module (exporté ou ré-exporté).
// Né d'une panne réelle (14 nov. 2026) : `sources-externes` importait
// `archiverCacheVerif` depuis `verifSource.ts`, qui ne le ré-exportait pas —
// la fonction ne démarrait plus (BOOT_ERROR), sans qu'aucun test ne le voie.
// Usage : node tests/imports-exports.test.mjs
import fs from 'node:fs'
import path from 'node:path'
let ko = 0, n = 0
const RACINE = 'supabase/functions'
const fichiers = []
for (const d of fs.readdirSync(RACINE)) {
  const p = path.join(RACINE, d)
  if (fs.statSync(p).isDirectory()) for (const f of fs.readdirSync(p)) if (f.endsWith('.ts')) fichiers.push(path.join(p, f))
}
const cacheExports = new Map()
function exportsDe(f, vus = new Set()) {
  if (cacheExports.has(f)) return cacheExports.get(f)
  if (vus.has(f) || !fs.existsSync(f)) return new Set()
  vus.add(f)
  const s = fs.readFileSync(f, 'utf8')
  const out = new Set()
  for (const m of s.matchAll(/export\s+(?:declare\s+)?(?:async\s+)?(?:function\*?|const|let|var|type|interface|class|enum)\s+([A-Za-z_$][\w$]*)/g)) out.add(m[1])
  for (const m of s.matchAll(/export\s*\{([^}]*)\}(?:\s*from\s*["']([^"']+)["'])?/g)) {
    for (const part of m[1].split(',')) {
      const t = part.trim().replace(/^type\s+/, '')
      if (!t) continue
      const [, alias] = t.split(/\s+as\s+/)
      out.add((alias ?? t).trim())
    }
  }
  for (const m of s.matchAll(/export\s+\*\s+from\s+["']([^"']+)["']/g)) {
    if (m[1].startsWith('.')) for (const x of exportsDe(path.resolve(path.dirname(f), m[1]), vus)) out.add(x)
  }
  if (/export\s+default/.test(s)) out.add('default')
  cacheExports.set(f, out)
  return out
}
for (const f of fichiers) {
  const s = fs.readFileSync(f, 'utf8')
  for (const m of s.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["'](\.[^"']+\.ts)["']/g)) {
    const cible = path.resolve(path.dirname(f), m[2])
    const ex = exportsDe(cible)
    for (const part of m[1].split(',')) {
      const t = part.trim().replace(/^type\s+/, '')
      if (!t) continue
      const nom = t.split(/\s+as\s+/)[0].trim()
      n++
      if (!ex.has(nom)) { ko++; console.log(`FAIL — ${f} importe « ${nom} » de ${m[2]}, qui ne l’exporte pas`) }
    }
  }
}
// Contre-épreuve : le contrôle doit mordre sur le défaut réel.
const vs = exportsDe(path.resolve(RACINE, '_shared/verifSource.ts'))
if (!vs.has('archiverCacheVerif')) { ko++; console.log('FAIL — verifSource.ts doit ré-exporter archiverCacheVerif') }
if (ko) { console.log(`\nÉCHEC — ${ko} import(s) introuvable(s) sur ${n}`); process.exit(1) }
console.log(`OK — ${n} noms importés, tous exportés par leur module`)
