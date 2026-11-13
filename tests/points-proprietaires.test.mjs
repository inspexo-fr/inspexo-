// Tests hors ligne : points signalés par des propriétaires (sprint 24).
// Usage : node tests/points-proprietaires.test.mjs
import fs from 'node:fs'
import { pointProprietaire, siteDe, SEUIL_SOURCES_PROPRIETAIRES, MENTION_PROPRIETAIRES } from '../supabase/functions/_shared/pointsProprietaires.ts'
let ok_ = 0, ko = 0
const ok = (c, l) => { if (c) { ok_++; console.log(`PASS — ${l}`) } else { ko++; console.log(`FAIL — ${l}`) } }
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l}${JSON.stringify(a) === JSON.stringify(b) ? '' : ` (obtenu ${JSON.stringify(a)})`}`)
const f1 = 'https://www.forum-peugeot.com/t/1', f2 = 'https://forum.forum-peugeot.com/t/2', f3 = 'https://www.forum-auto.caradisiac.com/x'
const g1 = 'https://www.garage-dupont.fr/x', g2 = 'https://www.oscaro.com/blog/x', presse = 'https://www.largus.fr/x'
eq(siteDe(f2), 'forum-peugeot.com', 'sous-domaine ramené au site')
eq(siteDe('https://a.b.exemple.co.uk/x'), 'exemple.co.uk', 'suffixe à deux niveaux')
eq(SEUIL_SOURCES_PROPRIETAIRES, 3, 'seuil de 3 sites')
const p = { titre: 'Fuite du boîtier d\'eau — panne connue', organe: 'Boîtier d\'eau / thermostat', symptome: 'Traces de liquide sous le moteur à froid. Réparation : 350 € environ. Température qui monte à chaud.', km_typique: '80 000 km', urls: [f1, g1, g2] }
const pt = pointProprietaire(p)
ok(pt && pt.n_sources === 3, '3 sites distincts (forum + 2 garages) : point retenu')
ok(pt && !/panne connue/i.test(JSON.stringify(pt)), 'jamais « panne connue »')
ok(pt && !/€|euro/i.test(JSON.stringify(pt)), 'jamais un montant (la phrase chiffrée est retirée)')
eq(pt?.quand, 'à froid, à chaud, vers 80 000 km', 'quand : froid, chaud, kilométrage')
eq(pt?.quoi, 'Boîtier d\'eau / thermostat', 'quoi : l’organe')
eq(pt?.mention, MENTION_PROPRIETAIRES, 'mention obligatoire')
eq(pointProprietaire({ ...p, urls: [f1, f2, g1] }), null, 'deux pages du même site (sous-domaines) : 2 sites seulement ⇒ pas de point')
eq(pointProprietaire({ ...p, urls: [f1, g1, presse] }), null, 'une source de presse ne compte pas (la panne serait portée, pas « signalée »)')
ok(pointProprietaire({ ...p, urls: [f1, g1, g2, f3] })?.n_sources === 4, 'quatre sites : 4')

// Sans effet sur la note, une seule fois dans le dossier
const lire = (q) => fs.readFileSync(new URL(q, import.meta.url), 'utf8')
ok(!/pointsProprietaires|pointProprietaire|points_proprietaires/.test(lire('../supabase/functions/_shared/bareme.ts')), 'le barème ignore les points')
const score = lire('../supabase/functions/score/index.ts')
const lignes = score.split('\n').filter((l) => /pointsProprietaires|pointProprietaire\(/.test(l) && !/^\s*\/\//.test(l))
ok(lignes.length > 0 && lignes.every((l) => !/faits|calculerAxes|pannesNonVerifiables|score\s*[:=]|verdict/.test(l)), 'aucune ligne portant les points ne touche aux faits, au plafond ni au score')
const bloc = score.slice(score.indexOf('const restantes: typeof nonPortees'), score.indexOf('questionSansSourceIndependante(p.titre)') + 60)
ok(/pannesNonVerifiables = nonPortees\.length/.test(score) && /for \(const p of restantes\.slice\(0, 3\)\)/.test(bloc), 'le plafond compte toujours toutes les non portées ; la question n’est posée que pour celles qui ne sont pas devenues un point')
console.log(`\n${ok_} PASS, ${ko} FAIL`)
if (ko > 0) process.exit(1)
