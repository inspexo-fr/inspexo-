// Captures du sprint 14. La page /visio/:id dépend d'une mission confirmée et
// d'une session : on INTERCEPTE la réponse de `visio-acces` pour rendre le
// composant réel avec des données réalistes, plutôt que de fabriquer une
// mission payée en base.
//
// L'iframe Whereby est elle aussi interceptée : aucun appel ne sort vers le
// prestataire, et la zone vidéo porte un repère explicite.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = 'http://127.0.0.1:4178'
const OUT = '/Users/utku/Desktop/inspexo/captures-sprint14'
mkdirSync(OUT, { recursive: true })

const CHECKLIST = [
  { quoi: 'Démarrage à froid', comment: 'Moteur arrêté depuis au moins 6 h. Lancez le démarreur, caméra sur le pot.', signal_rouge: 'fumée bleue ou blanche épaisse qui persiste' },
  { quoi: 'Compteur et kilométrage', comment: 'Contact mis, filmez le compteur en entier.', signal_rouge: 'kilométrage inférieur au dernier contrôle technique' },
  { quoi: 'Courroie de distribution', comment: 'Carnet et factures : la courroie du 1.2 PureTech baigne dans l’huile.', signal_rouge: 'aucune facture de remplacement après 100 000 km' },
  { quoi: 'État des pneus', comment: 'Les quatre, témoins d’usure et date DOT.', signal_rouge: 'usure irrégulière sur un bord' },
  { quoi: 'Corrosion du châssis', comment: 'Demande de passer sous la voiture sur un pont.', signal_rouge: 'tôle percée' },
  { quoi: 'Essai routier', comment: 'Rouler 10 minutes, boîte et freins.', signal_rouge: 'vibrations au freinage' },
]
const NON_VERIF = [
  { quoi: 'Corrosion du châssis', famille: 'sous_le_vehicule', raison: 'demande de passer sous le véhicule (pont ou fosse)' },
  { quoi: 'Essai routier', famille: 'essai_routier', raison: 'demande de conduire le véhicule' },
]

const reponse = (role) => ({
  ok: true, role,
  url: `${BASE}/__faux-visio.html`,
  creneau: '2026-11-20T14:00:00.000Z',
  checklist: CHECKLIST,
  non_verifiables: NON_VERIF,
  captures_autorisees: role === 'inspecteur',
})

const navigateur = await chromium.launch()

async function capture(nom, role, largeur, hauteur, mobile) {
  const ctx = await navigateur.newContext({
    viewport: { width: largeur, height: hauteur },
    deviceScaleFactor: 2,
    isMobile: mobile,
    hasTouch: mobile,
    userAgent: mobile
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
      : undefined,
  })
  const page = await ctx.newPage()

  // ⚠️ L'ORDRE COMPTE : chez Playwright, la route enregistrée EN DERNIER
  // gagne. Le fourre-tout Supabase doit donc être posé EN PREMIER, sinon il
  // intercepte aussi `visio-acces` et la page reçoit un objet vide — c'est ce
  // qui avait donné « Aucune checklist pour ce véhicule » à la première
  // capture.
  await page.route('**/*supabase.co/**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  // Le faux flux vidéo : rien ne sort vers Whereby.
  await page.route('**/__faux-visio.html', (r) =>
    r.fulfill({ status: 200, contentType: 'text/html', body:
      `<body style="margin:0;background:#111;color:#eee;font:14px -apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center">
       <div><div style="font-size:34px">[ camera ]</div><div style="margin-top:10px;opacity:.75">flux video (Whereby)<br/>camera arriere &middot; non enregistre</div></div></body>` }))
  // La réponse de la fonction edge, enregistrée EN DERNIER pour l'emporter.
  await page.route('**/functions/v1/visio-acces', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reponse(role)) }))

  await page.goto(`${BASE}/visio/11111111-2222-4333-8444-555555555555`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('iframe', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(800)
  // Le bandeau cookies masque le bas de l'écran : on le ferme comme le ferait
  // l'utilisateur, plutôt que de le cacher en CSS (ce serait une capture de
  // quelque chose qui n'existe pas).
  await page.getByRole('button', { name: /j'ai compris/i }).click({ timeout: 2500 }).catch(() => {})
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/${nom}.png`, fullPage: false })

  // Débordement horizontal : la vérification du projet à 390 px.
  const debord = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth)
  console.log(`${nom.padEnd(34)} ${largeur}x${hauteur}  debord=${debord}px`)
  await ctx.close()
}

await capture('acheteur-telephone-390', 'acheteur', 390, 844, true)
await capture('inspecteur-390', 'inspecteur', 390, 844, true)
await capture('inspecteur-ordinateur-1280', 'inspecteur', 1280, 800, false)

// Les pages statiques, sans interception.
for (const [nom, url] of [['cgv-visio-390', '/cgv-visio'], ['cgu-390', '/cgu']]) {
  const ctx = await navigateur.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  await page.route('**/*supabase.co/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(700)
  await page.getByRole('button', { name: /j'ai compris/i }).click({ timeout: 2500 }).catch(() => {})
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/${nom}.png`, fullPage: false })
  const debord = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  console.log(`${nom.padEnd(34)} 390x844  debord=${debord}px`)
  await ctx.close()
}

await navigateur.close()
