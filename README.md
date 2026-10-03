# Languages

Un carnet de langues personnel, en deux parties, avec une bascule rapide de
l'une à l'autre (barre latérale sur ordinateur, barre sous le pouce sur
téléphone). En ligne sur https://languages.clementsalin.com.

## Allemand : conjugaison

Le carnet des verbes appris au fil des leçons (anciennement **Verbheft**),
avec leur conjugaison automatique.

- **Ajout rapide** : tape l'infinitif (`fahren`, `sich freuen`, `anrufen`,
  `Rad fahren`…). L'autocomplétion puise dans environ 8 400 verbes. En cas de
  faute de frappe, l'application propose des corrections (`shreiben` → `schreiben`).
- **Formes principales** : *fahren – fährt – fuhr – ist gefahren*, avec le type
  du verbe (faible, fort, mixte, modal, irrégulier) et l'auxiliaire.
- **Conjugaison complète** : Präsens, Perfekt, Präteritum, Futur I,
  Plusquamperfekt, Konjunktiv II (avec ou sans *würde*) et Imperativ ; les
  autres temps dans une section repliable. Les formes du présent dont le
  radical change sont surlignées.
- **Cas particuliers** : pronoms réfléchis à l'accusatif ou au datif, particules
  séparables (*ruft … an*), verbes à double emploi (*übersetzen*), choix entre
  *haben* et *sein*.

## Anglais : phrasal verbs

*sit down*, *sit up*, *sit by*, *get over*… regroupés **par verbe** (tout ce
qui se construit sur *sit*) ou **par particule** (tout ce qui finit par *up*).

- Le sens et l'exemple sont saisis par toi : il n'existe pas de dictionnaire
  libre de phrasal verbs assez fiable, et l'app n'invente pas de traduction.
- Les formes des verbes irréguliers sont affichées (*sit – sat – sat*), à
  partir d'une table d'environ 150 verbes. Un verbe absent de la table n'est
  pas présumé régulier : aucune forme n'est alors affichée.

## Anglais : expressions

Idiomes et tournures figées (*break the ice*, *it's not my cup of tea*), avec
leur sens et un exemple, saisis par toi. Recherche dans l'expression, le sens
et l'exemple ; tri par date d'ajout ou alphabétique.

## Suggestion de traduction

Un bouton « Suggérer une traduction (DeepL) » sous les champs de traduction et
de sens propose une traduction en français ; elle ne remplit le champ que si
tu cliques sur « Utiliser ». Dans l'autre sens, pour l'allemand : tape le verbe
en français dans le champ traduction, et « Trouver le verbe allemand » propose
l'infinitif allemand, à condition qu'il soit dans le dictionnaire. Demande le réseau, le jeton de synchronisation et
une clé DeepL sur le serveur (`docs/deploiement.md`).

## Synchronisation et sauvegarde

- **Local-first** : le carnet est enregistré sur l'appareil (IndexedDB) et
  fonctionne hors ligne. Avec le jeton du serveur (Réglages), il s'échange tout
  seul entre le Mac et l'iPhone.
- **Sauvegarde** : export JSON de tout le carnet (réimportable), CSV des verbes
  allemands. L'import accepte aussi les sauvegardes de Verbheft et une simple
  liste de verbes, un par ligne, avec en option `verbe;traduction`.
- **Reprise de Verbheft** : les verbes de l'ancienne version sont repris
  automatiquement au premier lancement, sur chaque appareil.
- **Sur téléphone** : l'application s'installe sur l'écran d'accueil (PWA).

## Développement

```bash
npm install
npm run dev                       # http://localhost:5173
SYNC_TOKEN=un-secret npm run dev  # avec la synchronisation
npm test                          # tests (Vitest)
npm run typecheck
npm run build                     # dist/ (app) et dist-server/ (serveur)
npm start                         # serveur de production, après build
```

Organisation :

| Dossier | Contenu |
| --- | --- |
| `src/domain/de/` | Moteur de conjugaison, sans dépendance au navigateur : analyse de la saisie, particules, auxiliaire, orthographe, corrections du dictionnaire |
| `src/domain/en/` | Phrasal verbs (analyse, regroupement), expressions, table des verbes irréguliers |
| `src/domain/sync.ts` | Protocole de synchronisation, partagé par le navigateur et le serveur |
| `src/data/` | IndexedDB, dépôts, reprise de Verbheft, moteur de synchronisation |
| `src/pages/`, `src/components/` | Interface (React + Tailwind) |
| `server/` | Serveur de production : fichiers de l'app et `/api/sync` (SQLite) |
| `vite-plugins/` | Service worker et route de synchronisation en développement |
| `tests/` | Tests, dont le moteur sur le vrai dictionnaire |

### Le dictionnaire

Les formes conjuguées viennent de
[`german-verbs-dict`](https://github.com/RosaeNLG/rosaenlg/tree/master/packages/german-verbs-dict),
issu des données [Morphy](http://morphy.wolfganglezius.de/) et
[korrekturen.de](https://www.korrekturen.de/flexion/), sous licence
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

Le moteur corrige plusieurs défauts de ces données :

- **Ancienne orthographe** : *muß* devient *muss*, *läßt* devient *lässt*,
  *schloß* devient *schloss* (voir `src/domain/de/orthography.ts`).
- **Verbes à particule** : certains sont mal marqués (*wiederholen*,
  *unterschreiben*, *kennenlernen*…). Le participe passé sert à trancher.
- **Verbes absents** : les composés comme *mitkommen* ou *herunterladen* sont
  reconstruits à partir du verbe de base.
- **Tables des verbes les plus fréquents** : auxiliaires, modaux et *wissen* sont
  vérifiés à la main (`src/domain/de/overrides.ts`).
- **Auxiliaire** : le dictionnaire ne l'indique pas. Il est déduit de listes de
  verbes de mouvement et de changement d'état, et l'utilisateur peut le corriger
  pour chaque verbe.

## Déploiement

Conteneur Docker sur le VPS, derrière le Caddy principal du serveur. Fusionner
une PR sur `main` met en ligne (`.github/workflows/ci.yml`) ; en secours,
`./scripts/deploy.sh`. Marche à suivre complète, bascule depuis Verbheft
comprise : [`docs/deploiement.md`](./docs/deploiement.md).
