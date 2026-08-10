#!/usr/bin/env bash
#
# Back up everything Librero owns: the SQLite database and the uploads tree.
#
#   ./scripts/backup.sh [destination-directory]
#
# The database is copied with sqlite3's .backup, not cp — a plain copy of a live
# WAL-mode database can capture a torn page and restore as a corrupt file.
#
# Restore is the inverse and needs no tooling:
#   docker compose down
#   tar -xzf librero-backup-YYYY-MM-DD-HHMMSS.tar.gz -C /path/to/data --strip-components=1
#   docker compose up -d

set -euo pipefail

DATA_DIR="${LIBRERO_DATA_DIR:-./data}"
DB_PATH="${LIBRERO_DB_PATH:-$DATA_DIR/librero.db}"
DEST_DIR="${1:-./backups}"

if [ ! -f "$DB_PATH" ]; then
  echo "No database at $DB_PATH" >&2
  exit 1
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "sqlite3 is required (apt install sqlite3 / brew install sqlite)." >&2
  exit 1
fi

STAMP="$(date +%Y-%m-%d-%H%M%S)"
STAGING="$(mktemp -d)"
trap 'rm -rf "$STAGING"' EXIT

mkdir -p "$DEST_DIR" "$STAGING/librero"

# Consistent snapshot of a live database, WAL included.
sqlite3 "$DB_PATH" ".backup '$STAGING/librero/librero.db'"

if [ -d "$DATA_DIR/uploads" ]; then
  cp -R "$DATA_DIR/uploads" "$STAGING/librero/uploads"
fi

ARCHIVE="$DEST_DIR/librero-backup-$STAMP.tar.gz"
tar -czf "$ARCHIVE" -C "$STAGING" librero

echo "Wrote $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1))"

# Keep the last 14 archives; older ones are pruned so a nightly cron does not
# fill the disk.
KEEP="${LIBRERO_BACKUP_KEEP:-14}"
ls -1t "$DEST_DIR"/librero-backup-*.tar.gz 2>/dev/null \
  | tail -n "+$((KEEP + 1))" \
  | xargs -r rm --
