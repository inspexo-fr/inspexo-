// Test hors ligne du mode revendeur (aucun réseau, aucune base).
// Usage : node tests/revendeur.test.mjs
import { readFileSync } from 'node:fs'
import {
  ECART_ANNEES, ECART_KM, filtrerComparables, mediane, MENTION_REVENDEUR,
  memeEnergie, offreOuverture, PARAMETRES_DEFAUT, penteKm, prixAchatMax,
  prixRevente, SEUIL_COMPARABLES,
} from '../supabase/functions/_shared/revendeur.ts'
import {
  comparablesDepuisStructures, coutCarteGrise, energieDeStructure,
  messageVendeurRevendeur, revendeurPublique,
} from '../supabase/functions/_shared/revendeur.ts'
import { critair, libelleCritair, verdictZfe, ZFE, ZFE_RELEVE_LE } from '../supabase/functions/_shared/critair.ts'
// Les miroirs CLIENT, generes par scripts/generer-miroir-revendeur.mjs.
import * as miroirRevendeur from '../src/data/revendeur.gen.js'
import * as miroirCritair from '../src/data/critair.gen.js'

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

// ── Carte grise ────────────────────────────────────────────────────────────
//
// ⚠️ Sans région ou sans puissance fiscale : AUCUN chiffre. Une carte grise va
// de la gratuité à plus de 1 000 € selon la région, les chevaux fiscaux et
// l'énergie — une moyenne nationale silencieuse fausserait le prix d'achat
// maximum sans que l'utilisateur sache d'où vient l'erreur.
{
  const bareme = {
    maj: '2026-11-05', source: 'essai', frais_fixes_eur: 13.76,
    regions: { 'Île-de-France': 68.95, Occitanie: 59.5, 'Pays de la Loire': 51 },
  }
  const r = coutCarteGrise(5, 'Occitanie', bareme)
  ok(r.connu && r.montant_eur === 311.26, `5 CV en Occitanie : 311,26 € (obtenu ${JSON.stringify(r)})`)
  ok(r.connu && r.maj === '2026-11-05', 'le coût porte la date du barème')

  // L'accent et la casse ne doivent pas faire perdre une région :
  // « Ile-de-France » saisi sans accent est la même région qu'« Île-de-France ».
  ok(coutCarteGrise(7, 'ile de france', bareme).connu, 'la région est reconnue sans accent ni tiret')

  eq(coutCarteGrise(5, null, bareme).motif, 'region_inconnue', 'sans région : aucun chiffre')
  eq(coutCarteGrise(5, '  ', bareme).motif, 'region_inconnue', 'région vide : aucun chiffre')
  eq(coutCarteGrise(5, 'Bretagne', bareme).motif, 'region_absente_du_bareme',
    'région hors barème : aucun chiffre, et le motif le dit')
  eq(coutCarteGrise(null, 'Occitanie', bareme).motif, 'cv_inconnus', 'sans CV : aucun chiffre')
  eq(coutCarteGrise(0, 'Occitanie', bareme).motif, 'cv_inconnus', '0 CV : aucun chiffre')
  eq(coutCarteGrise(5, 'Occitanie', null).motif, 'bareme_absent',
    'barème absent (config non lue) : aucun chiffre, jamais de valeur en dur')
}

