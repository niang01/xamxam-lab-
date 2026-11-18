#!/bin/sh
# Sauvegarde périodique de XAM-XAM LAB (service « backup » de Docker Compose).
# Toutes les XX_BACKUP_INTERVAL_S secondes : sauvegarde complète vérifiable (SHA-256) dans /app/backups,
# puis suppression des sauvegardes plus anciennes que XX_BACKUP_RETENTION_DAYS jours. Un échec est journalisé et réessayé.
set -u
INTERVAL="${XX_BACKUP_INTERVAL_S:-86400}"
RETENTION="${XX_BACKUP_RETENTION_DAYS:-14}"
DIR=/app/backups
mkdir -p "$DIR"
while true; do
  FILE="$DIR/xamxam-$(date -u +%Y%m%dT%H%M%SZ).json"
  if node node_modules/tsx/dist/cli.mjs scripts/backup.mts "$FILE"; then
    find "$DIR" -name 'xamxam-*.json' -type f -mtime +"$RETENTION" -print -delete | sed 's/^/[sauvegarde] supprimée (rétention) : /'
  else
    echo "[sauvegarde] ÉCHEC — nouvel essai dans 300 s" >&2
    rm -f "$FILE"
    sleep 300
    continue
  fi
  sleep "$INTERVAL"
done
