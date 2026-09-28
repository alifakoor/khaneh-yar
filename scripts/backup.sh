#!/usr/bin/env bash
# MongoDB backup using mongodump from the official image, so nothing needs installing locally.
# Works against any reachable MongoDB, e.g. the Darkube database's external address.
#
#   MONGODB_URI='mongodb://user:pass@host:port/?authSource=admin' ./scripts/backup.sh
#   crontab: 30 3 * * * cd /path/to/buying-house && MONGODB_URI='...' ./scripts/backup.sh >> backups/backup.log 2>&1
#
# Restore:
#   docker run --rm -i mongo:8 mongorestore --uri "$MONGODB_URI" --archive --gzip --drop < backups/<file>.archive.gz
set -euo pipefail
cd "$(dirname "$0")/.."
: "${MONGODB_URI:?MONGODB_URI is required}"
DB="${MONGODB_DB:-khanehyar}"
BACKUP_DIR="${BACKUP_DIR:-backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
mkdir -p "$BACKUP_DIR"
file="$BACKUP_DIR/khanehyar-$(date +%Y%m%d-%H%M%S).archive.gz"
docker run --rm --network host mongo:8 mongodump --uri "$MONGODB_URI" --db "$DB" --archive --gzip > "$file.tmp"
mv "$file.tmp" "$file"
find "$BACKUP_DIR" -name 'khanehyar-*.archive.gz' -mtime +"$KEEP_DAYS" -delete
echo "$(date -Is) backup written: $file ($(du -h "$file" | cut -f1))"
