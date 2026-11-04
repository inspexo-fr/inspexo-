// Test HORS LIGNE du filet déterministe sur les pannes du catalogue.
// Usage : node tests/pannes-applicables.test.mjs
//
// Ce que ce filet protège : le MÊME texte doit toujours donner le MÊME score.
// Mesuré avant correction sur la Mercedes 220 d (OM654) : deux analyses du même
// texte, même fiche, zéro affirmation écartée — 2 pannes retenues d'un côté,
// 0 de l'autre, axe risques 13 vs 16, score 71 vs 77.
import { readFileSync } from 'node:fs'
import {
  atlasConfirme, ciblesAtlas, entreeApplicable, panneCompteDansScore,
  pannesApplicables, questionSansSource, refsManquantes, sansSourcePublique,
} from '../supabase/functions/_shared/pannesApplicables.ts'

let ko = 0
let total = 0
const ok = (cond, label, detail = '') => {
  total++
  if (!cond) { ko++; console.log(`FAIL — ${label}${detail ? ` (${detail})` : ''}`) }
}
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), label,
  `obtenu ${JSON.stringify(a)}, attendu ${JSON.stringify(b)}`)
const titre = (t) => console.log(`\n▶ ${t}`)

const e = (p) => ({
  ref: 'F1', titre: 'Panne', organe: 'moteur', symptome: '',
  km_typique: null, gravite: 'majeure', rappel_code: null, ...p,
})
const vh = (p) => ({ kilometrage: 80_000, boite_code: '', boite_automatique: false, famille_moteur: 'OM654', designation: 'Classe C 220 d', ...p })

// ---------------------------------------------------------------------------
titre('Horizon de détention')
// ---------------------------------------------------------------------------
ok(entreeApplicable(e({ km_typique: 'dès 100 000 km' }), vh({ kilometrage: 80_000 })).ok,
  'usure à 100 000 km, véhicule à 80 000 → dans l’horizon')
ok(!entreeApplicable(e({ km_typique: 'dès 160 000 km' }), vh({ kilometrage: 36_606 })).ok,
  'usure à 160 000 km, véhicule à 36 606 → hors horizon')
ok(entreeApplicable(e({ km_typique: null }), vh({ kilometrage: 36_606 })).ok,
  'sans seuil kilométrique connu → applicable (on n’invente pas une échéance)')
ok(entreeApplicable(e({ km_typique: 'dès 160 000 km' }), vh({ kilometrage: null })).ok,
  'kilométrage du véhicule inconnu → applicable, on ne retire pas sur une donnée absente')
// Un rappel officiel porte sur une PRODUCTION, pas sur une usure.
ok(entreeApplicable(e({ km_typique: 'dès 200 000 km', rappel_code: 'KGH' }), vh({ kilometrage: 10_000 })).ok,
  'un rappel officiel n’est jamais écarté pour cause de kilométrage')

// ---------------------------------------------------------------------------
titre('Codes de boîte : une panne qui nomme une boîte ne vaut que pour elle')
// ---------------------------------------------------------------------------
ok(!entreeApplicable(e({ titre: 'Mécatronique DQ200' }), vh({ boite_code: '' })).ok,
  'panne DQ200, boîte du véhicule inconnue → écartée')
ok(!entreeApplicable(e({ titre: 'Mécatronique DQ200' }), vh({ boite_code: 'DQ381' })).ok,
  'panne DQ200 sur une DQ381 → écartée')
ok(entreeApplicable(e({ titre: 'Mécatronique DQ200' }), vh({ boite_code: 'DQ200' })).ok,
  'panne DQ200 sur une DQ200 → retenue')
ok(entreeApplicable(e({ titre: 'Mécatronique DQ 200' }), vh({ boite_code: 'DQ200' })).ok,
  'espaces et tirets ignorés dans la comparaison des codes')
ok(!entreeApplicable(e({ symptome: 'à-coups de la boîte à double embrayage' }), vh({ boite_automatique: false })).ok,
  'panne de double embrayage sans code, boîte non automatique → écartée')
ok(entreeApplicable(e({ symptome: 'à-coups de la boîte à double embrayage' }), vh({ boite_automatique: true })).ok,
  'panne de double embrayage sur une automatique identifiée → retenue')
ok(entreeApplicable(e({ titre: 'Injecteurs encrassés' }), vh({ boite_code: '' })).ok,
  'une panne moteur n’est pas concernée par la boîte')

