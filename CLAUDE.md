# CLAUDE.md

Instructions et contexte pour toute session Claude Code travaillant sur ce projet.

## Projet

**Languages** (anciennement **Verbheft**) : carnet de langues personnel, mono-utilisateur, en deux parties — **allemand** (conjugaison des verbes appris au fil des leçons) et **anglais** (phrasal verbs : *sit down*, *sit by*…). PWA installée sur Mac et iPhone, utilisable hors ligne, synchronisée entre appareils. Le README décrit les fonctionnalités et les corrections apportées au dictionnaire ; ce fichier fait foi sur les décisions techniques et le déploiement.

En ligne sur **https://languages.clementsalin.com** depuis le 01/10/2026 (Verbheft) ; refonte en Languages le 03/10/2026.

## Stack — même architecture que batch-cooking

Décidé le 03/10/2026 : reprendre l'architecture de batch-cooking (`clement-salin/batch-cooking-app`), pour n'avoir qu'une façon de faire sur les deux projets.

- **Vite + React + TypeScript + Tailwind CSS v4**, routage par react-router (`src/App.tsx`), adresses réelles (`/de/fahren`, `/en/verbe/sit`) : le serveur rend `index.html` pour toute adresse inconnue.
- **Stockage** : IndexedDB via `idb` (`src/data/db.ts`), **derrière des dépôts** (`de-verbs.ts`, `en-phrasals.ts`, générique : `collection.ts`). Aucune page n'accède au stockage directement.
- **Synchronisation local-first**, reprise de batch-cooking : le navigateur fait foi, le serveur est un point de rendez-vous. Collections : `deVerbs`, `enPhrasals`.
- **Dictionnaire allemand** : `german-verbs-dict` (~8 400 verbes, 5,5 Mo de JSON), chargé par `src/data/lexicon.ts` **seulement quand une page allemande le demande** (`useLexicon`). Fichier séparé (`assetsInlineLimit: 0`), jamais inliné, précaché par le service worker.
- **Serveur** : `server/main.ts`, Node **sans aucune dépendance** (SQLite fourni par `node:sqlite`). Ne pas y ajouter de paquet sans raison forte.
- **Service worker** : écrit à la main, produit par `vite-plugins/service-worker.ts`. Une nouvelle version attend que l'utilisateur accepte le bandeau.
- **Tests** : Vitest (`tests/`), dont le moteur de conjugaison sur le vrai dictionnaire et la couche IndexedDB (`fake-indexeddb`).

`src/domain/` ne dépend pas du navigateur : c'est ce qui le rend testable, et `src/domain/sync.ts` est importé aussi par le serveur. Ne pas y introduire d'accès au DOM, à IndexedDB ni à `localStorage`.

### Fichiers communs avec batch-cooking

Copiés, pas partagés par une bibliothèque commune (deux projets personnels : une bibliothèque coûterait plus qu'elle ne rapporte). Une correction faite d'un côté est à reporter de l'autre.

| Ici | Là-bas | Différence |
| --- | --- | --- |
| `src/domain/sync.ts` | idem | liste `SYNCABLE_COLLECTIONS` |
| `src/data/sync.ts` | idem | état affiché (`SyncState`), écoute des écritures locales |
| `src/data/sync-source.ts` | `indexedDbSyncSource` | magasins |
| `server/sync-store.ts` | idem | sans `writeOwn` ni reprise de schéma |
| `server/main.ts` | idem | sans import, photos ni cantine |
| `vite-plugins/service-worker.ts` | idem | sans photos |
| `src/pwa.ts` | idem | — |

### Synchronisation : ce qu'il faut savoir

- **Ajouter une collection** : l'inscrire dans `SYNCABLE_COLLECTIONS`, créer son magasin et son magasin de traces dans `upgrade` (`src/data/db.ts`, en montant `DB_VERSION`), l'ajouter à `TOMBSTONE_STORES` et à la transaction de `sync-source.ts`. Rien à changer côté serveur. Le piège de la date unique de dernier échange est déjà paré (`requestSince`).
- **Identifiants déterministes** : un verbe allemand a pour identifiant son infinitif (`sich freuen`), un phrasal verb son expression (`sit down`). Deux appareils qui ajoutent le même mot désignent le même enregistrement. Conséquence : le verbe et la particule d'un phrasal verb ne se modifient pas (ils font l'identifiant) ; on supprime et on recrée.
- **La synchronisation est éteinte tant que `SYNC_TOKEN` est absent du serveur.** Ne jamais l'ouvrir par défaut.
- **`/api/` n'est jamais mis en cache** par le service worker : une réponse de synchronisation rejouée fausserait l'état des appareils.

