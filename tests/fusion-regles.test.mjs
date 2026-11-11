// Tests hors ligne des règles de fusion des sources (sprint 23, étape f).
// Usage : node tests/fusion-regles.test.mjs
import { rapprocher, organePrincipal, defautsFusion, graviteSourcee, estBornee, intervalleEcrit, montantsDe } from '../scripts/fusion-regles.mjs'

let ok_ = 0, ko = 0
const ok = (c, l) => { if (c) { ok_++; console.log(`PASS — ${l}`) } else { ko++; console.log(`FAIL — ${l}`) } }
const eq = (a, b, l) => ok(a === b, `${l}${a === b ? '' : ` (obtenu ${JSON.stringify(a)}, attendu ${JSON.stringify(b)})`}`)

// ── Les faux rattachements du 11 nov. 2026 : ils doivent rester DOUTEUX ─────
// (décision d'Utku : même organe ET même défaut ; un cas douteux devient une
// nouvelle panne proposée, jamais un ajout de source.)
const faux = [
  ['Pompe d’injection à remplacer prématurément et fuite au boîtier de thermostat', 'Joint de culasse / surchauffe du circuit de refroidissement'],
  ['Durites d’admission d’air du turbo qui éclatent ou se déboîtent (perte de puissance)', 'Défaillance du turbocompresseur'],
  ['Vanne EGR et radiateur EGR : fuite de liquide de refroidissement', 'Pompe à eau prématurément défaillante'],
  ['Pompe à eau fragile (surchauffe) et usure prématurée d’embrayage', 'Durite de dégazage / circuit de refroidissement fragile'],
  ['Vanne EGR et calibration : perte de puissance', 'Encrassement de la vanne EGR'],
  ['Chaîne de distribution : claquement métallique au démarrage à froid', 'Usure et rupture de la chaîne de distribution arrière'],
  ['Chaîne de distribution : rupture', 'Courroie de distribution en bain d’huile qui se délite'],
]
for (const [aff, panne] of faux) eq(rapprocher(aff, [{ titre: panne }]).panne, null, `douteux, pas d’ajout : « ${aff.slice(0, 50)} » ↛ « ${panne.slice(0, 40)} »`)

// Même DÉFAUT, organe différent : c'est l'organe qui doit trancher (sans ce
// bloc, le contrôle de l'organe pourrait sauter sans qu'aucun test ne le voie).
for (const [aff, panne] of [
  ['Vanne EGR : fuite de liquide de refroidissement', 'Pompe à eau : fuite'],
  ['Pompe à eau fragile : fuite', 'Durite de dégazage fragile : fuite'],
  ['Injecteurs : fuite au joint', 'Pompe haute pression : fuite de gazole'],
  ['Turbo : encrassement', 'Vanne EGR : encrassement'],
]) eq(rapprocher(aff, [{ titre: panne }]).panne, null, `même défaut, autre organe : « ${aff} » ↛ « ${panne} »`)

// ── Les vrais rattachements : même organe principal ET même défaut ──────────
const vrais = [
  ['Dégradation prématurée de la courroie de distribution immergée dans l’huile', 'Courroie de distribution en bain d’huile (wet belt) qui se désagrège'],
  ['Usure prématurée puis rupture de la chaîne d’arbres à cames (chaîne de 7 mm)', 'Casse de la chaîne interne d’entraînement des arbres à cames'],
  ['Pompe à eau : fuite et perte de liquide de refroidissement', 'Pompe à eau prématurément défaillante, fuite'],
  ['Volant moteur bimasse : casse ou usure prématurée', 'Volant moteur bi-masse défaillant (usure)'],
]
for (const [aff, panne] of vrais) ok(rapprocher(aff, [{ titre: panne }]).panne?.titre === panne, `rattaché : « ${aff.slice(0, 50)} » → « ${panne.slice(0, 40)} »`)

// Deux pannes candidates : douteux, jamais un choix arbitraire.
eq(rapprocher('Rupture de la chaîne de distribution', [{ titre: 'Rupture de la chaîne de distribution avant' }, { titre: 'Chaîne de distribution : casse' }]).panne, null, 'deux pannes candidates : douteux')
// La panne voisine est signalée à la relecture.
ok(rapprocher('Réservoir d’AdBlue : pompe grippée', [{ titre: 'AdBlue : cristallisation dans le réservoir' }]).voisines.length === 1, 'une panne voisine sur le même organe est signalée')

// ── Organe principal = le premier nommé ─────────────────────────────────────
eq(organePrincipal('Pompe d’injection et fuite au boîtier de thermostat'), 'pompe_hp', 'organe principal : le sujet, pas un organe cité plus loin')
eq(organePrincipal('Courroie de distribution humide : débris qui bouchent la crépine'), 'courroie_distribution', 'courroie avant crépine')
ok(organePrincipal('Chaîne de distribution') !== organePrincipal('Courroie de distribution'), 'chaîne et courroie : deux organes')
ok(!defautsFusion('perte de puissance, bruits, à-coups').size, 'un symptôme n’est pas un défaut')

// ── Gravité établie par la source ───────────────────────────────────────────
eq(graviteSourcee(['Risque d’incendie du compartiment moteur.'], 'x').gravite, 'securite', 'danger écrit ⇒ securite')
eq(graviteSourcee(['Remplacement facturé 4 500 € en concession.'], 'x').gravite, 'casse', 'montant > 3 000 € écrit ⇒ casse')
eq(graviteSourcee(['Compter 1 200 € pour la remise en état.'], 'x').gravite, 'majeure', '500-3 000 € ⇒ majeure')
eq(graviteSourcee(['Pièce à 180 euros.'], 'x').gravite, 'mineure', '< 500 € ⇒ mineure')
eq(graviteSourcee(['Casse moteur possible si on attend.'], 'x').gravite, null, 'jamais promue en casse sans montant : pas de gravité ⇒ pas de panne')
eq(graviteSourcee([], 'x').gravite, null, 'sans extrait : pas de gravité')
eq(montantsDe('entre 2 500 et 4 500 euros, 2026 km').join(','), '2500,4500', 'montants : le kilométrage et les années ne sont pas des montants')

// ── Période bornante, intervalle ────────────────────────────────────────────
ok(estBornee({ periodes: [{ bornante: true }] }), 'période bornante détectée')
ok(!estBornee({ periodes: [{ bornante: false }] }), '« surtout 2012-2014 » (indicative) n’est pas bornante')
eq(intervalleEcrit('remplacement tous les 90 000 km ou 4 ans').km, 90000, 'intervalle km lu')
eq(intervalleEcrit('remplacement tous les 90 000 km ou 4 ans').ans, 4, 'intervalle ans lu')
ok(intervalleEcrit('courroie, 140 000 km / 10 ans, 10 ans / 210 000 km').plusieurs, 'plusieurs intervalles écrits ⇒ rien')

// ⚠️ La porte de sortie est la DERNIÈRE instruction, fusionnée avec le succès.
console.log(`\n${ok_} contrôles passés, ${ko} échec(s).`)
if (ko > 0) process.exit(1); else console.log('Tous les tests de fusion passent.')
