#!/usr/bin/env bash
# Crée un dépôt Git autonome XAM-XAM LAB (un seul commit initial, aucun historique d'un autre projet),
# à partir des fichiers suivis du dossier courant. Usage : bash scripts/extraire-depot.sh <dossier-cible> [url-du-dépôt-distant]
set -euo pipefail
TARGET="${1:?dossier cible requis}"
REMOTE="${2:-}"
SRC="$(cd "$(dirname "$0")/.." && pwd)"
[ -e "$TARGET" ] && { echo "Le dossier $TARGET existe déjà : arrêt (aucun écrasement)." >&2; exit 1; }
mkdir -p "$TARGET"
# Fichiers suivis par Git uniquement (ni node_modules, ni .next, ni données locales).
cd "$SRC"
TOP="$(git rev-parse --show-toplevel)"
PREFIX="$(git rev-parse --show-prefix)"
git -C "$TOP" archive --format=tar "HEAD:${PREFIX%/}" | tar -x -C "$TARGET"
cd "$TARGET"
git init -q -b main
git add -A
git -c user.name="${GIT_AUTHOR_NAME:-XAM-XAM LAB}" -c user.email="${GIT_AUTHOR_EMAIL:-dev@xamxam.invalid}" commit -q -m "XAM-XAM LAB — import initial"
if [ -n "$REMOTE" ]; then git remote add origin "$REMOTE"; echo "Dépôt prêt. Pousser : git -C $TARGET push -u origin main"; fi
echo "Dépôt autonome créé dans $TARGET ($(git ls-files | wc -l) fichiers)."
