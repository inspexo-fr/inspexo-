#!/usr/bin/env node
// SPRINT 23 — Table de correspondance : familles du fichier de sources
// externes → familles de l'atlas (fiches moteur en base).
//
// ⚠️ PAR LIBELLÉ ET PAR ANNÉES, PAS SEULEMENT PAR CODE (décision d'Utku du
// 10 nov. 2026). Beaucoup de clés ne portent pas de code moteur (« 1.4 TSI »,
// « 2.0 TDI ») : le code se déduit du libellé ET de la période, parce qu'un
// même nom commercial recouvre deux familles selon l'année (1.4 TSI : EA111
// jusqu'en 2012, EA211 ensuite). Une déduction ambiguë n'est pas faite.
//
// Aucune dépense, aucune écriture en base. Usage :
//   node scripts/correspondance-familles.mjs <fiches.json>   (sortie de sources-externes mode fiches)
// Écrit docs/correspondance-familles.json et imprime le résumé.
import { readFileSync, writeFileSync } from 'node:fs'

const SOURCE = 'docs/sources-moteurs-2026-11.json'
const SORTIE = 'docs/correspondance-familles.json'
const d = JSON.parse(readFileSync(SOURCE, 'utf8'))
const fiches = JSON.parse(readFileSync(process.argv[2], 'utf8')).fiches

