// Tests hors ligne : pages modèle (sprint 23, lot 3, point 5).
// Usage : node tests/modeles.test.mjs
import fs from 'node:fs'
import { decouperLibelle, indexerModeles, composerPage, estGeneration, slugTexte, SEUIL_PANNES_MODELE, fichePubliee } from '../supabase/functions/_shared/modeles.ts'
let ok_ = 0, ko = 0
const ok = (c, l) => { if (c) { ok_++; console.log(`PASS — ${l}`) } else { ko++; console.log(`FAIL — ${l}`) } }
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l}${JSON.stringify(a) === JSON.stringify(b) ? '' : ` (obtenu ${JSON.stringify(a)})`}`)
const d = (s) => decouperLibelle(s).map((x) => `${x.marque}|${x.modele}|${x.generation}`)

eq(d('Renault Clio III/IV'), ['Renault|Clio|III', 'Renault|Clio|IV'], 'générations romaines')
eq(d('Ford Fiesta/Focus'), ['Ford|Fiesta|null', 'Ford|Focus|null'], 'deux modèles, pas deux générations')
eq(d('Peugeot 207/208'), ['Peugeot|207|null', 'Peugeot|208|null'], 'deux modèles numérotés')
eq(d('Mercedes Classe C W204/W205'), ['Mercedes|Classe C|W204', 'Mercedes|Classe C|W205'], 'codes de caisse')
eq(d('Ford Focus Mk4'), ['Ford|Focus|IV'], 'Mk4 = IV (même page que « Focus IV »)')
eq(d('Renault Clio RS'), ['Renault|Clio RS|null'], 'RS est une finition, pas une génération')
eq(d('Peugeot 308 GT'), ['Peugeot|308 GT|null'], 'GT est une finition')
eq(d('Opel Corsa D/E'), ['Opel|Corsa|D', 'Opel|Corsa|E'], 'générations à une lettre')
eq(d('VW Golf VII'), ['Volkswagen|Golf|VII'], 'VW → Volkswagen')
eq(d('Mini Cooper S R56'), ['Mini|Cooper S|R56'], 'modèle à deux mots')
ok(!estGeneration('2008') && !estGeneration('ST'), 'un nombre ou une finition ne sont pas des générations')
eq(slugTexte('Série 3 F30'), 'serie-3-f30', 'slug sans accent')

const fam = (famille, modeles) => ({ marque: 'Peugeot', famille, nom_commercial: famille, modeles })
const pages = indexerModeles([fam('A', ['Peugeot 2008 I']), fam('B', ['Peugeot 2008 II']), fam('C', ['Peugeot 2008']), fam('D', ['Peugeot Expert'])])
const p1 = pages.find((p) => p.slug === '2008-i'), p2 = pages.find((p) => p.slug === '2008-ii')
eq(p1?.familles.map((f) => f.famille), ['A', 'C'], 'famille citée sans génération : rattachée à chaque génération connue')
eq(p2?.familles.map((f) => f.famille), ['B', 'C'], '… y compris la seconde')
ok(!pages.some((p) => p.slug === '2008'), 'pas de page « 2008 » en double quand les générations existent')
ok(pages.some((p) => p.slug === 'expert' && p.generation === null), 'modèle sans génération connue : page sans génération')

// Composition : seules les sources portantes
const presse = 'https://www.largus.fr/a', forum = 'https://forum-peugeot.com/t/1', garage = 'https://www.garage-dupont.fr/x', officiel = 'https://www.service-public.gouv.fr/x'
const fiche = { marque: 'Peugeot', famille_moteur: 'A', updated_at: '2026-11-01', pannes: [
  { titre: 'Courroie qui se délite', gravite: 'majeure', url_source: [presse, forum] },
  { titre: 'Pompe à huile', gravite: 'casse', url_source: [officiel] },
  { titre: 'Bruit de chaîne', gravite: 'majeure', url_source: [forum, garage] },
  { titre: 'Rappel officiel : injecteur', gravite: 'securite', url_source: [presse] },
], prises_en_charge: [
  { type: 'garantie', texte: 'Extension 10 ans', periode: { debut: 2013, fin: 2020, texte: '2013-2020' }, pays: ['FR'], urls: [presse] },
  { type: 'campagne', texte: 'Sans date', periode: null, pays: ['FR'], urls: [presse] },
  { type: 'rappel', texte: 'Rappel publié au Royaume-Uni seulement', periode: { debut: 2014, fin: 2016, texte: '2014-2016' }, pays: ['UK'], urls: ['https://www.which.co.uk/x'] },
] }
const c = composerPage(p1, [fiche])
const s = c.sections[0]
eq(s.pannes.map((x) => x.titre), ['Courroie qui se délite', 'Pompe à huile', 'Injecteur'], 'pannes portées seulement ; préfixe « Rappel officiel » retiré')
eq(s.pannes_non_portees, 1, 'la panne sans source indépendante est comptée, pas montrée')
eq(s.pannes[0].sources, [presse], 'seules les sources portantes sont citées')
eq(s.prises.map((x) => x.texte), ['Extension 10 ans', 'Rappel publié au Royaume-Uni seulement'], 'prises en charge DATÉES seulement')
eq(s.prises.map((x) => x.portee), ['france', 'contexte'], 'source étrangère : information de contexte')
eq([c.n_pannes, c.publiable], [3, true], `seuil de ${SEUIL_PANNES_MODELE} pannes portées atteint`)
ok(!composerPage(p1, [{ ...fiche, pannes: fiche.pannes.slice(0, 2) }]).publiable, 'sous le seuil : page non publiée')
ok(composerPage(p1, []).sections.length === 0, 'famille sans fiche en base : aucune section')
ok(fichePubliee(fiche) && !fichePubliee({ ...fiche, pannes: [...fiche.pannes, { titre: 'x', url_source: [] }] }), 'lien vers /moteur seulement si la page moteur est publiée (même critère que list_moteurs_publies)')

// Une ligne qui nomme un autre véhicule ne va pas sur cette page
const clio = { marque: 'Renault', modele: 'Clio', generation: 'IV', slug_marque: 'renault', slug: 'clio-iv', familles: [{ marque: 'Renault', famille: 'K9K', nom_commercial: '1.5 dCi', modeles: [] }] }
const cat = [{ marque: 'Renault', modele: 'Clio' }, { marque: 'Renault', modele: 'Captur' }, { marque: 'Dacia', modele: 'Duster' }, { marque: 'Renault', modele: 'Mégane' }, { marque: 'Peugeot', modele: '2008' }]
const k9k = { marque: 'Renault', famille_moteur: 'K9K', pannes: [
  { titre: 'Injecteurs Delphi', gravite: 'majeure', url_source: [presse] },
  { titre: 'Courroie (Captur seulement)', gravite: 'majeure', url_source: [presse] },
  { titre: 'Turbo de la Clio IV', gravite: 'majeure', url_source: [presse] },
], prises_en_charge: [
  { type: 'rappel', texte: 'Rappel (Captur): filtre à particules remplacé', periode: { debut: 2016, fin: 2016, texte: 'octobre 2016' }, pays: ['FR'], urls: [presse] },
  { type: 'rappel', texte: 'Rappel (Dacia diesel): blocage de la clé de contact', periode: { debut: 2021, fin: 2021, texte: 'janvier 2021' }, pays: ['FR'], urls: [presse] },
  { type: 'campagne', texte: 'Rappel Clio et Mégane : injecteurs remplacés', periode: { debut: 2014, fin: 2015, texte: '2014-2015' }, pays: ['FR'], urls: [presse] },
  { type: 'garantie', texte: 'Consommation d’huile du 1.5 dCi : prise en charge', periode: { debut: 2018, fin: 2020, texte: '2018-2020' }, pays: ['FR'], urls: [presse] },
] }
const cc = composerPage(clio, [k9k], cat).sections[0]
eq(cc.pannes.map((x) => x.titre), ['Injecteurs Delphi', 'Turbo de la Clio IV'], 'panne propre au Captur : absente de la page Clio')
eq(cc.prises.map((x) => x.texte), ['Rappel Clio et Mégane : injecteurs remplacés', 'Consommation d’huile du 1.5 dCi : prise en charge'], 'prises nommant le Captur ou Dacia : absentes ; Clio nommée ou aucun véhicule nommé : gardées')
ok(!composerPage(clio, [k9k], cat).sections[0].prises.some((x) => /2008/.test(x.texte)), 'un nom numérique (2008) n’est jamais cherché : il se confond avec une année')
const serie = { marque: 'BMW', modele: 'Série 3' }, expert = { marque: 'Peugeot', modele: 'Expert' }
const k9kb = { ...k9k, prises_en_charge: [{ type: 'campagne', texte: 'Vérification avec le numéro de série (VIN) en centre expert', periode: { debut: 2015, fin: 2016, texte: '2015-2016' }, pays: ['FR'], urls: [presse] }] }
eq(composerPage(clio, [k9kb], [...cat, serie, expert]).sections[0].prises.length, 1, '« numéro de série » et « centre expert » ne sont pas des noms de véhicule')

// La page ne recopie pas les fiches : aucun symptôme, coût ou kilométrage
const src = fs.readFileSync(new URL('../supabase/functions/_shared/modeles.ts', import.meta.url), 'utf8')
ok(!/symptome|cout_indicatif|km_typique/.test(src), 'le module ne reprend ni symptômes, ni coûts, ni kilométrages (page /moteur = référence)')
ok(/import \{ sourcesPortentLEntree, urlsDeLaPanne \} from "\.\/atlasSource\.ts"/.test(src), 'même classement des sources que le score (aucune seconde liste d’hôtes)')
console.log(`\n${ok_} PASS, ${ko} FAIL`)
if (ko > 0) process.exit(1)
