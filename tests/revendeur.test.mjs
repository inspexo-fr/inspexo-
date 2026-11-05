// Test hors ligne du mode revendeur (aucun réseau, aucune base).
// Usage : node tests/revendeur.test.mjs
import { readFileSync } from 'node:fs'
import {
  ECART_ANNEES, ECART_KM, filtrerComparables, mediane, MENTION_REVENDEUR,
  memeEnergie, offreOuverture, PARAMETRES_DEFAUT, penteKm, prixAchatMax,
  prixRevente, SEUIL_COMPARABLES,
} from '../supabase/functions/_shared/revendeur.ts'
import { critair, libelleCritair, verdictZfe, ZFE, ZFE_RELEVE_LE } from '../supabase/functions/_shared/critair.ts'

let ok_ = 0, ko = 0
const ok = (c, l) => { if (c) { ok_++; console.log(`PASS — ${l}`) } else { ko++; console.log(`FAIL — ${l}`) } }
const eq = (a, b, l) => ok(a === b, `${l}${a === b ? '' : ` (obtenu ${JSON.stringify(a)}, attendu ${JSON.stringify(b)})`}`)

const P = PARAMETRES_DEFAUT
const clio = { modele: 'Clio II', energie: 'Diesel', annee: 2004, km: 180000 }
const comp = (n, p, a = 2004, km = 180000, e = 'Diesel', m = 'Clio II') =>
  Array.from({ length: n }, (_, i) => ({ prix: p + i * 100, annee: a, km, energie: e, modele: m, titre: `annonce ${i}` }))

// ── Le seuil de 6 : aucun chiffre en dessous ───────────────────────────────
//
// ⚠️ Pas de fourchette élargie « faute de mieux ». Un prix calculé sur cinq
// annonces est plus dangereux que pas de prix : il a l'air sérieux.
eq(SEUIL_COMPARABLES, 6, 'le seuil est de 6 comparables')
eq(prixRevente(comp(5, 2000), clio, P), null, '5 comparables : AUCUN chiffre')
ok(prixRevente(comp(6, 2000), clio, P) !== null, '6 comparables : le calcul sort')
eq(prixRevente([], clio, P), null, 'aucun comparable : aucun chiffre')

// ── Le filtre ──────────────────────────────────────────────────────────────
{
  const liste = [
    ...comp(4, 2000),
    { prix: 2500, annee: 2004, km: 180000, energie: 'Essence', modele: 'Clio II', titre: 'essence' },
    { prix: 2500, annee: 2000, km: 180000, energie: 'Diesel', modele: 'Clio II', titre: 'trop vieille' },
    { prix: 2500, annee: 2004, km: 260000, energie: 'Diesel', modele: 'Clio II', titre: 'trop de km' },
    { prix: 2500, annee: 2004, km: 180000, energie: 'Diesel', modele: 'Clio III', titre: 'autre modèle' },
    { prix: 0, annee: 2004, km: 180000, energie: 'Diesel', modele: 'Clio II', titre: 'prix absurde' },
  ]
  const r = filtrerComparables(liste, clio)
  eq(r.retenus.length, 4, 'seuls les comparables conformes sont retenus')
  const raisons = r.ecartes.map((e) => e.raison).sort()
  eq(JSON.stringify(raisons), JSON.stringify(['annee', 'energie', 'km', 'modele', 'prix']),
    'chaque écart porte sa raison')
}
eq(ECART_ANNEES, 2, '±2 ans')
eq(ECART_KM, 40000, '±40 000 km')
ok(filtrerComparables([{ prix: 3000, annee: 2006, km: 180000, energie: 'Diesel', modele: 'Clio II' }], clio).retenus.length === 1,
  'la borne de 2 ans est inclusive')
ok(filtrerComparables([{ prix: 3000, annee: 2004, km: 220000, energie: 'Diesel', modele: 'Clio II' }], clio).retenus.length === 1,
  'la borne de 40 000 km est inclusive')

// ⚠️ Diesel et essence ne se mélangent jamais : ils ne se revendent pas au
// même prix, et c'est exactement ce qu'on mesure.
ok(!memeEnergie('Diesel', 'Essence'), 'diesel ≠ essence')
ok(memeEnergie('1.5 dCi', 'diesel'), 'une motorisation diesel est reconnue')
ok(!memeEnergie('', 'diesel'), 'une énergie vide ne vaut pas correspondance')
ok(!memeEnergie('hybride', 'essence'), 'hybride n’est pas rangé d’office en essence')

