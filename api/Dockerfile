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

# Build the API
WORKDIR /app/api
RUN pnpm build

# Use pnpm deploy to create a standalone production bundle
WORKDIR /app
RUN pnpm --filter api deploy --prod /prod/api

# Production stage
FROM node:20-slim AS runner

# Install sqlite3 for database debugging
RUN apt-get update && apt-get install -y sqlite3 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the deployed production bundle
COPY --from=builder /prod/api ./

# Copy built files and migrations
COPY --from=builder /app/api/dist ./dist
COPY --from=builder /app/api/drizzle ./drizzle

# Create data directory for SQLite
RUN mkdir -p /data

ENV NODE_ENV=production
ENV DATABASE_URL=/data/vibeproteins.db

EXPOSE 3000

# Run migrations and start server
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/index.js"]