// ---------------------------------------------------------------------------
titre('Partition du catalogue')
// ---------------------------------------------------------------------------
{
  const cat = [
    e({ ref: 'F1', titre: 'Injecteurs 220/250' }),
    e({ ref: 'F2', titre: 'Capteur NOx', km_typique: 'dès 90 000 km' }),
    e({ ref: 'F3', titre: 'Mécatronique DQ200' }),
    e({ ref: 'F4', titre: 'Distribution', km_typique: 'dès 400 000 km' }),
  ]
  const r = pannesApplicables(cat, vh({ kilometrage: 36_606 }))
  eq(r.applicables.map((x) => x.ref), ['F1', 'F2'], 'deux entrées applicables')
  eq(r.ecartees, [
    { ref: 'F3', motif: 'boite_incompatible' },
    { ref: 'F4', motif: 'hors_horizon' },
  ], 'les deux écartées portent leur motif')
}

// ---------------------------------------------------------------------------
titre('Le filet : ce que le serveur RÉINJECTE')
// ---------------------------------------------------------------------------
{
  const applicables = [e({ ref: 'F1' }), e({ ref: 'F2' }), e({ ref: 'A3' })]
  eq(refsManquantes(applicables, []), ['F1', 'F2', 'A3'],
    'modèle qui ne cite RIEN → les trois sont réinjectées (le cas Mercedes)')
  eq(refsManquantes(applicables, ['F1']), ['F2', 'A3'], 'modèle partiel → le reste est réinjecté')
  eq(refsManquantes(applicables, ['f1', 'f2', 'a3']), [],
    'casse ignorée : rien à réinjecter quand tout est cité')
  eq(refsManquantes([], ['F1']), [],
    'une référence citée mais non applicable n’est pas réinjectée par ce filet')
}

// ---------------------------------------------------------------------------
titre('Déterminisme : même entrée, même verdict, 1 000 fois')
// ---------------------------------------------------------------------------
{
  const cat = [
    e({ ref: 'F1', titre: 'Injecteurs' }),
    e({ ref: 'F2', titre: 'Capteur NOx', km_typique: 'dès 90 000 km' }),
    e({ ref: 'F3', titre: 'Volant moteur double embrayage' }),
  ]
  const v = vh({ kilometrage: 36_606, boite_automatique: true })
  const reference = JSON.stringify(pannesApplicables(cat, v))
  let divergences = 0
  for (let i = 0; i < 1_000; i++) {
    if (JSON.stringify(pannesApplicables(cat, v)) !== reference) divergences++
  }
  eq(divergences, 0, '1 000 évaluations identiques : aucune divergence')
}

// ---------------------------------------------------------------------------
titre('Le discriminant principal : fiche moteur contre atlas de marque')
// ---------------------------------------------------------------------------
// Mesuré en production : une première version de ce filet, qui ne distinguait
// pas la source, a attribué à une Mercedes 220 d de 2025 (OM654, 36 606 km)
// des défauts d'OM651, de M272/M273 (V6 essence), de boîte 722.9 et de caisses
// W203/W211 — score de 71 (vert) à 55 (orange). Le modèle faisait un vrai
// travail d'appariement ; le filet l'avait supprimé.
ok(entreeApplicable(e({ ref: 'F1', titre: 'Injecteurs' }), vh()).ok,
  'une entrée de FICHE moteur est garantie par le filet')
{
  const r = entreeApplicable(e({ ref: 'A7', titre: 'Suspension Airmatic — compresseur et coussins' }), vh())
  ok(!r.ok && r.motif === 'atlas_de_marque',
    'une entrée d’ATLAS de marque reste au jugement du modèle')
}

// Les cinq titres RÉELS qui avaient été injectés à tort.
{
  const v = vh({ kilometrage: 36_606, boite_automatique: true, famille_moteur: 'OM654' })
  const faux = [
    ['F2', 'Injecteurs Delphi OM651 (2.1 CDI)', 'moteur_incompatible'],
    ['F3', 'Plaque conductrice 7G-Tronic (722.9)', 'boite_incompatible'],
    ['F4', 'Corrosion structurelle (W203, W211, W210)', 'caisse_incompatible'],
    ['F5', 'Pignon de balancier moteur M272/M273', 'moteur_incompatible'],
    ['A7', 'Suspension Airmatic — compresseur et coussins', 'atlas_de_marque'],
  ]
  for (const [ref, t, motif] of faux) {
    const r = entreeApplicable(e({ ref, titre: t }), v)
    ok(!r.ok && r.motif === motif, `écartée : ${t.slice(0, 44)}`,
      r.ok ? 'RETENUE à tort' : `motif ${r.motif}`)
  }
  // Et les deux qui s'appliquaient vraiment restent retenues.
  for (const t of ['Défaillances injecteurs sur les premières motorisations 220/250',
                   'Tremblements/ratés moteur au démarrage à froid liés à un capteur NOx']) {
    ok(entreeApplicable(e({ ref: 'F1', titre: t }), v).ok, `retenue : ${t.slice(0, 44)}`)
  }
}
{
  // Une entrée qui nomme un moteur alors que le NÔTRE est inconnu : on
  // n'affirme pas. Mieux vaut laisser le modèle décider que de prêter à ce
  // véhicule un défaut nommé pour un autre.
  const r = entreeApplicable(e({ ref: 'F1', titre: 'Injecteurs OM651' }), vh({ famille_moteur: '' }))
  ok(!r.ok && r.motif === 'moteur_incompatible',
    'famille moteur du véhicule inconnue + entrée qui nomme un moteur → écartée')
}

