#!/usr/bin/env node
// SPRINT 22 — Relevé officiel des prix du contrôle technique (DGCCRF).
//
// Source : « Prix des contrôles techniques », jeu de données publié par les
// ministères économiques et financiers sur data.gouv.fr (Licence Ouverte 2.0),
// alimenté par les centres eux-mêmes et consultable sur
// prix.conso.gouv.fr/controle-technique. C'est la source officielle des prix
// des centres : on la lit, on ne recopie aucun comparateur.
//
// Ce script ne dépense rien (aucun appel IA). Il calcule, par énergie, le
// quart le moins cher (P25), la médiane et le quart le plus cher (P75) du prix
// de la visite pour une VOITURE PARTICULIÈRE, contre-visite exclue, et écrit
// la valeur à semer dans `config` (clé `ct_prix`).
//
// Usage : node scripts/releve-prix-ct.mjs [chemin.csv] > releve.json
// Sans chemin, le CSV est téléchargé (35 Mo).
import { readFileSync } from 'node:fs'

const SOURCE = 'https://www.data.gouv.fr/fr/datasets/prix-des-controles-techniques/'
const CSV = 'https://www.data.gouv.fr/api/1/datasets/r/63b62549-6c19-465f-a97c-2c65e9550d8a'

const texte = process.argv[2]
  ? readFileSync(process.argv[2], 'utf8')
  : await (await fetch(CSV)).text()

const lignes = texte.replace(/^﻿+/, '').split('\n')
const entete = lignes[0].split(';')
const ix = (n) => {
  const i = entete.indexOf(n)
  if (i < 0) { console.error(`colonne absente : ${n} — le format du jeu de données a changé`); process.exit(1) }
  return i
}
const iCat = ix('cat_vehicule_libelle'), iEn = ix('cat_energie_libelle'), iPrix = ix('prix_visite'), iMaj = ix('cct_update_date_time')

const ENERGIES = { Essence: 'essence', Diesel: 'diesel', Gaz: 'gaz', Hybride: 'hybride', Electrique: 'electrique' }
const groupes = { toutes: [] }
let majMax = ''
for (const l of lignes.slice(1)) {
  const c = l.split(';')
  if (c.length < entete.length || c[iCat] !== 'Voiture particulière') continue
  const p = Number(c[iPrix])
  // Un prix nul ou supérieur à 400 € pour une voiture est une saisie
  // erronée, pas un tarif : il n'entre pas dans le relevé.
  if (!(p > 0 && p < 400)) continue
  const e = ENERGIES[c[iEn]]
  if (!e) continue
  ;(groupes[e] ??= []).push(p)
  groupes.toutes.push(p)
  if (c[iMaj] > majMax) majMax = c[iMaj]
}

const q = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b)
  const i = (s.length - 1) * p, lo = Math.floor(i)
  return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo)
}
const energies = {}
for (const [k, xs] of Object.entries(groupes)) {
  energies[k] = { n: xs.length, p25: Math.round(q(xs, 0.25)), p50: Math.round(q(xs, 0.5)), p75: Math.round(q(xs, 0.75)) }
}
const [a, m, j] = majMax.slice(0, 10).split('-')
console.log(JSON.stringify({ maj: `${j}/${m}/${a}`, source: SOURCE, energies }, null, 1))
