// Test hors ligne du décodage normatif du VIN (aucun appel réseau).
// Vérifie : structure (17 caractères, jamais I/O/Q), WMI → constructeur/pays
// sans jamais deviner, années-modèle possibles (position 10, cycle 30 ans),
// clé de contrôle 49 CFR §565.15 (obligatoire en Amérique du Nord seulement).
// Usage : node tests/vin.test.mjs
import { anneesPossibles, cleControle, decoderVin } from '../src/lib/vin.js'

let ko = 0
const verifie = (titre, ok, detail = '') => {
  if (!ok) ko++
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${titre}${ok || !detail ? '' : ` (${detail})`}`)
}

// Exemple canonique de la littérature NHTSA : clé de contrôle correcte = 3.
{
  const d = decoderVin('1HGCM82633A004352')
  verifie('VIN US canonique : valide, Honda, États-Unis', d.valide && d.constructeur === 'Honda' && d.pays === 'États-Unis')
  verifie('VIN US : clé de contrôle concordante et OBLIGATOIRE', d.cle.concorde === true && d.cle.obligatoire === true)
  verifie('VIN US : année 2003 parmi les candidates (code 3)', d.annees_possibles.includes(2003))
}

// Marques françaises.
{
  const d = decoderVin('VF3LCYHZPJS112233')
  verifie('VF3 → Peugeot, France, région Europe', d.valide && d.constructeur === 'Peugeot' && d.pays === 'France' && d.region === 'Europe')
  verifie('Hors Amérique du Nord : clé INDICATIVE, jamais obligatoire', d.cle.obligatoire === false)
}
{
  const d = decoderVin('vf1 rfb00-964312345'.replace(/x/g, ''))
  verifie('Normalisation : minuscules, espaces et tirets acceptés', d.vin === 'VF1RFB00964312345' && d.constructeur === 'Renault')
}
{
  const d = decoderVin('UU14SDAA552987654')
  verifie('UU1 → Dacia, Roumanie', d.constructeur === 'Dacia' && d.pays === 'Roumanie')
}

// Allemandes.
{
  verifie('WVW → Volkswagen', decoderVin('WVWZZZAUZLP123456').constructeur === 'Volkswagen')
  verifie('W1K → Mercedes-Benz (depuis 2020)', decoderVin('W1K2063211A123456').constructeur === 'Mercedes-Benz')
  verifie('WAU → Audi', decoderVin('WAUZZZ4G1FN123456').constructeur === 'Audi')
}

// Préfixe à 2 caractères quand le WMI exact n'est pas listé.
{
  const d = decoderVin('JTDKB20U897654321')
  verifie('JT* → Toyota, Japon (préfixe 2 caractères)', d.constructeur === 'Toyota' && d.pays === 'Japon')
}

// WMI inconnu : on ne devine pas.
{
  const d = decoderVin('XX9ABCDE123456789')
  verifie('WMI inconnu → constructeur null, région quand même rendue', d.valide && d.constructeur === null && d.region === 'Europe')
}

// Structure invalide.
{
  verifie('16 caractères → invalide', decoderVin('VF3LCYHZJS112233').valide === false)
  const d = decoderVin('VO3ICYHZPJS112233')
  verifie('I/O/Q → invalide avec explication carte grise', d.valide === false && d.erreurs.some(e => e.includes('carte grise')))
}

// Années-modèle : cycle de 30 ans borné à [1980, courante + 1].
{
  const a = anneesPossibles('T', 2026)
  verifie('Code T en 2026 → 1996 ET 2026 (ambiguïté assumée)', a.length === 2 && a.includes(1996) && a.includes(2026))
  verifie('Code Y en 2026 → 2000 seulement (2030 pas encore plausible)', JSON.stringify(anneesPossibles('Y', 2026)) === '[2000]')
  verifie('Code interdit (O) → aucune année', anneesPossibles('O', 2026).length === 0)
}

// Clé de contrôle : discordance signalée, jamais bloquante en Europe.
{
  const d = decoderVin('VF3LCYHZ9JS112233')
  verifie('Clé discordante sur un VIN européen → VIN toujours valide, signal rendu',
    d.valide === true && typeof d.cle.attendue === 'string')
  verifie('cleControle rend X pour un reste de 10 ou un chiffre sinon',
    /^[0-9X]$/.test(cleControle('1HGCM82633A004352')))
}

// Déterminisme.
{
  const a = JSON.stringify(decoderVin('VF3LCYHZPJS112233'))
  const b = JSON.stringify(decoderVin('VF3LCYHZPJS112233'))
  verifie('Déterminisme : deux passes identiques', a === b)
}

if (ko > 0) {
  console.error(`\n${ko} échec(s).`)
  process.exit(1)
}
console.log('\nTous les tests VIN passent.')
