#!/bin/bash
# =============================================================================
# OpenRide — Database Backup Script
# =============================================================================
#
# Performs a PostgreSQL backup using pg_dump, compresses the output, optionally
# uploads to S3, and manages local backup retention.
#
# Environment variables:
#   POSTGRES_HOST           - Database hostname (default: postgres)
#   POSTGRES_PORT           - Database port (default: 5432)
#   POSTGRES_DB             - Database name (default: openride)
#   POSTGRES_USER           - Database user (default: openride)
#   PGPASSWORD              - Database password (required)
#   BACKUP_RETENTION_DAYS   - Number of days to keep local backups (default: 7)
#   S3_BACKUP_BUCKET        - S3 bucket for remote backups (optional)
#   S3_BACKUP_PREFIX        - S3 key prefix (default: openride/db-backups)
#   WEBHOOK_URL             - Webhook URL for failure notifications (optional)
#
# Usage:
#   ./backup.sh              # Run a backup
#   ./backup.sh --manual     # Run a manual backup (different naming)
#
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-openride}"
POSTGRES_USER="${POSTGRES_USER:-openride}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
S3_BACKUP_BUCKET="${S3_BACKUP_BUCKET:-}"
S3_BACKUP_PREFIX="${S3_BACKUP_PREFIX:-openride/db-backups}"
WEBHOOK_URL="${WEBHOOK_URL:-}"

BACKUP_DIR="/backups"
LOG_FILE="/var/log/openride-backup.log"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Determine backup type (scheduled vs manual)
BACKUP_TYPE="scheduled"
if [ "${1:-}" = "--manual" ]; then
    BACKUP_TYPE="manual"
fi

BACKUP_FILENAME="${POSTGRES_DB}_${BACKUP_TYPE}_${TIMESTAMP}.dump.gz"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILENAME}"

# ---------------------------------------------------------------------------
# Logging helper
# ---------------------------------------------------------------------------
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp
    timestamp=$(date +"%Y-%m-%d %H:%M:%S")
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

# ---------------------------------------------------------------------------
# Notification helper — sends a message to webhook on failure
# ---------------------------------------------------------------------------
notify_failure() {
    local message="$1"

    if [ -n "$WEBHOOK_URL" ]; then
        log "INFO" "Sending failure notification to webhook..."
        curl -s -X POST "$WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{
                \"text\": \"[BACKUP FAILED] OpenRide Database Backup\",
                \"content\": \"**Backup Failed**\n\nDatabase: \`${POSTGRES_DB}\`\nHost: \`${POSTGRES_HOST}\`\nTime: \`${TIMESTAMP}\`\nError: ${message}\",
                \"embeds\": [{
                    \"title\": \"Backup Failure Alert\",
                    \"description\": \"${message}\",
                    \"color\": 16711680,
                    \"fields\": [
                        {\"name\": \"Database\", \"value\": \"${POSTGRES_DB}\", \"inline\": true},
                        {\"name\": \"Host\", \"value\": \"${POSTGRES_HOST}\", \"inline\": true},
                        {\"name\": \"Time\", \"value\": \"${TIMESTAMP}\", \"inline\": true}
                    ]
                }]
            }" \
            --max-time 10 || log "WARN" "Failed to send webhook notification"
    fi
}

# ---------------------------------------------------------------------------
# Error handler
# ---------------------------------------------------------------------------
on_error() {
    local exit_code=$?
    local error_msg="Backup failed with exit code ${exit_code}"
    log "ERROR" "$error_msg"
    notify_failure "$error_msg"

    # Clean up partial backup file if it exists
    if [ -f "$BACKUP_PATH" ]; then
        rm -f "$BACKUP_PATH"
        log "INFO" "Cleaned up partial backup file."
    fi

    exit "$exit_code"
}

trap on_error ERR

# ---------------------------------------------------------------------------
# Main backup process
# ---------------------------------------------------------------------------
log "INFO" "========================================"
log "INFO" "Starting ${BACKUP_TYPE} backup of '${POSTGRES_DB}'"
log "INFO" "========================================"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Step 1: Run pg_dump
# Using custom format (-Fc) for efficient compression and selective restore.
# Piping through gzip for additional compression on top.
log "INFO" "Running pg_dump..."
SECONDS=0

pg_dump \
    -h "$POSTGRES_HOST" \
    -p "$POSTGRES_PORT" \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    -Fc \
    --no-owner \
    --no-privileges \
    --verbose \
    2>> "$LOG_FILE" | gzip > "$BACKUP_PATH"

DUMP_DURATION=$SECONDS
BACKUP_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)

log "INFO" "Backup completed in ${DUMP_DURATION}s. Size: ${BACKUP_SIZE}"

# Verify the backup file is not empty
if [ ! -s "$BACKUP_PATH" ]; then
    log "ERROR" "Backup file is empty!"
    notify_failure "Backup file is empty"
    rm -f "$BACKUP_PATH"
    exit 1
fi

# Step 2: Upload to S3 (if configured)
if [ -n "$S3_BACKUP_BUCKET" ]; then
    log "INFO" "Uploading backup to S3: s3://${S3_BACKUP_BUCKET}/${S3_BACKUP_PREFIX}/${BACKUP_FILENAME}"
    SECONDS=0

    aws s3 cp "$BACKUP_PATH" \
        "s3://${S3_BACKUP_BUCKET}/${S3_BACKUP_PREFIX}/${BACKUP_FILENAME}" \
        --storage-class STANDARD_IA \
        --only-show-errors

    UPLOAD_DURATION=$SECONDS
    log "INFO" "S3 upload completed in ${UPLOAD_DURATION}s."
else
    log "INFO" "S3 upload skipped (S3_BACKUP_BUCKET not configured)."
fi

# Step 3: Clean up old local backups
log "INFO" "Cleaning up backups older than ${BACKUP_RETENTION_DAYS} days..."

DELETED_COUNT=0
while IFS= read -r old_backup; do
    rm -f "$old_backup"
    log "INFO" "Deleted old backup: $(basename "$old_backup")"
    DELETED_COUNT=$((DELETED_COUNT + 1))
done < <(find "$BACKUP_DIR" -name "${POSTGRES_DB}_*.dump.gz" -mtime +"$BACKUP_RETENTION_DAYS" -type f 2>/dev/null)

log "INFO" "Cleaned up ${DELETED_COUNT} old backup(s)."

# Step 4: List current backups
CURRENT_COUNT=$(find "$BACKUP_DIR" -name "${POSTGRES_DB}_*.dump.gz" -type f | wc -l)
log "INFO" "Current local backups: ${CURRENT_COUNT}"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
log "INFO" "========================================"
log "INFO" "Backup summary:"
log "INFO" "  Type:     ${BACKUP_TYPE}"
log "INFO" "  File:     ${BACKUP_FILENAME}"
log "INFO" "  Size:     ${BACKUP_SIZE}"
log "INFO" "  Duration: ${DUMP_DURATION}s"
log "INFO" "  S3:       $([ -n "$S3_BACKUP_BUCKET" ] && echo "uploaded" || echo "skipped")"
log "INFO" "  Retained: ${CURRENT_COUNT} local backups"
log "INFO" "========================================"
