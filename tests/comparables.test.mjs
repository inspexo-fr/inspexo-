// Test hors ligne des agrégats de comparables (aucun appel API).
// Vérifie : la base ne manipule que des agrégats fusionnables (histogrammes),
// les règles de correspondance historiques (techno, cylindrée, ±2 ans,
// ±30 % km), le seuil de 15, la fonte des comparables en mémoire, la précision
// des quantiles (± une tranche de 250 €) et le déterminisme.
// Usage : node tests/comparables.test.mjs
import {
  technoDe, segmentDe, trancheKm, tranchePrix, moisRecents, fourchetteDepuisAgregats,
  TRANCHE_PRIX, ANNEE_INCONNUE, KM_INCONNU,
} from '../supabase/functions/_shared/comparables.ts'

let ko = 0
const verifie = (titre, ok, detail = '') => {
  if (!ok) ko++
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${titre}${ok || !detail ? '' : ` (${detail})`}`)
}

// ---------- Jetons et segments ----------
{
  const a = technoDe('Peugeot 308 1.2 PureTech 110 Allure')
  verifie('technoDe extrait techno + cylindrée', a.techno === 'puretech' && a.cyl === '1.2', JSON.stringify(a))
  const b = technoDe('BMW 320d')
  verifie('libellé sans jeton → champs vides', b.techno === '' && b.cyl === '')
}
{
  const seg = segmentDe({
    marque: 'Peugeot', modele: '308', libelle_motorisation: '1.2 PureTech 110',
    annee: 2016, km: 84500, prix: 9400, date: new Date('2026-10-28T12:00:00Z'),
  })
  verifie('segmentDe : tranches et normalisation',
    seg.marque_norm === 'peugeot' && seg.km_tranche === 4 && seg.prix_tranche === 9250 &&
    seg.mois === '2026-10' && seg.annee === 2016, JSON.stringify(seg))
  verifie('prix hors bornes → null', segmentDe({ marque: 'a', modele: 'b', annee: null, km: null, prix: 50 }) === null)
  verifie('km inconnu → sentinelle', trancheKm(null) === KM_INCONNU && tranchePrix(9499) === 9250)
}
{
  const mois = moisRecents(new Date('2026-01-15T00:00:00Z'))
  verifie('moisRecents enjambe l\'année', mois.join(',') === '2026-01,2025-12,2025-11', mois.join(','))
}

// ---------- Fourchette depuis histogrammes ----------
const ligne = (prix, effectif, extra = {}) => ({
  techno: 'puretech', cyl: '1.2', annee: 2016, km_tranche: 4, mois: '2026-10',
  prix_tranche: tranchePrix(prix), effectif, ...extra,
})
const vehicule = { techno: 'puretech', cyl: '1.2', annee: 2016, km: 84500 }
{
  // 20 comparables entre 8 000 et 12 750 € (20 tranches de 250 €) :
  // les quantiles d'histogramme doivent coller aux vrais à ± une tranche.
  const prix = Array.from({ length: 20 }, (_, i) => 8000 + i * 250)
  const lignes = prix.map((p) => ligne(p, 1))
  const f = fourchetteDepuisAgregats(lignes, vehicule)
  const vraieMediane = 10375
  verifie('quantiles à ± une tranche des vrais',
    f && Math.abs(f.mediane - vraieMediane) <= TRANCHE_PRIX && f.p25 < f.mediane && f.mediane < f.p75 && f.n === 20,
    JSON.stringify(f))
}
{
  const f = fourchetteDepuisAgregats([ligne(9000, 14)], vehicule)
  verifie('14 comparables < seuil de 15 → null', f === null)
  const f2 = fourchetteDepuisAgregats([ligne(9000, 15)], vehicule)
  verifie('15 comparables → fourchette publiée', f2 !== null && f2.n === 15)
}
{
  // Fusion entre segments compatibles (±2 ans, années/km inconnus acceptés).
  const lignes = [
    ligne(9000, 6),
    ligne(9500, 5, { annee: 2018 }),                       // +2 ans : accepté
    ligne(10000, 4, { annee: ANNEE_INCONNUE }),            // année inconnue : acceptée
    ligne(8750, 3, { km_tranche: KM_INCONNU }),            // km inconnu : accepté
    ligne(20000, 50, { annee: 2021 }),                     // +5 ans : EXCLU
    ligne(20000, 50, { techno: 'bluehdi' }),               // autre techno : EXCLU
    ligne(20000, 50, { cyl: '1.6' }),                      // autre cylindrée : EXCLUE
    ligne(20000, 50, { km_tranche: 9 }),                   // km hors ±30 % : EXCLU
  ]
  const f = fourchetteDepuisAgregats(lignes, vehicule)
  verifie('fusion des segments compatibles, exclusions respectées',
    f && f.n === 18 && f.p75 <= 10500, JSON.stringify(f))
}
{
  // Les comparables EN MÉMOIRE (extension) se fondent dans l'histogramme.
  const f = fourchetteDepuisAgregats([ligne(9000, 10)], vehicule, 15, [9100, 9200, 9300, 9400, 9600])
  verifie('comparables en mémoire fondus (10 base + 5 extension = 15)', f !== null && f.n === 15, JSON.stringify(f))
}
{
  // Véhicule sans techno identifiée : tout le modèle correspond (règle historique).
  const f = fourchetteDepuisAgregats(
    [ligne(9000, 10), ligne(9500, 5, { techno: 'bluehdi', cyl: '' })],
    { techno: '', cyl: '', annee: 2016, km: 84500 },
  )
  verifie('sans techno véhicule, toutes les technos du modèle comptent', f !== null && f.n === 15)
}
{
  const lignes = [ligne(9000, 10), ligne(9500, 8)]
  const resultats = new Set()
  for (let i = 0; i < 50; i++) resultats.add(JSON.stringify(fourchetteDepuisAgregats([...lignes], { ...vehicule })))
  verifie('50 appels identiques → 1 résultat', resultats.size === 1)
}

console.log(ko === 0 ? '\n✓ comparables conformes' : `\n✗ ${ko} écart(s)`)
process.exit(ko === 0 ? 0 : 1)
