// Test hors ligne de la lecture du PV de contrôle technique (aucun appel API).
// Vérifie : validation stricte de la sortie vision (codes, catégories,
// sentinelles), AUCUNE donnée personnelle dans les textes rendus, liaison aux
// pannes de la fiche par organe/mots significatifs, chiffrage UNIQUEMENT si un
// coût sourcé existe, et comparaison kilométrique PV vs annonce (un compteur
// ne recule pas).
// Usage : node tests/lecture-ct.test.mjs
import {
  comparerKmCt,
  relierEtChiffrer,
  validerLectureCt,
} from '../supabase/functions/_shared/lectureCt.ts'

let ko = 0
const verifie = (titre, ok, detail = '') => {
  if (!ok) ko++
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${titre}${ok || !detail ? '' : ` (${detail})`}`)
}

// ---------- validerLectureCt ----------
// `toLocaleString('fr-FR')` sépare les milliers par une espace insécable
// étroite (U+202F), pas par une espace ordinaire : une assertion écrite avec
// une espace normale échoue sur un message pourtant juste.
const esp = (t) => String(t ?? '').replace(/[\u00a0\u202f\u2009]/g, ' ')

const brutComplet = {
  lisible: true,
  date_ct: '2026-06-12',
  centre: 'Autosécurité Toulouse Nord',
  km_releve: 188452,
  resultat: 'defavorable',
  contre_visite: true,
  date_limite: '2026-08-11',
  defauts: [
    { code: '1.1.3.a.1', libelle: 'Plaquettes de frein avant : usure excessive', categorie: 'majeure', explication: "Les plaquettes sont en dessous du minimum : freinage dégradé, remplacement exigé avant la contre-visite." },
    { code: '5.2.3.d.2', libelle: 'Pneumatique arrière droit : profondeur insuffisante', categorie: 'majeure', explication: 'Le témoin d’usure est atteint : pneu à remplacer.' },
    { code: '4.1.2', libelle: 'Réglage des feux de croisement', categorie: 'mineure', explication: 'Simple réglage, sans contre-visite.' },
  ],
}
{
  const l = validerLectureCt(brutComplet)
  verifie('PV complet : lisible, date, centre, km, résultat', l.lisible && l.date_ct === '2026-06-12' && l.centre?.includes('Toulouse') && l.km_releve === 188452 && l.resultat === 'defavorable')
  verifie('PV complet : 3 défaillances, codes conservés', l.defauts.length === 3 && l.defauts[0].code === '1.1.3.a.1')
  verifie('PV complet : contre-visite', l.contre_visite === true && l.date_limite === '2026-08-11')
}
{
  const l = validerLectureCt({ lisible: false, date_ct: '', centre: '', km_releve: 0, resultat: 'inconnu', contre_visite: false, date_limite: '', defauts: [] })
  verifie('Document illisible : tout en sentinelles', !l.lisible && l.date_ct === null && l.km_releve === null && l.defauts.length === 0)
}
{
  const l = validerLectureCt({ ...brutComplet, defauts: [], km_releve: 0, date_ct: '', resultat: 'inconnu' })
  verifie('« lisible » sans AUCUN contenu lisible → illisible', l.lisible === false)
}
{
  const l = validerLectureCt({
    ...brutComplet,
    defauts: [
      { code: 'nawak!!', libelle: 'Corrosion châssis', categorie: 'critique', explication: 'x' },
      { code: '1.1', libelle: 'ok', categorie: 'fantaisie', explication: 'x' },
      { code: '8.2.1.2', libelle: '', categorie: 'mineure', explication: 'x' },
    ],
  })
  verifie('Code invalide → null, catégorie inconnue ou libellé vide → défaut écarté',
    l.defauts.length === 1 && l.defauts[0].code === null && l.defauts[0].libelle === 'Corrosion châssis')
}
{
  const l = validerLectureCt({
    ...brutComplet,
    centre: 'Centre CT — véhicule AB-123-CD',
    defauts: [{ code: '1.1.1', libelle: 'Frein de service, immatriculation FG-456-HJ visible', categorie: 'majeure', explication: 'VIN VF3ABCDEF12345678 relevé.' }],
  })
  const texte = JSON.stringify(l)
  verifie('Aucune donnée personnelle (plaque, VIN) dans les textes rendus',
    !/AB-123-CD|FG-456-HJ|VF3ABCDEF12345678/.test(texte), texte.slice(0, 160))
}
{
  const l = validerLectureCt({ ...brutComplet, contre_visite: false })
  verifie('Défaillance majeure présente → contre-visite même si le drapeau manque', l.contre_visite === true)
}
{
  const l = validerLectureCt({ ...brutComplet, km_releve: 5_000_000, date_ct: '12/06/2026' })
  verifie('Km aberrant et date mal formée → sentinelles', l.km_releve === null && l.date_ct === null)
}

// ---------- relierEtChiffrer ----------
const pannes = [
  { titre: 'Usure prématurée des plaquettes et disques de frein' },
  { titre: 'Courroie de distribution en bain d’huile : délitement' },
]
const couts = [
  { operation: 'Remplacement plaquettes de frein avant', cout_min_eur: 80, cout_max_eur: 180, urls: ['https://exemple.fr/frein'], statut: 'source', famille_norm: '' },
  { operation: 'Remplacement d’un pneumatique', cout_min_eur: 60, cout_max_eur: 160, urls: ['https://exemple.fr/pneu'], statut: 'valide_devis', famille_norm: '' },
]
{
  const l = validerLectureCt(brutComplet)
  const d = relierEtChiffrer(l.defauts, pannes, couts)
  verifie('Défaut frein relié à la panne frein de la fiche', d[0].panne_liee?.includes('plaquettes'))
  verifie('Défaut frein chiffré depuis repair_costs (avec sources)',
    d[0].cout_min_eur === 80 && d[0].cout_max_eur === 180 && d[0].cout_urls.length === 1)
  verifie('Défaut pneu chiffré par le devis validé', d[1].cout_statut === 'valide_devis')
  verifie('Réglage des feux : AUCUN coût inventé, aucune panne liée',
    d[2].cout_min_eur === null && d[2].cout_max_eur === null && d[2].panne_liee === null)
}

// ---------- comparerKmCt ----------
{
  const r = comparerKmCt(188452, '2026-06-12', 120000)
  verifie('Annonce < PV → compteur contredit (preuve documentaire)', r.compteur_contredit === true && /188 452|188 452/.test(esp(r.incoherence)))
}
{
  const r = comparerKmCt(118000, '2026-06-12', 120000)
  verifie('Annonce > PV (a roulé depuis) → rien à signaler', r.compteur_contredit === false && r.incoherence === null)
}
{
  const r = comparerKmCt(120000, '2026-06-12', 119200)
  verifie('Écart sous la tolérance de 1 % → rien à signaler', r.compteur_contredit === false)
}
{
  const r = comparerKmCt(null, null, 120000)
  verifie('Km du PV illisible → aucune comparaison', r.compteur_contredit === false && r.incoherence === null)
}

// ---------- déterminisme ----------
{
  const a = JSON.stringify(relierEtChiffrer(validerLectureCt(brutComplet).defauts, pannes, couts))
  const b = JSON.stringify(relierEtChiffrer(validerLectureCt(brutComplet).defauts, pannes, couts))
  verifie('Déterminisme : deux passes identiques', a === b)
}


// ---------------------------------------------------------------------------
// SPRINT 13 — Historique kilométrique du PV (section obligatoire depuis le
// 20 mai 2018). Un relevé isolé ne peut pas montrer un compteur qui recule ;
// la SÉRIE, si.
// ---------------------------------------------------------------------------
{
  const l = validerLectureCt({
    ...brutComplet,
    km_releve: 188452,
    km_historique: [
      { date: '2024-06-10', km: 150200 },
      { date: '2022-06-08', km: 118400 },
      { date: '2020-06-05', km: 82300 },
    ],
  })
  verifie('Historique km : les 3 relevés sont retenus', l.km_historique.length === 3)
  // L'ORDRE est la condition de la détection : il ne peut pas dépendre du
  // document, qui liste souvent du plus récent au plus ancien.
  verifie('Historique km : réordonné du plus ancien au plus récent',
    l.km_historique[0].km === 82300 && l.km_historique[2].km === 150200,
    l.km_historique.map(e => e.km).join(' '))
}
{
  const l = validerLectureCt({
    ...brutComplet,
    km_historique: [
      { date: '2024-06-10', km: 150200 },
      { date: 'pas une date', km: 90000 },
      { date: '2022-06-08', km: 0 },
      { date: '2020-06-05', km: 3_000_000 },
    ],
  })
  verifie('Historique km : relevé sans date gardé, km aberrants écartés',
    l.km_historique.length === 2 && l.km_historique.some(e => e.km === 90000) &&
    !l.km_historique.some(e => e.km === 0 || e.km === 3_000_000),
    JSON.stringify(l.km_historique))
}
{
  const l = validerLectureCt({ ...brutComplet, km_historique: 'pas un tableau' })
  verifie('Historique km : entrée non tabulaire → tableau vide', Array.isArray(l.km_historique) && l.km_historique.length === 0)
}
{
  // Un PV dont SEULE la section kilométrique est lisible reste exploitable :
  // c'est précisément le cas qui fait basculer un verdict.
  const l = validerLectureCt({
    lisible: true, date_ct: '', centre: '', km_releve: 0, resultat: 'inconnu',
    contre_visite: false, date_limite: '', defauts: [],
    km_historique: [{ date: '2024-06-10', km: 150200 }],
  })
  verifie('PV dont seul l’historique km est lisible → exploitable', l.lisible === true)
}

// ---- Compteur qui RECULE entre deux contrôles officiels ----
{
  const r = comparerKmCt(140000, '2026-06-12', 145000, [
    { date: '2022-06-08', km: 118400 },
    { date: '2024-06-10', km: 150200 },
  ])
  verifie('Compteur qui recule entre deux CT → compteur contredit',
    r.compteur_contredit === true && /recul/i.test(esp(r.incoherence)), esp(r.incoherence))
  verifie('Le message chiffre la baisse et nomme les deux contrôles',
    /10 200/.test(esp(r.incoherence)) && /10\/06\/2024/.test(esp(r.incoherence)) &&
    /12\/06\/2026/.test(esp(r.incoherence)), esp(r.incoherence))
  verifie('Le message demande la justification',
    /remplacement de compteur document/i.test(esp(r.incoherence)))
}
{
  // La baisse est détectée MÊME si l'annonce est cohérente avec le dernier
  // relevé : le fait grave est la série, pas l'annonce.
  const r = comparerKmCt(140000, '2026-06-12', 200000, [{ date: '2024-06-10', km: 150200 }])
  verifie('Baisse signalée même quand l’annonce est cohérente', r.compteur_contredit === true)
}
{
  const r = comparerKmCt(160000, '2026-06-12', 165000, [
    { date: '2020-06-05', km: 82300 },
    { date: '2022-06-08', km: 118400 },
    { date: '2024-06-10', km: 150200 },
  ])
  verifie('Série croissante et annonce cohérente → aucun signal',
    r.compteur_contredit === false && r.incoherence === null, esp(r.incoherence))
}
{
  // Tolérance de 1 % : un arrondi de lecture ne doit pas crier à la fraude.
  const r = comparerKmCt(149900, '2026-06-12', 155000, [{ date: '2024-06-10', km: 150200 }])
  verifie('Baisse de 0,2 % (arrondi de lecture) → pas de signal', r.compteur_contredit === false)
  const r2 = comparerKmCt(145000, '2026-06-12', 155000, [{ date: '2024-06-10', km: 150200 }])
  verifie('Baisse de 3,5 % → signal', r2.compteur_contredit === true)
}
{
  // L'ancienne règle reste : annonce sous le dernier relevé.
  const r = comparerKmCt(188452, '2026-06-12', 120000, [])
  verifie('Annonce sous le relevé du jour → compteur contredit (règle d’origine)',
    r.compteur_contredit === true && /188 452/.test(esp(r.incoherence)))
  const r2 = comparerKmCt(null, null, 120000, [{ date: '2024-06-10', km: 150200 }])
  verifie('Annonce sous le dernier relevé de l’historique, sans relevé du jour',
    r2.compteur_contredit === true && /150 200/.test(esp(r2.incoherence)), esp(r2.incoherence))
}
{
  const r = comparerKmCt(null, null, null, [])
  verifie('Rien à comparer → aucun signal', r.compteur_contredit === false && r.incoherence === null)
  const r2 = comparerKmCt(150000, '2026-06-12', null, [{ date: '2024-06-10', km: 120000 }])
  verifie('Sans km annoncé, la série est quand même vérifiée',
    r2.compteur_contredit === false && r2.incoherence === null)
}

if (ko > 0) {
  console.error(`\n${ko} échec(s).`)
  process.exit(1)
}
console.log('\nTous les tests lecture-ct passent.')
