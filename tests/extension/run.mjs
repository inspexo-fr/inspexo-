// Test des extracteurs de l'extension sur les fixtures HTML.
// Usage : node tests/extension/run.mjs
// AutoScout24 : 3 pages réelles capturées. Leboncoin / La Centrale : pages
// reconstituées (DataDome bloque la capture automatisée) qui reproduisent les
// structures publiques __NEXT_DATA__ / JSON-LD / dataLayer — pour les
// rafraîchir : ouvrir une annonce dans Chrome, « Enregistrer sous… » (HTML
// seul) dans fixtures/<site>/pageN.html, puis ajuster expected.json.
import { chromium } from 'playwright'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const FIXTURES = join(ROOT, 'tests', 'extension', 'fixtures')
const SITES = {
  leboncoin: 'https://www.leboncoin.fr/ad/voitures/2900000000',
  lacentrale: 'https://www.lacentrale.fr/auto-occasion-annonce-69112233.html',
  autoscout24: 'https://www.autoscout24.fr/offres/exemple_ma1mo2-abcd',
}

const exePath = process.env.HOME +
  '/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell'
const browser = await chromium.launch(existsSync(exePath) ? { executablePath: exePath } : {})
const page = await browser.newPage()

let failed = 0
const check = (ok, label) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${label}`)
  if (!ok) failed++
}

for (const [site, sampleUrl] of Object.entries(SITES)) {
  console.log(`▶ ${site}`)
  const dir = join(FIXTURES, site)
  const expected = JSON.parse(readFileSync(join(dir, 'expected.json'), 'utf8'))
  const pages = readdirSync(dir).filter(f => /^page\d+\.html$/.test(f)).sort()

  // match() reconnaît l'URL type du site (URL expose hostname/pathname comme Location)
  const matchOk = await page.evaluate(
    ({ scripts, url, site }) => {
      // eslint-disable-next-line no-eval
      for (const s of scripts) (0, eval)(s)
      const ext = globalThis.INSPEXO_SITES.find(x => x.nom === site)
      return !!ext && ext.match(new URL(url))
    },
    {
      scripts: [
        readFileSync(join(ROOT, 'extension', 'sites', 'common.js'), 'utf8'),
        readFileSync(join(ROOT, 'extension', 'sites', `${site}.js`), 'utf8'),
      ],
      url: sampleUrl,
      site,
    },
  )
  check(matchOk, `match() reconnaît ${sampleUrl.slice(0, 60)}`)

  for (let i = 0; i < pages.length; i++) {
    const html = readFileSync(join(dir, pages[i]), 'utf8')
    await page.setContent(html, { waitUntil: 'domcontentloaded' })
    await page.addScriptTag({ path: join(ROOT, 'extension', 'sites', 'common.js') })
    await page.addScriptTag({ path: join(ROOT, 'extension', 'sites', `${site}.js`) })
    const data = await page.evaluate(
      (s) => globalThis.INSPEXO_SITES.find(x => x.nom === s)?.extract(document) ?? null,
      site,
    )
    const exp = expected[i] || {}
    if (!data) { check(false, `${pages[i]} : extraction nulle`); continue }
    const norm = (x) => String(x ?? '').toLowerCase().replace(/[\s ]/g, '')
    for (const [k, want] of Object.entries(exp)) {
      if (want == null) continue
      if (k === 'photos_min') check((data.photos || []).length >= want, `${pages[i]} : ≥ ${want} photo(s) (${(data.photos || []).length})`)
      else if (k.endsWith('_contient')) {
        const field = k.replace('_contient', '')
        check(norm(data[field]).includes(norm(want)), `${pages[i]} : ${field} contient « ${want} » (${String(data[field]).slice(0, 48)})`)
      } else check(norm(data[k]) === norm(want), `${pages[i]} : ${k} = « ${want} » (${String(data[k]).slice(0, 48)})`)
    }
  }
  console.log('')
}

await browser.close()
console.log(failed === 0 ? '✓ extracteurs OK' : `✗ ${failed} assertion(s) en échec`)
process.exit(failed === 0 ? 0 : 1)
