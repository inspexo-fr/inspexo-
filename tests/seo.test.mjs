// Tests hors ligne : chantier SEO (sprint 24) — seuil d'indexation, anti-doublon, balises.
// Usage : node tests/seo.test.mjs
import fs from 'node:fs'
import { estIndexable as indexableHtml, ajouterNoindex, uneSeuleBaliseRobots, metaDe, pairesProches, gardee, doublonsMeta } from '../scripts/seo.mjs'
import { estIndexable, verdictIndexationMoteur, verdictIndexationModele, prisesDateesPropres, principale } from '../supabase/functions/_shared/indexation.ts'
let ok_ = 0, ko = 0
const ok = (c, l) => { if (c) { ok_++; console.log(`PASS — ${l}`) } else { ko++; console.log(`FAIL — ${l}`) } }
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l}${JSON.stringify(a) === JSON.stringify(b) ? '' : ` (obtenu ${JSON.stringify(a)})`}`)

// Seuil : portées + prises datées propres ≥ 3, dont au moins 1 portée
eq([estIndexable(3, 0), estIndexable(1, 2), estIndexable(0, 3), estIndexable(2, 0)], [true, true, false, false], 'seuil : 3 au total dont 1 panne portée au moins')
const presse = 'https://www.largus.fr/x', forum = 'https://forum-peugeot.com/t'
const fam = { marque: 'Fiat', famille: 'FIREFLY', nom_commercial: '1.0 FireFly' }
const fiche = { updated_at: '2026-11-13', pannes: [
  { titre: 'Panne (1.0 FireFly T3 120 ch)', url_source: [presse] },
  { titre: 'Refus de démarrage (1.3 FireFly T4)', url_source: [presse] },
  { titre: 'Supports moteur', url_source: [presse] },
], prises_en_charge: [] }
const v = verdictIndexationMoteur(fam, fiche, [fam])
eq([v.publiee, v.pannes.length, v.resume.n_portees, v.resume.indexable], [true, 1, 1, false], 'FIREFLY : page accessible, 2 pannes d’autres versions retirées, noindex')
eq(prisesDateesPropres([
  { type: 'campagne', texte: 'Campagne datée en France', periode: { debut: 2015, fin: 2016, texte: '2015-2016' }, pays: ['FR'], urls: [presse] },
  { type: 'campagne', texte: 'Campagne sans date publiée', periode: null, pays: ['FR'], urls: [presse] },
  { type: 'rappel', texte: 'Rappel publié au Royaume-Uni', periode: { debut: 2015, fin: 2016, texte: 'x' }, pays: ['UK'], urls: [presse] },
  { type: 'rappel', texte: 'Rappel du 1.3 FireFly 150 ch', periode: { debut: 2015, fin: 2016, texte: 'x' }, pays: ['FR'], urls: [presse] },
], '1.0 FireFly'), 1, 'prises propres : datées, publiées en France, de la même version')
const vw = { marque: 'Volkswagen', famille: 'EA288', nom_commercial: '2.0 TDI (EA288)' }, audi = { marque: 'Audi', famille: 'EA288', nom_commercial: '2.0 TDI (EA288)' }
eq([principale(vw, [vw, audi]), principale(audi, [vw, audi])?.marque], [null, 'Volkswagen'], 'vrai doublon : Audi EA288 renvoie à Volkswagen EA288')
const vd = verdictIndexationMoteur(audi, { pannes: [1, 2, 3].map((i) => ({ titre: `P${i}`, url_source: [presse] })) }, [vw, audi])
eq([vd.resume.indexable, vd.resume.canonique?.marque], [false, 'Volkswagen'], 'le doublon n’est pas indexable et porte le canonique')
eq(verdictIndexationModele([{ pannes: [1], prises: [{ portee: 'france' }, { portee: 'contexte' }] }]).indexable, false, 'modèle : une information de contexte ne compte pas')

// HTML : indexabilité, noindex sans canonique
const page = (t, d, robots = '', canon = 'https://www.inspexo.io/x') => `<html><head><title>${t}</title><meta name="description" content="${d}">${robots}<link rel="canonical" href="${canon}"></head><body><main>texte</main></body></html>`
ok(indexableHtml(page('A', 'a'), 'https://www.inspexo.io/x'), 'page normale : indexable')
ok(!indexableHtml(page('A', 'a', '<meta name="robots" content="noindex, follow">'), 'https://www.inspexo.io/x'), 'noindex : hors sitemap')
ok(!indexableHtml(page('A', 'a', '', 'https://www.inspexo.io/y'), 'https://www.inspexo.io/x'), 'canonique ailleurs : hors sitemap')
const n = ajouterNoindex(page('A', 'a'))
ok(metaDe(n).noindex && metaDe(n).canonique === 'https://www.inspexo.io/x', 'anti-doublon : noindex ajouté SANS canonique vers l’autre page')

const deux = '<head><meta name="robots" content="index, follow"><meta name="robots" content="noindex, follow" data-rh="true"></head>'
eq((uneSeuleBaliseRobots(deux).match(/name="robots"/g) || []).length, 1, 'une seule balise robots : celle de la page')
ok(/noindex/.test(uneSeuleBaliseRobots(deux)), '… et c’est le noindex qui reste')
eq(uneSeuleBaliseRobots('<head><meta name="robots" content="index, follow"></head>'), '<head><meta name="robots" content="index, follow"></head>', 'page sans balise propre : gabarit conservé')

// Similarité et choix de la page gardée
const corps = (mots) => `<html><head><title>x</title></head><body><main>${mots}</main></body></html>`
const commun = 'courroie de distribution humide qui se désagrège et bouche la crépine huile turbo moteur casse '.repeat(3)
const pages = [{ url: '/modele/bmw/serie-1-f20', html: corps(commun + 'serie un') }, { url: '/modele/bmw/serie-3-f30', html: corps(commun + 'serie trois') }, { url: '/modele/x/y', html: corps('tout autre texte sans rapport avec la distribution ni le turbo ni rien du tout ici') }]
const pr = pairesProches(pages, 0.8)
ok(pr.length === 1 && pr[0].a.includes('serie-1') && pr[0].b.includes('serie-3'), 'paire trop proche détectée, et elle seule')
eq(gardee('/modele/renault/megane-iii', '/modele/renault/megane-iv', { '/modele/renault/megane-iii': { annee_recente: 2008 }, '/modele/renault/megane-iv': { annee_recente: 2018 } }).garde, '/modele/renault/megane-iv', 'paire restée trop proche : la génération la plus récente reste indexée')
eq(gardee('/modele/a/x', '/modele/a/y', { '/modele/a/x': { annee_recente: 2015 }, '/modele/a/y': { annee_recente: 2015 } }), null, 'année égale : aucun choix, les deux restent indexées')
eq(gardee('/modele/a/x', '/modele/a/y', {}), null, 'année inconnue : aucun choix au hasard')
const pr2 = fs.readFileSync(new URL('../scripts/prerendu.mjs', import.meta.url), 'utf8')
ok(/if \(!g\) \{ nonDepartagees\.push\(pr\); continue \}/.test(pr2), 'le pré-rendu laisse indexées les paires non départagées et les signale')

// Balises
const d = doublonsMeta([{ url: '/a', meta: { titre: 'T', description: 'D' } }, { url: '/b', meta: { titre: 'T', description: 'E' } }, { url: '/c', meta: { titre: 'U', description: '' } }])
eq([d.titres.length, d.descriptions.length, d.sans_description], [1, 0, ['/c']], 'titres en double et description absente détectés')

// Pages moteur : plus de FAQPage ; BreadcrumbList partout
const moteur = fs.readFileSync(new URL('../src/pages/MoteurPage.jsx', import.meta.url), 'utf8')
ok(!/'@type': 'FAQPage'/.test(moteur), 'pages moteur : plus de FAQPage (questions identiques d’une page à l’autre)')
ok(/<FilAriane/.test(moteur), 'pages moteur : fil d’Ariane')
ok(!/AggregateRating|"Review"|'Review'/.test(fs.readFileSync(new URL('../src/components/FilAriane.jsx', import.meta.url), 'utf8') + moteur), 'ni avis ni note en étoiles')
console.log(`\n${ok_} PASS, ${ko} FAIL`)
if (ko > 0) process.exit(1)
