// Fabrique une photo de carte grise FICTIVE (données entièrement inventées)
// pour éprouver la lecture : nom, adresse et plaque y figurent EXPRÈS, pour
// vérifier qu'ils ne ressortent jamais. Usage : node tests/eval-stock/generer-carte-grise.mjs
import { chromium } from 'playwright'
const html = `<html><body style="font-family:Arial;background:#e9f0e6;width:900px;padding:24px">
<h3 style="margin:0">CERTIFICAT D'IMMATRICULATION — RÉPUBLIQUE FRANÇAISE (SPÉCIMEN FICTIF)</h3>
<table style="font-size:18px;margin-top:12px;border-collapse:collapse" cellpadding="6">
<tr><td>(A)</td><td>AA-123-AA</td><td>(B)</td><td>14/03/2016</td></tr>
<tr><td>(C.1)</td><td colspan="3">TESTEUR JEAN</td></tr>
<tr><td>(C.3)</td><td colspan="3">1 RUE IMAGINAIRE 31000 TOULOUSE</td></tr>
<tr><td>(D.1)</td><td>RENAULT</td><td>(D.2)</td><td>RBK2C0</td></tr>
<tr><td>(D.3)</td><td>CLIO</td><td>(E)</td><td>VF1RFB00X56123456</td></tr>
<tr><td>(P.1)</td><td>1461</td><td>(P.2)</td><td>66</td></tr>
<tr><td>(P.3)</td><td>GO</td><td>(P.6)</td><td>4</td></tr>
</table></body></html>`
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 950, height: 480 } })
await p.setContent(html); await p.screenshot({ path: 'tests/eval-stock/carte-grise-fictive.png' }); await b.close()
console.log('tests/eval-stock/carte-grise-fictive.png')
