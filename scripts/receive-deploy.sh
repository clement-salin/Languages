#!/bin/sh
# Commande forcée de la clé de déploiement de Languages, installée sur le
# VPS sous /root/receive-deploy-languages.sh (voir docs/deploiement.md).
#
# La clé utilisée par la CI n'ouvre pas un shell : elle ne peut exécuter que
# ce script. Si elle fuitait, elle ne permettrait que de redéployer l'app.
#
# Une clé n'a qu'une commande forcée : celle de batch-cooking ne peut donc
# pas servir ici, il en faut une seconde (voir docs/deploiement.md).

set -eu

# L'image arrive compressée sur l'entrée standard.
gunzip | docker load

cd /root/languages
docker compose up -d

# Les couches de l'image précédente ne servent plus et remplissent le disque.
docker image prune -f --filter dangling=true >/dev/null
