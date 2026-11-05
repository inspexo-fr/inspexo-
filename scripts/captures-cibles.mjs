// Captures 390 px des « alertes rentables » : la recherche à sauvegarder sur
// un vrai dossier, et la page « Mes cibles ».
//
// ⚠️ La page /cibles est servie par une fonction edge réservée au Pass. On
// lui fournit une réponse composée à partir du MODULE RÉEL (`cibles.gen.js`),
// pas une maquette : les chiffres affichés sont ceux que la fonction
// calculerait sur ces relevés.
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { cibleDepuisQuantiles, rechercheSauvegardee, trierCibles, MENTION_CIBLES } from '../src/data/cibles.gen.js'

const SCRATCH = process.argv[2]
const SORTIE = process.argv[3]
const ID = 'e21be2d9-89ba-4049-ba39-19696d5c63ec'

const gratuit = JSON.parse(readFileSync(`${SCRATCH}/clio-gratuit.json`, 'utf8'))
const pass = JSON.parse(readFileSync('/tmp/clio-pass.json', 'utf8'))
const avecPass = JSON.parse(JSON.stringify(gratuit))
avecPass.pass = true
avecPass.result_json.revendeur = { ...pass.result.revendeur, segment: { marque: 'renault', modele: 'clio', energie: 'Diesel' } }
avecPass.result_json.negociation = pass.result.negociation

// Les cibles : trois segments plausibles, passés par le VRAI module.
const P = { marge_negociation_pct: 8, marge_voulue_eur: 500, imprevus_vehicule_ancien_eur: 150 }
const segments = [
  { marque: 'renault', modele: 'clio', energie: 'Diesel', n: 11, p25: 2125, p50: 2625, annee_moyenne: 2004, km_moyen: 179571, maj: '2026-11-05' },
  { marque: 'peugeot', modele: '308', energie: 'Diesel', n: 9, p25: 7125, p50: 9375, annee_moyenne: 2017, km_moyen: 112000, maj: '2026-11-04' },
  { marque: 'volkswagen', modele: 'golf', energie: 'Essence', n: 8, p25: 11875, p50: 12375, annee_moyenne: 2019, km_moyen: 78000, maj: '2026-11-03' },
]
const cibles = trierCibles(segments.map((s) => {
  const c = cibleDepuisQuantiles(s, P, { carte_grise_eur: 311, annee_courante: 2026 })
  return { ...c, recherche: rechercheSauvegardee(s, c.achat_max) }
}))

const navigateur = await chromium.launch()
const ctx = await navigateur.newContext({ viewport: { width: 390, height: 1500 }, deviceScaleFactor: 2, colorScheme: 'light' })
const page = await ctx.newPage()
const erreurs = []
page.on('pageerror', (e) => erreurs.push(String(e).slice(0, 140)))

await page.route('**/rest/v1/rpc/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
await page.route('**/rest/v1/rpc/get_public_analysis', (r) =>
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(avecPass) }))
await page.route('**/rest/v1/rpc/get_config_publique', (r) =>
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    carte_grise_tarifs: { maj: '2026-11-05', source: 'essai', frais_fixes_eur: 13.76, regions: { Occitanie: 59.5 } },
  }) }))
await page.route('**/rest/v1/rpc/preferences_revendeur_lire', (r) =>
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    region: 'Occitanie', ville_revente: 'Toulouse', parametres: { cv: 5 },
  }) }))
await page.route('**/functions/v1/**', (r) => r.fulfill({ status: 404, body: '{}' }))
// ⚠️ CHEZ PLAYWRIGHT, LA ROUTE ENREGISTRÉE EN DERNIER GAGNE. Le fourre-tout
// ci-dessus doit donc être posé AVANT la route précise, sinon il
// l'intercepte et la page affiche « Chargement impossible ». Même piège
// que celui rencontré au sprint 14 sur `visio-acces`.
await page.route('**/functions/v1/revendeur-cibles', (r) =>
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    cibles, en_attente: [{ marque: 'dacia', modele: 'sandero', energie: 'Essence', effectif: 4 }],
    seuil: 6, profil: { region: 'Occitanie', ville_revente: 'Toulouse', cv: 5 },
    carte_grise_connue: true, mention: MENTION_CIBLES,
  }) }))

const degager = () => page.evaluate(() => {
  for (const b of document.querySelectorAll('button')) {
    if (/j.ai compris/i.test(b.textContent || '')) b.click()
  }
  for (const el of document.querySelectorAll('nav, header')) {
    const p = getComputedStyle(el).position
    if (p === 'fixed' || p === 'sticky') el.style.display = 'none'
  }
})

// 1. La recherche à sauvegarder, dans le dossier.
await page.goto(`http://127.0.0.1:4173/a/${ID}`, { waitUntil: 'networkidle' })
await degager()
const bloc = page.locator('[data-testid="revendeur-bloc"]')
await bloc.waitFor({ timeout: 20000 })
// Un coût réaliste pour que l'affaire passe et que la recherche ait un sens.
const champs = page.locator('[data-testid="revendeur-bloc"] input[type="number"]')
await champs.first().fill('250')
await champs.first().dispatchEvent('input')
await page.waitForTimeout(500)
await bloc.scrollIntoViewIfNeeded()
await bloc.screenshot({ path: `${SORTIE}/cibles-recherche-390.png` })
console.log('recherche à sauvegarder : capturée')

// 2. La page « Mes cibles ».
await page.goto('http://127.0.0.1:4173/cibles', { waitUntil: 'networkidle' })
await degager()
await page.waitForTimeout(800)
await page.screenshot({ path: `${SORTIE}/cibles-page-390.png`, fullPage: true })
const debord = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
console.log(`Mes cibles : capturée · débordement 390 px : ${debord ? 'OUI ⚠️' : 'non'} · erreurs JS : ${erreurs.length || 'aucune'}`)
for (const e of erreurs.slice(0, 3)) console.log('   ' + e)
await navigateur.close()
