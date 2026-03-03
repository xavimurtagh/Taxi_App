#!/bin/bash
# =============================================================================
# OpenRide — Let's Encrypt SSL Certificate Initialization
# =============================================================================
#
# This script handles the initial SSL certificate setup for the OpenRide
# production deployment. It solves the chicken-and-egg problem where nginx
# needs certificates to start, but certbot needs nginx to validate domains.
#
# Usage:
#   chmod +x infrastructure/ssl/init-letsencrypt.sh
#   ./infrastructure/ssl/init-letsencrypt.sh
#
# Prerequisites:
#   - Docker and Docker Compose installed
#   - DNS A record pointing to this server
#   - Port 80 and 443 open in firewall
#
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration — CHANGE THESE VALUES
# ---------------------------------------------------------------------------

# Your domain(s) — space-separated list
DOMAINS=(openride.community www.openride.community)

# Email for Let's Encrypt notifications (expiry warnings, etc.)
EMAIL="admin@openride.community"

# Use Let's Encrypt staging server for testing (1 = yes, 0 = no).
# The staging server has much higher rate limits but produces untrusted certs.
# Set to 0 for real certificates.
STAGING=0

# RSA key size (2048 or 4096). 4096 is more secure but slightly slower.
RSA_KEY_SIZE=4096

# Docker Compose file to use
COMPOSE_FILE="docker-compose.prod.yml"

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
DATA_PATH="./infrastructure/ssl/certbot"
CONF_PATH="$DATA_PATH/conf"
WWW_PATH="$DATA_PATH/www"

# ---------------------------------------------------------------------------
# Color output helpers
# ---------------------------------------------------------------------------
info()  { echo -e "\033[1;34m[INFO]\033[0m  $*"; }
warn()  { echo -e "\033[1;33m[WARN]\033[0m  $*"; }
error() { echo -e "\033[1;31m[ERROR]\033[0m $*"; }
ok()    { echo -e "\033[1;32m[OK]\033[0m    $*"; }

# ---------------------------------------------------------------------------
# Check prerequisites
# ---------------------------------------------------------------------------
if ! command -v docker &> /dev/null; then
    error "Docker is not installed. Please install Docker first."
    exit 1
fi

if ! docker compose version &> /dev/null; then
    error "Docker Compose is not available. Please install Docker Compose v2."
    exit 1
fi

# ---------------------------------------------------------------------------
# Check if certificates already exist
# ---------------------------------------------------------------------------
DOMAIN="${DOMAINS[0]}"

if [ -d "$CONF_PATH/live/$DOMAIN" ]; then
    warn "Certificates for $DOMAIN already exist."
    read -p "Do you want to replace them? (y/N) " REPLACE
    if [ "$REPLACE" != "y" ] && [ "$REPLACE" != "Y" ]; then
        info "Keeping existing certificates. Exiting."
        exit 0
    fi
fi

info "Setting up SSL certificates for: ${DOMAINS[*]}"

# ---------------------------------------------------------------------------
# Create required directories
# ---------------------------------------------------------------------------
info "Creating certificate directories..."
mkdir -p "$CONF_PATH"
mkdir -p "$WWW_PATH"

# ---------------------------------------------------------------------------
# Download recommended TLS parameters from Mozilla
# ---------------------------------------------------------------------------
if [ ! -e "$CONF_PATH/options-ssl-nginx.conf" ] || [ ! -e "$CONF_PATH/ssl-dhparams.pem" ]; then
    info "Downloading recommended TLS parameters..."
    curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf \
        > "$CONF_PATH/options-ssl-nginx.conf"
    curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem \
        > "$CONF_PATH/ssl-dhparams.pem"
    ok "TLS parameters downloaded."
fi

# ---------------------------------------------------------------------------
# Create dummy certificates for initial nginx startup
# ---------------------------------------------------------------------------
# Nginx refuses to start without valid certificate files. We create self-signed
# dummy certs first so nginx can boot, then replace them with real ones.
info "Creating dummy certificates for initial nginx startup..."

CERT_PATH="$CONF_PATH/live/$DOMAIN"
mkdir -p "$CERT_PATH"

openssl req -x509 -nodes -newkey rsa:$RSA_KEY_SIZE \
    -days 1 \
    -keyout "$CERT_PATH/privkey.pem" \
    -out "$CERT_PATH/fullchain.pem" \
    -subj "/CN=localhost" \
    2>/dev/null

