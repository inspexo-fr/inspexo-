#!/usr/bin/env node
// SPRINT 17 — Liens ?src= prêts à l'emploi, par canal.
//
// L'étiquette de campagne est contrainte des DEUX côtés (client et base) par
// ^[a-z0-9][a-z0-9-]{0,39}$ : ce script ne produit que des étiquettes valides,
// et il le VÉRIFIE avant d'écrire. Une étiquette refusée en base serait
// perdue en silence — le visiteur arriverait, l'analyse se ferait, et la
// provenance ne serait nulle part.
//
// Usage : node scripts/liens-src.mjs [--md]

const FORMAT = /^[a-z0-9][a-z0-9-]{0,39}$/
const BASE = 'https://www.inspexo.io'

// Un canal = un préfixe. Le numéro distingue les publications SANS rien dire
// de leur contenu : une étiquette n'est pas un titre, elle est un compteur.
const CANAUX = [
  { prefixe: 'tiktok', n: 10, page: '/score', quoi: 'Vidéos TikTok' },
  { prefixe: 'insta', n: 10, page: '/score', quoi: 'Publications Instagram' },
  { prefixe: 'yt', n: 5, page: '/score', quoi: 'YouTube (description)' },
  { prefixe: 'forum', n: 8, page: '/airbags-takata', quoi: 'Messages sur forums auto' },
  { prefixe: 'presse', n: 5, page: '/fiabilite', quoi: 'Contacts presse' },
  { prefixe: 'reddit', n: 5, page: '/score', quoi: 'Reddit' },
  { prefixe: 'fb', n: 5, page: '/score', quoi: 'Groupes Facebook' },
  { prefixe: 'lbc', n: 3, page: '/extension', quoi: 'Mentions Leboncoin / petites annonces' },
  { prefixe: 'pro', n: 3, page: '/pro', quoi: 'Démarchage professionnel' },
]

const lignes = []
let invalides = 0
for (const c of CANAUX) {
  const liens = []
  for (let i = 1; i <= c.n; i++) {
    const src = `${c.prefixe}-${String(i).padStart(2, '0')}`
    if (!FORMAT.test(src)) { invalides++; continue }
    liens.push({ src, url: `${BASE}${c.page}?src=${src}` })
  }
  lignes.push({ ...c, liens })
}

if (invalides > 0) {
  console.error(`✗ ${invalides} étiquette(s) ne respectent pas ^[a-z0-9][a-z0-9-]{0,39}$`)
  process.exit(1)
}

if (process.argv.includes('--md')) {
  const out = []
  out.push('# Liens de campagne `?src=` — prêts à l\'emploi\n')
  out.push('Généré par `node scripts/liens-src.mjs --md`. Ne pas éditer à la main.\n')
  out.push('L\'étiquette est capturée au premier rendu, gardée dans une seule clé de')
  out.push('`sessionStorage`, et **effacée dès qu\'elle est rattachée à une analyse**.')
  out.push('Elle n\'apparaît qu\'en **agrégé** dans l\'admin (onglet Parcours), jamais à')
  out.push('côté d\'une adresse email.\n')
  out.push('⚠️ Une étiquette hors format `^[a-z0-9][a-z0-9-]{0,39}$` est **refusée en')
  out.push('base** : le visiteur arrive, l\'analyse se fait, et la provenance est perdue')
  out.push('sans message d\'erreur. N\'inventez pas d\'étiquette à la main — ajoutez un')
  out.push('canal dans ce script.\n')
  out.push('Une étiquette est un **compteur**, pas un titre : `tiktok-03` ne dit rien du')
  out.push('contenu de la vidéo. Tenez la correspondance de votre côté.\n')
  for (const c of lignes) {
    out.push(`\n## ${c.quoi} — \`${c.prefixe}-*\` → ${c.page}\n`)
    for (const l of c.liens) out.push(`- \`${l.url}\``)
  }
  out.push('\n## Lire les résultats\n')
  out.push('Admin → onglet **Parcours** : analyses par source, taux de passage, délai')
  out.push('médian analyse → paiement. Le bilan quotidien par email reprend la')
  out.push('ventilation par source de la veille.\n')
  console.log(out.join('\n'))
} else {
  for (const c of lignes) {
    console.log(`\n${c.quoi}  (${c.page})`)
    for (const l of c.liens) console.log('  ' + l.url)
  }
  console.log(`\n${lignes.reduce((n, c) => n + c.liens.length, 0)} liens, tous au format valide.`)
}
