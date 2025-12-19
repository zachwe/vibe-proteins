# Build stage
FROM node:20-slim AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy package files from root (monorepo)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/package.json ./api/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy API source code
COPY api/ ./api/

# Build the API
RUN pnpm --filter api build

# Production stage
FROM node:20-slim AS runner

# Install pnpm for running
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/package.json ./api/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built files and migrations
COPY --from=builder /app/api/dist ./api/dist
COPY api/drizzle ./api/drizzle
COPY api/drizzle.config.ts ./api/

# Create data directory for SQLite
RUN mkdir -p /data

ENV NODE_ENV=production
ENV DATABASE_URL=/data/vibeproteins.db

EXPOSE 3000

WORKDIR /app/api

# Run migrations and start server
CMD ["sh", "-c", "pnpm db:migrate && node dist/index.js"]
