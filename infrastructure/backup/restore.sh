#!/bin/bash
# =============================================================================
# OpenRide — Database Restore Script
# =============================================================================
#
# Restores a PostgreSQL database from a backup file (local or S3).
#
# Usage:
#   ./restore.sh <backup_file>                    # Restore from local file
#   ./restore.sh --from-s3 <s3_key>               # Download from S3 and restore
#   ./restore.sh --list                            # List available local backups
#   ./restore.sh --list-s3                         # List available S3 backups
#
# Environment variables:
#   POSTGRES_HOST           - Database hostname (default: postgres)
#   POSTGRES_PORT           - Database port (default: 5432)
#   POSTGRES_DB             - Database name (default: openride)
#   POSTGRES_USER           - Database user (default: openride)
#   PGPASSWORD              - Database password (required)
#   S3_BACKUP_BUCKET        - S3 bucket (required for S3 operations)
#   S3_BACKUP_PREFIX        - S3 key prefix (default: openride/db-backups)
#
# WARNING: This will DROP and recreate the target database!
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
S3_BACKUP_BUCKET="${S3_BACKUP_BUCKET:-}"
S3_BACKUP_PREFIX="${S3_BACKUP_PREFIX:-openride/db-backups}"

BACKUP_DIR="/backups"
LOG_FILE="/var/log/openride-restore.log"

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
# Usage
# ---------------------------------------------------------------------------
usage() {
    echo "Usage:"
    echo "  $0 <backup_file>          Restore from a local backup file"
    echo "  $0 --from-s3 <s3_key>     Download from S3 and restore"
    echo "  $0 --list                 List available local backups"
    echo "  $0 --list-s3              List available S3 backups"
    echo ""
    echo "Examples:"
    echo "  $0 /backups/openride_scheduled_20240115_020000.dump.gz"
    echo "  $0 --from-s3 openride/db-backups/openride_scheduled_20240115_020000.dump.gz"
    echo "  $0 --list"
    exit 1
}

