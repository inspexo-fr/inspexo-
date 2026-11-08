// Test hors ligne du coût réel sur 3 ans (sprint 22). Aucun appel réseau.
// Usage : node tests/cout3ans.test.mjs
import { readFileSync } from 'node:fs'
import * as srv from '../supabase/functions/_shared/cout3ans.ts'
import * as cli from '../src/data/cout3ans.gen.js'
import {
  ageDepuis, calculerCout3Ans, energieCt, entreeDepuisAnalyse, tarifCt,
} from '../supabase/functions/_shared/cout3ansSources.ts'

let ok_ = 0, ko = 0
const ok = (c, l) => { if (c) { ok_++ } else { ko++; console.log(`FAIL — ${l}`) } }
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (obtenu ${JSON.stringify(a)}, attendu ${JSON.stringify(b)})`)

const { occurrences, controlesTechniques, coutTroisAns, coutTroisAnsPublic, kmAnBorne, A_CHIFFRER } = srv

// ── Occurrences dans l'horizon ──────────────────────────────────────────────
eq(occurrences(100_000, 15_000, 6, 30_000, null), 1, 'vidange 30 000 km : 100k → 145k franchit 120k')
eq(occurrences(119_000, 15_000, 6, 30_000, null), 2, '119k → 164k franchit 120k et 150k')
eq(occurrences(120_000, 15_000, 6, 30_000, null), 1, 'l’échéance pile au km actuel n’est PAS comptée (elle est « dès l’achat »)')
eq(occurrences(50_000, 15_000, 3.5, 160_000, 6), 1, 'au premier des deux termes : 6 ans atteint avant 160 000 km')
eq(occurrences(50_000, 15_000, 1, 160_000, 6), 0, 'ni 160 000 km ni 6 ans dans les 3 ans')
eq(occurrences(null, 15_000, null, 30_000, 2), null, 'km et âge inconnus : non calculable')
eq(occurrences(10_000, 15_000, 2, 30_000, 2), 1, 'âge 2 → 5 franchit 4 ; km 10k → 55k franchit 30k : max(1, 1) = 1')
eq(occurrences(10_000, 15_000, 2, null, 2), 1, 'âge 2 → 5, intervalle 2 ans : seule l’échéance à 4 ans')
eq(occurrences(10_000, 20_000, 2, 30_000, null), 2, 'km 10k → 70k franchit 30k et 60k')

// ── Contrôles techniques ────────────────────────────────────────────────────
eq(controlesTechniques(1)?.n, 1, 'voiture d’1 an : contrôle à 4 ans dans l’horizon')
eq(controlesTechniques(2)?.n, 1, '2 ans : contrôle à 4 ans (6 ans hors horizon de 3 ans)')
eq(controlesTechniques(3.2)?.n, 2, '3,2 ans : contrôles à 4 et 6 ans')
eq(controlesTechniques(8)?.n, 1, 'plus de 4 ans : le contrôle de la vente est au vendeur, le suivant 2 ans après')
eq(controlesTechniques(null), null, 'âge inconnu : aucun nombre inventé')

// ── Bornes du kilométrage annuel ────────────────────────────────────────────
eq(kmAnBorne(undefined), 15_000, '15 000 km par défaut')
eq(kmAnBorne('abc'), 15_000, 'saisie illisible : défaut')
eq(kmAnBorne(500), 1_000, 'plancher')
eq(kmAnBorne(500_000), 80_000, 'plafond')

// ── Calcul complet ──────────────────────────────────────────────────────────
const sourceVroomly = { via: 'comparateur', libelle: 'prix moyen affiché par des garages, via Vroomly', urls: ['https://www.vroomly.com/x'] }
const entree = {
  prix_eur: 12_000, kilometrage: 100_000, age_ans: 6, age_base: 'premiere_immatriculation',
  plan: [
    { operation: 'Vidange moteur', intervalle_km: 30_000, intervalle_annees: 2, cout_min: 120, cout_max: 180, source_cout: sourceVroomly, urls_echeance: ['https://www.largus.fr/a'] },
    { operation: 'Courroie de distribution', intervalle_km: 120_000, intervalle_annees: 6, cout_min: null, cout_max: null, source_cout: null, urls_echeance: ['https://www.largus.fr/b'] },
    { operation: 'Liquide de frein', intervalle_km: null, intervalle_annees: 10, cout_min: 60, cout_max: 90, source_cout: sourceVroomly, urls_echeance: [] },
  ],
  du_des_achat: [],
  non_etablies: [{ operation: 'Bougies', motif: 'intervalle à vérifier dans le carnet' }],
  ct: { min: 75, max: 85, n_centres: 6118, maj: '08/11/2026', source: 'https://www.data.gouv.fr/fr/datasets/prix-des-controles-techniques/' },
  carte_grise: null,
  carte_grise_motif: 'indiquez votre région',
}
const r = coutTroisAns(entree, { km_an: 15_000 })
const ligne = (id) => r.lignes.find((l) => l.id === id)
// Vidange : max(km 100k→145k : 1, âge 6→9 / 2 ans : 1 (8)) = 1… âge 6→9 franchit 8 seulement.
eq(ligne('plan:vidange-moteur')?.occurrences, 1, 'vidange : une occurrence')
eq(ligne('plan:courroie-de-distribution')?.occurrences, 1, 'courroie : 120 000 km franchi')
ok(ligne('plan:courroie-de-distribution')?.chiffree === false, 'courroie sans coût admis : NON chiffrée')
eq(ligne('plan:courroie-de-distribution')?.motif, A_CHIFFRER, '… et dit « à chiffrer avec un garage »')
ok(!ligne('plan:liquide-de-frein'), 'liquide de frein (10 ans) hors horizon : pas de ligne')
eq(ligne('controle-technique')?.min, 75, 'un contrôle technique, quart le moins cher')
ok(/DGCCRF/.test(ligne('controle-technique')?.source?.libelle ?? ''), 'le CT cite le relevé officiel')
ok(ligne('carte-grise')?.chiffree === false && /région/.test(ligne('carte-grise')?.motif ?? ''), 'carte grise sans région : pas de chiffre, le motif est dit')
eq(r.total_min, 12_000 + 120 + 75, 'total min = prix + vidange + CT')
eq(r.total_max, 12_000 + 180 + 85, 'total max')
ok(r.partiel === true && r.non_chiffrees === 2, 'le total se dit partiel et compte ses trous (courroie, carte grise)')
eq(r.non_etablies.length, 1, 'les opérations sans intervalle établi sont listées à part')
ok(ligne('plan:vidange-moteur')?.source?.libelle === 'prix moyen affiché par des garages, via Vroomly', 'le libellé du comparateur est EXACT')

// Kilométrage annuel modifiable.
const r2 = coutTroisAns(entree, { km_an: 30_000 })
eq(r2.lignes.find((l) => l.id === 'plan:vidange-moteur')?.occurrences, 3, '30 000 km/an : 100k → 190k franchit 120, 150, 180')

// Corrections à l'écran.
const r3 = coutTroisAns(entree, { km_an: 15_000, corrections: { 'plan:courroie-de-distribution': 900 } })
const c3 = r3.lignes.find((l) => l.id === 'plan:courroie-de-distribution')
ok(c3.chiffree && c3.corrigee && c3.source.via === 'utilisateur', 'une correction chiffre la ligne et le dit')
eq(r3.total_min - r.total_min, 900, 'la correction entre dans le total')

// Version publique : le total seul.
const pub = coutTroisAnsPublic(r)
ok(!('lignes' in pub) && pub.masque === true, 'sans Pass : aucune ligne')
eq([pub.total_min, pub.total_max, pub.non_chiffrees], [r.total_min, r.total_max, r.non_chiffrees], 'sans Pass : le même total')
ok(!/valeur|cote|estimation|expertise/i.test(JSON.stringify(r)), 'vocabulaire : jamais « valeur », « cote », « estimation », « expertise »')

// ── Sources : la règle du 8 nov. 2026 ───────────────────────────────────────
const rj = {
  vehicule: { prix_affiche: 10_000, kilometrage: 95_000, annee: 2018, carburant: 'Diesel', famille_moteur: 'K9K', boite_code: null },
  critair: { premiere_immatriculation: '2018-03' },
  recalcul: {
    plan_entretien: [
      // Échéance établie par la presse, coût de la fiche sur Vroomly : admis (prévue au plan).
      { operation: 'Vidange moteur', intervalle_km: 20_000, intervalle_annees: 1, cout_min_eur: 100, cout_max_eur: 150, a_verifier_carnet: false, urls: ['https://www.largus.fr/v', 'https://www.vroomly.com/v'] },
      // Échéance portée par un garage seulement : non établie.
      { operation: 'Kit de distribution', intervalle_km: 120_000, intervalle_annees: 5, cout_min_eur: 600, cout_max_eur: 900, a_verifier_carnet: false, urls: ['https://www.vroomly.com/d'] },
      { operation: 'Liquide de refroidissement', intervalle_km: null, intervalle_annees: null, a_verifier_carnet: true, urls: [] },
    ],
    entretien_du_non_prouve: [],
    operations_non_faites: ['Embrayage à prévoir'],
  },
}
const candidats = [
  // Fourchette générique Vroomly pour l'embrayage : HORS plan → refusée.
  { operation: "Remplacement du kit d'embrayage", cout_min_eur: 600, cout_max_eur: 1_200, urls: ['https://www.vroomly.com/blog/quel-est-le-prix-dun-changement-embrayage/'], statut: 'source', famille_norm: '' },
]
const e = entreeDepuisAnalyse(rj, candidats, null, new Date('2026-11-08T00:00:00Z'), null, 'indiquez votre région')
eq(e.plan.map((p) => p.operation), ['Vidange moteur'], 'seule une échéance portée par une source indépendante est établie')
eq(e.plan[0].source_cout?.via, 'portante', 'la fiche cite une page portante : elle est créditée en premier')
{
  // Fiche sans coût : la fourchette générique Vroomly chiffre une opération PRÉVUE au plan.
  const rjSansCout = JSON.parse(JSON.stringify(rj))
  rjSansCout.recalcul.plan_entretien[0].cout_min_eur = null
  rjSansCout.recalcul.plan_entretien[0].cout_max_eur = null
  const vid = [{ operation: 'Vidange moteur et filtre', cout_min_eur: 90, cout_max_eur: 160, urls: ['https://www.vroomly.com/blog/prix-vidange/'], statut: 'source', famille_norm: '' }]
  const ev = entreeDepuisAnalyse(rjSansCout, vid, null, new Date('2026-11-08'), null, null)
  eq(ev.plan[0].source_cout?.via, 'comparateur', 'opération prévue au plan : le prix moyen d’un comparateur est admis')
  eq(ev.plan[0].source_cout?.libelle, 'prix moyen affiché par des garages, via Vroomly', '… avec le libellé exact')
}
ok(e.non_etablies.some((x) => x.operation === 'Kit de distribution' && /indépendante/.test(x.motif)),
  'une échéance portée par un garage seul reste « à vérifier dans le carnet »')
ok(e.non_etablies.some((x) => x.operation === 'Liquide de refroidissement'), 'à vérifier au carnet : non établie')
const emb = e.du_des_achat.find((d) => /mbrayage/.test(d.operation))
ok(emb && emb.source_cout == null, '⚠️ embrayage déclaré mais HORS plan : le comparateur NE le chiffre PAS (règle du 6 nov.)')
ok(emb && /déclare non faite/.test(emb.motif), '… et la ligne dit pourquoi elle est due')

// Une fourchette portante, elle, chiffre une opération hors plan.
const e2 = entreeDepuisAnalyse(rj, [{ ...candidats[0], urls: ['https://www.largus.fr/embrayage'] }], null, new Date('2026-11-08'), null, null)
eq(e2.du_des_achat.find((d) => /mbrayage/.test(d.operation))?.source_cout?.via, 'portante', 'hors plan : une source portante chiffre')
const e3 = entreeDepuisAnalyse(rj, [{ ...candidats[0], statut: 'valide_devis' }], null, new Date('2026-11-08'), null, null)
eq(e3.du_des_achat.find((d) => /mbrayage/.test(d.operation))?.source_cout?.via, 'devis', 'hors plan : un devis validé chiffre')

// Âge et contrôle technique.
eq(ageDepuis('2018-03', 2018, new Date('2026-03-01T00:00:00Z')).base, 'premiere_immatriculation', 'âge depuis la 1re immatriculation')
eq(ageDepuis('', 2018, new Date('2026-07-01T00:00:00Z')), { age: 8, base: 'annee_modele' }, 'sinon depuis l’année-modèle, et le dit')
eq(energieCt('1.5 dCi 90'), 'diesel', 'énergie : dCi → diesel')
eq(energieCt('électrique'), 'electrique', 'énergie : électrique')
eq(energieCt(''), 'toutes', 'énergie inconnue : toutes énergies')
const releve = { maj: '08/11/2026', source: 'https://www.data.gouv.fr/x', energies: { diesel: { n: 6118, p25: 75, p50: 80, p75: 85 }, toutes: { n: 28761, p25: 79, p50: 85, p75: 90 } } }
eq(tarifCt(releve, 'Diesel'), { min: 75, max: 85, n_centres: 6118, maj: '08/11/2026', source: 'https://www.data.gouv.fr/x' }, 'tarif CT par énergie')
eq(tarifCt(releve, 'Hybride')?.min, 79, 'énergie absente du relevé : toutes énergies')
eq(tarifCt({ ...releve, energies: { diesel: { n: 10, p25: 75, p50: 80, p75: 85 } } }, 'Diesel'), null, 'moins de 50 tarifs : pas de chiffre')

// Assemblage complet : carte grise depuis le barème.
const ctx = { candidats: [], releve, bareme: { maj: '2026-11-05', source: 'x', frais_fixes_eur: 13.76, regions: { Occitanie: 59.5 } } }
const full = calculerCout3Ans(rj, ctx, { km_an: 15_000, region: 'Occitanie', cv: 5, aujourdhui: new Date('2026-11-08') })
eq(full.cout.lignes.find((l) => l.id === 'carte-grise')?.min, Math.round(5 * 59.5 + 13.76), 'carte grise = CV × tarif + frais fixes')
const sansCv = calculerCout3Ans(rj, ctx, { region: 'Occitanie', aujourdhui: new Date('2026-11-08') })
ok(/puissance fiscale/.test(sansCv.cout.lignes.find((l) => l.id === 'carte-grise')?.motif ?? ''), 'sans CV : aucun chiffre, le motif nomme la case')

// ── Parité serveur / miroir navigateur ──────────────────────────────────────
let n = 0, div = 0
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1))
for (let i = 0; i < 400; i++) {
  const ent = {
    prix_eur: Math.random() < 0.1 ? null : rnd(1_000, 60_000),
    kilometrage: Math.random() < 0.1 ? null : rnd(0, 300_000),
    age_ans: Math.random() < 0.1 ? null : rnd(0, 250) / 10,
    age_base: 'annee_modele',
    plan: Array.from({ length: rnd(0, 5) }, (_, k) => ({
      operation: `Op ${k}`, intervalle_km: Math.random() < 0.3 ? null : rnd(10, 200) * 1000,
      intervalle_annees: Math.random() < 0.5 ? null : rnd(1, 10),
      cout_min: rnd(50, 500), cout_max: rnd(500, 2000),
      source_cout: Math.random() < 0.4 ? null : sourceVroomly, urls_echeance: [],
    })),
    du_des_achat: [], non_etablies: [],
    ct: Math.random() < 0.3 ? null : entree.ct,
    carte_grise: Math.random() < 0.5 ? null : { montant_eur: rnd(0, 900), region: 'Occitanie', cv: 5, maj: null },
    carte_grise_motif: null,
  }
  const p = { km_an: rnd(0, 90_000) }
  n++
  if (JSON.stringify(srv.coutTroisAns(ent, p)) !== JSON.stringify(cli.coutTroisAns(ent, p))) div++
}
eq(div, 0, `parité serveur / navigateur sur ${n} cas tirés`)

// ── Garde-fous statiques ────────────────────────────────────────────────────
const fn = readFileSync('supabase/functions/cout-3ans/index.ts', 'utf8')
ok(/if \(!acces\.passActif\) return json\(\{ pass: false, cout: coutTroisAnsPublic\(cout\) \}\)/.test(fn),
  'cout-3ans : sans Pass, SEULE la version publique sort')
ok(fn.indexOf('passDepuisReq(') < fn.indexOf('await req.json('), 'cout-3ans : le droit est lu avant le corps')
ok(!/insert|upsert|update\(/.test(fn), 'cout-3ans n’écrit rien')

console.log(`\n${ko === 0 ? 'OK' : 'ÉCHEC'} — ${ok_}/${ok_ + ko} contrôles passés`)
if (ko > 0) { console.error(`${ko} échec(s) dans tests/cout3ans.test.mjs`); process.exit(1) }
console.log('Tous les tests cout3ans passent.')
