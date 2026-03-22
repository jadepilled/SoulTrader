#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
#  SoulTrader — Setup Automated Backup Cron + Bash Aliases
#  Run once on the production server: bash scripts/setup-backups.sh
#
#  This script:
#    1. Adds the `build` alias to ~/.bashrc
#    2. Adds the `backup` alias to ~/.bashrc
#    3. Installs the hourly cron job for automated rolling backups
#    4. Creates backup directories
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

PROJECT_DIR="/var/www/soultrader"
BASHRC="$HOME/.bashrc"

echo "╔══════════════════════════════════════════════════╗"
echo "║     SoulTrader — Backup & Build Setup            ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ─── 1. Create backup directories ────────────────────────────────────────────
echo "  [1/4] Creating backup directories..."
mkdir -p "$PROJECT_DIR/backups/hourly"
mkdir -p "$PROJECT_DIR/backups/daily"
mkdir -p "$PROJECT_DIR/backups/weekly"
mkdir -p "$PROJECT_DIR/backups/manual"
echo "        ✓ $PROJECT_DIR/backups/{hourly,daily,weekly,manual}"
echo ""

# ─── 2. Make scripts executable ──────────────────────────────────────────────
echo "  [2/4] Making scripts executable..."
chmod +x "$PROJECT_DIR/scripts/build.sh"
chmod +x "$PROJECT_DIR/scripts/backup.sh"
chmod +x "$PROJECT_DIR/scripts/backup-rotate.sh"
echo "        ✓ build.sh, backup.sh, backup-rotate.sh"
echo ""

# ─── 3. Add bash aliases ─────────────────────────────────────────────────────
echo "  [3/4] Configuring bash aliases..."

# build alias
if grep -q "alias build=" "$BASHRC" 2>/dev/null; then
  echo "        • build alias already exists, skipping"
else
  echo "" >> "$BASHRC"
  echo "# SoulTrader build — rebuild database & re-seed items" >> "$BASHRC"
  echo "alias build='cd $PROJECT_DIR && bash scripts/build.sh'" >> "$BASHRC"
  echo "        ✓ Added 'build' alias"
fi

# backup alias
if grep -q "alias backup=" "$BASHRC" 2>/dev/null; then
  echo "        • backup alias already exists, skipping"
else
  echo "" >> "$BASHRC"
  echo "# SoulTrader backup — manual database backup" >> "$BASHRC"
  echo "alias backup='cd $PROJECT_DIR && bash scripts/backup.sh'" >> "$BASHRC"
  echo "        ✓ Added 'backup' alias"
fi
echo ""

# ─── 4. Install cron job ─────────────────────────────────────────────────────
echo "  [4/4] Installing hourly backup cron job..."

CRON_CMD="0 * * * * cd $PROJECT_DIR && bash scripts/backup-rotate.sh >> /dev/null 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -qF "backup-rotate.sh"; then
  echo "        • Cron job already exists, skipping"
else
  # Append to existing crontab
  (crontab -l 2>/dev/null; echo ""; echo "# SoulTrader automated hourly backup with rotation"; echo "$CRON_CMD") | crontab -
  echo "        ✓ Cron installed: runs every hour at :00"
fi
echo ""

# ─── Done ─────────────────────────────────────────────────────────────────────
echo "╔══════════════════════════════════════════════════╗"
echo "║                  Setup Complete                  ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo "  Aliases (reload shell or run: source ~/.bashrc):"
echo "    build   — Rebuild database, re-seed items, audit icons"
echo "    backup  — Create a manual database backup"
echo "    deploy  — Pull, install, restart PM2 (existing)"
echo ""
echo "  Automated backups:"
echo "    • Hourly backups at :00 (retained 24h)"
echo "    • Daily consolidation (retained 4 weeks)"
echo "    • Weekly archives (retained indefinitely)"
echo "    • Logs: $PROJECT_DIR/backups/backup.log"
echo ""
echo "  Backup storage: $PROJECT_DIR/backups/"
echo "    hourly/  — Last 24 hours"
echo "    daily/   — Last 4 weeks (1 per day)"
echo "    weekly/  — Permanent archives (1 per week)"
echo "    manual/  — On-demand backups (never auto-deleted)"
echo ""
