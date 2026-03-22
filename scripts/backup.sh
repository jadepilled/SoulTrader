#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
#  SoulTrader — Manual Database Backup
#  Usage: bash scripts/backup.sh   (or via `backup` alias)
#
#  Creates a timestamped pg_dump in /var/www/soultrader/backups/manual/
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

# Load .env from project root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

if [ -f "$PROJECT_ROOT/.env" ]; then
  set -a
  source "$PROJECT_ROOT/.env"
  set +a
fi

# Defaults
DB_NAME="${POSTGRES_DB:-soultrader}"
DB_USER="${POSTGRES_USER:-soultrader_user}"
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"

BACKUP_DIR="$PROJECT_ROOT/backups/manual"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
FILENAME="soultrader_manual_${TIMESTAMP}.sql.gz"
FILEPATH="$BACKUP_DIR/$FILENAME"

echo "╔══════════════════════════════════════════════════╗"
echo "║         SoulTrader — Manual Backup               ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo "  Database:  $DB_NAME"
echo "  Host:      $DB_HOST:$DB_PORT"
echo "  User:      $DB_USER"
echo "  Output:    $FILEPATH"
echo ""

# Run pg_dump (compressed with gzip)
export PGPASSWORD="${POSTGRES_PASSWORD:-}"
if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl | gzip > "$FILEPATH"; then
  SIZE=$(du -h "$FILEPATH" | cut -f1)
  echo "  ✓ Backup complete: $FILENAME ($SIZE)"
  echo ""

  # Show recent manual backups
  echo "  Recent manual backups:"
  ls -lht "$BACKUP_DIR"/*.sql.gz 2>/dev/null | head -10 | while read -r line; do
    echo "    $line"
  done
  echo ""
else
  echo "  ✗ Backup FAILED"
  rm -f "$FILEPATH"
  exit 1
fi
