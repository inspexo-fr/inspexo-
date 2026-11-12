// Fabrique les factures d'essai (données INVENTÉES). Usage : node tests/eval-facture/generer-factures.mjs
import { chromium } from 'playwright'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const DIR = join(dirname(fileURLToPath(import.meta.url)), 'clio-distribution', 'photos')
const facture = ({ plaque, vin }) => `<!doctype html><html><body style="font:15px Arial;width:760px;padding:30px;background:#fff;color:#111">
<h2 style="margin:0">GARAGE DU CANAL — Facture n° F-2024-0312</h2>
<p>12 rue Imaginaire, 31000 Toulouse — SIRET fictif</p>
<p><b>Date :</b> 12/03/2024</p>
<table style="border-collapse:collapse;width:100%;margin:10px 0" border="1" cellpadding="6">
<tr><td><b>Véhicule</b></td><td>Renault Clio IV 1.5 dCi 90</td></tr>
<tr><td><b>Immatriculation</b></td><td>${plaque}</td></tr>
<tr><td><b>N° de série (VIN)</b></td><td>${vin}</td></tr>
<tr><td><b>Kilométrage</b></td><td>88 000 km</td></tr></table>
<table style="border-collapse:collapse;width:100%" border="1" cellpadding="6">
<tr><th>Désignation</th><th>Montant TTC</th></tr>
<tr><td>Remplacement kit de distribution + pompe à eau</td><td>612,00 €</td></tr>
<tr><td>Liquide de refroidissement</td><td>38,00 €</td></tr>
<tr><td><b>Total TTC</b></td><td><b>650,00 €</b></td></tr></table>
<p style="font-size:12px;color:#555">Document d'essai fabriqué pour les tests Inspexo — données fictives.</p></body></html>`
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 820, height: 640 } })
for (const [nom, d] of [
  ['facture-conforme.png', { plaque: 'FG-456-HJ', vin: '' }],
  ['facture-autre-vehicule.png', { plaque: 'ZT-731-KM', vin: '' }],
]) {
  await p.setContent(facture(d))
  await p.screenshot({ path: join(DIR, nom), fullPage: true })
  console.log('écrit', nom)
}
await b.close()
