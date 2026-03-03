# =============================================================================
# OpenRide Backend — Production Dockerfile
# Multi-stage build for minimal, secure production image
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Install ALL dependencies (including devDependencies for building)
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder

# Install dumb-init for proper PID 1 signal handling
RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy package manifests first for better layer caching.
# If these files haven't changed, Docker reuses the cached npm install layer.
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies).
# Using --ignore-scripts to prevent arbitrary code execution during install.
# Using ci for deterministic builds from the lockfile.
RUN npm ci --ignore-scripts

# Copy the rest of the application source code
COPY . .

# ---------------------------------------------------------------------------
# Stage 2: Production image — only what we need to run
# ---------------------------------------------------------------------------
FROM node:20-alpine AS production

# Image metadata labels
LABEL org.opencontainers.image.title="OpenRide API" \
      org.opencontainers.image.description="OpenRide ride-sharing platform — backend API server" \
      org.opencontainers.image.vendor="OpenRide Community" \
      org.opencontainers.image.source="https://github.com/openride/openride" \
      org.opencontainers.image.licenses="AGPL-3.0"

# Install dumb-init in production image for proper signal forwarding.
# Node.js does not handle SIGTERM properly as PID 1; dumb-init fixes this.
RUN apk add --no-cache dumb-init

# Set production environment
ENV NODE_ENV=production

WORKDIR /app

# Copy package manifests and install only production dependencies.
# This keeps the image small by excluding devDependencies.
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts && \
    npm cache clean --force

# Copy application source from the builder stage
COPY --from=builder /app/src ./src

# Copy migration files so we can run migrations from the container
COPY --from=builder /app/migrations ./migrations

# Create a non-root user for security.
# Running as root inside containers is a security risk — if the process
# is compromised, the attacker has root access within the container.
RUN addgroup --system --gid 1001 openride && \
    adduser --system --uid 1001 --ingroup openride openride

# Change ownership of the app directory to the non-root user
RUN chown -R openride:openride /app

# Switch to non-root user
USER openride

# Expose the API port
EXPOSE 3000

# Health check — Docker uses this to determine container health.
# The /health endpoint checks database and Redis connectivity.
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "fetch('http://localhost:3000/health').then(r => { if (!r.ok) process.exit(1); }).catch(() => process.exit(1))"

# Use dumb-init as PID 1 to properly handle signals (SIGTERM, SIGINT).
# This ensures graceful shutdown works correctly in container orchestrators.
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "src/index.js"]