const norm = (t) => String(t ?? '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]/g, '')

// ── 1. Codes moteur CONNUS (liste positive : une regex ouverte prendrait
//      « C4 » ou « A3 », qui sont des modèles, pour des moteurs). ──────────
const CODES = [
  'K9K', 'K4M', 'K4J', 'K7M', 'K7J', 'D4F', 'D7F', 'R9M', 'M9R', 'M9T', 'F4R', 'F9Q', 'H4D', 'H4M', 'H4B', 'H4BT', 'H4DT',
  'H5F', 'H5FT', 'H5H', 'H5HT', 'B4D', 'HR13', 'HR10', 'HR12', 'HR16', 'MR16DDT', 'MR20DE', 'MR20', 'MR16',
  'EB2', 'EB2F', 'EB2DT', 'EB2DTS', 'EB2ADTS', 'EP6', 'EP3', 'EC5', 'EC8', 'ET3', 'EW10', 'EW7', 'DV4', 'DV5', 'DV6',
  'DW8', 'DW10', 'DW12', 'TU1', 'TU3', 'TU5',
  'EA111', 'EA211', 'EA888', 'EA189', 'EA288', 'EA113', 'EA827', 'EA824', 'EA839', 'EA837', 'EA897', 'EA896', 'EA898', 'CRBC',
  'N47', 'N57', 'B47', 'B48', 'B38', 'B37', 'N13', 'N18', 'N20', 'N43', 'N46', 'N52', 'N53', 'N54', 'N55', 'N62', 'N63', 'S55',
  'M271', 'M272', 'M273', 'M274', 'M276', 'M282', 'M139', 'M254', 'M264', 'OM611', 'OM640', 'OM642', 'OM646', 'OM651',
  'OM607', 'OM608', 'OM626', 'OM654', 'OM656',
  '1KR', '1NR', '1ND', '1ZR', '2ZR', '1NZ', '2NR', '1AD', '2AD', 'M15A', 'K12B', 'K14C',
  'G3LC', 'G4FD', 'G4FJ', 'G4KD', 'G4LA', 'G4LC', 'G4LD', 'D4FB', 'D4FE', 'D4HA', 'D4204T', 'B4204T', 'D5244T', 'D4162T',
  'A14XER', 'A16XER', 'A17DTS', 'B16DTH', 'Z13DTH', 'B14XFT', 'F15DT', 'A13DTE',
  'FOX', 'SIGMA', 'DRAGON', 'TWINAIR', 'FIRE', 'MULTIJET', 'TJET',
  // Relevés sur les clés « non rattachées » du premier passage (10 nov. 2026).
  'OM607', 'HR12DDT', 'HR13DDT', 'HR09', 'N12', 'N14', 'N16', 'D4FD', 'U2', 'EA188', 'A14NET', 'B14NET', 'A20DTH',
  '8NR', '1WW', 'M20A', 'M260', 'M270', 'P10A2', 'L15B7', 'N16A', 'N16A1', 'R18', 'N22', '4B11', '4B12', '3A92', '4A92', '4N13', '4N14',
  'EJ20', 'EJ25', 'FB16', 'FB20', 'FB25', 'KAPPA', 'SMARTSTREAM', 'INGENIUM', 'ECOBLUE', 'SKYACTIV', 'MULTIAIR', 'FIREFLY',
]

// ── Un même moteur physique sous plusieurs codes : UNE fiche (code canonique).
// Sources de ces équivalences : les libellés du fichier eux-mêmes (« Nissan
// HR13DDT / Renault H5Ht / Mercedes M282 »). Une équivalence non écrite dans
// le fichier n'est pas ajoutée ici.
const EQUIV = {
  K9K: ['K9K', 'OM607'],
  H5FT: ['H5FT', 'H5F', 'HR12DDT', 'HR12'],
  H5HT: ['H5HT', 'H5H', 'HR13DDT', 'HR13', 'M282'],
  H4BT: ['H4BT', 'H4B', 'HR09'],
  DV6: ['DV6', 'D4162T'],
  EP6: ['EP6', 'N12', 'N14', 'N16', 'N18'],
  AD: ['1AD', '2AD'],
  U2: ['U2', 'D4FB', 'D4FD', 'D4FE'],
  MULTIJET: ['MULTIJET'],
  FB: ['FB16', 'FB20', 'FB25'],
  EJ: ['EJ20', 'EJ25'],
  '4B1': ['4B11', '4B12'],
  '4N1': ['4N13', '4N14'],
  '14NET': ['A14NET', 'B14NET'],
  FIRE: ['FIRE'],
}
const canonique = (c) => Object.entries(EQUIV).find(([, l]) => l.includes(c))?.[0] ?? c
// Ce que nos fiches appellent autrement (fiche → codes couverts).
const SYNONYMES = { FOX: ['FOX', '10ECOBOOST'], DRAGON: ['DRAGON', '15ECOBOOST', '12ECOBOOST'], SIGMA: ['SIGMA'], TWINAIR: ['TWINAIR'] }

// ── 2. Libellés commerciaux → code, BORNÉS PAR LES ANNÉES ────────────────────
// Chaque règle : marques, motif sur le libellé, et le code selon la période.
// `null` = ambigu sur la période : on ne devine pas.
const ALIAS = [
  { marques: /renault|dacia|nissan|mercedes/i, re: /1[.,]5\s*(blue\s*)?dci/i, code: () => 'K9K' },
  { marques: /renault|dacia/i, re: /1[.,]6\s*dci/i, code: () => 'R9M' },
  { marques: /renault|dacia|nissan/i, re: /0[.,]9\s*tce/i, code: () => 'H4BT' },
  { marques: /renault|dacia|nissan/i, re: /1[.,]0\s*(sce|tce)/i, code: () => 'H4D' },
  // ⚠️ « 1.2 TCe » n'est PAS toujours le H5Ft : avant 2012, le 1.2 TCe 100
  // est un D4Ft. Ambigu si la période chevauche.
  { marques: /renault|dacia|nissan/i, re: /1[.,]2\s*tce/i, code: (a) => (a.max <= 2012 ? 'D4F' : a.min >= 2012 ? 'H5FT' : null) },
  { marques: /renault|dacia|nissan|mercedes/i, re: /1[.,]3\s*tce/i, code: () => 'H5HT' },
  { marques: /peugeot|citro|ds|opel|toyota|fiat/i, re: /1[.,]2\s*(puretech|vti)/i, code: () => 'EB2' },
  { marques: /peugeot|citro|ds|opel|mini/i, re: /1[.,]6\s*thp/i, code: () => 'EP6' },
  { marques: /peugeot|citro|ds/i, re: /1[.,]6\s*vti\s*115/i, code: (a) => (a.min >= 2013 ? 'EC5' : null) },
  { marques: /peugeot|citro|ds/i, re: /1[.,]6\s*vti\s*120/i, code: () => 'EP6' },
  { marques: /peugeot|citro|ds|opel|ford|toyota|fiat/i, re: /1[.,]5\s*bluehdi/i, code: () => 'DV5' },
  { marques: /peugeot|citro|ds|ford|mini|volvo|toyota/i, re: /1[.,]6\s*(e-?)?(blue)?hdi|1[.,]6\s*tdci/i, code: () => 'DV6' },
  { marques: /peugeot|citro|ds/i, re: /2[.,]0\s*(blue)?hdi/i, code: () => 'DW10' },
  { marques: /volkswagen|audi|seat|skoda|cupra/i, re: /1[.,][24]\s*tsi/i, code: (a) => (a.max <= 2012 ? 'EA111' : a.min >= 2012 ? 'EA211' : null) },
  { marques: /volkswagen|audi|seat|skoda|cupra/i, re: /1[.,][05]\s*tsi/i, code: () => 'EA211' },
  { marques: /volkswagen|audi|seat|skoda|cupra/i, re: /(1[.,]8|2[.,]0)\s*tfsi|2[.,]0\s*tsi/i, code: () => 'EA888' },
  { marques: /volkswagen|audi|seat|skoda|cupra/i, re: /(1[.,]6|2[.,]0)\s*tdi/i, code: (a) => (a.max <= 2015 ? 'EA189' : a.min >= 2012 ? 'EA288' : null) },
  { marques: /ford/i, re: /1[.,]0\s*eco\s*boost/i, code: () => 'FOX' },
  { marques: /ford/i, re: /1[.,][25]\s*eco\s*boost/i, code: () => 'DRAGON' },
  { marques: /toyota|lexus/i, re: /1[.,]8\s*(hybrid|vvt)/i, code: () => '2ZR' },
  { marques: /ford|mazda|volvo|mini/i, re: /1[.,]6\s*(tdci|mz-?cd|d\b)/i, code: () => 'DV6' },
  { marques: /ford/i, re: /2[.,]0\s*tdci/i, code: () => 'DW10' },
  { marques: /fiat|alfa|jeep|opel|suzuki/i, re: /jtdm|multijet|cdti\s*1[.,]3/i, code: () => 'MULTIJET' },
  { marques: /fiat|jeep|alfa/i, re: /\bfire\b|500.*essence/i, code: () => 'FIRE' },
  { marques: /volkswagen|audi|seat|skoda/i, re: /\bpd\b|pumpe|injecteur-pompe/i, code: () => 'EA188' },
]

// ── 3. Ce qui n'est pas un moteur ────────────────────────────────────────────
const BOITE = /\b(haldex|4motion|4matic|xdrive|transfert|dsg|dq\d{3}|dl\d{3}|edc|dc4|easy[- ]?r|al4|dp0|eat\d|bmp6|etg|cvt|xtronic|dualogic|powershift|m32|mg5|7g[- ]?tronic|8hp|zf|aisin|tiptronic|s[- ]?tronic|bo[iî]te)\b/i
const ORGANE = /\b(ve|electrique|batterie|hybride rechargeable|phev|electronique|train|trains|suspension|hydractive|pneumatique|direction|airbag|rappel|rappels|carrosserie|climatisation|freinage|essieu|chassis|ch[aâ]ssis|corrosion)\b/i

const annees = (t) => {
  const ys = (String(t ?? '').match(/\b(19[89]\d|20[0-3]\d)\b/g) ?? []).map(Number)
  return ys.length ? { min: Math.min(...ys), max: Math.max(...ys) } : { min: 0, max: 9999 }
}

// ── 4. Familles du fichier ───────────────────────────────────────────────────
const familles = {}
for (const o of d.objets) {
  const f = (familles[o.famille] ??= { cle: o.famille, libelle: o.libelle_moteur, marques: new Set(), modeles: new Set(), types: {}, n: 0, groupe: o.groupe })
  f.n++; f.types[o.type] = (f.types[o.type] ?? 0) + 1
  for (const m of o.marques ?? []) f.marques.add(m)
  if (o.modeles_annees) f.modeles.add(o.modeles_annees)
}

// Codes courts portés par PLUSIEURS constructeurs : réservés à leurs marques.
// N16 est un BMW (Prince) ET un Honda (N16A, 1.6 i-DTEC).
const MARQUES_DU_CODE = {
  N12: /bmw|mini|peugeot|citro/i, N14: /bmw|mini|peugeot|citro/i, N16: /bmw|mini|peugeot|citro/i, N18: /bmw|mini|peugeot|citro/i,
  N13: /bmw|mini/i, N20: /bmw|mini/i, N43: /bmw/i, N46: /bmw/i, N47: /bmw|mini|toyota/i, N57: /bmw/i,
  B37: /bmw|mini/i, B38: /bmw|mini/i, B47: /bmw|mini|toyota/i, B48: /bmw|mini|toyota/i,
  N16A: /honda/i, N22: /honda/i, R18: /honda/i,
}
// ⚠️ DÉCISIONS D'UTKU DU 10 NOV. 2026 sur les trois clés non rattachées :
//   - Honda N16 : c'est le 1.6 i-DTEC (voir libelle_moteur) ; N16 est ambigu
//     avec BMW, LA MARQUE TRANCHE → code canonique N16A pour Honda ;
//   - Opel CDTI Astra J : fiche MODÈLE Astra J, pas une fiche moteur ;
//   - VAG V6 3.0 TDI : jamais tranché par code ; rattaché par modèle et
//     années, fiche modèle si la période chevauche.
const CODE_SELON_MARQUE = (code, marques) => (code === 'N16' && /honda/i.test(marques) ? 'N16A' : code)
const CLES_MODELE = { 'OPEL-CDTI-ASTRA-J': 'Opel Astra J', 'VAG-V6-3.0TDI': 'par modèle et années (V6 3.0 TDI)' }

const codesDuTexte = (t) => {
  const n = ' ' + String(t ?? '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]+/g, ' ') + ' '
  // Correspondance EXACTE ; un suffixe n'est admis que si le code finit par un
  // chiffre (N47D20 → N47). Sinon D4F (Renault) attrapait D4FB (Hyundai).
  return CODES.filter((c) => new RegExp(`\\s${c}${/\d$/.test(c) ? '[A-Z0-9]{0,3}' : ''}\\s`).test(n))
}

const lignes = []
for (const f of Object.values(familles)) {
  const texte = `${f.cle} ${f.libelle}`
  const marques = [...f.marques].join(' ')
  const per = annees([...f.modeles].join(' ') + ' ' + f.libelle)
  let codes = codesDuTexte(texte).map((c) => CODE_SELON_MARQUE(c, marques))
    .filter((c) => !MARQUES_DU_CODE[c] || MARQUES_DU_CODE[c].test(marques))
  const viaAlias = []
  for (const a of ALIAS) {
    if (!a.marques.test(marques + ' ' + f.cle)) continue
    if (!a.re.test(texte)) continue
    const c = a.code(per)
    if (c) viaAlias.push(c); else viaAlias.push(`AMBIGU(${a.re.source.slice(0, 18)})`)
  }
  codes = [...new Set([...codes, ...viaAlias.filter((c) => !c.startsWith('AMBIGU'))].map(canonique))]
  // Une ambiguïté de période ne compte pas quand la clé NOMME déjà son code.
  if (codesDuTexte(texte).length) viaAlias.splice(0, viaAlias.length, ...viaAlias.filter((c) => !c.startsWith('AMBIGU')))
  if (CLES_MODELE[f.cle]) codes = []
  const nature = CLES_MODELE[f.cle] ? 'modele'
    : ORGANE.test(texte) && codes.length === 0 ? 'organe'
    : BOITE.test(texte) && codes.length === 0 ? 'boite'
    : codes.length ? 'moteur' : 'non_rattachee'
  // Fiches en base compatibles (même règle de préfixe que la recherche de fiche).
  const enBase = []
  for (const c of codes) {
    const cn = norm(c)
    for (const fi of fiches) {
      const fn = fi.famille_norm || norm(fi.famille_moteur)
      const syn = (SYNONYMES[fn] ?? []).map(norm)
      const fc = norm(canonique(fn))
      if (fc === cn || fn === cn || (/\d$/.test(fn) && cn.startsWith(fn)) || (/\d$/.test(cn) && fn.startsWith(cn)) || syn.includes(cn)) enBase.push(`${fi.marque} ${fi.famille_moteur}`)
    }
  }
  lignes.push({
    cle: f.cle, groupe: f.groupe, nature, libelle: f.libelle, marques: [...f.marques],
    periode: per.min ? `${per.min}-${per.max}` : null, codes, ambigu: viaAlias.filter((c) => c.startsWith('AMBIGU')),
    fiches_en_base: [...new Set(enBase)], objets: f.n, types: f.types,
  })
}

// ── 5. Regroupement des clés qui se recoupent (même code) ───────────────────
const parent = Object.fromEntries(lignes.map((l) => [l.cle, l.cle]))
const racine = (k) => (parent[k] === k ? k : (parent[k] = racine(parent[k])))
const parCode = {}
for (const l of lignes) for (const c of l.codes) (parCode[c] ??= []).push(l.cle)
for (const cles of Object.values(parCode)) for (const k of cles.slice(1)) parent[racine(k)] = racine(cles[0])
const groupes = {}
for (const l of lignes) (groupes[racine(l.cle)] ??= []).push(l.cle)

// ── 6. Fiches à créer : codes moteur sans fiche en base ─────────────────────
const codesSansFiche = {}
for (const l of lignes.filter((x) => x.nature === 'moteur')) {
  for (const c of l.codes) {
    const couvert = l.fiches_en_base.some((fb) => {
      const fn = norm(fb.split(' ').slice(1).join(' '))
      const cn = norm(c)
      return norm(canonique(fn)) === cn || fn === cn || (/\d$/.test(fn) && cn.startsWith(fn)) || (/\d$/.test(cn) && fn.startsWith(cn)) || (SYNONYMES[fn] ?? []).map(norm).includes(cn)
    })
    if (!couvert) (codesSansFiche[c] ??= { cles: new Set(), marques: new Set(), objets: 0 })
    if (!couvert) { codesSansFiche[c].cles.add(l.cle); l.marques.forEach((m) => codesSansFiche[c].marques.add(m)); codesSansFiche[c].objets += l.objets }
  }
}

const sortie = {
  genere_le: new Date().toISOString().slice(0, 10),
  source: SOURCE,
  fiches_en_base: fiches.length,
  lignes: lignes.sort((a, b) => a.groupe.localeCompare(b.groupe) || a.cle.localeCompare(b.cle)),
  groupes_de_cles: Object.values(groupes).filter((g) => g.length > 1),
  moteurs_sans_fiche: Object.fromEntries(Object.entries(codesSansFiche).sort((a, b) => b[1].objets - a[1].objets)
    .map(([c, v]) => [c, { cles: [...v.cles], marques: [...v.marques], objets: v.objets }])),
}
writeFileSync(SORTIE, JSON.stringify(sortie, null, 1))

// Version lisible de la table.
const md = ['# Correspondance des familles — sources-moteurs-2026-11', '',
  `Générée le ${sortie.genere_le} par \`scripts/correspondance-familles.mjs\` · ${fiches.length} fiches en base.`, '',
  '| Clé du fichier | Nature | Codes déduits | Période | Fiche en base | Objets |', '|---|---|---|---|---|---|',
  ...sortie.lignes.map((l) => `| ${l.cle} | ${l.nature} | ${l.codes.join(', ') || '—'}${l.ambigu.length ? ' (ambigu)' : ''} | ${l.periode ?? '—'} | ${l.fiches_en_base.join(', ') || '**aucune**'} | ${l.objets} |`),
  '', '## Moteurs sans fiche', '', '| Code canonique | Objets | Marques | Clés |', '|---|---|---|---|',
  ...Object.entries(sortie.moteurs_sans_fiche).map(([c, v]) => `| ${c} | ${v.objets} | ${v.marques.join(', ')} | ${v.cles.join(', ')} |`)]
writeFileSync('docs/correspondance-familles.md', md.join('\n') + '\n')

const compte = (n) => lignes.filter((l) => l.nature === n)
console.log(`${lignes.length} clés · moteur ${compte('moteur').length} · boîte ${compte('boite').length} · organe ${compte('organe').length} · non rattachées ${compte('non_rattachee').length}`)
console.log(`clés moteur rattachées à une fiche en base : ${compte('moteur').filter((l) => l.fiches_en_base.length).length}`)
console.log(`groupes de clés qui se recoupent : ${sortie.groupes_de_cles.length}`)
for (const g of sortie.groupes_de_cles.slice(0, 12)) console.log('   ', g.join('  +  '))
console.log(`\nMOTEURS SANS FICHE (fiches à créer) : ${Object.keys(sortie.moteurs_sans_fiche).length}`)
for (const [c, v] of Object.entries(sortie.moteurs_sans_fiche)) console.log(`   ${c.padEnd(8)} ${String(v.objets).padStart(3)} objets  ${v.marques.join('/')}`)
const amb = lignes.filter((l) => l.ambigu.length)
if (amb.length) console.log(`\nAMBIGUËS (période à cheval, non devinées) : ${amb.map((l) => l.cle).join(' ')}`)
console.log(`\nBOÎTES : ${compte('boite').map((l) => l.cle).join(' ')}`)
console.log(`\nORGANES : ${compte('organe').map((l) => l.cle).join(' ')}`)
console.log(`\nNON RATTACHÉES : ${compte('non_rattachee').map((l) => l.cle).join(' ')}`)
console.log(`\n→ ${SORTIE}`)
