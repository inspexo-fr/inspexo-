// Test HORS LIGNE des « alertes rentables ». Usage : node tests/cibles.test.mjs
import { readFileSync } from 'node:fs'
import {
  cibleDepuisQuantiles, ECART_KM_CIBLE, effectifHistogramme, fusionnerHistogrammes,
  histogrammeDePrix, MENTION_CIBLES, parametresDepuisProfil, plafondRecherche,
  TRANCHE_PRIX_CIBLE,
  profilComplet, profilValide, PROFIL_VIDE, rechercheSauvegardee, SEUIL_CIBLE, trierCibles,
} from '../supabase/functions/_shared/cibles.ts'
import { quantileHisto } from '../supabase/functions/_shared/marche.ts'
import * as miroir from '../src/data/cibles.gen.js'

let ok_ = 0, ko = 0
const ok = (c, l) => { if (c) { ok_++; console.log(`PASS — ${l}`) } else { ko++; console.log(`FAIL — ${l}`) } }
const eq = (a, b, l) => ok(a === b, `${l}${a === b ? '' : ` (obtenu ${JSON.stringify(a)}, attendu ${JSON.stringify(b)})`}`)

const P = { marge_negociation_pct: 8, marge_voulue_eur: 500, imprevus_vehicule_ancien_eur: 150 }

// ── Histogramme ────────────────────────────────────────────────────────────
//
// ⚠️ On stocke un histogramme, pas des annonces : il se fusionne par somme
// d'une session à l'autre, et ne conserve ni titre, ni URL, ni date.
{
  const h = histogrammeDePrix([2600, 2200, 2900, 1950, 3200, 2450, 2750])
  eq(effectifHistogramme(h), 7, 'sept prix, sept relevés')
  eq(h['2750'], 2, '2 900 et 2 750 tombent dans la même tranche de 250 €')

  eq(effectifHistogramme(histogrammeDePrix([0, -5, 50, 2_000_000])), 0,
    'les prix absurdes sont écartés, pas comptés')
  eq(effectifHistogramme(histogrammeDePrix([])), 0, 'aucun prix : aucun relevé')

  // ⚠️ Découper les relevés ne doit RIEN changer : c'est la raison d'être de
  // l'histogramme. Un revendeur qui relève 4 annonces aujourd'hui et 3 demain
  // doit obtenir le même segment qu'en les relevant d'un coup.
  const d1 = histogrammeDePrix([2600, 2200, 2900, 1950])
  const d2 = histogrammeDePrix([3200, 2450, 2750])
  const fusion = fusionnerHistogrammes(d1, d2)
  eq(JSON.stringify(fusion), JSON.stringify(h), 'quatre + trois = sept, au relevé près')
  eq(effectifHistogramme(fusion), 7, 'et l’effectif suit')

  eq(effectifHistogramme(fusionnerHistogrammes(null, null)), 0, 'deux histogrammes absents : zéro')
  eq(effectifHistogramme(fusionnerHistogrammes(h, { '2500': -3 })), 7,
    'un effectif négatif est ignoré, il ne retire rien')
}

// ── Les quantiles viennent de l’UNIQUE implémentation du projet ───────────
//
// ⚠️ `quantileHisto` est celle de _shared/marche.ts, exportée exprès. En
// écrire une seconde ici ferait diverger deux chiffres qui doivent être le
// même — c’est la règle posée au sprint 9.
{
  const src = readFileSync(new URL('../supabase/functions/_shared/cibles.ts', import.meta.url), 'utf8')
  ok(!/function\s+quantile/i.test(src) && !/\.sort\([^)]*\)\s*\[\s*Math\.floor/.test(src),
    'cibles.ts ne contient AUCUNE implémentation de quantile')
}

