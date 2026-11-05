// Test hors ligne de Crit'Air et des ZFE (aucun appel API, aucune base).
// Usage : node tests/critair.test.mjs
//
// Ce que ce test protège, dans l'ordre d'importance :
//  1. qu'une vignette ne pèse JAMAIS sur le score — c'est une contrainte
//     d'usage, pas un défaut du véhicule ;
//  2. qu'on n'avertit jamais sur une supposition : classement inconnu ⇒ rien ;
//  3. que la liste des ZFE en CONFIG dit exactement la même chose que le socle
//     du code — sinon la même voiture serait interdite ou non selon le chemin ;
//  4. que la table réglementaire (arrêté du 21 juin 2016) est juste aux bornes.
import { readFileSync } from 'node:fs'
import {
  critair, libelleCritair, sourceZfe, verdictZfe, ZFE, ZFE_RELEVE_LE, ZFE_SOCLE,
} from '../supabase/functions/_shared/critair.ts'

let ko = 0
let total = 0
const ok = (cond, label, obtenu) => {
  total++
  if (!cond) { ko++; console.log(`FAIL — ${label}${obtenu !== undefined ? ` (obtenu ${JSON.stringify(obtenu)})` : ''}`) }
}
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), label, a)
const titre = (t) => console.log(`\n▶ ${t}`)

// ---------------------------------------------------------------------------
titre('Table réglementaire — arrêté du 21 juin 2016')
eq(critair('électrique', 2012), '0', 'électrique → Crit’Air 0, quelle que soit l’année')
eq(critair('hydrogène', 1998), '0', 'hydrogène → Crit’Air 0')

// Essence : bornes 1997, 2006, 2011.
eq(critair('essence', 2011), '1', 'essence 2011 → 1')
eq(critair('essence', 2010), '2', 'essence 2010 → 2')
eq(critair('essence', 2006), '2', 'essence 2006 → 2')
eq(critair('essence', 2005), '3', 'essence 2005 → 3')
eq(critair('essence', 1997), '3', 'essence 1997 → 3')
eq(critair('essence', 1996), 'non_classe', 'essence 1996 → non classé')

// Diesel : un cran de plus à chaque borne.
eq(critair('diesel', 2011), '2', 'diesel 2011 → 2')
eq(critair('diesel', 2010), '3', 'diesel 2010 → 3')
eq(critair('diesel', 2005), '4', 'diesel 2005 → 4')
eq(critair('diesel', 2000), '5', 'diesel 2000 → 5')
eq(critair('diesel', 1996), 'non_classe', 'diesel 1996 → non classé')

// Les motorisations telles que les annonces les écrivent.
for (const [e, attendu] of [['1.5 dCi', '2'], ['2.0 TDI', '2'], ['BlueHDi', '2'], ['220 CDI', '2']]) {
  eq(critair(e, 2015), attendu, `« ${e} » est lu comme un diesel`)
}
eq(critair('PureTech essence', 2015), '1', '« PureTech essence » est lu comme une essence')
// ⚠️ Un hybride sans carburant précisé retombe sur « essence » — jamais sur un
// classement PLUS favorable que ce que la donnée permet d'affirmer.
eq(critair('hybride', 2015), '1', 'hybride sans précision → traité comme essence')
eq(critair('hybride diesel', 2015), '2', 'hybride diesel → suit son carburant')

titre('Ce qui empêche d’affirmer')
eq(critair('', 2015), 'inconnu', 'sans énergie → inconnu')
eq(critair('essence', null), 'inconnu', 'sans date → inconnu')
eq(critair('essence', ''), 'inconnu', 'date vide → inconnu')
eq(critair('cheval', 2015), 'inconnu', 'énergie non reconnue → inconnu, jamais un classement par défaut')
// La date mensuelle est acceptée, et c'est elle qui compte aux bornes.
eq(critair('diesel', '2011-01'), '2', 'janvier 2011 → 2 (borne incluse)')
eq(critair('diesel', '2010-12'), '3', 'décembre 2010 → 3')