// ── Le prix de revente ─────────────────────────────────────────────────────
{
  const c = comp(6, 3000) // 3000..3500, médiane 3250
  const r = prixRevente(c, { ...clio, km: 180000 }, P)
  eq(r.mediane_observee, 3250, 'médiane des prix observés')
  eq(r.retrait_negociation_eur, Math.round(3250 * 0.08), 'la marge de négociation de 8 % est retirée')
  eq(r.valeur, 3250 - Math.round(3250 * 0.08), 'prix de revente = médiane − négociation')
  eq(r.nb_comparables, 6, 'le nombre de comparables est rendu')
  eq(r.decote_zfe_eur, 0, 'aucune décote ZFE hors ZFE')
}
{
  // Pente non mesurable : tous les comparables au même kilométrage.
  eq(penteKm(comp(8, 3000)), null, 'pente non mesurable : aucun ajustement inventé')
  // Pente mesurable : le prix baisse quand le km monte.
  const c = [100000, 120000, 140000, 160000, 180000, 200000].map((km, i) => ({
    prix: 6000 - i * 400, annee: 2004, km, energie: 'Diesel', modele: 'Clio II',
  }))
  const pente = penteKm(c)
  ok(pente != null && pente < 0, 'pente mesurée et négative')
  ok(pente > -0.2, 'pente dans le domaine plausible')
}
{
  // ZFE : la décote s'applique APRÈS la négociation, jamais avant.
  const c = comp(6, 3000)
  const sans = prixRevente(c, clio, P, false)
  const avec = prixRevente(c, clio, P, true)
  eq(avec.decote_zfe_eur, Math.round(sans.valeur * 0.1), 'la décote ZFE porte sur le prix après négociation')
  ok(avec.valeur < sans.valeur, 'et elle fait bien baisser le prix')
}

// ── Le prix d'achat maximum ────────────────────────────────────────────────
{
  const travaux = [
    { cle: 'distribution', libelle: 'Distribution', montant_eur: 700, source: 'https://x.test/a', modifiable: true },
    { cle: 'pneus', libelle: 'Pneus', montant_eur: 300, source: 'https://x.test/b', modifiable: true },
  ]
  const r = prixAchatMax(3000, travaux, P, { ct_a_refaire_eur: 90, carte_grise_eur: 120, region_connue: true, age_vehicule_ans: 20 })
  const imprevus = Math.round(1000 * 0.15) + 150
  const total = 700 + 300 + 90 + 120 + imprevus + 500
  eq(r.valeur, 3000 - total, 'chaque coût est soustrait, et seulement ceux-là')
  ok(r.lignes.some((l) => l.cle === 'imprevus' && l.montant_eur === imprevus),
    'les imprévus valent 15 % des travaux + 150 € au-delà de 10 ans')
  ok(r.lignes.every((l) => l.modifiable), 'toutes les lignes sont modifiables')
  ok(r.lignes.some((l) => l.cle === 'marge_voulue' && l.montant_eur === 500), 'la marge visée est une ligne comme les autres')
  eq(r.incomplet, false, 'calcul complet quand la région est connue')
}
{
  // ⚠️ Sans région, AUCUNE moyenne nationale : le calcul se déclare incomplet.
  const r = prixAchatMax(3000, [], P, { region_connue: false, age_vehicule_ans: 5 })
  eq(r.incomplet, true, 'région inconnue : le calcul se déclare incomplet')
  ok(r.manquants.includes('carte_grise'), 'et nomme ce qui manque')
  ok(!r.lignes.some((l) => l.cle === 'carte_grise'), 'aucune ligne carte grise inventée')
}
{
  // Un véhicule de moins de 10 ans n'a pas le forfait d'âge.
  const r = prixAchatMax(10000, [{ cle: 'x', libelle: 'X', montant_eur: 1000, modifiable: true }], P,
    { region_connue: true, carte_grise_eur: 0, age_vehicule_ans: 4 })
  const l = r.lignes.find((x) => x.cle === 'imprevus')
  eq(l.montant_eur, 150, '15 % de 1 000 € = 150 €, sans forfait d’âge')
}
eq(prixAchatMax(500, [{ cle: 'x', libelle: 'X', montant_eur: 5000, modifiable: true }], P, { region_connue: true, carte_grise_eur: 0 }).valeur, 0,
  'le prix d’achat maximum ne devient jamais négatif')

