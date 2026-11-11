#!/usr/bin/env bash
# Session de jeton — étape (f) de la séquence des scores.
# PRÉALABLES (sans jeton, annoncés au journal, faits AVANT) : dump prod,
# migration 20261127120000 (prises_en_charge), BAREME_VERSION 11.14,
# déploiement de score, admin-defect-sheets, sheet-builder (+ fonctions du barème).
# 1. écriture de la fusion RELUE (docs/fusion-proposee.json) ; 2. les 4 références × 3.
# ⚠️ Retirer ADMIN_ACCESS_TOKEN de .env.local après.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▶ 1/2 — fusion relue (sources, nouvelles pannes, prises en charge, entretien)"
node scripts/fusionner-sources.mjs --appliquer

echo "▶ 2/2 — les 4 références × 3"
npm run eval -- --cas audi-s7-intermediaire,308-puretech-complete,mercedes-2025-societe,revendeur-clio2-dci \
  --repetitions 3 --sans-stabilite --budget 1.20 --plafond-session 10

echo "✓ session (f) terminée — RETIRER ADMIN_ACCESS_TOKEN de .env.local"
