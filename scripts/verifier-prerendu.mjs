// Vérifie qu'un déploiement sert bien le CONTENU des pages publiques dans le
// HTML, sans exécuter la moindre ligne de JavaScript — exactement ce que voit
// un robot d'indexation qui ne rend pas la page.
//
// Le danger que ce script couvre : le conteneur de build de Vercel n'a pas de
// Chromium. Si le pré-rendu ne s'exécute pas, le site reste parfaitement
// utilisable dans un navigateur, et c'est précisément ce qui rend la panne
// invisible — seules les pages servies à Google sont vides.
//
// Usage : node scripts/verifier-prerendu.mjs https://inspexo-xxxx.vercel.app
//         node scripts/verifier-prerendu.mjs            (défaut : production)
const BASE = (process.argv[2] || 'https://www.inspexo.io').replace(/\/$/, '')

// Chaque page doit porter son titre ET des fragments qui ne peuvent venir que
// de la base : un gabarit vide passerait un simple test de longueur.
const PAGES = [
  {
    url: '/moteur/peugeot-1-2-puretech-130',
    titre: 'Pannes connues du 1.2 PureTech 130',
    attendus: ['courroie', 'PureTech'],
    minTexte: 2500,
  },
  {
    url: '/moteur/peugeot-1-5-bluehdi',
    titre: 'Pannes connues du 1.5 BlueHDi',
    attendus: ['BlueHDi', 'entretien'],
    minTexte: 2500,
  },
  {
    url: '/airbags-takata',
    titre: 'Airbags Takata',
    attendus: ['BMW', 'Citroën', 'liste officielle'],
    minTexte: 1500,
  },
  {
    url: '/moteur',
    titre: 'Pannes connues par moteur',
    attendus: ['Peugeot', 'Renault'],
    minTexte: 1200,
  },
]

/** Texte visible approximatif : on retire scripts, styles et balises. */
function texteVisible(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

let ko = 0
console.log(`Contrôle du HTML servi par ${BASE} (sans JavaScript)\n`)

for (const p of PAGES) {
  let html = ''
  let statut = 0
  try {
    const r = await fetch(`${BASE}${p.url}`, {
      headers: { 'User-Agent': 'Inspexo-verif-prerendu/1.0' },
      redirect: 'follow',
    })
    statut = r.status
    html = await r.text()
  } catch (e) {
    console.log(`✗ ${p.url}\n    requête impossible : ${e.message}`)
    ko++
    continue
  }

  const texte = texteVisible(html)
  const titreOk = html.includes(p.titre)
  const manquants = p.attendus.filter((m) => !texte.includes(m))
  const assezLong = texte.length >= p.minTexte
  const ok = statut === 200 && titreOk && manquants.length === 0 && assezLong

  if (!ok) ko++
  console.log(`${ok ? '✓' : '✗'} ${p.url}`)
  console.log(`    HTTP ${statut} · ${texte.length} caractères lisibles (minimum ${p.minTexte})`)
  if (!titreOk) console.log(`    titre « ${p.titre} » ABSENT du HTML`)
  if (manquants.length) console.log(`    contenu absent : ${manquants.join(', ')}`)
  if (!assezLong) console.log('    page quasi vide : le pré-rendu n\'a pas tourné sur ce déploiement')
}

console.log()
if (ko === 0) {
  console.log('✓ Les pages publiques sont servies avec leur contenu, sans JavaScript.')
  process.exit(0)
}
console.log(`✗ ${ko} page(s) servie(s) sans leur contenu.`)
console.log('  Le pré-rendu n\'a pas tourné pendant le build. Voir docs/prerendu.md.')
process.exit(1)
