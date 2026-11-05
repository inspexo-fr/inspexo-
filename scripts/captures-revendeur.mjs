// Captures 390 px du bloc revendeur sur la Clio II, en gratuit et avec le Pass.
//
// ⚠️ LES DEUX CHARGES UTILES SONT RÉELLES, prises sur la production :
//   - « gratuit » : la réponse de `get_public_analysis` à un appelant ANONYME
//     (donc déjà masquée par le serveur) ;
//   - « Pass » : la réponse de la fonction `score` servie par son cache 7 jours
//     avec le secret d'éval (donc non masquée), coût nul.
// Seule la SESSION est simulée : on sert la charge utile correspondante à la
// page. Rien n'est inventé dans les données.
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const ID = 'e21be2d9-89ba-4049-ba39-19696d5c63ec'
const SCRATCH = process.argv[2]
const SORTIE = process.argv[3]

const gratuit = JSON.parse(readFileSync(`${SCRATCH}/clio-gratuit.json`, 'utf8'))
const pass = JSON.parse(readFileSync('/tmp/clio-pass.json', 'utf8'))

// La charge utile « Pass » : la même ligne, mais avec le bloc revendeur
// complet tel que `score` l'a rendu à l'éval.
const avecPass = JSON.parse(JSON.stringify(gratuit))
avecPass.pass = true
avecPass.result_json.revendeur = pass.result.revendeur
avecPass.result_json.negociation = pass.result.negociation

const navigateur = await chromium.launch()
for (const [nom, charge] of [['gratuit', gratuit], ['pass', avecPass]]) {
  const ctx = await navigateur.newContext({
    viewport: { width: 390, height: 1400 },
    deviceScaleFactor: 2,
    colorScheme: 'light',
  })
  const page = await ctx.newPage()

  // ⚠️ L'ORDRE DES ROUTES COMPTE CHEZ PLAYWRIGHT : la dernière enregistrée
  // gagne. La route précise doit donc être posée APRÈS le fourre-tout —
  // leçon du sprint 14, où un fourre-tout Supabase interceptait `visio-acces`.
  await page.route('**/rest/v1/rpc/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.route('**/rest/v1/rpc/get_public_analysis', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(charge) }))
  await page.route('**/rest/v1/rpc/get_config_publique', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      carte_grise_tarifs: {
        maj: '2026-11-05', source: 'Tarifs régionaux du cheval fiscal 2026',
        frais_fixes_eur: 13.76,
        regions: { 'Occitanie': 59.5, 'Île-de-France': 68.95, 'Auvergne-Rhône-Alpes': 43 },
      },
    }) }))
  await page.route('**/functions/v1/**', (r) => r.fulfill({ status: 404, body: '{}' }))

  await page.goto(`http://127.0.0.1:4173/a/${ID}`, { waitUntil: 'networkidle' })

  // La barre fixe et le bandeau cookies recouvriraient le bloc sur une capture
  // d'élément : on ferme le bandeau et on masque la barre, sans toucher au
  // bloc lui-même.
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('button')) {
      if (/j.ai compris/i.test(b.textContent || '')) b.click()
    }
    for (const el of document.querySelectorAll('nav, header, [class*="cookie"]')) {
      const pos = getComputedStyle(el).position
      if (pos === 'fixed' || pos === 'sticky') el.style.display = 'none'
    }
  })
  await page.waitForTimeout(400)
  const bloc = page.locator('[data-testid="revendeur-bloc"]')
  await bloc.waitFor({ timeout: 20000 })
  await bloc.scrollIntoViewIfNeeded()
  await page.waitForTimeout(600)

  const chiffres = {
    revente: await page.locator('[data-testid="revendeur-revente"]').textContent(),
    achat: await page.locator('[data-testid="revendeur-achat-max"]').textContent(),
    offre: await page.locator('[data-testid="revendeur-offre"]').textContent(),
  }
  console.log(`${nom.padEnd(8)} → revente ${chiffres.revente} · achat ${chiffres.achat} · offre ${chiffres.offre}`)

  await bloc.screenshot({ path: `${SORTIE}/revendeur-${nom}-390.png` })
  // Et une vue « l'affaire passe » : on baisse le coût d'embrayage À L'ÉCRAN,
  // comme le ferait l'utilisateur. Rien n'est simulé côté données — c'est la
  // modification en direct que le bloc est censé permettre.
  if (nom === 'pass') {
    const champs = page.locator('[data-testid="revendeur-bloc"] input[type="number"]')
    await champs.first().fill('250')
    await champs.first().dispatchEvent('input')
    await page.waitForTimeout(500)
    const apres = {
      achat: await page.locator('[data-testid="revendeur-achat-max"]').textContent(),
      offre: await page.locator('[data-testid="revendeur-offre"]').textContent(),
    }
    console.log(`         embrayage corrigé à 250 € → achat ${apres.achat} · offre ${apres.offre}`)
    await bloc.screenshot({ path: `${SORTIE}/revendeur-pass-affaire-qui-passe-390.png` })
  }
  await page.screenshot({ path: `${SORTIE}/revendeur-${nom}-page-390.png`, fullPage: false })

  // Débordement horizontal : la règle du projet est zéro scroll à 390 px.
  const debord = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  console.log(`         débordement horizontal : ${debord ? 'OUI ⚠️' : 'non'}`)
  await ctx.close()
}
await navigateur.close()
