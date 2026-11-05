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
  function envoyer (charge) {
    window.mobileApp && window.mobileApp.postMessage({
      detail: { inspexo_extraction: JSON.stringify(charge) },
    })
  }
  try {
    var sites = globalThis.INSPEXO_SITES || []
    var site = sites.find(function (s) {
      try { return s.match(window.location) } catch (e) { return false }
    })
    if (site) {
      var data = site.extract(document)
      envoyer({ ok: !!data, type: 'annonce', site: site.nom, data: data })
      return
    }
    // SPRINT 19 — page de RECHERCHE partagée : les annonces affichées
    // deviennent les comparables de la prochaine analyse. Même geste que le
    // bouton « Ajouter ces annonces comme comparables » de l'extension, et
    // même règle : rien n'est lu avant que l'utilisateur ait partagé la page.
    var serp = sites.find(function (s) {
      try { return s.matchSerp && s.matchSerp(window.location) } catch (e) { return false }
    })
    if (serp) {
      var annonces = serp.extractSerp(document) || []
      envoyer({ ok: annonces.length > 0, type: 'recherche', site: serp.nom, annonces: annonces })
      return
    }
    envoyer({ ok: false, type: null, site: null, data: null })
  } catch (e) {
    envoyer({ ok: false, type: null, site: null, erreur: String(e).slice(0, 200) })
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