// ── Comparables venus d'une page de résultats ──────────────────────────────
//
// ⚠️ LE MODÈLE EST DÉDUIT DU TITRE PAR LE SERVEUR. Si le client l'envoyait, il
// choisirait dans quel segment ses prix atterrissent — c'est la règle posée au
// sprint 9 pour le relevé agrégé, et elle vaut ici aussi.
{
  // Le « modèle déduit » est injecté : côté serveur c'est `modeleCanonique`
  // de _shared/marche.ts. Ici, une version minimale suffit à éprouver le
  // branchement.
  const modeleDe = (t) => (/clio/i.test(t) ? 'clio' : /308/.test(t) ? '308' : '')
  const opts = { modele_cible: 'clio', modele_de: modeleDe }
  const v = { modele: 'ignoré', energie: 'Diesel', annee: 2004, km: 180000 }

  const recues = [
    { titre: 'Renault Clio II 1.5 dCi 65', annee: 2004, km: 175000, prix: 2100 },
    { titre: 'Renault Clio 1.5 dCi 70', annee: 2005, km: 190000, prix: 2400, carburant: 'Diesel' },
    { titre: 'Renault Clio III 1.5 dCi', annee: 2006, km: 160000, prix: 2900 },
    { titre: 'Renault Clio 1.2 16v', annee: 2004, km: 175000, prix: 1900, carburant: 'Essence' },
    { titre: 'Peugeot 308 1.6 HDi', annee: 2005, km: 180000, prix: 3200 },
    { titre: 'Renault Clio dCi', annee: 2004, km: 178000, prix: 2200 },
  ]
  const r = comparablesDepuisStructures(recues, v, opts)
  eq(r.recus, 6, 'les 6 structures reçues sont comptées')
  eq(r.retenus.length, 4, '4 retenues : même modèle ET même énergie')
  ok(r.ecartes.some((e) => e.raison === 'energie'), 'la Clio essence est écartée pour énergie')
  ok(r.ecartes.some((e) => e.raison === 'modele'), 'la 308 est écartée pour modèle')

  // ⚠️ L'énergie se lit dans le TITRE quand le champ manque : « dCi » suffit.
  // Sans cette lecture, une page de résultats qui n'affiche pas le carburant
  // ferait écarter toutes les annonces, et l'écran dirait « pas assez de
  // comparables » alors qu'il en a six sous les yeux.
  eq(energieDeStructure({ titre: 'Clio 1.5 dCi 90' }), 'diesel', '« dCi » dans le titre : diesel')
  eq(energieDeStructure({ titre: 'Golf 1.4 TSI' }), 'essence', '« TSI » : essence')
  eq(energieDeStructure({ titre: 'Zoe R110' }), '', 'titre muet : aucune énergie devinée')
  eq(energieDeStructure({ titre: 'Clio dCi', carburant: 'Essence' }), 'Essence',
    'le champ du site gagne sur le titre')

  // Le décompte des écartés sert l'écran : il doit pouvoir dire POURQUOI il
  // n'a pas six comparables, pas seulement qu'il n'en a pas six.
  eq(comparablesDepuisStructures([], v, opts).retenus.length, 0, 'aucune structure : aucun retenu')
  eq(prixRevente(r.retenus, v, PARAMETRES_DEFAUT), null,
    '4 retenues sur 6 reçues : toujours AUCUN chiffre (le seuil porte sur les RETENUES)')
}

// L espace des milliers est une INSÉCABLE (U+00A0), posée par le formateur
// maison de `messageVendeurRevendeur` — pas par toLocaleString, dont le
// résultat varierait avec la version d ICU entre Deno et le navigateur.
const NB = '\u00a0'

// ── Message au vendeur ─────────────────────────────────────────────────────
{
  const args = [
    { poste: 'Courroie de distribution à refaire', montant_eur: 800, source: 'https://x' },
    { poste: 'Pneus arrière', montant_eur: 180 },
    { poste: 'Contrôle technique à repasser', montant_eur: 150 },
    { poste: 'Embrayage', montant_eur: 1200 },
    { poste: 'Vidange', montant_eur: 120 },
    { poste: 'Argument sans montant', montant_eur: 0 },
  ]
  const m = messageVendeurRevendeur(args, 2450, 3500)
  ok(m.includes(`2${NB}450${NB}€`), 'le message porte l’offre d’ouverture')
  ok(m.includes(`3${NB}500${NB}€`), 'et rappelle le prix demandé')
  eq(m.split('\n').filter((l) => l.startsWith('- ')).length, 4, 'quatre arguments au plus')
  ok(m.includes('Embrayage') && m.includes(`1${NB}200${NB}€`), 'les postes les plus chers d’abord')
  ok(!m.includes('Argument sans montant'),
    'un argument SANS montant n’entre pas dans le message : négocier sans chiffre, le vendeur le voit')
  ok(!m.includes('Vidange'), 'le cinquième poste, le moins cher, est laissé de côté')

  eq(messageVendeurRevendeur([], 2450, 3500), '', 'aucun argument chiffré : aucun message')
  eq(messageVendeurRevendeur(args, null, 3500), '', 'aucune offre : aucun message')

  // Vocabulaire : jamais « valeur », « cote » ni « expertise » dans ce qui
  // part chez le vendeur.
  for (const mot of ['valeur', 'cote', 'expertise', 'estimation']) {
    ok(!new RegExp(mot, 'i').test(m), `le message vendeur n’emploie pas « ${mot} »`)
  }
}

