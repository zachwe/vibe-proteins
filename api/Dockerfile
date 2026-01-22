# Build stage
FROM node:20-slim AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy entire monorepo structure for proper workspace resolution
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/ ./api/
COPY frontend/package.json ./frontend/

# Install all dependencies (needed for workspace resolution)
RUN pnpm install --frozen-lockfile

# Build args for Sentry source map upload
ARG SENTRY_AUTH_TOKEN
ARG COMMIT_SHA

# Build the API (with source map upload if SENTRY_AUTH_TOKEN is set)
WORKDIR /app/api
RUN SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN COMMIT_SHA=$COMMIT_SHA pnpm build

# Use pnpm deploy to create a standalone production bundle
WORKDIR /app
RUN pnpm --filter api deploy --prod /prod/api

# Production stage
FROM node:20-slim AS runner

# Install sqlite3 and download Litestream
RUN apt-get update && apt-get install -y sqlite3 ca-certificates wget && \
    wget -qO- https://github.com/benbjohnson/litestream/releases/download/v0.3.13/litestream-v0.3.13-linux-amd64.tar.gz | tar xz -C /usr/local/bin && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the deployed production bundle
COPY --from=builder /prod/api ./

# Copy built files and migrations
COPY --from=builder /app/api/dist ./dist
COPY --from=builder /app/api/drizzle ./drizzle

# Copy Litestream config
COPY api/litestream.yml /etc/litestream.yml

# Create data directory for SQLite
RUN mkdir -p /data

ENV NODE_ENV=production
ENV DATABASE_URL=/data/vibeproteins.db

EXPOSE 3000

# Run migrations then start server with Litestream replication
# Litestream will replicate WAL changes to R2 continuously
CMD ["sh", "-c", "node dist/db/migrate.js && litestream replicate -exec 'node dist/index.js'"]
