#!/bin/sh
# Commande forcée de la clé de déploiement de Languages, installée sur le
# VPS sous /root/receive-deploy-languages.sh (voir docs/deploiement.md).
#
# La clé utilisée par la CI n'ouvre pas un shell : elle ne peut exécuter que
# ce script. Si elle fuitait, elle ne permettrait que de redéployer l'app —
# à condition que ce script refuse toute autre image : `docker load` charge
# sans broncher une archive qui porterait le nom de l'image d'un autre site
# du VPS (recettes, Caddy…) et la remplacerait. D'où la vérification
# ci-dessous, faite **avant** le chargement.
#
# Une clé n'a qu'une commande forcée : celle de batch-cooking ne peut donc
# pas servir ici, il en faut une seconde (voir docs/deploiement.md).

set -eu

# L'image arrive compressée sur l'entrée standard. On la pose sur le disque
# pour la vérifier avant que Docker ne la voie.
archive=$(mktemp /var/tmp/languages-image.XXXXXX)
trap 'rm -f "$archive"' EXIT
gunzip > "$archive"

# Les seuls noms acceptés sont ceux de l'image de Languages. Tout ce qui
# pourrait nommer une image dans l'archive est lu : manifest.json (format
# Docker), index.json (format OCI, lu par le magasin containerd) et
# repositories (ancien format). Au moindre doute, refus.
python3 - "$archive" <<'PY'
import json, sys, tarfile

ALLOWED_TAGS = {'languages:latest', 'docker.io/library/languages:latest'}
ALLOWED_REFS = ALLOWED_TAGS | {'latest'}
NAME_KEYS = {'io.containerd.image.name', 'org.opencontainers.image.ref.name'}

def refuse(reason):
    print(f'Archive refusée : {reason}', file=sys.stderr)
    sys.exit(1)

def strict(pairs):
    # Docker (Go) lit les clés sans tenir compte de la casse et garde la
    # dernière en cas de doublon : un doublon pourrait cacher un second nom.
    seen = set()
    for key, _ in pairs:
        if key.lower() in seen:
            refuse(f'clé en double « {key} »')
        seen.add(key.lower())
    return dict(pairs)

def walk(node):
    if isinstance(node, dict):
        yield node
        for value in node.values():
            yield from walk(value)
    elif isinstance(node, list):
        for value in node:
            yield from walk(value)

with tarfile.open(sys.argv[1]) as tar:
    members = {}
    for member in tar.getmembers():
        name = member.name
        while name.startswith('./'):
            name = name[2:]
        if name in members:
            refuse(f'« {name} » figure deux fois')
        members[name] = member

    def read(name):
        member = members.get(name)
        if member is None:
            return None
        if not member.isfile() or member.size > 1_000_000:
            refuse(f'« {name} » inattendu')
        return json.loads(tar.extractfile(member).read(), object_pairs_hook=strict)

    manifest = read('manifest.json')
    if manifest is None:
        refuse('manifest.json absent')
    if not isinstance(manifest, list) or len(manifest) != 1:
        refuse('une seule image attendue')
    tags = [v for d in walk(manifest) for k, v in d.items() if k.lower() == 'repotags']
    if tags != [['languages:latest']]:
        refuse(f'noms inattendus {tags}')

    repositories = read('repositories')
    if repositories is not None and (list(repositories) != ['languages'] or list(repositories['languages']) != ['latest']):
        refuse('repositories inattendu')

    # Les annotations qui nomment une image peuvent se trouver dans l'index
    # comme dans les index qu'il désigne : tous les petits fichiers JSON de
    # l'archive sont lus. Un doublon y est sans risque : Python et Docker
    # gardent tous deux la dernière valeur, et chaque variante de casse est
    # parcourue.
    for name, member in members.items():
        if not member.isfile() or member.size > 1_000_000:
            continue
        try:
            document = json.loads(tar.extractfile(member).read())
        except (ValueError, UnicodeDecodeError):
            continue
        for node in walk(document):
            for key, value in node.items():
                if key in NAME_KEYS and value not in ALLOWED_REFS:
                    refuse(f'nom inattendu « {value} » dans {name}')
PY

docker load -i "$archive"
rm -f "$archive"

cd /root/languages
docker compose up -d

# Les couches de l'image précédente ne servent plus et remplissent le disque.
docker image prune -f --filter dangling=true >/dev/null
