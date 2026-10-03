# Mettre Languages en ligne sur le VPS

L'app tourne dans un conteneur Docker `languages` (Node, sans dépendance), sur le réseau Docker `web`, derrière le Caddy principal du serveur (`caddy-proxy-caddy-1`), qui gère le domaine et le HTTPS. C'est le même montage que recettes (batch-cooking).

| Élément | Valeur |
| --- | --- |
| Dossier sur le VPS | `/root/languages/` : `docker-compose.yml`, `.env` |
| Conteneur | `languages`, port 8080, aucun port publié |
| Données | volume Docker `languages_languages-data` (base SQLite `languages.db`) — déclaré `languages-data` dans le compose, Docker le préfixe du nom du projet |
| Image | construite par la CI ou sur le Mac, envoyée par SSH, jamais construite sur le serveur |

Ce qui change par rapport à Verbheft : le conteneur `verbheft` ne faisait que servir des fichiers (`caddy:2-alpine`). Le nouveau conteneur sert les fichiers **et** la synchronisation (`/api/sync`), d'où un serveur Node et une base.

---

## Bascule depuis Verbheft (une seule fois)

> **Étapes 1 à 4 faites le 03/10/2026** : le VPS sert Languages, l'ancien conteneur `verbheft` est arrêté et `/root/verbheft` reste en place pour le retour en arrière. **Étape 6 (déploiement par la CI) faite et vérifiée le même jour. Restent les étapes 5 et 7.** La marche à suivre est gardée pour mémoire, et pour le retour en arrière.
>
> Ce qui a coincé, à ne pas refaire : les étapes 3 et 4 ont été faites **avant** l'étape 2. Caddy pointait alors vers un conteneur `languages` qui n'existait pas encore, et le site a répondu 502 jusqu'au premier envoi. Puis le conteneur a refusé de démarrer : `.env` contenait le jeton seul, sans `SYNC_TOKEN=` devant (voir « En cas de problème »).

Les étapes se font depuis le Mac, **dans l'ordre** : l'ancien conteneur `verbheft` continue de servir le site jusqu'à l'étape 4, ce qui permet de revenir en arrière à tout moment.

### 1. Le jeton de synchronisation, sur le VPS

Le jeton est le mot de passe que chaque appareil présente au serveur. Il ne passe ni par le dépôt ni par une session Claude.

```bash
ssh root@46.225.70.60
mkdir -p /root/languages && cd /root/languages
openssl rand -hex 24          # affiche un jeton : copie-le dans ton gestionnaire de mots de passe
nano .env                     # écrire une seule ligne : SYNC_TOKEN=<le jeton>
chmod 600 .env
```

Utiliser `nano`, pas `echo` : une commande `echo` resterait dans l'historique du shell.

La ligne doit commencer par `SYNC_TOKEN=` : un jeton collé seul n'est rattaché à aucune variable, et le conteneur refuse de démarrer.

### 2. Premier envoi, depuis le Mac

Docker Desktop doit être lancé sur le Mac.

```bash
./scripts/deploy.sh
```

Le script vérifie les types et les tests, construit l'image, envoie `docker-compose.yml` et l'image, puis démarre le conteneur `languages`. Le `curl` final répond encore avec l'ancien site : c'est normal, le proxy pointe toujours vers `verbheft`.

### 3. Pointer le domaine vers le nouveau conteneur

**Seulement une fois le conteneur `languages` démarré** (`ssh root@46.225.70.60 'docker ps --filter name=languages'` doit le montrer `Up`) : sinon le site répond 502.

Dans le Caddyfile du proxy, **modifier uniquement** le bloc `languages.clementsalin.com`, après une copie de sauvegarde :

```bash
ssh root@46.225.70.60
cp /opt/caddy-proxy/Caddyfile /opt/caddy-proxy/Caddyfile.bak-$(date +%F)
nano /opt/caddy-proxy/Caddyfile
```

```
languages.clementsalin.com {
    reverse_proxy languages:8080
}
```

(au lieu de `reverse_proxy verbheft:80`). Puis valider et **recharger, sans redémarrer** :

```bash
docker exec caddy-proxy-caddy-1 caddy validate --config /etc/caddy/Caddyfile
docker exec caddy-proxy-caddy-1 caddy reload --config /etc/caddy/Caddyfile
```

Vérifier ensuite que https://languages.clementsalin.com affiche « Languages », et que les autres sites (recettes, batucada.app, maudmyers.com, Pilates) répondent toujours.

### 4. Arrêter l'ancien conteneur

```bash
cd /root/verbheft && docker compose down
```

Le dossier `/root/verbheft` reste en place : il sert au retour en arrière (ci-dessous). Le supprimer une fois la nouvelle version éprouvée.

### 5. Sur chaque appareil

1. Ouvrir https://languages.clementsalin.com. Les verbes de Verbheft enregistrés **sur cet appareil** sont repris automatiquement au premier lancement.
2. Un bandeau « Une nouvelle version est disponible » peut apparaître : le toucher.
3. **Réglages → Synchronisation** : coller le jeton, Enregistrer.

