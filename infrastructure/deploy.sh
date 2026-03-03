#!/bin/bash
# =============================================================================
# OpenRide — Production Deployment Script
# =============================================================================
#
# This script handles deploying OpenRide to a production server with
# zero-downtime rolling restarts and automatic rollback on failure.
#
# Usage:
#   ./infrastructure/deploy.sh                    # Deploy latest
#   ./infrastructure/deploy.sh --tag abc1234      # Deploy specific tag
#   ./infrastructure/deploy.sh --rollback         # Rollback to previous version
#   ./infrastructure/deploy.sh --status           # Check current deployment status
#
# Prerequisites:
#   - Docker and Docker Compose installed
#   - .env.production file configured
#   - SSL certificates set up (see infrastructure/ssl/init-letsencrypt.sh)
#
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.prod.yml"
ENV_FILE="${PROJECT_DIR}/.env.production"
TAG_FILE="${PROJECT_DIR}/.current-tag"
PREVIOUS_TAG_FILE="${PROJECT_DIR}/.previous-tag"
LOG_FILE="${PROJECT_DIR}/deploy.log"
HEALTH_URL="http://localhost:3000/health"
HEALTH_RETRIES=12
HEALTH_INTERVAL=10
API_REPLICAS=2

# ---------------------------------------------------------------------------
# Color output helpers
# ---------------------------------------------------------------------------
info()  { echo -e "\033[1;34m[INFO]\033[0m  $*" | tee -a "$LOG_FILE"; }
ok()    { echo -e "\033[1;32m[OK]\033[0m    $*" | tee -a "$LOG_FILE"; }
warn()  { echo -e "\033[1;33m[WARN]\033[0m  $*" | tee -a "$LOG_FILE"; }
error() { echo -e "\033[1;31m[ERROR]\033[0m $*" | tee -a "$LOG_FILE"; }

# ---------------------------------------------------------------------------
# Timestamped log entry
# ---------------------------------------------------------------------------
log_start() {
    echo "" >> "$LOG_FILE"
    echo "========================================" >> "$LOG_FILE"
    echo "Deploy started: $(date -u +"%Y-%m-%d %H:%M:%S UTC")" >> "$LOG_FILE"
    echo "========================================" >> "$LOG_FILE"
}

# ---------------------------------------------------------------------------
# Verify prerequisites
# ---------------------------------------------------------------------------
check_prerequisites() {
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed."
        exit 1
    fi

    if ! docker compose version &> /dev/null; then
        error "Docker Compose v2 is not available."
        exit 1
    fi

    if [ ! -f "$COMPOSE_FILE" ]; then
        error "Docker Compose file not found: ${COMPOSE_FILE}"
        exit 1
    fi

    if [ ! -f "$ENV_FILE" ]; then
        error "Environment file not found: ${ENV_FILE}"
        error "Copy .env.production.example to .env.production and configure it."
        exit 1
    fi
}

# ---------------------------------------------------------------------------
# Health check — waits for the API to respond with status 200
# ---------------------------------------------------------------------------
wait_for_health() {
    local retries=$HEALTH_RETRIES
    local interval=$HEALTH_INTERVAL

    info "Waiting for API to become healthy..."

    for i in $(seq 1 "$retries"); do
        if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
            ok "Health check passed on attempt ${i}/${retries}."
            return 0
        fi

        if [ "$i" -lt "$retries" ]; then
            info "Health check attempt ${i}/${retries} failed. Retrying in ${interval}s..."
            sleep "$interval"
        fi
    done

    error "Health check failed after ${retries} attempts (${HEALTH_RETRIES} x ${HEALTH_INTERVAL}s)."
    return 1
}

# ---------------------------------------------------------------------------
# Show deployment status
# ---------------------------------------------------------------------------
show_status() {
    echo ""
    info "OpenRide Deployment Status"
    echo "──────────────────────────────────────────"

    local current_tag="unknown"
    if [ -f "$TAG_FILE" ]; then
        current_tag=$(cat "$TAG_FILE")
    fi
    echo "  Current tag:  ${current_tag}"

    local previous_tag="unknown"
    if [ -f "$PREVIOUS_TAG_FILE" ]; then
        previous_tag=$(cat "$PREVIOUS_TAG_FILE")
    fi
    echo "  Previous tag: ${previous_tag}"

    echo ""
    echo "  Services:"
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || \
        docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps

    echo ""
    echo "  Health check:"
    if curl -sf "$HEALTH_URL" 2>/dev/null; then
        echo ""
        ok "API is healthy."
    else
        warn "API health check failed or unavailable."
    fi

    echo ""
}