// ---------------------------------------------------------------------------
titre('Atlas : affiché toujours, compté seulement si l’annonce le confirme')
// ---------------------------------------------------------------------------
// Décision du 4 novembre 2026. L'atlas est un catalogue de MARQUE : une entrée
// ne concerne CE véhicule que s'il a l'équipement, la génération ou le code
// visés. Nous ne pouvons pas le savoir — sauf si l'annonce le dit. La décision
// ne dépend donc plus d'un jugement, mais de la présence d'un mot dans un
// texte : vérifiable, reproductible, explicable à l'acheteur.
{
  const airmatic = e({ ref: 'A7', titre: 'Suspension Airmatic — compresseur et coussins' })
  ok(ciblesAtlas(airmatic).includes('AIRMATIC'), 'la cible « Airmatic » est extraite',
    JSON.stringify(ciblesAtlas(airmatic)))
  ok(atlasConfirme(airmatic, 'Classe C 220d, suspension Airmatic, 36 000 km'),
    'annonce qui mentionne Airmatic → confirmée')
  ok(!atlasConfirme(airmatic, 'Classe C 220d, 36 000 km, boîte auto'),
    'annonce muette sur l’équipement → NON confirmée')
}
{
  const w203 = e({ ref: 'A4', titre: 'Corrosion structurelle (W203, W211, W210)' })
  ok(atlasConfirme(w203, 'Mercedes Classe C W203 de 2004'), 'code de caisse cité dans l’annonce → confirmée')
  ok(!atlasConfirme(w203, 'Mercedes Classe C 220d de 2025'), 'caisse absente de l’annonce → non confirmée')
}
{
  // Une entrée qui ne vise RIEN de distinctif ne peut pas être confirmée :
  // elle reste une question. Conservateur à dessein — mieux vaut une question
  // de trop qu'un point de score pris sur une supposition.
  const vague = e({ ref: 'A9', titre: 'Usure des freins' })
  eq(ciblesAtlas(vague), [], 'aucune cible distinctive')
  ok(!atlasConfirme(vague, 'Classe C 220d, freins neufs'), 'sans cible, jamais confirmée')
}
ok(!atlasConfirme(e({ ref: 'A7', titre: 'Suspension Airmatic' }), ''),
  'annonce vide → jamais confirmée')

// La porte d'entrée utilisée par `score`.
{
  const r1 = panneCompteDansScore(e({ ref: 'F1', titre: 'Injecteurs OM654' }), 'Mercedes 220d')
  ok(r1.compte && r1.motif === 'fiche', 'entrée de fiche : compte toujours')
  const r2 = panneCompteDansScore(e({ ref: 'A7', titre: 'Suspension Airmatic' }), 'avec Airmatic')
  ok(r2.compte && r2.motif === 'atlas_confirme', 'atlas confirmé : compte')
  const r3 = panneCompteDansScore(e({ ref: 'A7', titre: 'Suspension Airmatic' }), 'sans mention')
  ok(!r3.compte && r3.motif === 'atlas_non_confirme', 'atlas non confirmé : ne compte pas')
}

