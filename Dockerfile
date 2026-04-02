# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Build
# Compiles the Next.js app and the better-sqlite3 native addon.
# /scripts/ and /data/tmp/ are excluded via .dockerignore.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# Build tools required by better-sqlite3 (native Node addon)
RUN apk add --no-cache python3 make g++

# Install all dependencies (including devDeps needed for the build)
COPY package*.json ./
RUN npm ci

# Copy application source (.dockerignore excludes scripts/, data/tmp/, etc.)
COPY . .

# NEXT_PUBLIC_* variables are inlined at build time — accept them as build args.
# In Railway, project Variables with NEXT_PUBLIC_ prefix are automatically
# passed as build args; you can also pass them with --build-arg locally.
ARG NEXT_PUBLIC_MAPBOX_TOKEN
ENV NEXT_PUBLIC_MAPBOX_TOKEN=$NEXT_PUBLIC_MAPBOX_TOKEN
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# The Next.js file-system tracer does not always capture native .node binaries.
# Copy better-sqlite3 explicitly into the standalone output to guarantee it is
# present at runtime.
RUN cp -r /app/node_modules/better-sqlite3 \
          /app/.next/standalone/node_modules/better-sqlite3

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Production runner
# Lean Alpine image — only the standalone server and runtime assets.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user for container security
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# ── Application files ──────────────────────────────────────────────────────
# Standalone server + its traced node_modules (includes better-sqlite3)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Static assets (CSS, JS chunks) — not included in standalone
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# ── Seed database ──────────────────────────────────────────────────────────
# Bake the current database into the image so the app works out-of-the-box
# even before a Railway volume is attached.  The entrypoint copies this seed
# to /data/gardsguiden.db if no database exists there yet.
RUN mkdir -p /app/seed
COPY --from=builder --chown=nextjs:nodejs /app/data/gardsguiden.db /app/seed/gardsguiden.db

# ── Persistent data directory ──────────────────────────────────────────────
# Mount a Railway volume at /data to persist the SQLite database across
# deployments.  Set DB_PATH=/data/gardsguiden.db in Railway's Variables.
RUN mkdir -p /data && chown nextjs:nodejs /data

# ── Entrypoint ─────────────────────────────────────────────────────────────
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nextjs

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
