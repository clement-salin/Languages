#!/usr/bin/env bash
# Déploiement manuel depuis le Mac.
#
# En temps normal il est inutile : fusionner une PR sur `main` suffit, la CI
# construit et déploie (.github/workflows/ci.yml). Ce script sert de
# secours, et pour la première mise en place (il envoie aussi
# docker-compose.yml, que la CI ne peut pas envoyer).
#
#   ./scripts/deploy.sh
#
# Configurable : DEPLOY_TARGET (défaut root@46.225.70.60),
#                DEPLOY_DIR    (défaut /root/languages)
set -euo pipefail

TARGET="${DEPLOY_TARGET:-root@46.225.70.60}"
REMOTE_DIR="${DEPLOY_DIR:-/root/languages}"

cd "$(dirname "$0")/.."

echo "→ Vérification (types, tests)"
npm run typecheck
npm test

echo "→ Construction de l'image"
# --platform est indispensable depuis un Mac à puce Apple : sans lui l'image
# sort en arm64 et refuse de démarrer sur le VPS (x86_64).
docker build --platform linux/amd64 -t languages .

echo "→ Envoi de l'image et de docker-compose.yml vers $TARGET"
ssh "$TARGET" "mkdir -p '$REMOTE_DIR'"
scp deploy/docker-compose.yml "$TARGET:$REMOTE_DIR/docker-compose.yml"
docker save languages | gzip | ssh "$TARGET" 'gunzip | docker load'

echo "→ Relance du conteneur"
ssh "$TARGET" "cd '$REMOTE_DIR' && docker compose up -d"

echo "→ Vérification depuis l'extérieur"
curl -sI --max-time 20 https://languages.clementsalin.com/ | head -1

echo "✓ En ligne."
