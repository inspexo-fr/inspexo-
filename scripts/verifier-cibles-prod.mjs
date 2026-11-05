// Vérification EN PRODUCTION des « alertes rentables », sur un vrai dossier.
//
// ⚠️ La page /cibles et le détail du bloc revendeur sont réservés au Pass.
// Sans session Pass, on vérifie ce qu'un visiteur voit RÉELLEMENT : le refus,
// et aucune donnée réservée dans la charge utile.
import { chromium } from 'playwright'

const ID = 'e21be2d9-89ba-4049-ba39-19696d5c63ec'
const SORTIE = process.argv[2]
const navigateur = await chromium.launch()
let anomalies = 0

for (const [nom, chemin] of [['dossier', `/a/${ID}`], ['cibles', '/cibles']]) {
  const ctx = await navigateur.newContext({ viewport: { width: 390, height: 1400 }, deviceScaleFactor: 2, colorScheme: 'light' })
  const page = await ctx.newPage()
  const erreurs = []
  page.on('pageerror', (e) => erreurs.push(String(e).slice(0, 140)))
  await page.goto(`https://www.inspexo.io${chemin}`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('button')) {
      if (/j.ai compris/i.test(b.textContent || '')) b.click()
    }
  })
  await page.waitForTimeout(600)

  const texte = (await page.locator('main').textContent()) || ''
  const debord = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  console.log(`${nom.padEnd(8)} débordement 390 px : ${debord ? 'OUI ⚠️' : 'non'} · erreurs JS : ${erreurs.length || 'aucune'}`)
  if (debord || erreurs.length) { anomalies++; for (const e of erreurs.slice(0, 2)) console.log('   ' + e) }

  if (nom === 'cibles') {
    const refuse = /Pass achat|Connectez-vous/i.test(texte)
    console.log(`         sans Pass : ${refuse ? 'refus annoncé, conforme' : 'PAS DE REFUS ⚠️'}`)
    if (!refuse) anomalies++
  } else {
    const bloc = await page.locator('[data-testid="revendeur-bloc"]').count() > 0
    const reserve = /réservé au Pass/i.test(texte)
    const fuite = /Recherche à sauvegarder|Ajouter ce modèle à mes cibles/i.test(texte)
    console.log(`         bloc revendeur : ${bloc ? 'présent' : 'absent ⚠️'} · détail Pass : ${
      reserve ? 'annoncé réservé' : 'non annoncé ⚠️'} · recherche visible sans Pass : ${fuite ? 'OUI ⚠️' : 'non'}`)
    if (!bloc || !reserve || fuite) anomalies++
  }
  await page.screenshot({ path: `${SORTIE}/prod-${nom}-390.png`, fullPage: false })
  await ctx.close()
}
await navigateur.close()
console.log(anomalies === 0 ? '\n✓ vérification prod : conforme' : `\n⚠️ ${anomalies} anomalie(s)`)
process.exit(anomalies === 0 ? 0 : 1)
