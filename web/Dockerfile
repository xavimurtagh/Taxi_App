# =============================================================================
# OpenRide Web — Production Dockerfile
# Multi-stage build for Next.js with standalone output
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Install dependencies
# ---------------------------------------------------------------------------
FROM node:20-alpine AS deps

# libc6-compat is needed for some native Node.js modules on Alpine
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package manifests for dependency caching
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies needed for the build)
RUN npm ci --ignore-scripts

# ---------------------------------------------------------------------------
# Stage 2: Build the Next.js application
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies from the deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy the full source code
COPY . .

# Build the Next.js application.
# The `output: 'standalone'` setting in next.config.js produces a
# self-contained build in .next/standalone that includes only the
# necessary files and a minimal server.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 3: Production runner — minimal image
# ---------------------------------------------------------------------------
FROM node:20-alpine AS runner

LABEL org.opencontainers.image.title="OpenRide Web" \
      org.opencontainers.image.description="OpenRide ride-sharing platform — Next.js web frontend" \
      org.opencontainers.image.vendor="OpenRide Community" \
      org.opencontainers.image.source="https://github.com/openride/openride" \
      org.opencontainers.image.licenses="AGPL-3.0"

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 openride && \
    adduser --system --uid 1001 --ingroup openride openride

# Copy the standalone build output.
# The standalone output includes a minimal Node.js server and only the
# necessary dependencies — no need for the full node_modules directory.
COPY --from=builder /app/public ./public

# Next.js standalone output directory structure:
#   .next/standalone/  — server.js + minimal node_modules
#   .next/static/      — static assets (CSS, JS bundles)
# We need to copy static assets into the standalone directory so they
# are served correctly.
COPY --from=builder --chown=openride:openride /app/.next/standalone ./
COPY --from=builder --chown=openride:openride /app/.next/static ./.next/static

USER openride

EXPOSE 3001

ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

# Health check — verifies the Next.js server is responding
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://localhost:3001/').then(r => { if (r.status >= 500) process.exit(1); }).catch(() => process.exit(1))"

# The standalone server.js is the entry point produced by Next.js
CMD ["node", "server.js"]
