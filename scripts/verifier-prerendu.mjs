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

/**
 * Une préversion Vercel est protégée par défaut : la requête anonyme part en
 * 302 vers le SSO. Le confondre avec une page vide serait un faux diagnostic —
 * on le reconnaît et on le dit.
 */
function deploiementProtege(html, urlFinale) {
  // Le signe le plus sûr est d'avoir été renvoyé hors du domaine interrogé :
  // Vercel redirige vers vercel.com/login, et le SSO n'est qu'un paramètre de
  // cette URL — le chercher dans le chemin ne suffit pas.
  let horsDomaine = false
  try {
    horsDomaine = new URL(urlFinale).host !== new URL(BASE).host
  } catch (_) { /* URL finale inexploitable : on s'en remet au corps */ }
  return (
    horsDomaine ||
    html.includes('Protected by Vercel Authentication') ||
    html.includes('Authentication Required')
  )
}

let ko = 0
let protegees = 0
console.log(`Contrôle du HTML servi par ${BASE} (sans JavaScript)\n`)

for (const p of PAGES) {
  let html = ''
  let statut = 0
  let r = null
  try {
    r = await fetch(`${BASE}${p.url}`, {
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

  if (deploiementProtege(html, r?.url ?? '')) {
    console.log(`! ${p.url}`)
    console.log('    déploiement protégé par l\'authentification Vercel : ce contrôle')
    console.log('    anonyme ne peut rien conclure. Sur une préversion, utiliser :')
    console.log(`      npx vercel curl ${BASE}${p.url}`)
    protegees++
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
if (protegees > 0) {
  console.log(`! ${protegees} page(s) derrière l'authentification Vercel : contrôle anonyme`)
  console.log('  impossible. Ce n\'est PAS un défaut de pré-rendu — rien n\'est conclu.')
  process.exit(2)
}
if (ko === 0) {
  console.log('✓ Les pages publiques sont servies avec leur contenu, sans JavaScript.')
  process.exit(0)
}
console.log(`✗ ${ko} page(s) servie(s) sans leur contenu.`)
console.log('  Le pré-rendu n\'a pas tourné pendant le build. Voir docs/prerendu.md.')
process.exit(1)
