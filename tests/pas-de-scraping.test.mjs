// Test hors ligne : AUCUN de nos serveurs ne contacte un site d'annonces.
// Usage : node tests/pas-de-scraping.test.mjs
//
// ⚠️ C'EST UNE PROMESSE PUBLIQUE, PAS UNE PRÉFÉRENCE D'ARCHITECTURE.
// Elle est écrite dans la politique de confidentialité, dans la fiche des
// stores et dans la page de l'extension : « l'annonce est lue par votre
// appareil, jamais par nos serveurs ». Le jour où une fonction irait chercher
// une page d'annonce, la promesse deviendrait fausse sans que personne ne s'en
// aperçoive — un `fetch` de plus ne se voit pas dans une revue de code.
//
// Ce que le test interdit : qu'un domaine de site d'annonces apparaisse dans
// le code qui s'exécute SUR NOS SERVEURS (fonctions edge Supabase et fonctions
// Vercel `/api`).
//
// Ce qu'il n'interdit pas, et c'est voulu : les mêmes domaines côté CLIENT
// (extension Chrome, extracteur de l'appli, pages React). Là, c'est le
// navigateur de l'utilisateur qui charge la page — c'est précisément le
// dispositif que la promesse décrit.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

let ok_ = 0, ko = 0
const ok = (c, l) => { if (c) { ok_++; console.log(`PASS — ${l}`) } else { ko++; console.log(`FAIL — ${l}`) } }

const RACINE = fileURLToPath(new URL('..', import.meta.url))

// Les sites d'annonces que l'extension et l'appli savent lire. Ajouter un
// extracteur, c'est ajouter son domaine ici.
const SITES_ANNONCES = [
  'leboncoin.fr',
  'leboncoin',
  'lacentrale.fr',
  'autoscout24',
]

/** Code exécuté SUR NOS SERVEURS. */
const COTE_SERVEUR = ['supabase/functions', 'api']

function fichiers(dossier, acc = []) {
  for (const e of readdirSync(join(RACINE, dossier))) {
    const rel = join(dossier, e)
    const abs = join(RACINE, rel)
    if (statSync(abs).isDirectory()) fichiers(rel, acc)
    else if (/\.(ts|js|mjs|json)$/.test(e)) acc.push(rel)
  }
  return acc
}

