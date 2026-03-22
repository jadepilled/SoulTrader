#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
#  SoulTrader — Automated Rolling Backup with Rotation
#  Called by cron every hour.
#
#  Retention policy:
#    • Hourly backups kept for 24 hours
#    • After 24h, one backup per day is kept (the latest from that day)
#    • After 4 weeks, one backup per week is kept (Sunday's daily)
#    • Weekly backups are retained indefinitely (small footprint)
#
#  Directory structure:
#    backups/
#      hourly/     ← last 24 hours of hourly dumps
#      daily/      ← consolidated daily backups (1 per day)
#      weekly/     ← consolidated weekly backups (1 per week)
#      manual/     ← on-demand backups (never auto-deleted)
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PROJECT_ROOT/backups/backup.log"

# Load .env
if [ -f "$PROJECT_ROOT/.env" ]; then
  set -a
  source "$PROJECT_ROOT/.env"
  set +a
fi

DB_NAME="${POSTGRES_DB:-soultrader}"
DB_USER="${POSTGRES_USER:-soultrader_user}"
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
export PGPASSWORD="${POSTGRES_PASSWORD:-}"

HOURLY_DIR="$PROJECT_ROOT/backups/hourly"
DAILY_DIR="$PROJECT_ROOT/backups/daily"
WEEKLY_DIR="$PROJECT_ROOT/backups/weekly"

mkdir -p "$HOURLY_DIR" "$DAILY_DIR" "$WEEKLY_DIR"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# ─── Step 1: Create hourly backup ────────────────────────────────────────────
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
FILENAME="soultrader_${TIMESTAMP}.sql.gz"
FILEPATH="$HOURLY_DIR/$FILENAME"

if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl | gzip > "$FILEPATH"; then
  SIZE=$(du -h "$FILEPATH" | cut -f1)
  log "Hourly backup created: $FILENAME ($SIZE)"
else
  log "ERROR: Hourly backup FAILED"
  rm -f "$FILEPATH"
  exit 1
fi

# ─── Step 2: Prune hourly backups older than 24 hours ─────────────────────────
find "$HOURLY_DIR" -name "soultrader_*.sql.gz" -type f -mmin +1440 | while read -r old_file; do
  log "Pruning old hourly: $(basename "$old_file")"
  rm -f "$old_file"
done

# ─── Step 3: Promote latest hourly to daily (once per day) ───────────────────
# Check if we already have a daily backup for today
TODAY=$(date +"%Y-%m-%d")
DAILY_FILE="$DAILY_DIR/soultrader_daily_${TODAY}.sql.gz"

if [ ! -f "$DAILY_FILE" ]; then
  # Find the latest hourly backup and copy it as today's daily
  LATEST_HOURLY=$(ls -t "$HOURLY_DIR"/soultrader_*.sql.gz 2>/dev/null | head -1)
  if [ -n "$LATEST_HOURLY" ]; then
    cp "$LATEST_HOURLY" "$DAILY_FILE"
    log "Daily backup promoted: soultrader_daily_${TODAY}.sql.gz"
  fi
else
  # Update today's daily with the latest hourly (keeps the most recent snapshot)
  LATEST_HOURLY=$(ls -t "$HOURLY_DIR"/soultrader_*.sql.gz 2>/dev/null | head -1)
  if [ -n "$LATEST_HOURLY" ]; then
    cp "$LATEST_HOURLY" "$DAILY_FILE"
  fi
fi

# ─── Step 4: Prune daily backups older than 4 weeks ──────────────────────────
# Before pruning, promote the latest daily from each completed week to weekly
find "$DAILY_DIR" -name "soultrader_daily_*.sql.gz" -type f -mtime +28 | sort -r | while read -r old_daily; do
  # Extract date from filename
  DAILY_DATE=$(basename "$old_daily" | sed 's/soultrader_daily_//' | sed 's/\.sql\.gz//')
  # Get ISO week number for this date
  WEEK_NUM=$(date -d "$DAILY_DATE" +"%G-W%V" 2>/dev/null || date -j -f "%Y-%m-%d" "$DAILY_DATE" +"%G-W%V" 2>/dev/null || echo "")

  if [ -n "$WEEK_NUM" ]; then
    WEEKLY_FILE="$WEEKLY_DIR/soultrader_weekly_${WEEK_NUM}.sql.gz"
    if [ ! -f "$WEEKLY_FILE" ]; then
      # This is the first daily we've seen for this week (sorted newest-first),
      # so it's the latest from that week — promote it
      cp "$old_daily" "$WEEKLY_FILE"
      log "Weekly backup promoted: soultrader_weekly_${WEEK_NUM}.sql.gz"
    fi
  fi

  # Remove the old daily
  log "Pruning old daily: $(basename "$old_daily")"
  rm -f "$old_daily"
done

# ─── Step 5: Summary ─────────────────────────────────────────────────────────
HOURLY_COUNT=$(ls "$HOURLY_DIR"/soultrader_*.sql.gz 2>/dev/null | wc -l)
DAILY_COUNT=$(ls "$DAILY_DIR"/soultrader_daily_*.sql.gz 2>/dev/null | wc -l)
WEEKLY_COUNT=$(ls "$WEEKLY_DIR"/soultrader_weekly_*.sql.gz 2>/dev/null | wc -l)
TOTAL_SIZE=$(du -sh "$PROJECT_ROOT/backups" 2>/dev/null | cut -f1)

log "Retention: ${HOURLY_COUNT} hourly, ${DAILY_COUNT} daily, ${WEEKLY_COUNT} weekly | Total: ${TOTAL_SIZE}"
