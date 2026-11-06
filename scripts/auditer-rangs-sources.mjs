#!/usr/bin/env node
// AUDIT EN LECTURE SEULE des rangs de sources — AUCUNE dépense, AUCUNE écriture.
//
// Applique `rangSource(url)` à toutes les sources des fiches moteur et des
// entrées d'atlas, et dit ce qui ne tiendrait plus si la règle du sprint 21
// (une entrée exige au moins une source officielle ou de presse) leur était
// appliquée.
//
// ⚠️ Il ne CHANGE RIEN. Lancé le 6 nov. 2026, il a trouvé que 12 % seulement
// des 219 pannes de fiches sont portées par une source officielle ou de
// presse, et que 28 fiches sur 44 n'en ont aucune.
//
// Les fiches sont lues depuis un dump JSON produit en lecture seule :
//   node scripts/auditer-rangs-sources.mjs <fichier-fiches.json>

import { readFileSync } from 'node:fs'
const { rangSource, sourcesPortentLEntree, coutUtilisable } =
  await import(new URL('../supabase/functions/_shared/atlasSource.ts', import.meta.url))
const fiches = JSON.parse(readFileSync(process.argv[2] ?? 'fiches.json', 'utf8'))
const { defectAtlas } = await import('../src/data/defectAtlas.js')

const urlsDe = (p) => {
  const u = []
  for (const s of (p.sources ?? [])) if (s?.url) u.push(s.url)
  for (const s of (p.url_source ?? [])) if (typeof s === 'string') u.push(s)
  if (typeof p.url_source === 'string') u.push(p.url_source)
  return [...new Set(u)]
}

const hotes = {}
const compterHote = (u, rang) => {
  let h = ''
  try { h = new URL(u).hostname.replace(/^www\./, '') } catch { h = '(illisible)' }
  hotes[h] = hotes[h] ?? { rang, n: 0 }
  hotes[h].n++
}

// ── Fiches moteur ───────────────────────────────────────────────────────────
const fichesTombent = []
const pannesTombent = []
const coutsDouteux = []
let totalPannes = 0, pannesPortees = 0
for (const f of fiches) {
  const pannes = Array.isArray(f.pannes) ? f.pannes : []
  let portees = 0
  for (const p of pannes) {
    totalPannes++
    const urls = urlsDe(p)
    for (const u of urls) compterHote(u, rangSource(u))
    const porte = sourcesPortentLEntree(urls)
    if (porte) { portees++; pannesPortees++ } else {
      pannesTombent.push({ fiche: `${f.marque} ${f.famille_moteur}`, titre: p.titre ?? p.title ?? '(sans titre)',
        gravite: p.gravite, rangs: urls.map(rangSource), n: urls.length })
    }
    const coutMax = Number(p.cout_max_eur ?? p.cout_indicatif_eur_max ?? 0)
    if (coutMax > 0 && !coutUtilisable(urls)) {
      coutsDouteux.push({ fiche: `${f.marque} ${f.famille_moteur}`, titre: (p.titre ?? '(sans titre)').slice(0, 54),
        gravite: p.gravite, cout: `${p.cout_min_eur ?? '?'}-${coutMax} €`, rangs: [...new Set(urls.map(rangSource))] })
    }
  }
  if (pannes.length > 0 && portees === 0) {
    fichesTombent.push({ fiche: `${f.marque} ${f.famille_moteur}`, pannes: pannes.length, statut: f.statut })
  }
}

// ── Les 10 entrées d'atlas antérieures au sprint 21 ─────────────────────────
const atlasTombent = []
const atlasCouts = []
let atlasTotal = 0
for (const [cle, bloc] of Object.entries(defectAtlas)) {
  for (const d of (bloc.defects ?? [])) {
    if (d.categorie) continue // ajoutée au sprint 21, déjà filtrée
    atlasTotal++
    const urls = urlsDe(d)
    for (const u of urls) compterHote(u, rangSource(u))
    if (!sourcesPortentLEntree(urls)) {
      atlasTombent.push({ cle, titre: d.title.slice(0, 52), gravite: d.gravite, rangs: urls.map(rangSource) })
    }
    const coutMax = Number(d.cout_max_eur ?? 0)
    if (coutMax > 0 && !coutUtilisable(urls)) {
      atlasCouts.push({ cle, titre: d.title.slice(0, 52), gravite: d.gravite,
        cout: `${d.cout_min_eur ?? '?'}-${coutMax} €`, rangs: [...new Set(urls.map(rangSource))] })
    }
  }
}

const pct = (a, b) => b === 0 ? '—' : `${Math.round((a / b) * 100)} %`
console.log(`FICHES MOTEUR — ${fiches.length} fiches, ${totalPannes} pannes`)
console.log(`  pannes portées par une source officielle ou de presse : ${pannesPortees}/${totalPannes} (${pct(pannesPortees, totalPannes)})`)
console.log(`  pannes qui ne tiendraient plus                        : ${pannesTombent.length}`)
console.log(`  FICHES ENTIÈREMENT à terre (aucune panne portée)      : ${fichesTombent.length}/${fiches.length}`)
console.log(`  coûts reposant sur une source non portante            : ${coutsDouteux.length}`)
console.log(`\nATLAS (10 entrées d'avant le sprint 21)`)
console.log(`  entrées qui ne tiendraient plus : ${atlasTombent.length}/${atlasTotal}`)
console.log(`  coûts non portants              : ${atlasCouts.length}`)

console.log('\n— FICHES ENTIÈREMENT À TERRE :')
for (const f of fichesTombent) console.log(`  ${f.fiche.padEnd(22)} ${f.pannes} panne(s) · ${f.statut}`)

console.log('\n— LES 10 ENTRÉES D’ATLAS :')
for (const a of atlasTombent) console.log(`  TOMBE  ${a.cle.padEnd(10)} ${a.titre.padEnd(54)} ${a.gravite.padEnd(9)} ${a.rangs.join(',') || '(aucune source)'}`)

console.log('\n— GRAVITÉS APPUYÉES SUR UN COÛT NON PORTANT (atlas) :')
for (const a of atlasCouts) console.log(`  ${a.cle.padEnd(10)} ${a.titre.padEnd(54)} ${a.gravite.padEnd(8)} ${a.cout.padEnd(14)} ${a.rangs.join(',')}`)

console.log('\n— GRAVITÉS APPUYÉES SUR UN COÛT NON PORTANT (fiches), les 20 premières :')
for (const c of coutsDouteux.slice(0, 20)) console.log(`  ${c.fiche.padEnd(20)} ${c.titre.padEnd(56)} ${c.gravite.padEnd(8)} ${c.cout.padEnd(14)} ${c.rangs.join(',')}`)
if (coutsDouteux.length > 20) console.log(`  … et ${coutsDouteux.length - 20} autres`)

console.log('\n— LES 25 HÔTES LES PLUS CITÉS, toutes sources confondues :')
const tri = Object.entries(hotes).sort((a, b) => b[1].n - a[1].n).slice(0, 25)
for (const [h, v] of tri) console.log(`  ${String(v.n).padStart(4)} ${v.rang.padEnd(12)} ${h}`)
const parRang = {}
for (const v of Object.values(hotes)) parRang[v.rang] = (parRang[v.rang] ?? 0) + v.n
console.log(`\n  répartition des citations : ${Object.entries(parRang).map(([k, v]) => `${k} ${v}`).join(' · ')}`)