// ── Aucun fetch serveur ne vise un site d'annonces ────────────────────────
//
// ⚠️ La première version de ce test interdisait la simple PRÉSENCE du mot
// « leboncoin » dans le code serveur. Elle a immédiatement signalé
// `intake` et `marche` — qui ne font pourtant rien de mal : ils portent une
// LISTE BLANCHE (`SITES_AUTORISES`) servant à refuser une provenance qui ne
// serait pas un site d'annonces connu. Interdire le mot, c'était interdire
// la validation elle-même.
//
// Ce qui compte n'est pas de nommer un domaine, c'est d'ALLER LE CHERCHER.
{
  const fautifs = []
  const VARIABLES_SUSPECTES = /source_url|urlAnnonce|annonceUrl|url_annonce|lienAnnonce/i
  for (const d of COTE_SERVEUR) {
    for (const f of fichiers(d)) {
      const src = readFileSync(join(RACINE, f), 'utf8')
      const lignes = src.split(String.fromCharCode(10))
      lignes.forEach((l, i) => {
        if (/^\s*(\/\/|\*)/.test(l)) return        // commentaire
        if (!/\bfetch\s*\(/.test(l)) return         // pas un appel réseau
        const vise = SITES_ANNONCES.find((s2) => l.toLowerCase().includes(s2))
        if (vise) fautifs.push(`${f}:${i + 1} → fetch vers « ${vise} »`)
        else if (VARIABLES_SUSPECTES.test(l)) {
          fautifs.push(`${f}:${i + 1} → fetch portant l'URL d'une annonce`)
        }
      })
    }
  }
  ok(fautifs.length === 0,
    `aucun fetch serveur ne vise un site d'annonces${fautifs.length ? ` — ${fautifs[0]}` : ''}`)
  fautifs.slice(1, 5).forEach((t) => console.log(`        aussi : ${t}`))
}

// ── Et le récupérateur de pages REFUSE ces domaines, par construction ─────
//
// ⚠️ Le trou que ce garde-fou bouche : `texteDeLaPage` récupère une URL
// QUELCONQUE — celle que cite une fiche moteur. Rien n'empêchait une source
// d'être une annonce Leboncoin, auquel cas notre serveur serait allé la
// chercher. La promesse tient désormais par construction, pas par chance.
{
  const vs = readFileSync(join(RACINE, 'supabase/functions/_shared/verifSource.ts'), 'utf8')
  ok(/export function estSiteDAnnonces/.test(vs),
    'le récupérateur de pages sait reconnaître un site d’annonces')
  const corps = vs.slice(vs.indexOf('export async function texteDeLaPage'))
  ok(/^\s*if \(estSiteDAnnonces\(url\)\) return null/m.test(corps),
    'et il refuse AVANT toute requête — premier test de la fonction')
  for (const site of SITES_ANNONCES) {
    ok(vs.toLowerCase().replace(/\\/g, '').includes(site),
      `« ${site} » figure dans la liste refusée`)
  }
}

// ── Le test mord-il ? Contre-épreuve ──────────────────────────────────────
{
  const faux = '  const r = await fetch("https://www.leboncoin.fr/ad/voitures/123")'
  const detecte = /\bfetch\s*\(/.test(faux) && SITES_ANNONCES.some((s2) => faux.toLowerCase().includes(s2))
  ok(detecte, 'contre-épreuve : un fetch vers Leboncoin serait bien détecté')

  const liste = '  const SITES_AUTORISES = ["leboncoin.fr", "lacentrale.fr"]'
  const fauxPositif = /\bfetch\s*\(/.test(liste)
  ok(!fauxPositif, 'une liste blanche de validation ne déclenche PAS d’alerte')

  const commentaire = "  // aucune requête vers leboncoin.fr ici"
  ok(/^\s*\/\//.test(commentaire),
    'et une mention en commentaire non plus')
}

// ── Les extracteurs vivent bien côté CLIENT ────────────────────────────────
{
  const extension = readFileSync(join(RACINE, 'extension/sites/leboncoin.js'), 'utf8')
  ok(extension.length > 200, 'l’extracteur Leboncoin existe côté extension')
  const mobile = readFileSync(join(RACINE, 'src/lib/extracteurInjectable.gen.js'), 'utf8')
  ok(mobile.includes('leboncoin'),
    'et il est embarqué dans le script injecté par l’appli — c’est l’appareil qui lit')
}

// ── Ce que la fonction `intake` reçoit : du TEXTE, pas une URL à aller lire ─
{
  const intake = readFileSync(join(RACINE, 'supabase/functions/intake/index.ts'), 'utf8')
  ok(/body\.titre/.test(intake) && /body\.description/.test(intake),
    'intake reçoit des CHAMPS déjà extraits (titre, description), pas une page à charger')
  // La seule URL qu'elle manipule est conservée comme provenance, jamais
  // récupérée : aucun fetch ne doit porter une variable d'URL d'annonce.
  const lignesFetch = intake.split('\n').filter((l) => /fetch\s*\(/.test(l))
  // ⚠️ `SUPABASE_URL` contient « URL » : un motif trop large prenait notre
  // propre appel interne pour une récupération d'annonce.
  ok(!lignesFetch.some((l) => /source_url|body\.url|urlAnnonce|annonceUrl/i.test(l)),
    'aucun fetch d’intake ne porte l’URL de l’annonce')
}

console.log(`\n${ok_} contrôles passés, ${ko} échec(s).`)
if (ko > 0) process.exit(1)
console.log('Tous les tests pas-de-scraping passent.')
