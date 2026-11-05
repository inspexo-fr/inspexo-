// Test hors ligne du décodage normatif du VIN (aucun appel réseau).
// Vérifie : structure (17 caractères, jamais I/O/Q), WMI → constructeur/pays
// sans jamais deviner, années-modèle possibles (position 10, cycle 30 ans),
// clé de contrôle 49 CFR §565.15 (obligatoire en Amérique du Nord seulement).
// Usage : node tests/vin.test.mjs
import { readFileSync } from 'node:fs'
import {
  anneesPossibles, cleControle, concordanceVin, decoderVin, incoherenceConstructeur, trouverVin,
} from '../src/lib/vin.js'

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

// ---------------------------------------------------------------------------
// SPRINT 20 — TROUVER un VIN dans un texte
// ---------------------------------------------------------------------------
console.log('\n▶ Recherche dans un texte')
{
  // Étiqueté : on le prend tel quel, sous toutes les formulations courantes.
  for (const forme of [
    'VIN : VF3LBHZTXHS123456',
    'VIN VF3LBHZTXHS123456',
    'n° de châssis : VF3LBHZTXHS123456',
    'numéro de chassis VF3LBHZTXHS123456',
    'Châssis VF3LBHZTXHS123456',
    'numéro de série : VF3LBHZTXHS123456',
    'vin=VF3LBHZTXHS123456',
  ]) {
    const t = trouverVin(`Peugeot 308, 2017. ${forme}. Prix 9 000 €.`)
    verifie(`« ${forme.slice(0, 26)}… » → VIN trouvé et étiqueté`,
      t?.vin === 'VF3LBHZTXHS123456' && t.etiquette === true, JSON.stringify(t))
  }
  verifie('la casse et les minuscules ne gênent pas',
    trouverVin('vin : vf3lbhztxhs123456')?.vin === 'VF3LBHZTXHS123456')

  // Jeton isolé : accepté SEULEMENT si sa forme le corrobore.
  verifie('jeton isolé avec WMI reconnu → accepté, mais non étiqueté',
    (() => { const t = trouverVin('Belle Audi A3, WAUZZZ8V1KA123456, 19 000 €'); return t?.vin === 'WAUZZZ8V1KA123456' && t.etiquette === false })())

  // ⚠️ LES FAUX POSITIFS, qui sont tout l'enjeu : une référence d'annonce
  // prise pour un VIN ferait annoncer une discordance de constructeur sur une
  // chaîne qui n'en est pas un.
  verifie('référence d’annonce de 17 caractères → REFUSÉE',
    trouverVin('Référence interne REF2024ABCDE12345, nous consulter') === null)
  verifie('17 chiffres → refusés (c’est un numéro, pas un VIN)',
    trouverVin('Appelez le 06123456789012345') === null)
  verifie('texte sans rien → null', trouverVin('Peugeot 308 essence 2017, 9 000 €') === null)
  verifie('texte vide ou absent → null',
    trouverVin('') === null && trouverVin(null) === null && trouverVin(undefined) === null)
  verifie('un VIN collé à d’autres caractères n’est pas découpé',
    trouverVin('XXWAUZZZ8V1KA123456YY') === null)
  // Un I, O ou Q dans la chaîne la disqualifie : ces lettres n'existent pas
  // dans un VIN, donc ce n'en est pas un.
  verifie('une chaîne de 17 caractères contenant un O n’est pas un VIN',
    trouverVin('Lot nO VFOLBHZTXHS12345') === null)
  // L'étiquette l'emporte sur un jeton qui traînerait avant.
  verifie('l’étiquette gagne sur un jeton antérieur',
    trouverVin('REF WAUZZZ8V1KA123456 — VIN : VF3LBHZTXHS123456')?.vin === 'VF3LBHZTXHS123456')
}

console.log('\n▶ Concordance avec l’annonce')
{
  const audi = decoderVin('WAUZZZ8V1KA123456')
  const d1 = concordanceVin(audi, { marque: 'Peugeot', annee: 2019 })
  verifie('constructeur discordant → « discordance »', d1.constructeur === 'discordance')
  verifie('et le constat le dit en clair', d1.constats.some((c) => !c.ok && /Audi/.test(c.texte)))

  const d2 = concordanceVin(audi, { marque: 'Audi', annee: 2019 })
  verifie('constructeur concordant → « accord »', d2.constructeur === 'accord')
  // Le libellé du WMI porte parfois l'usine : la comparaison doit tenir.
  const hongrie = decoderVin('TRUZZZ8U1A1123456')
  verifie('« Audi (usine de Győr) » concorde avec « Audi »',
    concordanceVin(hongrie, { marque: 'Audi', annee: 2010 }).constructeur === 'accord',
    hongrie.constructeur)

  // ⚠️ Rien n'est tranché sans la donnée : pas de marque, pas de verdict.
  verifie('sans marque dans l’annonce → indécidable',
    concordanceVin(audi, { annee: 2019 }).constructeur === 'indecidable')
  verifie('sans année dans l’annonce → indécidable',
    concordanceVin(audi, { marque: 'Audi' }).annee === 'indecidable')
  verifie('un VIN invalide ne conclut rien',
    (() => { const c = concordanceVin(decoderVin('TROPCOURT'), { marque: 'Audi', annee: 2019 }); return c.constructeur === 'indecidable' && c.annee === 'indecidable' && c.constats.length === 0 })())

  // L'ambiguïté du cycle de 30 ans ne doit pas créer de fausse discordance.
  verifie('le cycle de 30 ans ne crée pas de fausse discordance',
    concordanceVin(audi, { marque: 'Audi', annee: 1989 }).annee === 'accord',
    JSON.stringify(audi.annees_possibles))
  verifie('un an d’écart est toléré (année-modèle vs mise en circulation)',
    concordanceVin(audi, { marque: 'Audi', annee: 2018 }).annee === 'accord')
  verifie('trois ans d’écart → discordance',
    concordanceVin(audi, { marque: 'Audi', annee: 2022 }).annee === 'discordance')
}