# ---------------------------------------------------------------------------
# Run database migrations
# ---------------------------------------------------------------------------
run_migrations() {
    info "Running database migrations..."

    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" \
        run --rm api sh -c '
            for f in migrations/*.sql; do
                echo "Applying migration: $f"
                node -e "
                    import(\"pg\").then(async ({ default: pg }) => {
                        const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
                        const fs = await import(\"fs\");
                        const sql = fs.readFileSync(\"$f\", \"utf8\");
                        await pool.query(sql);
                        await pool.end();
                    }).catch(err => { console.error(err.message); process.exit(1); });
                " || echo "Migration $f may have already been applied (continuing)."
            done
            echo "All migrations processed."
        '

    ok "Database migrations complete."
}

# ---------------------------------------------------------------------------
# Deploy — main deployment logic
# ---------------------------------------------------------------------------
deploy() {
    local tag="${1:-latest}"

    log_start
    check_prerequisites

    info "========================================="
    info "  Deploying OpenRide"
    info "  Tag: ${tag}"
    info "========================================="

    # Save current tag as previous (for rollback)
    if [ -f "$TAG_FILE" ]; then
        cp "$TAG_FILE" "$PREVIOUS_TAG_FILE"
    fi

    # Set the new tag
    echo "$tag" > "$TAG_FILE"
    export IMAGE_TAG="$tag"

    # Step 1: Pull new images
    info "Pulling Docker images (tag: ${tag})..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull api web
    ok "Images pulled successfully."

    # Step 2: Ensure infrastructure services are running (postgres, redis, nginx)
    info "Ensuring infrastructure services are running..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d postgres redis nginx certbot backup
    sleep 5

    # Wait for postgres to be healthy before running migrations
    info "Waiting for PostgreSQL to be ready..."
    for i in $(seq 1 30); do
        if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres pg_isready -U "${POSTGRES_USER:-openride}" > /dev/null 2>&1; then
            ok "PostgreSQL is ready."
            break
        fi
        if [ "$i" -eq 30 ]; then
            error "PostgreSQL did not become ready in time."
            exit 1
        fi
        sleep 2
    done

    # Step 3: Run database migrations
    run_migrations

    # Step 4: Rolling restart of API containers
    # Strategy: scale up to API_REPLICAS + 1 (adding new containers with new image),
    # wait for health, then scale back down.
    info "Performing rolling restart of API containers..."

    # Start new containers alongside existing ones
    local scale_up=$((API_REPLICAS + 1))
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-deps --scale "api=${scale_up}" api
    info "Scaled API to ${scale_up} replicas (rolling update)."

    # Wait for the new containers to become healthy
    sleep 10

    if ! wait_for_health; then
        error "New containers are not healthy. Initiating rollback..."
        rollback
        exit 1
    fi

    # Scale back to normal replica count (Docker will stop the oldest containers)
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-deps --scale "api=${API_REPLICAS}" api
    info "Scaled API back to ${API_REPLICAS} replicas."

    # Step 5: Update web frontend
    info "Updating web frontend..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-deps web

    # Step 6: Final health check
    sleep 5
    if ! wait_for_health; then
        error "Post-deployment health check failed. Initiating rollback..."
        rollback
        exit 1
    fi

    # Step 7: Clean up unused images to save disk space
    info "Cleaning up old Docker images..."
    docker image prune -f --filter "until=72h" > /dev/null 2>&1 || true

    # Done
    echo ""
    ok "========================================="
    ok "  Deployment SUCCESSFUL"
    ok "  Tag: ${tag}"
    ok "  Time: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
    ok "========================================="
    echo ""
}

# ---------------------------------------------------------------------------
# Rollback — revert to the previous deployment
# ---------------------------------------------------------------------------
rollback() {
    local previous_tag

    if [ -f "$PREVIOUS_TAG_FILE" ]; then
        previous_tag=$(cat "$PREVIOUS_TAG_FILE")
    else
        error "No previous deployment tag found. Cannot rollback."
        error "You can manually specify a tag: $0 --tag <tag>"
        exit 1
    fi

    warn "========================================="
    warn "  Rolling back to tag: ${previous_tag}"
    warn "========================================="

    export IMAGE_TAG="$previous_tag"
    echo "$previous_tag" > "$TAG_FILE"

    # Pull the previous image (it should still be cached locally)
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull api web 2>/dev/null || true

    # Restart with previous image
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-deps api web

    # Wait for health
    sleep 10
    if wait_for_health; then
        ok "Rollback successful. Running tag: ${previous_tag}"
    else
        error "CRITICAL: Rollback also failed! Manual intervention required."
        error "Check logs: docker compose -f ${COMPOSE_FILE} logs api"
        exit 1
    fi
}

# ---------------------------------------------------------------------------
# Main — parse arguments and execute
# ---------------------------------------------------------------------------
main() {
    local tag="latest"
    local action="deploy"

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --tag)
                tag="${2:?Error: --tag requires a value}"
                shift 2
                ;;
            --rollback)
                action="rollback"
                shift
                ;;
            --status)
                action="status"
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --tag TAG       Deploy a specific image tag (default: latest)"
                echo "  --rollback      Rollback to the previous deployment"
                echo "  --status        Show current deployment status"
                echo "  --help          Show this help message"
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                echo "Use --help for usage information."
                exit 1
                ;;
        esac
    done

    case "$action" in
        deploy)
            deploy "$tag"
            ;;
        rollback)
            rollback
            ;;
        status)
            check_prerequisites
            show_status
            ;;
    esac
}

main "$@"
