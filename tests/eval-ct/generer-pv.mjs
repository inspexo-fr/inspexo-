#!/usr/bin/env node
// Génère le PV de contrôle technique SYNTHÉTIQUE du cas d'éval
// pv-synthetique (aucune donnée réelle : nom, plaque et VIN fictifs, mis là
// EXPRÈS pour vérifier que la lecture ne les restitue jamais).
// Usage : node tests/eval-ct/generer-pv.mjs
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = join(dirname(fileURLToPath(import.meta.url)), 'pv-synthetique', 'photos')
mkdirSync(DIR, { recursive: true })

const HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { font-family: "Courier New", monospace; background: #e8e6e0; margin: 0; padding: 24px; }
  .doc { background: #fdfdfb; border: 1px solid #999; max-width: 760px; margin: auto; padding: 28px 32px; transform: rotate(-0.4deg); box-shadow: 2px 3px 8px rgba(0,0,0,.25); }
  h1 { font-size: 17px; letter-spacing: 1px; margin: 0 0 2px; }
  .sub { font-size: 11px; color: #333; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 12px; }
  td { padding: 3px 6px; border: 1px solid #bbb; vertical-align: top; }
  .lbl { color: #555; width: 32%; }
  .sec { font-weight: bold; font-size: 12px; background: #ddd; padding: 4px 6px; margin: 14px 0 6px; }
  .def { font-size: 12px; margin: 4px 0; }
  .maj { font-weight: bold; }
  .res { border: 2px solid #000; display: inline-block; padding: 6px 14px; font-weight: bold; font-size: 14px; margin-top: 10px; }
  .foot { font-size: 10px; color: #444; margin-top: 16px; }
</style></head><body><div class="doc">
  <h1>PROCÈS-VERBAL DE CONTRÔLE TECHNIQUE</h1>
  <div class="sub">Contrôle technique périodique — Véhicule léger (arrêté du 18 juin 1991 modifié)</div>
  <table>
    <tr><td class="lbl">Centre de contrôle</td><td>CTRL AUTO TOULOUSE NORD — Agrément S031X999</td></tr>
    <tr><td class="lbl">Date du contrôle</td><td>12/06/2026 — 10 h 42</td></tr>
    <tr><td class="lbl">Immatriculation</td><td>ZZ-999-ZZ</td></tr>
    <tr><td class="lbl">N° de châssis (VIN)</td><td>VF3ZZZTESTZ999999</td></tr>
    <tr><td class="lbl">Titulaire</td><td>M. JEAN FICTIF — 1 rue de l'Exemple, 31000 Toulouse</td></tr>
    <tr><td class="lbl">Kilométrage relevé</td><td><b>188 452 km</b></td></tr>
    <tr><td class="lbl">Kilométrage contrôle précédent</td><td>154 310 km (03/07/2024)</td></tr>
  </table>
  <div class="sec">DÉFAILLANCES CONSTATÉES</div>
  <div class="def maj">1.1.3.a.1 — Plaquettes de frein avant : usure excessive (au-delà du témoin) — DÉFAILLANCE MAJEURE (S)</div>
  <div class="def maj">5.2.3.d.2 — Pneumatique arrière droit : profondeur de sculpture insuffisante — DÉFAILLANCE MAJEURE (S)</div>
  <div class="def">4.1.2.a.1 — Feu de croisement : réglage non conforme — défaillance mineure</div>
  <div class="def">8.4.1.a.1 — Bruit anormal à l'échappement — défaillance mineure</div>
  <div class="sec">RÉSULTAT</div>
  <div class="res">DÉFAVORABLE — CONTRE-VISITE OBLIGATOIRE AVANT LE 11/08/2026</div>
  <div class="foot">Les défaillances majeures (S) doivent être corrigées et le véhicule représenté en contre-visite dans un délai de deux mois.
  Document généré pour test logiciel — véhicule, titulaire et immatriculation fictifs.</div>
</div></body></html>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 860, height: 1100 }, deviceScaleFactor: 2 })
await page.setContent(HTML, { waitUntil: 'networkidle' })
await page.screenshot({ path: join(DIR, 'pv.png'), fullPage: true })
await browser.close()
console.log('PV synthétique écrit :', join(DIR, 'pv.png'))
