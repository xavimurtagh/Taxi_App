# =============================================================================
# OpenRide — Database Backup Sidecar
# Alpine with PostgreSQL client and AWS CLI for S3 uploads
# =============================================================================

FROM alpine:3.19

LABEL org.opencontainers.image.title="OpenRide Backup" \
      org.opencontainers.image.description="Automated PostgreSQL backup sidecar with S3 upload support"

# Install required packages:
#   - postgresql16-client: pg_dump and pg_restore for backups
#   - aws-cli: upload backups to S3
#   - bash: for the backup scripts
#   - curl: for webhook notifications
#   - gzip: for backup compression
#   - dcron: lightweight cron daemon for Alpine
#   - tzdata: timezone support for cron scheduling
RUN apk add --no-cache \
    postgresql16-client \
    aws-cli \
    bash \
    curl \
    gzip \
    dcron \
    tzdata

# Set timezone to UTC for consistent cron scheduling
ENV TZ=UTC

# Create backup directory
RUN mkdir -p /backups /scripts /var/log

# Copy scripts
COPY backup.sh /scripts/backup.sh
COPY restore.sh /scripts/restore.sh
COPY crontab /etc/crontabs/root

# Make scripts executable
RUN chmod +x /scripts/backup.sh /scripts/restore.sh

# The backup volume is mounted here
VOLUME /backups

# Run crond in the foreground.
# -f = foreground, -l 2 = log level (info)
CMD ["crond", "-f", "-l", "2"]