// ── La cible d’un segment ──────────────────────────────────────────────────
{
  const h = histogrammeDePrix([2600, 2200, 2900, 1950, 3200, 2450, 2750])
  const map = new Map(Object.entries(h).map(([t, n]) => [Number(t), n]))
  const n = effectifHistogramme(h)
  const seg = {
    marque: 'renault', modele: 'clio', energie: 'diesel', n,
    p25: quantileHisto(map, n, 0.25), p50: quantileHisto(map, n, 0.5),
    annee_mediane: 2004, km_median: 180000, maj: '2026-11-05',
  }
  const c = cibleDepuisQuantiles(seg, P, { carte_grise_eur: 311, annee_courante: 2026 })
  ok(c !== null, 'sept relevés : une cible sort')
  eq(c.revente, Math.round(seg.p50 * 0.92), 'revente = médiane observée moins la négociation de l’acheteur final')
  eq(c.achat_max, c.revente - 150 - 311 - 500, 'achat max = revente − forfait ancien − carte grise − marge visée')
  eq(c.marge_estimee, c.revente - 150 - 311 - c.p25,
    'marge estimée = ce qui reste en achetant au quart le moins cher, AVANT la marge visée')

  // ⚠️ Aucun coût de réparation : une cible décrit un véhicule qu’on n’a pas
  // encore vu. Les travaux se découvrent sur l’annonce.
  ok(!JSON.stringify(c).includes('travaux'), 'une cible ne porte aucun poste de travaux')

  eq(cibleDepuisQuantiles({ ...seg, n: SEUIL_CIBLE - 1 }, P), null,
    `sous ${SEUIL_CIBLE} relevés : AUCUNE cible`)
  eq(cibleDepuisQuantiles(null, P), null, 'segment absent : aucune cible')

  // Sans carte grise connue, le coût n’est pas inventé : il vaut zéro et la
  // cible est donc OPTIMISTE — c’est à l’écran de le dire.
  const sansCg = cibleDepuisQuantiles(seg, P, { annee_courante: 2026 })
  eq(sansCg.achat_max, c.achat_max + 311, 'sans région, la carte grise ne pèse pas')

  // Un véhicule récent n’a pas le forfait « plus de 10 ans ».
  const recent = cibleDepuisQuantiles({ ...seg, annee_mediane: 2022 }, P, { annee_courante: 2026 })
  eq(recent.achat_max, recent.revente - 500, 'moins de 10 ans : ni forfait ni carte grise inconnue')
}

