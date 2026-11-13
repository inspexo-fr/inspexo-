// Tests hors ligne : fiche moteur construite depuis les PARTIES CONFIRMÉES
// (sprint 24, chantier A). Usage : node tests/parties-confirmees.test.mjs
import fs from 'node:fs'
import { restreindreSources, promptDepuisParties, normUrlSource, sanitizePannes } from '../supabase/functions/_shared/defectSheets.ts'
import { partiesConfirmees, CLASSES_PORTANTES } from '../scripts/parties-confirmees.mjs'
let ok_ = 0, ko = 0
const ok = (c, l) => { if (c) { ok_++; console.log(`PASS — ${l}`) } else { ko++; console.log(`FAIL — ${l}`) } }

// 1. Restriction des sources : une URL hors liste ne passe jamais.
const brut = [
  { titre: 'A', symptomes: 's', sources: [{ url: 'https://www.largus.fr/x.html#top', vehicule_concerne: 'v', nomme_moteur: true }, { url: 'https://forum.exemple.fr/t/1', vehicule_concerne: 'v', nomme_moteur: true }] },
  { titre: 'B', symptomes: 's', sources: [{ url: 'https://inventee.example.com/p', vehicule_concerne: 'v', nomme_moteur: true }] },
]
const r = restreindreSources(brut, ['https://largus.fr/x.html/'])
ok(r.pannes.length === 1 && r.pannes[0].titre === 'A', 'une panne sans source autorisée disparaît')
ok(r.pannes[0].sources.length === 1, 'la source hors liste est retirée de la panne gardée')
ok(r.retirees.length === 2, 'les URL retirées sont comptées')
ok(normUrlSource('https://WWW.Largus.fr/x.html/#a') === normUrlSource('https://largus.fr/x.html'), 'www, casse de l’hôte, barre finale et fragment ignorés')
ok(normUrlSource('pas une url') === null, 'URL invalide ⇒ null')
ok(restreindreSources(brut, []).pannes.length === 0, 'liste vide ⇒ aucune panne')

// 2. Le prompt : aucune recherche, plan et programmes vides, faits balisés.
const pr = promptDepuisParties('Renault', 'R9M', '1.6 dCi', [{ texte: 'Fissure <script>', urls: ['https://largus.fr/x'], extraits: ['le carter-cylindre peut se fissurer'] }])
ok(/AUCUNE recherche/.test(pr), 'le prompt interdit la recherche')
ok(/plan_entretien et programmes_garantie : listes VIDES/.test(pr), 'plan et programmes vides')
ok(!/<script>/.test(pr), 'chevrons neutralisés dans les faits')
ok(/<extrait>le carter-cylindre peut se fissurer<\/extrait>/.test(pr), 'extrait verbatim transmis')

// 3. Le pipeline existant s’applique ensuite : sources rattachées, rang portant.
const s = sanitizePannes([{ titre: 'Fissure du carter-cylindre 1.6 dCi', symptomes: 'casse moteur', gravite: 'casse', sources: [{ url: 'https://www.largus.fr/actualite-automobile/renault-espace-talisman-et-trafic-risque-de-casse-du-moteur-16-dci-9928390.html', vehicule_concerne: 'Renault 1.6 dCi R9M', nomme_moteur: true }] }], 'R9M', 'Renault')
ok(s.pannes.length === 1, 'une panne confirmée sur la presse passe sanitizePannes')

// 4. Collecte : seules les parties « soutenue » sur une source portante.
const journal = { affirmations: {
  'A-X-01': { famille: 'X', type: 'panne', parties: [
    { uid: 'A-X-01#1', partie: 'p1', confirmees: [{ url: 'https://largus.fr/a', verdict: 'soutenue', classe: 'presse' }] },
    { uid: 'A-X-01#2', partie: 'p2', confirmees: [{ url: 'https://forum.fr/a', verdict: 'soutenue', classe: 'forum' }] },
    { uid: 'A-X-01#3', partie: 'p3', confirmees: [{ url: 'https://largus.fr/b', verdict: 'non_soutenue', classe: 'presse' }] },
  ] },
  'A-Y-01': { famille: 'Y', type: 'panne', parties: [{ uid: 'A-Y-01#1', partie: 'autre', confirmees: [{ url: 'https://largus.fr/c', verdict: 'soutenue', classe: 'presse' }] }] },
} }
const sources = { objets: { o: { id: 'A-X-01', famille: 'X', sources: [{ url: 'https://www.largus.fr/a', extraits: [{ texte: 'mot pour mot', verbatim: true }, { texte: 'paraphrase', verbatim: false }] }] } } }
const pc = partiesConfirmees(journal, sources, 'X')
ok(pc.length === 1 && pc[0].texte === 'p1', 'forum et « non soutenue » écartés, autre famille ignorée')
ok(pc[0].extraits.length === 1 && pc[0].extraits[0] === 'mot pour mot', 'seuls les extraits verbatim sont transmis')
ok(!CLASSES_PORTANTES.has('forum') && !CLASSES_PORTANTES.has('vendeur') && !CLASSES_PORTANTES.has('compilation'), 'forum, vendeur, compilation ne portent pas')

// 5. Le mode est réservé au secret d'éval et n'écrase jamais une fiche.
const sb = fs.readFileSync('supabase/functions/sheet-builder/index.ts', 'utf8')
ok(/mode === "parties" && \(!evalOk/.test(sb), 'sheet-builder : mode « parties » réservé au secret d’éval')
ok(/force: parties \? false : force/.test(sb), 'mode « parties » : jamais forcé (une fiche existante est renvoyée, pas remplacée)')
const ds = fs.readFileSync('supabase/functions/_shared/defectSheets.ts', 'utf8')
const gen = ds.slice(ds.indexOf('async function generateSheetDepuisParties'), ds.indexOf('/** Lookup seul'))
ok(!/web_search/.test(gen), 'aucune recherche web dans la génération depuis les parties')
ok(ds.indexOf('restreindreSources(generated.input.pannes') < ds.indexOf('sanitizePannes(\n    generated.input.pannes'), 'la restriction précède le contrôle de qualité')

if (ko) { console.log(`\n${ko} échec(s), ${ok_} réussite(s)`); process.exit(1) } else console.log(`\nTous les tests passent (${ok_})`)
