#!/usr/bin/env bash
# SPRINT 22 — Session d'écriture avec le jeton admin (une heure de vie).
#
# Enchaîne, dans l'ordre et en s'arrêtant au premier échec :
#   1. les sources trouvées par le rejeu au juge à vote (point 3) ;
#   2. les plans d'entretien du lot pilote (point 4) ;
#   3. les 4 références, AUSSITÔT, pendant que le jeton vit encore : si un
#      verdict bouge et qu'il faut revenir en arrière, `--restaurer` exige le
#      même jeton.
#
# Le mur de l'éval est le reste du budget du point 3 (0,85 € annoncés,
# 0,199 € dépensés par le rejeu).
#
# Usage : ADMIN_ACCESS_TOKEN posé dans .env.local, puis
#         bash scripts/session-jeton.sh
set -euo pipefail

grep -q '^ADMIN_ACCESS_TOKEN=' .env.local || { echo "ADMIN_ACCESS_TOKEN absent de .env.local"; exit 1; }

echo "▶ 1/3 — sources du rejeu (point 3)"
node scripts/resourcer-fiches.mjs --appliquer

echo "▶ 2/3 — plans d'entretien du pilote (point 4)"
node scripts/plans-entretien.mjs --appliquer

echo "▶ 3/3 — les 4 références"
npm run eval -- --cas audi-s7-intermediaire,308-puretech-complete,mercedes-2025-societe,revendeur-clio2-dci \
  --sans-stabilite --budget 0.65

echo
echo "⚠️ Si un verdict a bougé : node scripts/plans-entretien.mjs --restaurer (même jeton)."
echo "⚠️ Ensuite, RETIRER ADMIN_ACCESS_TOKEN de .env.local."