// ── UNE VALEUR ABERRANTE NE DOIT PAS DÉPLACER LA CIBLE ────────────────────
//
// ⚠️ C'EST LA RAISON D'ÊTRE DU STOCKAGE EN HISTOGRAMME, et la raison pour
// laquelle on ne montre AUCUNE moyenne. Une annonce à 50 000 € (erreur de
// saisie, véhicule de collection mal rangé) emporterait une moyenne ; elle ne
// déplace pas une médiane lue sur l'ensemble des relevés.
//
// On éprouve les deux régimes : un petit échantillon, où l'ajout d'un point
// déplace mécaniquement les quantiles d'une tranche au plus, et un
// échantillon réaliste, où ils ne bougent PAS DU TOUT.
{
  const quantiles = (prix) => {
    const h = histogrammeDePrix(prix)
    const map = new Map(Object.entries(h).map(([t, n]) => [Number(t), n]))
    const n = effectifHistogramme(h)
    return {
      n,
      p25: quantileHisto(map, n, 0.25),
      p50: quantileHisto(map, n, 0.5),
      p75: quantileHisto(map, n, 0.75),
    }
  }
  const cibleDe = (prix) => {
    const q = quantiles(prix)
    return cibleDepuisQuantiles(
      { marque: 'renault', modele: 'clio', energie: 'diesel', ...q, annee_mediane: 2004, km_median: 180000 },
      P, { carte_grise_eur: 311, annee_courante: 2026 },
    )
  }
  const moyenne = (xs) => Math.round(xs.reduce((s, x) => s + x, 0) / xs.length)

  // ── Le 1 € n'entre même pas dans l'histogramme ────────────────────────
  eq(effectifHistogramme(histogrammeDePrix([1])), 0,
    'un prix à 1 € est écarté à l’entrée : il ne compte pas comme un relevé')
  eq(effectifHistogramme(histogrammeDePrix([2600, 1, 2200])), 2,
    'et il ne gonfle pas l’effectif des autres')

  // ── Échantillon réaliste : les quantiles NE BOUGENT PAS ───────────────
  const base = [
    2600, 2200, 2900, 1950, 3200, 2450, 2750, 2300, 2850, 2050,
    2700, 2400, 3050, 2150, 2950, 2500, 2650, 2250, 3100, 2350,
  ]
  const avec = [...base, 1, 50_000]

  const sain = cibleDe(base)
  const pollue = cibleDe(avec)

  eq(pollue.n, sain.n + 1, 'le 50 000 € compte pour un relevé, le 1 € pour aucun')
  eq(pollue.p25, sain.p25, 'p25 INCHANGÉ malgré 1 € et 50 000 €')
  eq(pollue.p50, sain.p50, 'médiane INCHANGÉE')
  eq(pollue.revente, sain.revente, 'donc le prix de revente réaliste ne bouge pas')
  eq(pollue.achat_max, sain.achat_max, 'ni le prix d’achat maximum')
  eq(pollue.marge_estimee, sain.marge_estimee, 'ni la marge estimée : LA CIBLE NE BOUGE PAS')

  // ⚠️ Et la contre-épreuve, sans laquelle le test précédent ne prouverait
  // rien : une MOYENNE, elle, est emportée. C'est tout le propos.
  const degatMoyenne = moyenne(avec.filter((p) => p >= 200)) - moyenne(base)
  ok(degatMoyenne > 2000,
    `une moyenne, elle, bondirait de ${degatMoyenne} € sur le même jeu — ` +
    'c’est pourquoi aucune moyenne n’est affichée')

  // Seul le p75 suit le haut de la distribution, et c’est NORMAL : c’est son
  // rôle. On vérifie qu’il monte sans emporter le reste.
  ok(pollue.p75 >= sain.p75, 'le troisième quartile suit le haut de la distribution, lui')

  // ── Petit échantillon : au plus UNE tranche de déplacement ────────────
  const petit = [2600, 2200, 2900, 1950, 3200, 2450, 2750]
  const petitPollue = [...petit, 1, 50_000]
  const a = cibleDe(petit), b = cibleDe(petitPollue)
  ok(Math.abs(b.p50 - a.p50) <= TRANCHE_PRIX_CIBLE,
    `sur sept relevés, la médiane se déplace d’une tranche au plus (${a.p50} → ${b.p50})`)
  eq(b.p25, a.p25, 'et le premier quartile ne bouge pas non plus')
}

// ── Tri : où il y a de l’argent, et ce qui n’en a pas ─────────────────────
{
  const faire = (modele, p25, p50) => cibleDepuisQuantiles(
    { marque: 'x', modele, energie: 'diesel', n: 8, p25, p50, annee_mediane: 2015, km_median: 120000 },
    P, { annee_courante: 2026 },
  )
  const liste = [faire('a', 5000, 5400), faire('b', 4000, 6000), faire('c', 7000, 7100)]
  const triees = trierCibles(liste)
  eq(triees[0].modele, 'b', 'la marge la plus large d’abord')
  eq(triees[triees.length - 1].modele, 'c', 'et l’inatteignable en dernier')
  eq(triees[triees.length - 1].atteignable, false,
    'un modèle qui ne paie pas reste AFFICHÉ : le savoir est une information')
  eq(trierCibles([]).length, 0, 'aucune cible : aucune ligne')
}