# ---------------------------------------------------------------------------
# List local backups
# ---------------------------------------------------------------------------
list_local() {
    log "INFO" "Available local backups in ${BACKUP_DIR}:"
    echo ""
    if ls "$BACKUP_DIR"/*.dump.gz 1>/dev/null 2>&1; then
        ls -lhS "$BACKUP_DIR"/*.dump.gz | awk '{print $5, $6, $7, $8, $9}'
    else
        echo "  No backup files found."
    fi
    echo ""
}

# ---------------------------------------------------------------------------
# List S3 backups
# ---------------------------------------------------------------------------
list_s3() {
    if [ -z "$S3_BACKUP_BUCKET" ]; then
        log "ERROR" "S3_BACKUP_BUCKET is not set."
        exit 1
    fi

    log "INFO" "Available S3 backups in s3://${S3_BACKUP_BUCKET}/${S3_BACKUP_PREFIX}/:"
    echo ""
    aws s3 ls "s3://${S3_BACKUP_BUCKET}/${S3_BACKUP_PREFIX}/" --human-readable
    echo ""
}

# ---------------------------------------------------------------------------
# Download from S3
# ---------------------------------------------------------------------------
download_from_s3() {
    local s3_key="$1"
    local local_filename
    local_filename=$(basename "$s3_key")
    local local_path="${BACKUP_DIR}/${local_filename}"

    if [ -z "$S3_BACKUP_BUCKET" ]; then
        log "ERROR" "S3_BACKUP_BUCKET is not set."
        exit 1
    fi

    log "INFO" "Downloading backup from S3: s3://${S3_BACKUP_BUCKET}/${s3_key}"
    aws s3 cp "s3://${S3_BACKUP_BUCKET}/${s3_key}" "$local_path" --only-show-errors

    if [ ! -f "$local_path" ]; then
        log "ERROR" "Failed to download backup from S3."
        exit 1
    fi

    log "INFO" "Downloaded to: ${local_path}"
    echo "$local_path"
}

# ---------------------------------------------------------------------------
# Restore from backup file
# ---------------------------------------------------------------------------
restore() {
    local backup_file="$1"

    # Verify the backup file exists
    if [ ! -f "$backup_file" ]; then
        log "ERROR" "Backup file not found: ${backup_file}"
        exit 1
    fi

    # Verify the backup file is not empty
    if [ ! -s "$backup_file" ]; then
        log "ERROR" "Backup file is empty: ${backup_file}"
        exit 1
    fi

    local backup_size
    backup_size=$(du -h "$backup_file" | cut -f1)

    log "INFO" "========================================"
    log "INFO" "Starting database restore"
    log "INFO" "========================================"
    log "INFO" "  Source: ${backup_file}"
    log "INFO" "  Size:   ${backup_size}"
    log "INFO" "  Target: ${POSTGRES_DB}@${POSTGRES_HOST}:${POSTGRES_PORT}"
    log "INFO" "========================================"

    # Safety confirmation
    echo ""
    echo "WARNING: This will DROP and RECREATE the database '${POSTGRES_DB}'!"
    echo "All existing data in '${POSTGRES_DB}' will be PERMANENTLY LOST."
    echo ""
    read -p "Are you sure you want to continue? Type 'yes' to confirm: " CONFIRM

    if [ "$CONFIRM" != "yes" ]; then
        log "INFO" "Restore cancelled by user."
        exit 0
    fi

    # Step 1: Terminate existing connections to the database
    log "INFO" "Terminating existing connections to '${POSTGRES_DB}'..."
    psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d postgres -c \
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${POSTGRES_DB}' AND pid <> pg_backend_pid();" \
        2>> "$LOG_FILE" || true

    # Step 2: Drop and recreate the database
    log "INFO" "Dropping database '${POSTGRES_DB}'..."
    psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d postgres -c \
        "DROP DATABASE IF EXISTS \"${POSTGRES_DB}\";" \
        2>> "$LOG_FILE"

    log "INFO" "Creating database '${POSTGRES_DB}'..."
    psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d postgres -c \
        "CREATE DATABASE \"${POSTGRES_DB}\" OWNER \"${POSTGRES_USER}\";" \
        2>> "$LOG_FILE"

    # Step 3: Enable PostGIS extension
    log "INFO" "Enabling PostGIS extension..."
    psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
        "CREATE EXTENSION IF NOT EXISTS postgis;" \
        2>> "$LOG_FILE"

    # Step 4: Restore from backup
    log "INFO" "Restoring database from backup..."
    SECONDS=0

    # The backup is gzipped pg_dump custom format.
    # Decompress with gunzip, then restore with pg_restore.
    gunzip -c "$backup_file" | pg_restore \
        -h "$POSTGRES_HOST" \
        -p "$POSTGRES_PORT" \
        -U "$POSTGRES_USER" \
        -d "$POSTGRES_DB" \
        --no-owner \
        --no-privileges \
        --verbose \
        2>> "$LOG_FILE" || {
            # pg_restore may return non-zero even on success if there are
            # some warnings (e.g., extension already exists). Check if the
            # database has tables.
            log "WARN" "pg_restore exited with warnings. Verifying restore..."
        }

    RESTORE_DURATION=$SECONDS

    # Step 5: Verify restore
    log "INFO" "Verifying restore..."
    TABLE_COUNT=$(psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
        -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')

    if [ "$TABLE_COUNT" -eq 0 ]; then
        log "ERROR" "Restore verification failed: no tables found in database."
        exit 1
    fi

    # ---------------------------------------------------------------------------
    # Summary
    # ---------------------------------------------------------------------------
    log "INFO" "========================================"
    log "INFO" "Restore completed successfully!"
    log "INFO" "  Duration: ${RESTORE_DURATION}s"
    log "INFO" "  Tables:   ${TABLE_COUNT}"
    log "INFO" "========================================"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
if [ $# -eq 0 ]; then
    usage
fi

case "$1" in
    --list)
        list_local
        ;;
    --list-s3)
        list_s3
        ;;
    --from-s3)
        if [ $# -lt 2 ]; then
            echo "Error: --from-s3 requires an S3 key argument."
            usage
        fi
        DOWNLOADED_FILE=$(download_from_s3 "$2")
        restore "$DOWNLOADED_FILE"
        ;;
    --help|-h)
        usage
        ;;
    *)
        restore "$1"
        ;;
esac
