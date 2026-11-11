#!/usr/bin/env bash
# Session de jeton — étape (e) de la séquence des scores (11 nov. 2026).
# 1. écriture des couvertures RELUES par Utku ; 2. les 4 références × 3.
# Arrêt au premier échec. ⚠️ Retirer ADMIN_ACCESS_TOKEN de .env.local après.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▶ 1/2 — écriture des couvertures (docs/couvertures-proposees.json)"
node scripts/ecrire-couvertures.mjs --appliquer

echo "▶ 2/2 — les 4 références × 3"
npm run eval -- --cas audi-s7-intermediaire,308-puretech-complete,mercedes-2025-societe,revendeur-clio2-dci \
  --repetitions 3 --sans-stabilite --budget 1.20 --plafond-session 10

echo "✓ session (e) terminée — RETIRER ADMIN_ACCESS_TOKEN de .env.local"
