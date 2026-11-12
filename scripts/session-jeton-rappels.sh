#!/usr/bin/env bash
# Session de jeton — point 3 (rappels étrangers et hors période).
# PRÉALABLES (sans jeton, annoncés au journal, faits AVANT) : BAREME_VERSION
# 11.15, déploiement de score et admin-defect-sheets (+ fonctions nommées par
# fonctions-a-redeployer.mjs).
# 1. qualification « etranger » des 2 rappels relus ; 2. les 4 références × 3.
# ⚠️ Retirer ADMIN_ACCESS_TOKEN de .env.local après.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▶ 1/2 — rappels aux sources toutes étrangères → contexte (20U6/L8, 61DT02)"
node scripts/qualifier-rappels.mjs --appliquer

echo "▶ 2/2 — les 4 références × 3"
npm run eval -- --cas audi-s7-intermediaire,308-puretech-complete,mercedes-2025-societe,revendeur-clio2-dci \
  --repetitions 3 --sans-stabilite --budget 1.20 --plafond-session 12.5

echo "✓ session terminée — RETIRER ADMIN_ACCESS_TOKEN de .env.local"