// ── La recherche à sauvegarder ─────────────────────────────────────────────
{
  const r = rechercheSauvegardee(
    { marque: 'Renault', modele: 'Clio', energie: 'Diesel', annee_mediane: 2004, km_median: 180000 },
    2284,
  )
  eq(r.prix_max, 2300, 'plafond arrondi à la centaine SUPÉRIEURE')
  const champs = r.filtres.map((f) => f.champ)
  for (const c of ['Modèle', 'Carburant', 'Année', 'Kilométrage', 'Prix maximum']) {
    ok(champs.includes(c), `le filtre « ${c} » est donné en clair`)
  }
  eq(r.filtres.find((f) => f.champ === 'Année').valeur, 'de 2002 à 2006', 'années ± 2 autour de la médiane')
  eq(r.filtres.find((f) => f.champ === 'Kilométrage').valeur, `jusqu'à 220 000 km`,
    'kilométrage : la médiane plus la fenêtre de comparabilité')

  // ⚠️ LE LIEN NE PORTE QUE LA RECHERCHE TEXTE. On ne devine pas les noms de
  // paramètres de Leboncoin, et on ne l’interroge jamais pour les vérifier :
  // un lien qui appliquerait un mauvais filtre de prix écarterait en silence
  // les annonces qui comptent, et l’utilisateur nous croirait.
  eq(r.filtres.find((f) => f.champ === 'Modèle').valeur, 'Renault Clio',
    'le libellé est capitalisé : la clé de segment est en minuscules, pas le titre')
  ok(r.url.startsWith('https://www.leboncoin.fr/recherche?text='), 'le lien est une recherche texte')
  for (const interdit of ['price', 'mileage', 'regdate', 'fuel', '2300', '180000']) {
    ok(!r.url.includes(interdit), `le lien ne porte PAS de paramètre « ${interdit} »`)
  }
  ok(/ne devinons pas les paramètres/.test(r.note), 'et la note le dit à l’utilisateur')

  eq(rechercheSauvegardee({ marque: '', modele: '', energie: '' }, 1000).url, null,
    'sans modèle, aucun lien — on n’envoie pas vers une recherche vide')

  // L’arrondi va dans le sens de l’utilisateur, dans les DEUX sens : plafond
  // de recherche vers le haut (ne pas cacher une annonce négociable), offre
  // d’ouverture vers le bas (ne pas proposer plus que le calcul ne permet).
  eq(plafondRecherche(2201), 2300, 'arrondi vers le haut')
  eq(plafondRecherche(2200), 2200, 'déjà rond : inchangé')
  eq(plafondRecherche(-50), 0, 'jamais négatif')
}

// ── Profil mémorisé ────────────────────────────────────────────────────────
{
  const p = profilValide({ region: 'Occitanie', ville_revente: 'Toulouse', cv: 5, marge_voulue_eur: 800 })
  eq(p.region, 'Occitanie', 'la région est reprise')
  eq(p.cv, 5, 'la puissance fiscale aussi')
  eq(p.marge_negociation_pct, null, 'un champ non renseigné reste null, pas un défaut inventé')
  ok(profilComplet(p), 'région + CV : le profil suffit à calculer sans poser de question')

  ok(!profilComplet(profilValide({ region: 'Occitanie' })), 'sans CV : incomplet')
  ok(!profilComplet(profilValide({ cv: 5 })), 'sans région : incomplet')
  ok(!profilComplet(PROFIL_VIDE), 'profil vide : incomplet')

  eq(profilValide({ cv: 500 }).cv, 99, 'une puissance fiscale absurde est bornée')
  eq(profilValide({ cv: 'sept' }).cv, null, 'une puissance fiscale illisible est null')
  eq(profilValide(null).region, '', 'un profil absent ne lève pas')
  eq(profilValide({ region: 'x'.repeat(200) }).region.length, 60, 'la région est bornée en longueur')

  const defauts = { marge_negociation_pct: 8, marge_voulue_eur: 500, imprevus_pct_travaux: 15 }
  const appliques = parametresDepuisProfil(defauts, p)
  eq(appliques.marge_voulue_eur, 800, 'le profil remplace le défaut quand il est renseigné')
  eq(appliques.marge_negociation_pct, 8, 'et le laisse quand il ne l’est pas')
  eq(defauts.marge_voulue_eur, 500, 'les défauts ne sont pas modifiés au passage')
}

