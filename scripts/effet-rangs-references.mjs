#!/usr/bin/env node
// EFFET du filtre par hôte sur les cas de référence — CALCUL PUR, AUCUNE
// dépense, AUCUNE écriture.
//
// Reprend les FAITS réellement stockés (`result_json.recalcul.faits`), retire
// les pannes qu'aucune source officielle ou de presse ne porte, et rejoue
// `calculerAxes`. Mesuré le 6 nov. 2026 : S7, 308 et Clio II INCHANGÉS, la
// Mercedes monte de 71 à 77 — parce que ses deux seules pannes tombent et que
// l'axe passe alors à « aucun défaut documenté retenu », ce qui FLATTE.
//
//   node scripts/effet-rangs-references.mjs <fichier-refs.json>

import { readFileSync } from 'node:fs'
const { rangSource, sourcesPortentLEntree } =
  await import(new URL('../supabase/functions/_shared/atlasSource.ts', import.meta.url))
const { calculerAxes } = await import(new URL('../supabase/functions/_shared/bareme.ts', import.meta.url))
const refs = JSON.parse(readFileSync(process.argv[2] ?? 'refs.json', 'utf8'))

const urlsDe = (p) => {
  const u = []
  for (const s of (p.sources ?? [])) if (s?.url) u.push(s.url)
  for (const s of (Array.isArray(p.urls) ? p.urls : [])) if (typeof s === 'string') u.push(s)
  return [...new Set(u)]
}

const NOM = {
  aac21a7f: 'audi-s7-intermediaire',
  cf80299f: '308-puretech-complete',
  ad093b1d: 'mercedes-2025-societe',
  '18d57740': 'revendeur-clio2-dci',
}

for (const x of refs.sort((a, b) => (NOM[a.h] ?? '').localeCompare(NOM[b.h] ?? ''))) {
  const faits = x.faits
  const affichees = x.pannes ?? []
  if (!faits) { console.log(`\n${NOM[x.h]} : aucun bloc recalcul, non calculable`); continue }

  // Aligner `faits.pannes` (celles qui PÈSENT) sur `pannes_connues` (affichées),
  // dans l'ordre : la première est une sous-suite de la seconde.
  const pesent = []
  let i = 0
  for (const p of affichees) {
    if (i < faits.pannes.length && faits.pannes[i].gravite === (p.gravite ?? '')) { pesent.push(p); i++ }
  }
  const aligne = pesent.length === faits.pannes.length

  const tient = (p) => sourcesPortentLEntree(urlsDe(p))
  const gardees = pesent.filter(tient)
  const perdues = pesent.filter((p) => !tient(p))

  const avant = calculerAxes(faits)
  // ⚠️ SPRINT 21.1 — les pannes non portées ne DISPARAISSENT pas : elles sont
  // rétrogradées, et leur nombre plafonne l'axe à 10/20 tout en interdisant le
  // libellé « aucun défaut documenté ». Sans ce champ, le simple retrait
  // faisait MONTER le verdict.
  const apres = calculerAxes({
    ...faits,
    pannes: faits.pannes.filter((_, k) => tient(pesent[k] ?? {})),
    pannes_non_verifiables: perdues.length,
    // La gravité la plus élevée parmi les rétrogradées décide du plafond.
    pannes_non_verifiables_max_gravite: perdues
      .map((p) => String(p.gravite ?? 'mineure'))
      .reduce((a, b) => (({ mineure: 0, majeure: 1, casse: 2, securite: 3 }[b] ?? 0)
        > ({ mineure: 0, majeure: 1, casse: 2, securite: 3 }[a] ?? 0) ? b : a), 'mineure'),
  })

  console.log(`\n── ${NOM[x.h]}`)
  console.log(`   alignement faits/affichées : ${aligne ? 'exact' : '⚠️ APPROXIMATIF'} (${pesent.length}/${faits.pannes.length})`)
  const maxG = perdues.map((p) => String(p.gravite ?? 'mineure'))
    .reduce((a, b) => (({ mineure: 0, majeure: 1, casse: 2, securite: 3 }[b] ?? 0)
      > ({ mineure: 0, majeure: 1, casse: 2, securite: 3 }[a] ?? 0) ? b : a), 'mineure')
  console.log(`   pannes qui pèsent : ${pesent.length} → ${gardees.length} tiennent, ${perdues.length} tombent`
    + (perdues.length ? ` (plus grave rétrogradée : ${maxG} ⇒ plafond ${maxG === 'mineure' ? 13 : 10})` : ''))
  for (const p of perdues) {
    console.log(`     TOMBE  ${(p.titre ?? '').slice(0, 46).padEnd(48)} ${String(p.gravite).padEnd(9)} ${urlsDe(p).map(rangSource).join(',') || '(aucune source)'}`)
  }
  for (const p of gardees) {
    console.log(`     tient  ${(p.titre ?? '').slice(0, 46).padEnd(48)} ${String(p.gravite).padEnd(9)} ${urlsDe(p).map(rangSource).join(',')}`)
  }
  const a1 = avant.axes.risques_mecaniques, a2 = apres.axes.risques_mecaniques
  console.log(`   axe risques : ${a1.note} → ${a2.note}`)
  console.log(`   libellé     : ${String(a2.commentaire).slice(0, 120)}`)
  console.log(`   SCORE       : ${avant.verdict} ${avant.score}  →  ${apres.verdict} ${apres.score}   (${apres.score > avant.score ? '+' : ''}${apres.score - avant.score})`)
  if (avant.plafond_raison !== apres.plafond_raison) {
    console.log(`   plafond     : « ${avant.plafond_raison ?? 'aucun'} » → « ${apres.plafond_raison ?? 'aucun'} »`)
  }
}
