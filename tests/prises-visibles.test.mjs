// Tests hors ligne : prises masquées ou restreintes (décisions d'Utku du
// 14 nov. 2026). Usage : node tests/prises-visibles.test.mjs
import fs from 'node:fs'
import { priseVisible, prisesAffichables, sanitizePrisesEnCharge, fusionnerPrisesEnCharge } from '../supabase/functions/_shared/prisesEnCharge.ts'
import { prisesDateesPropres } from '../supabase/functions/_shared/indexation.ts'
let ok_ = 0, ko = 0
const ok = (c, l) => { if (c) { ok_++; console.log(`PASS — ${l}`) } else { ko++; console.log(`FAIL — ${l}`) } }
const base = { type: 'rappel', texte: 'Rappel du réservoir de carburant (Xsara Picasso 2.0 HDi 90)', periode: { debut: 2001, fin: 2005, texte: '2001-2005' }, pays: ['FR'], urls: ['https://www.caradisiac.com/a'] }
const masquee = { ...base, texte: 'Rappel masqué pour test du dispositif', masquee: { le: '2026-11-14', motif: 'plus de source portante' } }
const restreinte = { ...base, restreinte_a: ['Xsara Picasso'] }
const libre = { ...base, texte: 'Prise en charge sans restriction pour test' }

ok(!priseVisible(sanitizePrisesEnCharge([masquee])[0], 'Clio'), 'masquée : jamais visible')
ok(sanitizePrisesEnCharge([masquee]).length === 1, 'masquée : CONSERVÉE en base (jamais supprimée)')
const fus = fusionnerPrisesEnCharge([masquee], [libre])
ok(fus.liste.some((x) => x.masquee), 'une écriture admin ultérieure garde la marque « masquée »')
ok(priseVisible(sanitizePrisesEnCharge([restreinte])[0], 'Xsara Picasso'), 'restreinte : visible pour le véhicule nommé')
ok(!priseVisible(sanitizePrisesEnCharge([restreinte])[0], '307'), 'restreinte : retirée de la 307')
ok(!priseVisible(sanitizePrisesEnCharge([restreinte])[0], null), 'restreinte, modèle inconnu : non affichée (prudence)')
ok(priseVisible(sanitizePrisesEnCharge([libre])[0], '307'), 'sans restriction : visible')
ok(prisesAffichables([masquee, restreinte, libre], 2003, '307').length === 1, 'dossier : seule la prise libre s’affiche sur une 307')
ok(prisesDateesPropres([masquee, restreinte, libre], '2.0 HDi') === 1, 'indexation : ni masquée ni restreinte ne comptent')

// Câblage : toutes les lectures passent par la règle.
const lire = (f) => fs.readFileSync(f, 'utf8')
ok(/prisesAffichables\(sheet\?\.prises_en_charge \?\? \[\], v\.annee_modele \?\? null, v\.modele \?\? null\)/.test(lire('supabase/functions/score/index.ts')), 'score : dossier filtré par modèle')
ok(/x\.masquee && x\.type === "rappel"/.test(lire('supabase/functions/score/index.ts')), 'score : rappel masqué ⇒ question du VIN')
ok(/priseVisible\(x, page\.modele\)/.test(lire('supabase/functions/_shared/modeles.ts')), 'pages modèle filtrées')
ok(/priseVisible\(x, v\.modele\)/.test(lire('supabase/functions/_shared/stock.ts')), 'stock filtré')
const adm = lire('supabase/functions/admin-defect-sheets/index.ts')
const bloc = adm.slice(adm.indexOf('Array.isArray(body.corriger_prises)'), adm.indexOf('SPRINT 24, campagne 1'))
ok(!/\.filter\(|splice\(|delete /.test(bloc.replace(/\.filter\(\(t: unknown\)[^)]*\)/g, '')), 'corriger_prises ne retire aucune prise de la liste')
if (ko) { console.log(`\n${ko} échec(s)`); process.exit(1) } else console.log(`\nTous les tests passent (${ok_})`)
