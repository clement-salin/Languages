# CLAUDE.md

Instructions et contexte pour toute session Claude Code travaillant sur ce projet.

## Projet

**Verbheft** : carnet personnel de verbes allemands appris au fil des leçons, avec conjugaison automatique. PWA mono-utilisateur, utilisable hors ligne, installée sur Mac et iPhone. Le README décrit les fonctionnalités et les corrections apportées au dictionnaire ; ce fichier fait foi sur les décisions techniques et le déploiement.

En ligne sur **https://languages.clementsalin.com** depuis le 01/10/2026.

## Stack

- **Vite + TypeScript, sans framework.** Les vues construisent le DOM via `h()` (`src/ui/dom.ts`).
- **Routage par `#`** (`src/ui/router.ts`) : aucune réécriture d'adresse n'est nécessaire côté serveur, un simple serveur de fichiers suffit.
- **Stockage** : `localStorage` (`src/storage.ts`). Aucun serveur, aucune synchronisation : le passage d'un appareil à l'autre se fait par export/import JSON.
- **Dictionnaire** : `german-verbs-dict` (~8 400 verbes, 5,5 Mo de JSON), chargé au démarrage par `src/lexicon.ts`. Il reste un fichier séparé (`assetsInlineLimit: 0`), jamais inliné dans le JS.
- **Service worker** : `sw/sw.template.js`, complété au build par le plugin de `vite.config.ts` (version = empreinte des fichiers, liste à précacher).
- **Tests** : Vitest, sur le vrai dictionnaire (`tests/`).

`src/core/` ne dépend pas du navigateur : c'est ce qui le rend testable. Ne pas y introduire d'accès au DOM ni à `localStorage`.

## Commandes

```bash
npm install
npm run dev          # http://localhost:5173
npm test
npm run build        # typecheck + dist/
./scripts/deploy.sh  # tests, build, mise en ligne sur le VPS
```

## Déploiement — VPS Hetzner

| Élément | Valeur |
| --- | --- |
| Serveur | `root@46.225.70.60` (`clement-ubuntu-4gb-DE`), partagé avec d'autres sites |
| Domaine | `languages.clementsalin.com`, enregistrement `A` chez Cloudflare, **nuage gris** |
| Sur le VPS | `/root/verbheft/` : `docker-compose.yml`, `Caddyfile`, `dist/` |
| Conteneur | `verbheft`, image `caddy:2-alpine`, réseau Docker `web`, aucun port publié |
| Proxy | conteneur `caddy-proxy-caddy-1`, config dans `/opt/caddy-proxy/Caddyfile` |

Chaîne : Caddy principal (HTTPS, Let's Encrypt) → `reverse_proxy verbheft:80` → Caddy interne (`deploy/Caddyfile`) qui sert `dist/`.

**Mettre à jour = `./scripts/deploy.sh`**, rien d'autre. Le script envoie `dist/` en deux passes (nouveaux fichiers, puis `index.html`/`sw.js`, puis suppression des anciens) pour qu'aucun visiteur ne reçoive un `index.html` pointant vers un fichier absent, et recrée le conteneur pour relire le `Caddyfile`.

**En-têtes de cache** (`deploy/Caddyfile`) : `assets/*` est nommé d'après son contenu, donc en cache permanent ; tout le reste (`index.html`, `sw.js`, manifeste) est en `no-cache`. Ne jamais mettre `sw.js` en cache longue durée : les mises à jour n'arriveraient plus.

### Règles pour le serveur partagé

Le VPS héberge aussi recettes (batch-cooking), batucada.app, maudmyers.com et les sites Pilates.

- **Ne jamais écraser `/opt/caddy-proxy/Caddyfile`** : on y ajoute ou modifie un bloc, après une copie `Caddyfile.bak-<date>`. Une sauvegarde du 01/10/2026 est sur place.
- **Recharger, ne jamais redémarrer le proxy** : `docker exec caddy-proxy-caddy-1 caddy validate --config /etc/caddy/Caddyfile`, puis `caddy reload` avec les mêmes arguments.
- **Jamais `127.0.0.1`** dans un `reverse_proxy` : depuis le conteneur Caddy, c'est Caddy lui-même. On vise le nom du conteneur sur le réseau `web`.
- L'avertissement `Caddyfile input is not formatted` au rechargement vient d'un bloc préexistant (site Pilates) ; il est sans effet. Ne pas lancer `caddy fmt --overwrite` sur le fichier des autres sites sans le demander.
- Après une modification du proxy, vérifier que les autres sites répondent toujours.

### À savoir

- Le dépôt GitHub est cloné en **HTTPS** : en SSH, la clé d'hôte de GitHub n'est pas connue sur le Mac. Pour un `git push` qui réclamerait un mot de passe : `gh auth setup-git`.
- Un enregistrement DNS fraîchement créé peut rester introuvable sur le Mac (réponse négative en cache) alors que Cloudflare répond déjà. Vérifier avec `dig +short @1.1.1.1 languages.clementsalin.com`, et tester avec `curl --resolve languages.clementsalin.com:443:46.225.70.60 …`.
- **GitHub Pages** : le workflow `.github/workflows/deploy.yml` lance les tests à chaque push et publie aussi sur GitHub Pages depuis `main`. C'est une seconde copie, indépendante du VPS, active sur https://clement-salin.github.io/Languages/ (vérifié le 01/10/2026). Le carnet étant dans `localStorage`, les deux adresses ont chacune le leur. Non tranché : la garder ou retirer les étapes Pages.
