#!/usr/bin/env bash
# Session de jeton — point 3 (rappels étrangers et hors période).
# PRÉALABLES (sans jeton, annoncés au journal, faits AVANT) : BAREME_VERSION
# 11.15, déploiement de score et admin-defect-sheets (+ fonctions nommées par
# fonctions-a-redeployer.mjs).
# 1. 20U6/L8 → contexte ; JMK, NSC R/2018/151, 61DT02, 0D9F (aucune source portante)
#    → retirés des rappels ; 2. les 4 références × 3.
# ⚠️ Retirer ADMIN_ACCESS_TOKEN de .env.local après.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▶ 1/2 — 20U6/L8 → contexte ; JMK, NSC, 61DT02, 0D9F → retirés des rappels"
node scripts/qualifier-rappels.mjs --appliquer

echo "▶ 2/2 — les 4 références × 3"
npm run eval -- --cas audi-s7-intermediaire,308-puretech-complete,mercedes-2025-societe,revendeur-clio2-dci \
  --repetitions 3 --sans-stabilite --budget 1.20 --plafond-session 12.5

echo "✓ session terminée — RETIRER ADMIN_ACCESS_TOKEN de .env.local"