titre('Verdict ZFE — jamais d’avertissement sur une supposition')
eq(verdictZfe('Paris', 'inconnu'), null, 'classement inconnu → aucun verdict')
eq(verdictZfe('', '3'), null, 'ville vide → aucun verdict')
eq(verdictZfe('Castanet-Tolosan', '5'), null, 'commune sans ZFE répertoriée → aucun verdict')
ok(verdictZfe('paris', '3')?.interdit === true, 'Paris refuse un Crit’Air 3 (accents et casse indifférents)')
ok(verdictZfe('PARIS', '2')?.interdit === false, 'Paris accepte un Crit’Air 2')
ok(verdictZfe('Saint-Étienne', '5')?.interdit === true, 'Saint-Étienne refuse un Crit’Air 5')
ok(verdictZfe('Saint-Etienne', '5')?.interdit === true, 'la même commune sans accent donne le même verdict')
ok(verdictZfe('Rennes', '4')?.interdit === false,
  'une ZFE qui ne vise que les non classés n’interdit pas un Crit’Air 4')
ok(verdictZfe('Rennes', 'non_classe')?.interdit === true, 'Rennes refuse un non classé')
eq(verdictZfe('Paris', '3').releve_le, ZFE_RELEVE_LE, 'le verdict porte la DATE du relevé')

titre('La config peut remplacer la liste, jamais la faire disparaître')
eq(sourceZfe(null), ZFE_SOCLE, 'config absente → socle du code')
eq(sourceZfe({}), ZFE_SOCLE, 'config vide → socle')
eq(sourceZfe({ zones: [], maj: '2026-11-05' }), ZFE_SOCLE, 'zéro zone → socle')
eq(sourceZfe({ zones: [{ ville: 'Agen', interdits: ['5'], source: 'https://agen.fr/zfe' }] }), ZFE_SOCLE,
  'sans date de relevé → socle (une liste sans date ne peut pas s’afficher)')
{
  const bonne = { ville: 'Agen', interdits: ['non_classe', '5'], source: 'https://www.agen.fr/zfe' }
  const s = sourceZfe({ maj: '2026-12-01', zones: [bonne] })
  eq(s.zones.length, 1, 'une zone valide remplace le socle')
  eq(s.maj, '2026-12-01', 'la date vient de la config')
  ok(verdictZfe('Agen', '5', s)?.interdit === true, 'la zone de la config est appliquée')
  eq(verdictZfe('Paris', '3', s), null, 'et le socle n’est plus consulté : Paris n’est plus dans la liste')

  // ⚠️ Une zone malformée est ÉCARTÉE et n’emporte pas les autres. Un seuil
  // mal saisi ne doit ni avertir à tort, ni effacer les zones justes.
  const mauvaises = [
    { ville: '', interdits: ['5'], source: 'https://x.fr' },
    { ville: 'Nulle', interdits: [], source: 'https://x.fr' },
    { ville: 'Nulle', interdits: ['5'], source: 'pas-une-url' },
    { ville: 'Nulle', interdits: ['5', 'crit6'], source: 'https://x.fr' },
    { ville: 'Nulle', interdits: 'non_classe', source: 'https://x.fr' },
  ]
  const melange = sourceZfe({ maj: '2026-12-01', zones: [...mauvaises, bonne] })
  eq(melange.zones.length, 1, 'les cinq zones malformées sont écartées, la bonne reste')
  eq(melange.zones[0].ville, 'Agen', 'et c’est bien la bonne qui reste')
  eq(verdictZfe('Nulle', '5', melange), null, 'aucune zone douteuse n’avertit')
  // Une classe inconnue dans la liste rend la zone ENTIÈRE douteuse : on ne
  // garde pas « les seuils qu'on a compris » d'une saisie manifestement fausse.
  eq(sourceZfe({ maj: '2026-12-01', zones: [{ ville: 'X', interdits: ['5', 'crit6'], source: 'https://x.fr' }] }),
    ZFE_SOCLE, 'une classe inconnue invalide la zone entière')
}