### Reprise de Verbheft

Verbheft rangeait le carnet dans `localStorage` (`verbheft:verbs`). `src/data/legacy-migration.ts` le reprend **une seule fois** (marque `legacy-migration` dans la base : rejouée, la reprise ferait revenir un verbe supprimé depuis), sans écraser un verbe présent, puis renomme l'ancienne clé en `verbheft:verbs.backup` sans l'effacer. Les anciennes adresses `#/verbe/<infinitif>` redirigent (`src/legacy-redirect.ts`, importé **en premier** par `main.tsx` : le routeur lit l'adresse dès l'import de `App.tsx`).

## Interface

- **Deux parties, une bascule** (`src/components/LanguageSwitch.tsx`) : en tête de barre latérale sur grand écran, en barre fixe sous le pouce sur téléphone (bascule à 1024 px, `AppShell`). Elle ramène à la dernière page vue dans l'autre langue (`src/language.ts`).
- **Les sections d'une langue ne deviennent des onglets sur téléphone qu'à partir de deux** : un onglet unique serait un contrôle qui ne mène nulle part. Pour l'instant : Conjugaison (allemand), Phrasal verbs (anglais).
- **Accent par langue** : brique pour l'allemand, bleu marine pour l'anglais, posés par `data-lang` sur la coquille (`src/index.css`). Les composants n'écrivent que `accent`, `accent-text`, `accent-soft`.
- **Jamais de couleur en dur dans un composant** : ajouter un jeton dans `src/index.css`. Seule exception, la bascule, qui montre les deux langues à la fois.
- Drapeaux en SVG (`Flag.tsx`), pas en emoji : un emoji drapeau s'affiche en lettres sous Windows.
- **L'app propose, elle n'invente pas** : aucun sens de phrasal verb n'est deviné, aucune forme anglaise n'est déduite d'une règle (seule la table des irréguliers fait foi).
- Action principale : bouton flottant sur téléphone (`FloatingAction`), bouton d'en-tête sur grand écran.
- **Style non arrêté** : la maquette validée sur la structure est https://claude.ai/artifact/Bz8QKJbV4rrudhSFm55qVq (palette reprise de recettes). Deux autres styles y sont proposés (« Nuit d'encre », « Affiche suisse ») ; le choix est reporté. Tout passe par les jetons de `src/index.css` pour qu'en changer ne touche aucun composant.

## Commandes

```bash
npm install
npm run dev                       # http://localhost:5173
SYNC_TOKEN=un-secret npm run dev  # avec la synchronisation (base dans ./data/)
npm test
npm run typecheck
npm run build                     # typecheck + dist/ + dist-server/
./scripts/deploy.sh               # déploiement manuel (secours)
```

Avant de proposer un commit : `npm run typecheck && npm test`.

## Déploiement — VPS Hetzner

| Élément | Valeur |
| --- | --- |
| Serveur | `root@46.225.70.60` (`clement-ubuntu-4gb-DE`), partagé avec d'autres sites |
| Domaine | `languages.clementsalin.com`, enregistrement `A` chez Cloudflare, **nuage gris** |
| Sur le VPS | `/root/languages/` : `docker-compose.yml`, `.env` (`SYNC_TOKEN`) |
| Conteneur | `languages`, image `languages:latest` (Node), port 8080, réseau Docker `web`, aucun port publié |
| Données | volume `languages-data` (SQLite) |
| Proxy | conteneur `caddy-proxy-caddy-1`, config dans `/opt/caddy-proxy/Caddyfile` : `reverse_proxy languages:8080` |

