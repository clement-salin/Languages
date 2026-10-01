#!/usr/bin/env bash
# Publie Verbheft sur le VPS Hetzner : tests, build, envoi de dist/, relance.
#
# Configurable : DEPLOY_TARGET (défaut root@46.225.70.60),
#                REMOTE_DIR (défaut /root/verbheft),
#                DEPLOY_URL (défaut https://languages.clementsalin.com/).
set -euo pipefail

TARGET="${DEPLOY_TARGET:-root@46.225.70.60}"
REMOTE_DIR="${REMOTE_DIR:-/root/verbheft}"
URL="${DEPLOY_URL:-https://languages.clementsalin.com/}"

cd "$(dirname "$0")/.."

npm test
npm run build

ssh "$TARGET" "mkdir -p '$REMOTE_DIR/dist'"
scp deploy/docker-compose.yml deploy/Caddyfile "$TARGET:$REMOTE_DIR/"

# Deux passes : les nouveaux fichiers d'abord, puis index.html et sw.js qui
# les référencent, et seulement alors la suppression des anciens. Un visiteur
# ne tombe jamais sur un index.html qui pointe vers un fichier absent.
rsync -az --exclude index.html --exclude sw.js dist/ "$TARGET:$REMOTE_DIR/dist/"
rsync -az --delete dist/ "$TARGET:$REMOTE_DIR/dist/"

# --force-recreate relit le Caddyfile s'il a changé ; sans données, le
# redémarrage ne dure qu'un instant.
ssh "$TARGET" "cd '$REMOTE_DIR' && docker compose up -d --force-recreate"

curl -sI --max-time 20 "$URL" | head -1