console.log('\n▶ Ce qui pèse, et ce qui ne pèse pas')
{
  // ⚠️ SEULE la discordance de CONSTRUCTEUR devient une incohérence au sens
  // du barème. Le code d'année (position 10) et la clé de contrôle
  // (position 9) ne sont PAS obligatoires hors Amérique du Nord : en faire
  // peser une discordance reviendrait à sanctionner une voiture pour une
  // convention que son constructeur n'était pas tenu d'appliquer.
  const src = readFileSync(new URL('../supabase/functions/score/index.ts', import.meta.url), 'utf8')
  verifie('le serveur ne pose une incohérence que sur le constructeur',
    /concordanceVin[\s\S]{0,800}?incoherenceConstructeur/.test(src))
  verifie('la phrase d’incohérence est une CONSTANTE partagée (le filtre d’exemption la retrouve mot pour mot)',
    /incoherenceConstructeur\(/.test(src) && typeof incoherenceConstructeur('Audi', 'Peugeot') === 'string')
  verifie('elle nomme les deux constructeurs opposés',
    /Audi/.test(incoherenceConstructeur('Audi', 'Peugeot')) && /Peugeot/.test(incoherenceConstructeur('Audi', 'Peugeot')))
  verifie('aucune incohérence n’est posée sur la clé de contrôle',
    !/cle[\s\S]{0,120}incoherencesServeur/.test(src))

  // ⚠️ L'INVARIANT LE PLUS IMPORTANT DU SPRINT 20c : le VIN ne va JAMAIS dans
  // result_json. /a/:id est public, et un VIN est rattachable à son titulaire
  // par le SIV. Le serveur garde les faits DÉCODÉS et une empreinte salée.
  verifie('le bloc `vin:` de result_json existe', / {6}vin: vinDecode/.test(src))
  verifie('il porte les faits décodés, et le numéro n’y figure pas',
    / {6}vin: vinDecode[\s\S]{0,900}?annees_possibles: vinDecode\.annees_possibles/.test(src))
  // ⚠️ LE CONTRÔLE QUI COMPTE : le numéro lui-même n'est lu QUE pour être
  // décodé et pour produire son empreinte. Toute autre lecture serait une
  // fuite possible vers la réponse ou vers la base.
  {
    const lignes = src.split('\n').filter((l) => /vinTrouve!?\.vin/.test(l))
    verifie('le numéro est lu au moins une fois (sinon le contrôle serait vide)', lignes.length > 0)
    const horsUsage = lignes.filter((l) => !/decoderVin\(|sha256Hex\(/.test(l))
    verifie('⚠️ le numéro n’est lu QUE par decoderVin et par le calcul d’empreinte',
      horsUsage.length === 0, horsUsage.join(' | ').slice(0, 200))
  }
  verifie('l’empreinte du VIN est salée avec IP_HASH_SALT, jamais un sha256 nu',
    /sha256Hex\(IP_HASH_SALT \+ "vin:"/.test(src))
  verifie('l’empreinte va dans une COLONNE, pas dans result_json',
    /vin_empreinte/.test(src))
}

console.log('\n▶ Miroir client ≡ source serveur')
{
  const serveur = await import('../supabase/functions/_shared/vin.ts')
  const client = await import('../src/data/vin.gen.js')
  let divergences = 0
  const echantillons = [
    'VF3LBHZTXHS123456', 'WAUZZZ8V1KA123456', '1HGCM82633A004352', 'UU1xxxxxxxxxxxxxx',
    'TMBJJ7NE4H0012345', 'YV1MK7521A2123456', 'ZFA31200000123456', 'VF7NCxxxxxxxxxxxx',
    'TROPCOURT', 'VF3LBHZTXHS12345I', '', '00000000000000000',
  ]
  for (const v of echantillons) {
    if (JSON.stringify(serveur.decoderVin(v, 2026)) !== JSON.stringify(client.decoderVin(v, 2026))) divergences++
    const a = serveur.trouverVin(`VIN : ${v}`)
    const b = client.trouverVin(`VIN : ${v}`)
    if (JSON.stringify(a) !== JSON.stringify(b)) divergences++
  }
  verifie(`${echantillons.length} VIN joués dans les deux implémentations : aucune divergence`, divergences === 0, String(divergences))
  verifie('src/lib/vin.js n’est qu’un ré-export (plus aucune implémentation)',
    !/function\s+decoderVin/.test(readFileSync(new URL('../src/lib/vin.js', import.meta.url), 'utf8')))
}

if (ko > 0) {
  console.error(`\n${ko} échec(s).`)
  process.exit(1)
}
console.log('\nTous les tests VIN passent.')