ok "Dummy certificates created."

# ---------------------------------------------------------------------------
# Start nginx with dummy certificates
# ---------------------------------------------------------------------------
info "Starting nginx with dummy certificates..."
docker compose -f "$COMPOSE_FILE" up -d nginx
sleep 5

# Verify nginx started successfully
if ! docker compose -f "$COMPOSE_FILE" ps nginx | grep -q "Up\|running"; then
    error "Nginx failed to start. Check logs with: docker compose -f $COMPOSE_FILE logs nginx"
    exit 1
fi

ok "Nginx is running."

# ---------------------------------------------------------------------------
# Delete dummy certificates
# ---------------------------------------------------------------------------
info "Removing dummy certificates..."
rm -rf "$CERT_PATH"

# ---------------------------------------------------------------------------
# Request real certificates from Let's Encrypt
# ---------------------------------------------------------------------------
info "Requesting Let's Encrypt certificates..."

# Build the domain argument string for certbot
DOMAIN_ARGS=""
for domain in "${DOMAINS[@]}"; do
    DOMAIN_ARGS="$DOMAIN_ARGS -d $domain"
done

# Set staging flag if needed
STAGING_ARG=""
if [ "$STAGING" = "1" ]; then
    STAGING_ARG="--staging"
    warn "Using Let's Encrypt STAGING server (certificates will NOT be trusted)"
fi

# Run certbot to obtain certificates.
# --webroot mode validates domain ownership by placing a file in the webroot
# directory, which nginx serves at /.well-known/acme-challenge/
docker compose -f "$COMPOSE_FILE" run --rm certbot \
    certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    $STAGING_ARG \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    $DOMAIN_ARGS

if [ $? -ne 0 ]; then
    error "Certificate request failed. Common issues:"
    echo "  - DNS A record does not point to this server"
    echo "  - Port 80 is blocked by firewall"
    echo "  - Domain is not registered"
    echo ""
    echo "Check certbot logs: docker compose -f $COMPOSE_FILE logs certbot"
    exit 1
fi

ok "Certificates obtained successfully!"

# ---------------------------------------------------------------------------
# Reload nginx with real certificates
# ---------------------------------------------------------------------------
info "Reloading nginx with real certificates..."
docker compose -f "$COMPOSE_FILE" exec nginx nginx -s reload

ok "Nginx reloaded with valid SSL certificates."

# ---------------------------------------------------------------------------
# Set up auto-renewal cron job
# ---------------------------------------------------------------------------
info "Setting up certificate auto-renewal..."

# Create a renewal script
RENEWAL_SCRIPT="/etc/cron.d/openride-certbot-renew"

# Check if we can write to cron.d (requires root)
if [ -w "/etc/cron.d/" ] 2>/dev/null; then
    cat > "$RENEWAL_SCRIPT" << 'CRON'
# OpenRide — Auto-renew Let's Encrypt certificates
# Runs twice daily at random minutes to spread load on Let's Encrypt servers
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Check for renewal at 3:30 AM and 3:30 PM UTC
30 3,15 * * * root cd /opt/openride && docker compose -f docker-compose.prod.yml run --rm certbot renew --quiet && docker compose -f docker-compose.prod.yml exec nginx nginx -s reload >> /var/log/openride-certbot-renew.log 2>&1
CRON
    chmod 644 "$RENEWAL_SCRIPT"
    ok "Cron job installed at $RENEWAL_SCRIPT"
else
    warn "Could not install cron job (no write access to /etc/cron.d/)."
    warn "The certbot container handles auto-renewal, but you may also want to add"
    warn "this to your crontab manually:"
    echo ""
    echo "  30 3,15 * * * cd $(pwd) && docker compose -f $COMPOSE_FILE run --rm certbot renew --quiet && docker compose -f $COMPOSE_FILE exec nginx nginx -s reload"
    echo ""
fi

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
echo ""
ok "========================================="
ok "  SSL setup complete!"
ok "========================================="
echo ""
info "Your site should now be accessible at:"
for domain in "${DOMAINS[@]}"; do
    echo "  https://$domain"
done
echo ""
info "Certificate auto-renewal is handled by the certbot container."
info "Certificates are stored in: $CONF_PATH"
echo ""
