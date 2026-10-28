#!/usr/bin/env node
// Génère src/lib/extracteurInjectable.gen.js : les extracteurs de l'extension
// Chrome (sites/common + leboncoin + lacentrale + autoscout24) concaténés avec
// un pilote, prêts à être injectés dans la WebView de l'appli mobile
// (InAppBrowser.executeScript). Source de vérité : extension/sites/*.js —
// relancer ce script après toute modification des extracteurs.
// Usage : node scripts/generer-extracteur-mobile.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const sources = ['common.js', 'leboncoin.js', 'lacentrale.js', 'autoscout24.js']
  .map((f) => readFileSync(join(ROOT, 'extension', 'sites', f), 'utf8'))
  .join('\n')

const pilote = `
;(function () {
  try {
    var site = (globalThis.INSPEXO_SITES || []).find(function (s) {
      try { return s.match(window.location) } catch (e) { return false }
    })
    var data = site ? site.extract(document) : null
    window.mobileApp && window.mobileApp.postMessage({
      detail: { inspexo_extraction: JSON.stringify({ ok: !!data, site: site ? site.nom : null, data: data }) },
    })
  } catch (e) {
    window.mobileApp && window.mobileApp.postMessage({
      detail: { inspexo_extraction: JSON.stringify({ ok: false, site: null, erreur: String(e).slice(0, 200) }) },
    })
  }
})();
`

const bundle = `${sources}\n${pilote}`

const sortie = `// GÉNÉRÉ par scripts/generer-extracteur-mobile.mjs — NE PAS ÉDITER À LA MAIN.
// Extracteurs de l'extension Chrome (extension/sites/*.js) + pilote, injectés
// dans la WebView de l'appli mobile. Le résultat revient par
// window.mobileApp.postMessage (événement messageFromWebview).
/* eslint-disable */
export const EXTRACTEUR_INJECTABLE = ${JSON.stringify(bundle)}
`
writeFileSync(join(ROOT, 'src', 'lib', 'extracteurInjectable.gen.js'), sortie)
console.log(`src/lib/extracteurInjectable.gen.js généré (${Math.round(bundle.length / 1024)} Ko)`)
