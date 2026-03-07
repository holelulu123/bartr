#!/bin/bash
# backup-pull.sh — Run from your LOCAL machine to pull a fresh DB backup from production.
# Requires: ssh key access to the production server, rsync, ssh.
#
# Usage:
#   bash scripts/backup-pull.sh
#   bash scripts/backup-pull.sh user@host          # override remote
#   bash scripts/backup-pull.sh user@host /path     # override remote + local backup dir
#
# Schedule with cron (e.g. daily at 4 AM):
#   0 4 * * * /path/to/marketplace/scripts/backup-pull.sh >> /var/log/bartr-backup.log 2>&1

set -euo pipefail

# ── Configuration ────────────────────────────────────────────────────────────
REMOTE="${1:-bartr@your-server-ip}"           # SSH user@host
LOCAL_BACKUP_DIR="${2:-$HOME/bartr-backups}"  # Where to store backups locally
REMOTE_PROJECT_DIR="/opt/bartr"              # Project dir on the server
KEEP_DAYS=30                                 # Delete local backups older than this
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# ── Setup ────────────────────────────────────────────────────────────────────
mkdir -p "$LOCAL_BACKUP_DIR"

echo "[$TIMESTAMP] Starting backup from $REMOTE..."

# ── 1. Dump PostgreSQL on the remote server ──────────────────────────────────
REMOTE_DUMP="/tmp/bartr_pg_$TIMESTAMP.sql.gz"
echo "  Dumping PostgreSQL..."
ssh "$REMOTE" "cd $REMOTE_PROJECT_DIR && docker compose exec -T postgres pg_dumpall -U \$(grep POSTGRES_USER .env | cut -d= -f2) | gzip > $REMOTE_DUMP"

# ── 2. Pull the dump locally ─────────────────────────────────────────────────
echo "  Pulling PostgreSQL dump..."
rsync -az --progress -e ssh "$REMOTE:$REMOTE_DUMP" "$LOCAL_BACKUP_DIR/bartr_pg_$TIMESTAMP.sql.gz"

# ── 3. Clean up remote dump ──────────────────────────────────────────────────
ssh "$REMOTE" "rm -f $REMOTE_DUMP"

# ── 4. Pull MinIO data (images) ──────────────────────────────────────────────
echo "  Syncing MinIO data..."
mkdir -p "$LOCAL_BACKUP_DIR/minio"
rsync -az --delete --progress -e ssh "$REMOTE:$REMOTE_PROJECT_DIR/minio-data/" "$LOCAL_BACKUP_DIR/minio/"

# ── 5. Delete old local backups ──────────────────────────────────────────────
echo "  Cleaning backups older than $KEEP_DAYS days..."
find "$LOCAL_BACKUP_DIR" -name "bartr_pg_*.sql.gz" -mtime +$KEEP_DAYS -delete

# ── Done ─────────────────────────────────────────────────────────────────────
SIZE=$(du -sh "$LOCAL_BACKUP_DIR/bartr_pg_$TIMESTAMP.sql.gz" | cut -f1)
echo "  Done! PostgreSQL backup: $SIZE"
echo "  Stored in: $LOCAL_BACKUP_DIR"