**Fusionner une PR sur `main` déploie** (`.github/workflows/ci.yml`) : vérification, construction de l'image, envoi par SSH avec une clé restreinte à `scripts/receive-deploy.sh` (installé sous `/root/receive-deploy-languages.sh`). Tant que les secrets `DEPLOY_SSH_KEY` et `DEPLOY_KNOWN_HOSTS` manquent, la CI saute le déploiement avec un avertissement. `./scripts/deploy.sh` fait la même chose depuis le Mac et envoie aussi `deploy/docker-compose.yml`, que la CI ne peut pas envoyer.

**Bascule depuis Verbheft, retour en arrière, mise en place de la CI** : [`docs/deploiement.md`](./docs/deploiement.md). À la date du 03/10/2026, la bascule n'est **pas encore faite** : le VPS sert toujours l'ancien conteneur `verbheft` (`caddy:2-alpine`, `/root/verbheft/`).

**GitHub Pages est abandonné** (décidé le 03/10/2026) : l'app a besoin de son serveur, qu'une copie statique n'aurait pas, et la copie gardait son propre carnet. Le workflow ne publie plus ; reste à dépublier dans Settings → Pages.

### Règles pour le serveur partagé

Le VPS héberge aussi recettes (batch-cooking), batucada.app, maudmyers.com et les sites Pilates.

- **Ne jamais écraser `/opt/caddy-proxy/Caddyfile`** : on y ajoute ou modifie un bloc, après une copie `Caddyfile.bak-<date>`. Une sauvegarde du 01/10/2026 est sur place.
- **Recharger, ne jamais redémarrer le proxy** : `docker exec caddy-proxy-caddy-1 caddy validate --config /etc/caddy/Caddyfile`, puis `caddy reload` avec les mêmes arguments.
- **Jamais `127.0.0.1`** dans un `reverse_proxy` : depuis le conteneur Caddy, c'est Caddy lui-même. On vise le nom du conteneur sur le réseau `web`.
- L'avertissement `Caddyfile input is not formatted` au rechargement vient d'un bloc préexistant (site Pilates) ; il est sans effet. Ne pas lancer `caddy fmt --overwrite` sur le fichier des autres sites sans le demander.
- Après une modification du proxy, vérifier que les autres sites répondent toujours.
- **Attendre la fin d'un déploiement de la CI avant toute commande `docker compose` à la main** : sur batch-cooking, les deux se sont croisés et le conteneur s'est retrouvé renommé, introuvable pour Caddy.

### À savoir

- Le dépôt GitHub est cloné en **HTTPS** : en SSH, la clé d'hôte de GitHub n'est pas connue sur le Mac. Pour un `git push` qui réclamerait un mot de passe : `gh auth setup-git`.
- Un enregistrement DNS fraîchement créé peut rester introuvable sur le Mac (réponse négative en cache) alors que Cloudflare répond déjà. Vérifier avec `dig +short @1.1.1.1 languages.clementsalin.com`, et tester avec `curl --resolve languages.clementsalin.com:443:46.225.70.60 …`.
- **Depuis un Mac à puce Apple, construire l'image avec `--platform linux/amd64`** (déjà dans `scripts/deploy.sh`) : sinon le conteneur refuse de démarrer sur le VPS.
- Le `fetch` de Node ne lit pas le proxy des sessions cloud ; sans objet ici tant que le serveur ne télécharge rien.

## Reste ouvert

- **Style graphique** : à choisir sur la maquette (voir Interface).
- **Sauvegarde automatique de la base** : absente. Risque limité (chaque appareil garde tout le carnet), à reprendre de `.github/workflows/backup.yml` de batch-cooking si besoin.
- Nouvelles sections par langue : chacune ajoute une entrée dans `SECTIONS` (`AppShell.tsx`), une route, et — si elle stocke des données — une collection synchronisée.