// ── Verrou Pass ────────────────────────────────────────────────────────────
//
// ⚠️ MASQUAGE SERVEUR, pas un flou CSS. Le sprint 7 l'avait appris pour la
// négociation : floutée côté client, la donnée partait quand même au
// navigateur. Ici, le prix d'achat maximum ne doit PAS quitter le serveur.
{
  const bloc = {
    comparables: { retenus: 8, recus: 14, ecartes: [] },
    revente: { valeur: 3200, mediane_observee: 3500, nb_comparables: 8, ajustement_km_eur: 0,
      retrait_negociation_eur: 280, decote_zfe_eur: 0, pente_eur_par_km: null },
    achat_max: { valeur: 1900, revente_eur: 3200, incomplet: false, manquants: [],
      lignes: [
        { cle: 'distribution', libelle: 'Distribution', montant_eur: 800, modifiable: true },
        { cle: 'marge_voulue', libelle: 'Marge visée', montant_eur: 500, modifiable: true },
      ] },
    offre: 1600,
    parametres: PARAMETRES_DEFAUT,
    carte_grise: { connu: true, montant_eur: 311.26, cv: 5, tarif_cv: 59.5, region: 'Occitanie', maj: '2026-11-05' },
    critair: '4',
    zfe: null,
    arguments: [{ poste: 'Distribution', montant_eur: 800 }, { poste: 'Pneus', montant_eur: 180 }],
    message_vendeur: 'Bonjour, …',
    mention: MENTION_REVENDEUR,
  }
  const pub = revendeurPublique(bloc)
  const texte = JSON.stringify(pub)

  ok(pub.revente && pub.revente.valeur === 3200, 'gratuit : le prix de revente réaliste reste')
  eq(pub.achat_max, null, 'gratuit : le prix d’achat maximum ne part PAS au navigateur')
  eq(pub.offre, null, 'gratuit : ni l’offre d’ouverture')
  eq(pub.message_vendeur, '', 'ni le message vendeur')
  eq(pub.arguments.length, 0, 'ni les arguments')
  eq(pub.carte_grise, null, 'ni le détail du coût de carte grise')
  ok(!texte.includes('1900') && !texte.includes('1600'),
    'aucun des deux chiffres masqués ne se retrouve dans la charge utile')
  eq(pub.masque, true, 'le masquage est annoncé')
  eq(pub.nb_lignes_masquees, 2, 'et l’écran sait COMBIEN de lignes il ne voit pas')
  eq(pub.nb_arguments_masques, 2, 'idem pour les arguments')
  ok(pub.mention === MENTION_REVENDEUR, 'la mention obligatoire reste, Pass ou pas')

  eq(revendeurPublique(null), null, 'un bloc absent reste absent')
}

