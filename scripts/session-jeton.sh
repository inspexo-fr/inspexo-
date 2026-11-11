#!/usr/bin/env bash
# SPRINT 22 — Session d'écriture avec le jeton admin (une heure de vie).
#
# Enchaîne, dans l'ordre et en s'arrêtant au premier échec :
#   1. les sources trouvées par le rejeu au juge à vote (point 3) ;
#   2. les plans d'entretien du lot pilote (point 4) ;
#   3. les 4 références, AUSSITÔT, pendant que le jeton vit encore : si un
#      verdict bouge et qu'il faut revenir en arrière, `--restaurer` exige le
#      même jeton ;
#   4. la vérification indépendante (juge à vote + cache) des analyses RÉELLES
#      non encore vérifiées, mur 1,00 € (décision d'Utku du 8 nov. 2026), avec
#      le rapport et ce qui manque pour atteindre 30.
#
# Séquence des scores (décision d'Utku du 10 nov. 2026) : c'est le changement
# (a). Chaque changement est suivi des 4 références × 3 passages (mur 1,20 €,
# plafond de tests porté à 7 € pour la séquence).
#
# Usage : ADMIN_ACCESS_TOKEN posé dans .env.local, puis
#         bash scripts/session-jeton.sh
set -euo pipefail

grep -q '^ADMIN_ACCESS_TOKEN=' .env.local || { echo "ADMIN_ACCESS_TOKEN absent de .env.local"; exit 1; }

echo "▶ 1/4 — sources du rejeu (point 3)"
node scripts/resourcer-fiches.mjs --appliquer

echo "▶ 2/4 — plans d'entretien du pilote (point 4)"
node scripts/plans-entretien.mjs --appliquer

echo "▶ 3/4 — les 4 références"
npm run eval -- --cas audi-s7-intermediaire,308-puretech-complete,mercedes-2025-societe,revendeur-clio2-dci \
  --repetitions 3 --sans-stabilite --budget 1.20 --plafond-session 7

echo "▶ 4/4 — vérification indépendante des analyses réelles"
node scripts/verifier-analyses.mjs --depuis-admin --budget 1.00 --journal docs/verification-reelles-journal.json

echo
echo "⚠️ Si un verdict a bougé : node scripts/plans-entretien.mjs --restaurer (même jeton)."
echo "⚠️ Ensuite, RETIRER ADMIN_ACCESS_TOKEN de .env.local."
