# Verbheft : mes verbes allemands

Un carnet pour noter les verbes allemands appris au fil des leçons (Duolingo ou
autre). L'application affiche automatiquement leur conjugaison aux principaux temps.

- **Ajout rapide** : tape l'infinitif (`fahren`, `sich freuen`, `anrufen`,
  `Rad fahren`…). L'autocomplétion puise dans environ 8 400 verbes. En cas de
  faute de frappe, l'application propose des corrections (`shreiben` → `schreiben`).
- **Formes principales** : *fahren – fährt – fuhr – ist gefahren*, avec le type
  du verbe (faible, fort, mixte, modal, irrégulier) et l'auxiliaire.
- **Conjugaison complète** : Präsens, Perfekt, Präteritum, Futur I,
  Plusquamperfekt, Konjunktiv II (avec ou sans *würde*) et Imperativ. Les autres
  temps (Futur II, Konjunktiv I, Konjunktiv II passé) sont regroupés dans une
  section repliable. Les formes du présent dont le radical change sont surlignées.
- **Cas particuliers** : pronoms réfléchis à l'accusatif ou au datif, particules
  séparables (*ruft … an*), verbes à double emploi (*übersetzen*), choix entre
  *haben* et *sein*.
- **Carnet** : traduction, notes, recherche, tri et filtres (forts, faibles,
  avec *sein*…).
- **Sauvegarde** : export JSON (réimportable) et CSV (pour un tableur). L'import
  accepte aussi une simple liste de verbes, un par ligne, avec en option
  `verbe;traduction`.
- **Sur téléphone** : l'application s'installe sur l'écran d'accueil et
  fonctionne hors ligne (PWA).

Les verbes sont enregistrés dans le navigateur de l'appareil (`localStorage`).
Pour passer d'un appareil à l'autre, utilise l'export JSON puis l'import.

## Développement

```bash
npm install
npm run dev      # serveur de développement
npm test         # tests unitaires (Vitest)
npm run build    # typecheck + build de production dans dist/
npm run preview  # sert le build (service worker compris)
```

Organisation :

| Dossier | Contenu |
| --- | --- |
| `src/core/` | Moteur de conjugaison, sans dépendance au navigateur : analyse de la saisie, particules, auxiliaire, orthographe, corrections du dictionnaire |
| `src/ui/` | Vues (liste, fiche verbe), en TypeScript sans framework |
| `src/storage.ts`, `src/transfer.ts` | Carnet (localStorage), import et export |
| `sw/` | Modèle du service worker, complété au build par `vite.config.ts` |
| `tests/` | Tests sur le vrai dictionnaire |

### Le dictionnaire

Les formes conjuguées viennent de
[`german-verbs-dict`](https://github.com/RosaeNLG/rosaenlg/tree/master/packages/german-verbs-dict),
issu des données [Morphy](http://morphy.wolfganglezius.de/) et
[korrekturen.de](https://www.korrekturen.de/flexion/), sous licence
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

Le moteur corrige plusieurs défauts de ces données :

- **Ancienne orthographe** : *muß* devient *muss*, *läßt* devient *lässt*,
  *schloß* devient *schloss* (voir `src/core/orthography.ts`).
- **Verbes à particule** : certains sont mal marqués (*wiederholen*,
  *unterschreiben*, *kennenlernen*…). Le participe passé sert à trancher.
- **Verbes absents** : les composés comme *mitkommen* ou *herunterladen* sont
  reconstruits à partir du verbe de base.
- **Tables des verbes les plus fréquents** : auxiliaires, modaux et *wissen* sont
  vérifiés à la main (`src/core/overrides.ts`).
- **Auxiliaire** : le dictionnaire ne l'indique pas. Il est déduit de listes de
  verbes de mouvement et de changement d'état, et l'utilisateur peut le corriger
  pour chaque verbe.

## Déploiement

Le workflow `.github/workflows/deploy.yml` lance les tests et le build à chaque
push. Sur `main`, il publie aussi le site sur GitHub Pages. À activer une seule
fois : **Settings → Pages → Source : GitHub Actions**.

### Sur le VPS Hetzner

L'app est servie par un petit conteneur `caddy:2-alpine` (`deploy/`), sur le
réseau Docker `web`, derrière le Caddy principal du serveur
(`caddy-proxy-caddy-1`) qui gère le domaine et le HTTPS. Aucun port publié,
rien à installer sur l'hôte.

**Une seule fois :**

1. Chez Cloudflare, enregistrement `A` `languages` → `46.225.70.60`, en **DNS
   only** (nuage gris), sinon Caddy n'obtient pas de certificat.
2. Premier envoi : `./scripts/deploy.sh` (le `curl` final échoue tant que
   l'étape 3 n'est pas faite).
3. Ajouter **à la fin** du Caddyfile du proxy, sans toucher au reste :

   ```
   languages.clementsalin.com {
       reverse_proxy verbheft:80
   }
   ```

   puis recharger sans interrompre les autres sites :
   `docker exec caddy-proxy-caddy-1 caddy reload --config /etc/caddy/Caddyfile`.

**Ensuite, à chaque mise à jour :** `./scripts/deploy.sh`.
