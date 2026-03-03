# =============================================================================
# OpenRide — Nginx Reverse Proxy
# Production-grade reverse proxy with SSL, rate limiting, and security headers
# =============================================================================

FROM nginx:1.25-alpine

LABEL org.opencontainers.image.title="OpenRide Nginx" \
      org.opencontainers.image.description="OpenRide reverse proxy and SSL termination"

# Install curl for health checks
RUN apk add --no-cache curl

# Remove the default nginx configuration
RUN rm /etc/nginx/conf.d/default.conf

# Copy our production nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80 443

# Use nginx's default entrypoint and command
CMD ["nginx", "-g", "daemon off;"]