// ── Vocabulaire ────────────────────────────────────────────────────────────
{
  const src = readFileSync(new URL('../supabase/functions/_shared/cibles.ts', import.meta.url), 'utf8')
  const code = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
  for (const mot of ['cote du véhicule', 'expertise', 'estimation de valeur']) {
    ok(!new RegExp(mot, 'i').test(code), `cibles.ts n’emploie pas « ${mot} »`)
  }
  ok(MENTION_CIBLES.includes('ni des valeurs de véhicule ni des promesses de revente'),
    'la mention dit ce que les marges ne sont PAS')
  ok(MENTION_CIBLES.includes('prix observés'), 'et d’où viennent les chiffres')
}

// ── Parité serveur / client ────────────────────────────────────────────────
//
// Le miroir est GÉNÉRÉ par le compilateur TypeScript : la parité est acquise
// par construction. Ce contrôle attrape le fichier PÉRIMÉ.
{
  let graine = 19110501
  const alea = () => { graine = (graine * 1103515245 + 12345) & 0x7fffffff; return graine / 0x7fffffff }
  const entre = (a, b) => a + Math.floor(alea() * (b - a + 1))
  let divergences = 0, avecCible = 0
  for (let i = 0; i < 300; i++) {
    const prix = Array.from({ length: entre(0, 14) }, () => entre(500, 40000))
    const h = histogrammeDePrix(prix)
    const seg = {
      marque: 'm', modele: 'x', energie: 'diesel', n: effectifHistogramme(h),
      p25: entre(500, 20000), p50: entre(500, 40000),
      annee_mediane: alea() < 0.2 ? null : entre(1998, 2025),
      km_median: alea() < 0.2 ? null : entre(10000, 300000),
    }
    const par = { marge_negociation_pct: entre(0, 20), marge_voulue_eur: entre(0, 3000), imprevus_vehicule_ancien_eur: entre(0, 400) }
    const opts = { carte_grise_eur: alea() < 0.5 ? entre(50, 900) : null, annee_courante: 2026 }
    const a = {
      h, n: effectifHistogramme(h),
      cible: cibleDepuisQuantiles(seg, par, opts),
      recherche: rechercheSauvegardee(seg, entre(0, 20000)),
      profil: profilValide({ region: 'Occitanie', cv: entre(0, 120) }),
    }
    const b = {
      h: miroir.histogrammeDePrix(prix), n: miroir.effectifHistogramme(miroir.histogrammeDePrix(prix)),
      cible: miroir.cibleDepuisQuantiles(seg, par, opts),
      recherche: miroir.rechercheSauvegardee(seg, 0),
      profil: miroir.profilValide({ region: 'Occitanie', cv: 0 }),
    }
    // Les deux derniers appels prennent des entrées différentes : on ne
    // compare que ce qui est comparable, et on le dit.
    if (a.cible) avecCible++
    if (JSON.stringify(a.h) !== JSON.stringify(b.h) || a.n !== b.n ||
        JSON.stringify(a.cible) !== JSON.stringify(b.cible)) divergences++
  }
  eq(divergences, 0, '300 segments tirés au hasard : aucune divergence serveur/client')
  ok(avecCible > 30, `le tirage franchit le seuil (${avecCible}/300 avec une cible)`)
}

console.log(`\n${ok_} contrôles passés, ${ko} échec(s).`)
if (ko > 0) process.exit(1)
console.log('Tous les tests cibles passent.')