Commencer par l'appareil qui a le carnet le plus complet. Si les deux appareils avaient des verbes, ils se réunissent : un même verbe ajouté des deux côtés n'apparaît qu'une fois.

Sur iPhone, l'app installée sur l'écran d'accueil garde son propre stockage, distinct de Safari : c'est **dans l'app installée** qu'il faut ouvrir Languages pour que ses verbes soient repris.

### 6. Déploiement automatique (CI)

> **Fait le 03/10/2026.** Vérifié en lançant le workflow à la main (Actions → Vérification et déploiement → Run workflow, sur `main`) : image construite, conteneur recréé, réponse 200.

Une fois ceci fait, fusionner une PR sur `main` met en ligne tout seul. Tant que ce n'est pas fait, la CI vérifie et construit, puis saute le déploiement avec un avertissement.

La clé de batch-cooking ne peut pas servir : une clé SSH n'a qu'une commande forcée, et la sienne relance batch-cooking. Il en faut une seconde.

```bash
# Sur le Mac
ssh-keygen -t ed25519 -f ~/.ssh/languages-deploy -N "" -C "languages-ci"
scp scripts/receive-deploy.sh root@46.225.70.60:/root/receive-deploy-languages.sh
ssh root@46.225.70.60 'chmod +x /root/receive-deploy-languages.sh'
cat ~/.ssh/languages-deploy.pub
```

Sur le VPS, ajouter à `/root/.ssh/authorized_keys` une ligne qui commence par la restriction, suivie de la clé publique affichée :

```
command="/root/receive-deploy-languages.sh",no-port-forwarding,no-agent-forwarding,no-pty,no-X11-forwarding ssh-ed25519 AAAA… languages-ci
```

Puis sur GitHub, dépôt Languages → **Settings → Secrets and variables → Actions → New repository secret** :

| Nom | Valeur |
| --- | --- |
| `DEPLOY_SSH_KEY` | le contenu de `~/.ssh/languages-deploy` (la clé **privée**, lignes `BEGIN`/`END` comprises) |
| `DEPLOY_KNOWN_HOSTS` | la sortie de `ssh-keyscan 46.225.70.60` (la même valeur que pour batch-cooking) |

Supprimer ensuite la clé privée du Mac si tu ne veux pas la garder : elle ne sert qu'à la CI.

### 7. Retirer GitHub Pages

Le workflow ne publie plus sur Pages, mais la dernière version publiée y reste en ligne. Dépôt → **Settings → Pages** → « Unpublish site » (ou passer la source à « None »).

---

## Mises à jour

Fusionner une PR sur `main`. En secours, ou quand `deploy/docker-compose.yml` a changé (la CI ne peut pas l'envoyer) : `./scripts/deploy.sh`.

**Attendre la fin d'un déploiement de la CI avant toute commande `docker compose` à la main** : les deux se sont déjà croisés sur batch-cooking et le conteneur s'est retrouvé renommé, introuvable pour Caddy.

## Retour en arrière vers Verbheft

```bash
cd /root/verbheft && docker compose up -d
```

puis remettre `reverse_proxy verbheft:80` dans le bloc du Caddyfile, valider et recharger comme à l'étape 3. Les verbes saisis entre-temps dans Languages restent dans IndexedDB ; ceux d'avant n'ont pas quitté l'ancien stockage (renommé `verbheft:verbs.backup`, mais pas effacé).

## Sauvegarde

Pas encore automatisée. Le risque est limité : l'app est local-first, chaque appareil garde tout le carnet, et le serveur n'est qu'un point de rendez-vous. Une copie s'obtient depuis l'app (**Réglages → Sauvegarder (JSON)**). Pour automatiser, reprendre `.github/workflows/backup.yml` de batch-cooking.

## En cas de problème

| Symptôme | Cause et remède |
| --- | --- |
| Le site répond **502**, et `docker logs caddy-proxy-caddy-1` montre `lookup languages … server misbehaving` | Le conteneur `languages` n'existe pas ou est arrêté. `docker ps -a --filter name=languages` ; s'il manque, `./scripts/deploy.sh` depuis le Mac. |
| `docker compose up` échoue avec `required variable SYNC_TOKEN is missing a value` | `.env` absent, ou jeton écrit sans `SYNC_TOKEN=` devant. Vérifier sans afficher le secret : `sed 's/=.*/=…/' /root/languages/.env` doit montrer `SYNC_TOKEN=…`. Corriger en gardant le même jeton : `sed -i '1s/^/SYNC_TOKEN=/' /root/languages/.env`. |
| Le conteneur redémarre en boucle | `docker logs --tail 50 languages`. Image construite en arm64 ? Construire avec `--platform linux/amd64` (déjà dans `scripts/deploy.sh`). |
| La CI est verte mais rien n'a changé en ligne | Étape « Mise en ligne » sautée : secrets `DEPLOY_SSH_KEY` / `DEPLOY_KNOWN_HOSTS` absents (étape 6). |
| « La synchronisation n'est pas configurée » dans l'app | `docker exec languages printenv SYNC_TOKEN` ne doit pas être vide. |