titre('⚠️ La CONFIG de la migration ≡ le SOCLE du code')
{
  // Sans ce contrôle, la liste du code et celle de la base pourraient diverger
  // sans que rien ne le dise : la même voiture serait interdite par un chemin
  // et autorisée par l'autre, selon que la config a été lue ou non.
  const sql = readFileSync(new URL('../supabase/migrations/20261121120000_sprint20_zfe.sql', import.meta.url), 'utf8')
  const zones = [...sql.matchAll(
    /jsonb_build_object\('ville', '((?:[^']|'')*)', 'interdits', jsonb_build_array\(([^)]*)\), 'source', '((?:[^']|'')*)'\)/g,
  )].map((m) => ({
    ville: m[1].replace(/''/g, "'"),
    interdits: m[2].split(',').map((x) => x.trim().replace(/^'|'$/g, '')),
    source: m[3].replace(/''/g, "'"),
  }))
  eq(zones.length, ZFE.length, `la migration sème autant de zones que le code (${ZFE.length})`)
  eq(zones, ZFE.map((z) => ({ ville: z.ville, interdits: [...z.interdits], source: z.source })),
    'chaque ville, chaque seuil et chaque source sont identiques, dans le même ordre')
  ok(sql.includes(`'maj', '${ZFE_RELEVE_LE}'`), 'la date du relevé est la même des deux côtés')
  // Et la config semée doit traverser `sourceZfe` sans être rejetée : une
  // liste juste mais refusée par la validation retomberait sur le socle, et le
  // dispositif « modifiable sans redéploiement » ne servirait à rien.
  const relue = sourceZfe({ maj: ZFE_RELEVE_LE, zones })
  eq(relue.zones.length, ZFE.length, 'la config semée passe la validation (elle ne retombe pas sur le socle)')
  ok(sql.includes("cle in ('carte_grise_tarifs', 'zfe')"),
    'get_config_publique ouvre sa liste fermée à « zfe », et à rien d’autre')
  ok(!/cout_ia|echecs_seuil/.test(sql.split('get_config_publique')[1] ?? ''),
    'les réglages internes (coût IA, seuils d’alerte) restent hors de la liste publique')
}

titre('⚠️ AUCUN effet sur le score')
{
  // Une vignette est une contrainte d'usage : un diesel de 2010 n'est pas en
  // moins bon état parce qu'il ne peut pas entrer dans Paris. Le barème ne
  // doit donc même pas la recevoir.
  const bareme = readFileSync(new URL('../supabase/functions/_shared/bareme.ts', import.meta.url), 'utf8')
  ok(!/critair|crit'air|\bzfe\b/i.test(bareme),
    'le barème ne mentionne ni Crit’Air ni ZFE')
  const faits = readFileSync(new URL('../supabase/functions/_shared/bareme.ts', import.meta.url), 'utf8')
    .match(/export type FaitsAxes = \{[\s\S]*?\n\};/)
  ok(faits && !/critair|zfe/i.test(faits[0]), 'FaitsAxes ne porte aucun champ Crit’Air ni ZFE')
  // Contre-épreuve : le contrôle MORD si on l'applique à un fichier qui, lui,
  // parle bien de Crit'Air.
  const critairSrc = readFileSync(new URL('../supabase/functions/_shared/critair.ts', import.meta.url), 'utf8')
  ok(/critair/i.test(critairSrc), 'le test mord : le motif est bien détecté là où il existe')
}

titre('Libellés affichables')
eq(libelleCritair('0'), "Crit'Air 0 (vert)", 'vignette 0')
eq(libelleCritair('2'), "Crit'Air 2", 'vignette 2')
eq(libelleCritair('non_classe'), 'non classé', 'non classé')
eq(libelleCritair('inconnu'), 'classement inconnu', 'inconnu')

// ---------------------------------------------------------------------------
console.log(`\n${ko === 0 ? 'OK' : 'ÉCHEC'} — ${total - ko}/${total} contrôles passés`)
process.exit(ko === 0 ? 0 : 1)
