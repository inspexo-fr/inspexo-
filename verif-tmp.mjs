import { chromium } from 'playwright'
const nav = await chromium.launch()
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } })
const page = await ctx.newPage()
const erreurs = []
page.on('pageerror', (e) => erreurs.push(String(e).slice(0, 160)))

await page.goto('https://www.inspexo.io/', { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(2500)
let t = await page.evaluate(() => document.body.innerText)
console.log('— ACCUEIL')
console.log('  règle énoncée      : ' + /Une panne n'affirmée|Une panne n.est affirmée que si une source indépendante la confirme/.test(t))
console.log('  « questions à poser au vendeur » : ' + /questions à poser au vendeur/.test(t))
console.log('  AUCUN chiffre 54/231 : ' + !/54 de nos 231|54 \/ 231/.test(t))
const lien = await page.evaluate(() => {
  const a = [...document.querySelectorAll('a')].find((x) => /Voir le détail et nos chiffres/.test(x.textContent))
  return a ? a.getAttribute('href') : null
})
console.log('  lien vers          : ' + lien)
console.log('  débordement        : ' + await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1))
await page.screenshot({ path: 'captures-sprint21/accueil-regle-390.png' })

// Le lien mène-t-il vraiment au chiffre ?
await page.goto('https://www.inspexo.io/fiabilite', { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(2500)
t = await page.evaluate(() => document.body.innerText)
const m = t.match(/(\d+)\s*\/\s*(\d+)\s*\((\d+)\s*%\)/)
console.log('\n— /fiabilite')
console.log('  chiffre détaillé   : ' + (m ? m[0].replace(/\s+/g, ' ') : 'ABSENT'))
console.log('  débordement        : ' + await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1))
await page.screenshot({ path: 'captures-sprint21/fiabilite-390.png', fullPage: true })

console.log('\nerreurs JavaScript : ' + (erreurs.length ? erreurs.join(' | ') : 'aucune'))
await nav.close()