// ── PARITÉ SERVEUR / CLIENT ────────────────────────────────────────────────
//
// ⚠️ CE QUE CETTE SECTION PROUVE, ET POURQUOI ELLE EXISTE QUAND MÊME.
//
// Les miroirs `src/data/*.gen.js` ne sont pas écrits à la main : ils sont
// produits par le compilateur TypeScript à partir des modules serveur
// (scripts/generer-miroir-revendeur.mjs). La parité est donc acquise par
// CONSTRUCTION — contrairement à `src/data/marche.js`, recopié à la main au
// sprint 9, où le test de parité était le seul filet.
//
// Ce test garde deux rôles, qui valent tous les deux leur place :
//   1. il échoue si le fichier généré est PÉRIMÉ (module serveur modifié sans
//      relancer le script) — c'est le cas réaliste ;
//   2. il échoue si quelqu'un a retouché le fichier généré à la main.
//
// Et il porte sur le COMPORTEMENT, pas sur le texte : `--verifier` compare les
// octets, celui-ci compare les résultats. Les deux peuvent tomber séparément.
{
  // Générateur déterministe : un échec doit se rejouer à l'identique. Pas de
  // Math.random — un test qui ne se reproduit pas ne se corrige pas.
  let graine = 19111905
  const alea = () => { graine = (graine * 1103515245 + 12345) & 0x7fffffff; return graine / 0x7fffffff }
  const entre = (a, b) => a + Math.floor(alea() * (b - a + 1))
  const parmi = (xs) => xs[entre(0, xs.length - 1)]

  const MODELES = ['Clio II', 'Clio IV', '308', 'Golf VII', 'Série 3']
  const ENERGIES = ['Diesel', 'Essence', 'essence sans plomb', 'Hybride', 'Électrique', 'GPL', '']
  const REGIONS = ['Occitanie', 'Île-de-France', 'ile de france', 'Bretagne', null, '']
  const VILLES = ['Toulouse', 'Paris', 'Lyon', 'Castres', 'Rennes', '']
  const baremeCg = {
    maj: '2026-11-05', source: 'essai', frais_fixes_eur: 13.76,
    regions: { 'Île-de-France': 68.95, Occitanie: 59.5, 'Pays de la Loire': 51 },
  }
  const SERVEUR = { filtrerComparables, prixRevente, coutCarteGrise, prixAchatMax, offreOuverture, penteKm, mediane }

  let divergences = 0, avecChiffre = 0, sansChiffre = 0, interditsZfe = 0
  let premierEcart = null

  for (let cas = 0; cas < 500; cas++) {
    const v = {
      modele: parmi(MODELES),
      energie: parmi(ENERGIES),
      annee: alea() < 0.1 ? null : entre(1995, 2026),
      km: alea() < 0.1 ? null : entre(5000, 320000),
    }
    // ⚠️ LE TIRAGE DOIT FRANCHIR LE SEUIL. Première version : modèle,
    // énergie, année et kilométrage tirés indépendamment pour chaque
    // comparable — résultat, AUCUN des 500 cas n'atteignait 6 comparables
    // retenus, et la parité comparait 500 fois « null contre null ». C'est
    // exactement ce que les compteurs ci-dessous servent à voir.
    //
    // On tire donc des annonces PROCHES du véhicule (même modèle, même
    // énergie, année et kilométrage voisins), avec une part d'intrus pour que
    // le filtre ait aussi quelque chose à écarter.
    const comparables = Array.from({ length: entre(0, 20) }, () => {
      const intrus = alea() < 0.2
      return {
        prix: entre(500, 45000),
        annee: alea() < 0.08 ? null
          : intrus ? entre(1995, 2026)
          : (v.annee ?? 2010) + entre(-3, 3),
        km: alea() < 0.08 ? null
          : intrus ? entre(5000, 320000)
          : Math.max(0, (v.km ?? 150000) + entre(-60000, 60000)),
        energie: intrus ? parmi(ENERGIES) : v.energie,
        modele: intrus ? parmi(MODELES) : v.modele,
        titre: 'annonce',
      }
    })
    const parametres = {
      marge_negociation_pct: entre(0, 25),
      marge_voulue_eur: entre(0, 3000),
      imprevus_pct_travaux: entre(0, 40),
      imprevus_vehicule_ancien_eur: entre(0, 400),
      decote_zfe_pct: entre(0, 30),
      offre_retrait_pct: entre(0, 40),
    }
    const travaux = Array.from({ length: entre(0, 4) }, (_, i) => ({
      cle: `t${i}`, libelle: `travail ${i}`, montant_eur: entre(0, 2500), modifiable: true,
    }))
    const region = parmi(REGIONS)
    const ville = parmi(VILLES)
    const cv = alea() < 0.15 ? null : entre(1, 40)
    const ctARefaire = entre(0, 1) ? 180 : null

    const classeServeur = critair(v.energie, v.annee)
    const classeClient = miroirCritair.critair(v.energie, v.annee)
    const zfeServeur = verdictZfe(ville, classeServeur)
    const zfeClient = miroirCritair.verdictZfe(ville, classeClient)
    if (zfeServeur && zfeServeur.interdit) interditsZfe++

    // ⚠️ AUCUN tirage ici : les deux implémentations doivent recevoir
    // exactement les mêmes entrées. Un `entre(0, 1)` dans cette fonction
    // consommerait la graine et ferait comparer deux cas différents — la
    // parité serait alors vraie ou fausse par hasard.
    const resultat = (R, classe, zfe) => {
      const filtres = R.filtrerComparables(comparables, v)
      const revente = R.prixRevente(filtres.retenus, v, parametres, !!(zfe && zfe.interdit))
      const carte = R.coutCarteGrise(cv, region, baremeCg)
      const max = revente
        ? R.prixAchatMax(revente.valeur, travaux, parametres, {
            ct_a_refaire_eur: ctARefaire,
            carte_grise_eur: carte.connu ? carte.montant_eur : null,
            region_connue: carte.connu,
            age_vehicule_ans: v.annee ? 2026 - v.annee : null,
          })
        : null
      return {
        classe, zfe, filtres, revente, carte, max,
        offre: max ? R.offreOuverture(max.valeur, parametres) : null,
        pente: R.penteKm(filtres.retenus),
        mediane: R.mediane(filtres.retenus.map((c) => c.prix)),
      }
    }

    const a = resultat(SERVEUR, classeServeur, zfeServeur)
    const b = resultat(miroirRevendeur, classeClient, zfeClient)
    if (a.revente) avecChiffre++
    else sansChiffre++
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      divergences++
      if (!premierEcart) premierEcart = { cas, serveur: a, client: b }
    }
  }

  eq(divergences, 0, `500 cas tirés au hasard : aucune divergence serveur/client${
    premierEcart ? ` — premier écart : ${JSON.stringify(premierEcart).slice(0, 400)}` : ''}`)

  // ⚠️ Sans ces trois compteurs, « aucune divergence » pourrait être vrai pour
  // la mauvaise raison : un tirage qui ne franchirait jamais le seuil de
  // 6 comparables comparerait 500 fois « null contre null ».
  ok(avecChiffre > 40, `le tirage franchit le seuil (${avecChiffre}/500 avec un chiffre)`)
  ok(sansChiffre > 40, `et reste aussi en dessous (${sansChiffre}/500 sans chiffre)`)
  ok(interditsZfe > 10, `et la décote ZFE mord (${interditsZfe}/500 interdits en ZFE)`)
}

// ── Le miroir généré est-il à jour ? ───────────────────────────────────────
//
// La parité de comportement ci-dessus ne dit pas que le fichier sur disque est
// celui que le générateur produirait : un miroir périmé peut se comporter à
// l'identique sur les 500 cas tirés et différer ailleurs. On compare donc
// aussi les octets.
{
  const { execFileSync } = await import('node:child_process')
  const { fileURLToPath } = await import('node:url')
  let aJour = true, sortie = ''
  try {
    execFileSync('node', ['scripts/generer-miroir-revendeur.mjs', '--verifier'],
      { cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8' })
  } catch (e) {
    aJour = false
    sortie = String(e.stdout || '') + String(e.stderr || '')
  }
  ok(aJour, `les miroirs src/data/*.gen.js sont à jour${aJour ? '' : ` — ${sortie.trim().split('\n').find((l) => l.startsWith('✗')) || ''}`}`)
}

console.log(`\n${ok_} contrôles passés, ${ko} échec(s).`)
if (ko > 0) process.exit(1)
console.log('Tous les tests revendeur passent.')