// ── L'offre d'ouverture ────────────────────────────────────────────────────
eq(offreOuverture(2000, P), 1700, 'offre = −15 %, arrondie à la cinquantaine')
eq(offreOuverture(2037, P), 1700, 'arrondie vers le BAS : proposer plus que le calcul serait faux')
eq(offreOuverture(0, P), 0, 'un prix nul donne une offre nulle')
ok(offreOuverture(10000, P) % 50 === 0, 'toujours un multiple de 50')

// ── Crit'Air ───────────────────────────────────────────────────────────────
eq(critair('Électrique', 2015), '0', 'électrique : Crit’Air 0')
eq(critair('Essence', 2015), '1', 'essence après 2011 : Crit’Air 1')
eq(critair('Essence', 2008), '2', 'essence 2006-2010 : Crit’Air 2')
eq(critair('Essence', 2000), '3', 'essence 1997-2005 : Crit’Air 3')
eq(critair('Essence', 1995), 'non_classe', 'essence avant 1997 : non classé')
eq(critair('Diesel', 2015), '2', 'diesel après 2011 : Crit’Air 2')
eq(critair('Diesel', 2008), '3', 'diesel 2006-2010 : Crit’Air 3')
eq(critair('1.5 dCi', 2004), '4', 'diesel 2001-2005 : Crit’Air 4')
eq(critair('Diesel', 1999), '5', 'diesel 1997-2000 : Crit’Air 5')
eq(critair('Diesel', 1990), 'non_classe', 'diesel avant 1997 : non classé')
eq(critair('Diesel', null), 'inconnu', 'sans date : inconnu, jamais deviné')
eq(critair('', 2015), 'inconnu', 'sans énergie : inconnu')
eq(critair('Diesel', '2011-01-01'), '2', 'la borne du 1er janvier est inclusive')
eq(critair('Diesel', '2010-12-31'), '3', 'et la veille bascule bien')

// ── ZFE ────────────────────────────────────────────────────────────────────
ok(/^\d{4}-\d{2}-\d{2}$/.test(ZFE_RELEVE_LE), 'le relevé des ZFE porte une date')
eq(verdictZfe('Paris', '4').interdit, true, 'un Crit’Air 4 est interdit à Paris')
eq(verdictZfe('Paris', '1').interdit, false, 'un Crit’Air 1 ne l’est pas')
eq(verdictZfe('paris', '4').interdit, true, 'la casse n’a pas d’importance')
eq(verdictZfe('Saint-Etienne', 'non_classe').interdit, true, 'les accents non plus')
eq(verdictZfe('Brive-la-Gaillarde', '5'), null, 'une ville sans ZFE répertoriée ne produit aucun verdict')
eq(verdictZfe('Paris', 'inconnu'), null, '⚠️ classement inconnu : on n’avertit JAMAIS sur une supposition')
ok(verdictZfe('Lyon', '3').source.startsWith('https://'), 'chaque ZFE porte sa source')
eq(verdictZfe('Lyon', '3').releve_le, ZFE_RELEVE_LE, 'et la date du relevé')
ok(ZFE.every((z) => z.interdits.length > 0 && z.source.startsWith('https://')),
  'aucune ZFE sans seuil ni source')
eq(libelleCritair('non_classe'), 'non classé', 'le libellé d’un non classé est lisible')

// ── Vocabulaire ────────────────────────────────────────────────────────────
//
// ⚠️ Déterminer la VALEUR d'un véhicule est réservé aux experts en automobile
// inscrits (art. L326-4 I-2° du code de la route). Ce module relève des PRIX
// OBSERVÉS et applique les PARAMÈTRES de l'utilisateur.
{
  for (const f of ['supabase/functions/_shared/revendeur.ts', 'supabase/functions/_shared/critair.ts']) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
    const code = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
    for (const mot of ['estimation', 'cote du véhicule', 'expertise']) {
      ok(!new RegExp(mot, 'i').test(code), `${f.split('/').pop()} n’emploie pas « ${mot} »`)
    }
  }
  ok(MENTION_REVENDEUR.includes('ni une valeur du véhicule ni une garantie de revente'),
    'la mention obligatoire dit ce que le calcul n’est PAS')
  ok(MENTION_REVENDEUR.includes('prix observés') && MENTION_REVENDEUR.includes('tes paramètres'),
    'et d’où viennent les chiffres')
}

console.log(`\n${ok_} contrôles passés, ${ko} échec(s).`)
if (ko > 0) process.exit(1)
console.log('Tous les tests revendeur passent.')
