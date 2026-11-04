#!/usr/bin/env bash
# Essai de migration SUR UNE COPIE LOCALE — plus jamais sur la prod.
#
# Jusqu'au sprint 13, l'essai en transaction annulée se faisait en collant du
# SQL dans l'éditeur du dashboard, donc contre la base de PRODUCTION. Depuis
# que Docker est là, la pile locale rejoue l'intégralité des migrations sur une
# base vide : c'est une vérification plus forte (l'historique complet doit
# passer, pas seulement les dernières) et sans aucun risque.
#
# Usage :
#   scripts/essai-local.sh            # rejoue toutes les migrations + l'essai
#   scripts/essai-local.sh --garder   # ne remet pas la base à zéro avant
set -euo pipefail

export PATH="$HOME/.docker/bin:/Applications/Docker.app/Contents/Resources/bin:$PATH"
command -v docker >/dev/null || { echo "docker introuvable. Lancer Docker Desktop."; exit 1; }
docker info >/dev/null 2>&1 || { echo "le démon Docker ne répond pas. Lancer Docker Desktop."; exit 1; }

cd "$(dirname "$0")/.."

if ! docker ps --format '{{.Names}}' | grep -q supabase_db; then
  echo "▶ démarrage de la pile locale (peut prendre plusieurs minutes la première fois)"
  npx supabase start
fi

if [ "${1:-}" != "--garder" ]; then
  echo "▶ remise à zéro et rejeu de TOUTES les migrations sur la base locale"
  npx supabase db reset
fi

CONTENEUR=$(docker ps --format '{{.Names}}' | grep -E 'supabase_db' | head -1)
SQL=$(mktemp -t essai-migration).sql
# Mode assertions : le reset ci-dessus a deja rejoue les migrations.
node scripts/essai-migration-annulee.mjs --assertions > "$SQL"
echo "▶ essai en transaction annulée : $(grep -c 'pg_temp.essai_verifie(' "$SQL") assertions"

# ON_ERROR_STOP : une assertion qui lève doit faire échouer le script, pas
# défiler dans la sortie. Même règle que partout ailleurs dans ce projet — un
# contrôle qui n'échoue pas bruyamment n'est pas un contrôle.
if docker exec -i "$CONTENEUR" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < "$SQL" > "$SQL.out" 2>&1; then
  grep -E 'controles_passes|ESSAI CONCLUANT' "$SQL.out" | head -3
  echo "✓ essai local CONCLUANT"
else
  echo "✗ ESSAI LOCAL EN ÉCHEC :"
  grep -E 'ERREUR|ERROR|ESSAI ECHOUE' -A 12 "$SQL.out" | head -30
  exit 1
fi
rm -f "$SQL" "$SQL.out"
