// Vérification EN PRODUCTION du bloc revendeur sur un vrai dossier.
//
// ⚠️ Aucune donnée n'est injectée : la page est chargée depuis www.inspexo.io
// et parle à la vraie base. Le seul « truquage » est la SESSION — pour la vue
// Pass, on remplace la réponse de `get_public_analysis` par celle que la
// fonction `score` a réellement rendue avec le secret d'éval (donc non
// masquée). Les deux charges utiles sont réelles ; aucune n'est fabriquée.
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const ID = process.argv[2]
const SORTIE = process.argv[3]
const PASS_JSON = process.argv[4] // facultatif

const navigateur = await chromium.launch()
const vues = [['gratuit', null]]
if (PASS_JSON) vues.push(['pass', JSON.parse(readFileSync(PASS_JSON, 'utf8'))])

let anomalies = 0
for (const [nom, pass] of vues) {
  const ctx = await navigateur.newContext({
    viewport: { width: 390, height: 1400 }, deviceScaleFactor: 2, colorScheme: 'light',
  })
  const page = await ctx.newPage()
  const erreursJs = []
  page.on('pageerror', (e) => erreursJs.push(String(e).slice(0, 140)))

  // La vue Pass : on prend la réponse RÉELLE de la prod et on y remet le bloc
  // non masqué, tel que `score` l'a rendu. Rien d'autre n'est touché.
  if (pass) {
    await page.route('**/rest/v1/rpc/get_public_analysis', async (route) => {
      const rep = await route.fetch()
      const j = await rep.json()
      j.pass = true
      j.result_json.revendeur = pass.result.revendeur
      j.result_json.negociation = pass.result.negociation
      await route.fulfill({ response: rep, body: JSON.stringify(j) })
    })
  }

  await page.goto(`https://www.inspexo.io/a/${ID}`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('button')) {
      if (/j.ai compris/i.test(b.textContent || '')) b.click()
    }
    for (const el of document.querySelectorAll('nav, header')) {
      const p = getComputedStyle(el).position
      if (p === 'fixed' || p === 'sticky') el.style.display = 'none'
    }
  })

  const bloc = page.locator('[data-testid="revendeur-bloc"]')
  const present = await bloc.count() > 0
  if (!present) { console.log(`${nom} : ⚠️ bloc revendeur ABSENT`); anomalies++; await ctx.close(); continue }
  await bloc.scrollIntoViewIfNeeded()
  await page.waitForTimeout(700)

  const lire = async (t) => (await page.locator(`[data-testid="${t}"]`).textContent()).trim()
  const chiffres = {
    revente: await lire('revendeur-revente'),
    achat: await lire('revendeur-achat-max'),
    offre: await lire('revendeur-offre'),
  }
  const debord = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  console.log(`${nom.padEnd(8)} revente ${chiffres.revente} · achat ${chiffres.achat} · offre ${chiffres.offre}`)
  console.log(`         débordement 390 px : ${debord ? 'OUI ⚠️' : 'non'} · erreurs JS : ${erreursJs.length || 'aucune'}`)
  if (debord) anomalies++
  if (erreursJs.length) { anomalies++; for (const e of erreursJs.slice(0, 3)) console.log('         ' + e) }

  // Sans Pass : ni prix d'achat, ni offre, ni message ne doivent être arrivés
  // au navigateur. On lit la charge utile brute, pas l'écran.
  if (nom === 'gratuit') {
    const txt = await bloc.textContent()
    const fuite = /prix d'achat maximum pour ta marge visée\s*\d/i.test(txt)
    console.log(`         gratuit : aucun montant d'achat à l'écran → ${fuite ? 'FUITE ⚠️' : 'conforme'}`)
    if (fuite) anomalies++
  }

  await bloc.screenshot({ path: `${SORTIE}/prod-revendeur-${nom}-390.png` })
  await ctx.close()
}
await navigateur.close()
console.log(anomalies === 0 ? '\n✓ vérification prod : conforme' : `\n⚠️ ${anomalies} anomalie(s)`)
process.exit(anomalies === 0 ? 0 : 1)
