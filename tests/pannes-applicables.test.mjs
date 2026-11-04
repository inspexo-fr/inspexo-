// Test HORS LIGNE du filet déterministe sur les pannes du catalogue.
// Usage : node tests/pannes-applicables.test.mjs
//
// Ce que ce filet protège : le MÊME texte doit toujours donner le MÊME score.
// Mesuré avant correction sur la Mercedes 220 d (OM654) : deux analyses du même
// texte, même fiche, zéro affirmation écartée — 2 pannes retenues d'un côté,
// 0 de l'autre, axe risques 13 vs 16, score 71 vs 77.
import {
  entreeApplicable, pannesApplicables, refsManquantes,
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

console.log(`\n${ko === 0 ? 'OK' : 'ÉCHEC'} — ${total - ko}/${total} contrôles passés`)
process.exit(ko === 0 ? 0 : 1)