// DÉTERMINISME : c'est tout l'objet de la règle. Le même couple
// (entrée, annonce) doit toujours rendre la même décision.
{
  const entrees = [
    e({ ref: 'A7', titre: 'Suspension Airmatic — compresseur' }),
    e({ ref: 'A4', titre: 'Corrosion structurelle (W203, W211)' }),
    e({ ref: 'F1', titre: 'Injecteurs OM654' }),
    e({ ref: 'A9', titre: 'Usure des freins' }),
  ]
  const annonce = 'Mercedes Classe C 220 d, 2025, 36 606 km, boîte automatique, entretien à jour'
  const reference = JSON.stringify(entrees.map((x) => panneCompteDansScore(x, annonce)))
  let divergences = 0
  for (let i = 0; i < 500; i++) {
    if (JSON.stringify(entrees.map((x) => panneCompteDansScore(x, annonce))) !== reference) divergences++
  }
  eq(divergences, 0, '500 évaluations du même couple : aucune divergence')
  eq(JSON.parse(reference).map((r) => r.compte), [false, false, true, false],
    'sur cette annonce : seule l’entrée de fiche compte')
}

// ── SPRINT 15.1 — « base Inspexo » n'est pas une source ────────────────────
//
// Une entrée d'atlas sans URL ne s'affiche plus comme une panne : elle devient
// une question, et ne pèse jamais sur le score, même si l'annonce mentionne ce
// qu'elle vise.
{
  ok(sansSourcePublique('A1', []), 'entrée d’atlas sans URL : sans source publique')
  ok(sansSourcePublique('A12', null), 'urls absentes = sans source publique')
  ok(sansSourcePublique('A3', ['', '  ', 'base Inspexo']),
    'une mention qui n’est pas une URL ne vaut pas source')
  ok(!sansSourcePublique('A1', ['https://exemple.test/page']),
    'une entrée d’atlas QUI cite une page garde son statut de panne')
  ok(!sansSourcePublique('F1', []),
    'une entrée de FICHE n’est jamais retirée par cette règle — sa source est la fiche')
  ok(!sansSourcePublique('', []), 'une réf vide n’est pas une entrée d’atlas')

  // ⚠️ LE CAS QUI AURAIT TOUT CASSÉ. La courroie de la 308 existe DANS LES
  // DEUX catalogues : l'atlas (gravité plus sévère, aucune URL) et la fiche
  // EB2 (URLs). La déduplication amont garde la plus grave — donc la réf de
  // l'ATLAS — mais fusionne les URLs des deux. L'entrée fusionnée cite donc
  // des pages, et la règle ne la retire pas. Si la fusion ne transmettait pas
  // les URLs, cette règle supprimerait la panne centrale du dossier 308.
  ok(!sansSourcePublique('A7', ['https://fiche.test/eb2-courroie']),
    'entrée d’atlas fusionnée avec une entrée de fiche : les URLs héritées la sauvent')

  const q = questionSansSource('Chaîne de distribution N47 défaillante')
  ok(!/\bpanne/i.test(q), 'la question ne contient jamais le mot « panne »')
  ok(!/\bdéfaut\b/i.test(q), 'ni le mot « défaut » : nous n’avons pas de source pour l’affirmer')
  ok(!/ce modèle connaît/i.test(q), 'elle n’affirme pas que le modèle « connaît » quoi que ce soit')
  ok(q.includes('source publique'), 'elle dit explicitement qu’aucune source publique n’a été trouvée')
  ok(q.trim().endsWith(')') || q.includes('?'), 'c’est une question')
  ok(questionSansSource('x'.repeat(300)).match(/« (x+) »/)[1].length === 120,
    'le sujet repris est borné à 120 caractères')
}

// Le code de `score` applique bien la règle AVANT le barème et la négociation :
// une entrée retirée ne doit laisser de trace ni dans la note, ni dans la marge.
{
  const src = readFileSync(new URL('../supabase/functions/score/index.ts', import.meta.url), 'utf8')
  const iRetrait = src.indexOf('sansSourcePublique(p.source_ref, p.urls)')
  const iBareme = src.indexOf('const calcul = calculerAxes(faits)')
  const iNego = src.indexOf('negociation = calculerNegociation(')
  const iResultat = src.indexOf('pannes_connues: pannesJoined.map(')
  ok(iRetrait > 0, 'score applique la règle')
  ok(iRetrait < iBareme, 'le retrait précède le calcul du barème')
  ok(iRetrait < iNego, 'le retrait précède le calcul de la marge de négociation')
  ok(iRetrait < iResultat, 'le retrait précède la composition du dossier')
  ok(/BAREME_VERSION = "11\.4"/.test(
    readFileSync(new URL('../supabase/functions/_shared/bareme.ts', import.meta.url), 'utf8')),
    'la version du barème est incrémentée : la liste des défauts qui pèsent a changé')
}

console.log(`\n${ko === 0 ? 'OK' : 'ÉCHEC'} — ${total - ko}/${total} contrôles passés`)
process.exit(ko === 0 ? 0 : 1)
