// Test hors ligne du noyau d'affirmation (sprint 23, « effet paquet »).
import { readFileSync } from 'node:fs'
import { affirmationNoyau, detailsAffichables, extraireNoyau } from '../supabase/functions/_shared/noyau.ts'
let ok_ = 0, ko = 0
const ok = (c, l) => { if (c) ok_++; else { ko++; console.log(`FAIL — ${l}`) } }
const n = (t, ty = 'panne') => extraireNoyau(t, ty)
ok(n('Courroie désalignée : rupture (moteurs produits sept. 2009 – fév. 2011)').noyau === 'Courroie désalignée: rupture', 'parenthèse datée retirée')
ok(n('Rappel décembre 2015 (Twingo III EDC) : 944 modèles concernés — calculateur').details.includes('944 modèles'), 'volume retiré en détail')
ok(!/2015|944/.test(n('Rappel décembre 2015 (Twingo III EDC) : 944 modèles concernés — calculateur').noyau), 'ni date ni volume dans le noyau')
ok(n('Turbo : réparation 2 500 € en moyenne').details.some((d) => /2 500 €/.test(d)), 'coût retiré')
ok(/110-120 km\/h/.test(n('Bimasse : vibrations à 110-120 km/h').noyau), '« km/h » est une vitesse : conservé')
ok(n('Rupture parfois avant 50 000 km').details.some((d) => /50 000 km/.test(d)), 'un kilométrage de panne est un détail')
{
  const e = n('Distribution par courroie : remplacement périodique — 160 000 km ou 6 ans (ADAC) ; 150 000 km ou 5 ans (Caradisiac)', 'entretien')
  ok(e.noyau === 'Distribution par courroie: remplacement périodique', 'entretien : le noyau est le type et l’opération')
  ok(e.details.length === 2 && e.details.includes('160 000 km ou 6 ans'), 'entretien : les intervalles sont des détails vérifiés page par page')
}
ok(affirmationNoyau('Injecteurs défaillants (jusqu’en 2011)', 'panne', 'Renault 1.5 dCi (K9K)') === 'Sur Renault 1.5 dCi (K9K) : Injecteurs défaillants', 'le moteur est nommé dans l’affirmation')
ok(JSON.stringify(detailsAffichables(['944 modèles', 'décembre 2015'], ['Renault rappelle 944 modèles de Twingo'])) === '["944 modèles"]', 'un détail ne s’affiche que s’il figure littéralement dans un extrait confirmé')
ok(detailsAffichables(['jusqu’en 2006'], ["pompe grippée jusqu'en 2006"]).length === 1, 'apostrophes normalisées')
// Tout le fichier : jamais de noyau vide, jamais plus long que l'intitulé.
const S = JSON.parse(readFileSync('docs/sources-moteurs-2026-11.json', 'utf8'))
let vides = 0, plusLongs = 0
for (const o of S.objets) { const r = n(o.intitule, o.type); if (r.noyau.length < 8) vides++; if (r.noyau.length > o.intitule.length) plusLongs++ }
ok(vides === 0, `aucun noyau vide sur ${S.objets.length} affirmations (${vides})`)
ok(plusLongs === 0, 'un noyau n’est jamais plus long que l’intitulé')
console.log(`\n${ko === 0 ? 'OK' : 'ÉCHEC'} — ${ok_}/${ok_ + ko} contrôles passés`)
if (ko > 0) process.exit(1)
