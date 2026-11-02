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

// ===========================================================================
// SPRINT 9 — extractSerp : pages de RÉSULTATS.
// Ce que ce bloc protège : les champs qui alimentent le relevé de prix de
// marché (carburant, boîte, code postal) ET la chaîne complète extraction →
// segment, car un titre mal découpé polluerait durablement un segment de prix.
// Les trois pages sont RECONSTITUÉES (structures publiques __NEXT_DATA__ /
// JSON-LD), aucune n'est capturée : DataDome bloque l'automatisation.
// ===========================================================================
const { segmentDepuisTitreAnnonce, segmentDe } =
  await import('../../supabase/functions/_shared/marche.ts')

const ATTENDU_SERP = {
  leboncoin: {
    // La 4e annonce (sans prix) doit être écartée par l'extracteur.
    nombre: 3,
    premiere: { titre: 'Renault Clio IV 1.5 dCi 90 Business', prix: 9490, annee: 2017, km: 118000,
      carburant: 'Diesel', boite: 'Manuelle', code_postal: '31400' },
    segments: ['renault/clio', 'peugeot/308', 'mercedes/classe a'],
  },
  autoscout24: {
    nombre: 2,
    premiere: { titre: 'Volkswagen Golf 1.6 TDI 115 Confortline', prix: 14490, annee: 2018, km: 96000,
      carburant: 'Diesel', boite: 'Manuelle', code_postal: '69003' },
    segments: ['volkswagen/golf', 'dacia/sandero stepway'],
  },
  lacentrale: {
    nombre: 1,
    premiere: { titre: 'Citroën C5 Aircross 1.5 BlueHDi 130 Feel', prix: 19990, annee: 2020, km: 68000,
      carburant: 'Diesel', boite: 'Manuelle', code_postal: '44000' },
    segments: ['citroen/c5 aircross'],
  },
}

console.log('▶ extractSerp (pages de résultats)')
for (const [site, attendu] of Object.entries(ATTENDU_SERP)) {
  const fixture = join(FIXTURES, 'serp', `${site}.html`)
  if (!existsSync(fixture)) { check(false, `${site} : fixture SERP absente`); continue }
  await page.setContent(readFileSync(fixture, 'utf8'), { waitUntil: 'domcontentloaded' })
  await page.addScriptTag({ path: join(ROOT, 'extension', 'sites', 'common.js') })
  await page.addScriptTag({ path: join(ROOT, 'extension', 'sites', `${site}.js`) })
  const annonces = await page.evaluate(
    (s) => globalThis.INSPEXO_SITES.find((x) => x.nom === s)?.extractSerp(document) ?? [],
    site,
  )
  check(annonces.length === attendu.nombre,
    `${site} : ${attendu.nombre} annonce(s) extraite(s) (${annonces.length})`)
  const a = annonces[0] ?? {}
  for (const [champ, valeur] of Object.entries(attendu.premiere)) {
    check(String(a[champ] ?? '') === String(valeur),
      `${site} : ${champ} = « ${valeur} » (${String(a[champ]).slice(0, 40)})`)
  }
  // Chaîne complète : un titre de résultats doit produire le MÊME segment que
  // l'analyse de la même voiture, sinon le relevé se scinde en deux.
  const segments = annonces.map((x) => {
    const seg = segmentDepuisTitreAnnonce(x.titre)
    return seg ? `${seg.marque}/${seg.modele}` : null
  })
  check(JSON.stringify(segments) === JSON.stringify(attendu.segments),
    `${site} : segments ${JSON.stringify(attendu.segments)} (${JSON.stringify(segments)})`)
  // Et la région doit bien se déduire du code postal extrait.
  const seg0 = segmentDepuisTitreAnnonce(a.titre)
  const ag = seg0 && segmentDe({
    marque: seg0.marque, modele: seg0.modele, libelle: a.titre,
    carburant: a.carburant, boite: a.boite, annee: a.annee, km: a.km,
    prix: a.prix, code_postal: a.code_postal, date: new Date(Date.UTC(2026, 10, 2)),
  })
  check(!!ag && ag.region !== '' && ag.prix_tranche > 0,
    `${site} : relevé agrégeable (région « ${ag?.region} », tranche ${ag?.prix_tranche} €)`)
  check(!!ag && ag.boite !== '', `${site} : boîte normalisée (« ${ag?.boite} »)`)
}
console.log('')

await browser.close()
console.log(failed === 0 ? '✓ extracteurs OK' : `✗ ${failed} assertion(s) en échec`)
process.exit(failed === 0 ? 0 : 1)
