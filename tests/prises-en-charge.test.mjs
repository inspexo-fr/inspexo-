// Tests hors ligne des prises en charge (sprint 23 f) — affichage seulement.
// Usage : node tests/prises-en-charge.test.mjs
import { sanitizePrisesEnCharge, fusionnerPrisesEnCharge, prisesAffichables, MENTION_FRANCE, MENTION_CONTEXTE } from '../supabase/functions/_shared/prisesEnCharge.ts'

let ok_ = 0, ko = 0
const ok = (c, l) => { if (c) { ok_++; console.log(`PASS — ${l}`) } else { ko++; console.log(`FAIL — ${l}`) } }
const eq = (a, b, l) => ok(a === b, `${l}${a === b ? '' : ` (obtenu ${JSON.stringify(a)}, attendu ${JSON.stringify(b)})`}`)

const U = 'https://www.largus.fr/actualite-automobile/1-5-bluehdi-extension-10-ans-30041132.html'
const fr = { type: 'garantie', texte: 'Extension de garantie de la chaîne de distribution à 10 ans ou 240 000 km', periode: { debut: 2017, fin: 2023, texte: 'moteurs produits d’octobre 2017 à janvier 2023' }, pays: ['FR'], urls: [U] }
const us = { type: 'rappel', texte: 'Rappel 21H7 des turbocompresseurs (NHTSA 22V-178)', periode: null, pays: ['US'], urls: ['https://static.nhtsa.gov/odi/rcl/2022/RCAK-22V178-9203.pdf'] }

eq(sanitizePrisesEnCharge([fr, us]).length, 2, 'deux prises valides gardées')
eq(sanitizePrisesEnCharge([{ ...fr, type: 'panne' }]).length, 0, 'type inconnu refusé')
eq(sanitizePrisesEnCharge([{ ...fr, urls: ['http://x'] }]).length, 0, 'sans URL https : refusée')
eq(sanitizePrisesEnCharge([{ ...fr, periode: { debut: 2023, fin: 2017 } }])[0].periode, null, 'période incohérente : retirée, pas inventée')
eq(sanitizePrisesEnCharge([fr, { ...fr }]).length, 1, 'doublon de texte retiré')

const f = fusionnerPrisesEnCharge([fr], [fr, us])
eq(f.ajoutees, 1, 'fusion additive : seul le nouveau est ajouté')
eq(f.liste.length, 2, 'rien n’est retiré')

const a2020 = prisesAffichables([fr, us], 2020)
eq(a2020.length, 2, '2020 : la garantie bornée 2017-2023 et le rappel sans période sont affichés')
eq(a2020.find((x) => x.type === 'garantie').mention, MENTION_FRANCE, 'source française : programme à vérifier par le VIN')
eq(a2020.find((x) => x.type === 'rappel').mention, MENTION_CONTEXTE, 'source américaine : information de contexte')
ok(a2020.find((x) => x.type === 'rappel').periode_inconnue, 'période absente : dite comme telle')
eq(prisesAffichables([fr], 2015).length, 0, '2015 : hors de la période écrite, rien d’affiché')
eq(prisesAffichables([fr], null).length, 0, 'année inconnue et période bornée : rien d’affiché')
for (const m of [MENTION_FRANCE, MENTION_CONTEXTE]) ok(!/\bcouvert/i.test(m) && !/\béligible\b(?! de)/i.test(m.replace("l'éligibilité", '')), `jamais « couvert » : « ${m.slice(0, 50)}… »`)

// ⚠️ La porte de sortie est la DERNIÈRE instruction, fusionnée avec le succès.
console.log(`\n${ok_} contrôles passés, ${ko} échec(s).`)
if (ko > 0) process.exit(1); else console.log('Tous les tests prises en charge passent.')
