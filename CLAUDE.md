# Instructions

## Naming Convention

- **User-facing site name**: ProteinDojo
- **Codebase/infrastructure name**: vibeproteins (legacy, kept for compatibility)

When adding user-visible text (UI, SEO, documentation), use "ProteinDojo". Internal code and infrastructure references can continue using "vibeproteins".

## Project Documentation Files

### PLAN.md

The project specification and design document. Contains:

- **Core Mental Model**: Target/drug terminology and design modalities
- **Design Task Types**: Binders, blockers, decoys, stabilizers
- **Starter Targets**: 10 protein targets organized by difficulty level (1-4)
- **Scoring Metrics**: pLDDT, pTM, ipSAE, interface quality metrics
- **Platform Design**: Target pack format, user submission flow, visual feedback
- **Technology Stack**: React frontend, Node.js API, Modal Python inference, SQLite + S3
- **Features**: User stories, guided workflow (Explore -> Design -> Evaluate -> Submit)
- **Implementation Phases**: MVP through advanced features

Consult PLAN.md for architectural decisions, scoring algorithms, and feature requirements.

### TASKS.md

The implementation task tracker. Contains:

- **Phase-by-phase checklists**: Setup, infrastructure, inference, frontend, scoring, billing, content
- **Current Focus section**: What's actively being worked on
- **Completed work**: Historical record of finished tasks

Update TASKS.md when completing tasks or starting new work. Keep the "Current Focus" section accurate.

## Project Structure

```
vibeproteins/
├── frontend/          # Vite + React + TypeScript (port 5173)
├── api/               # Hono + TypeScript + SQLite (port 3000)
├── modal/             # Python Modal functions for GPU inference
├── datasette/         # Datasette dashboard for prod observability
├── PLAN.md            # Project specification
├── TASKS.md           # Task tracker
└── CLAUDE.md          # This file
```

## Key Technologies

- **Frontend**: React, TypeScript, Tailwind CSS, React Query, Mol* (3D viewer)
- **API**: Hono, Drizzle ORM, SQLite, BetterAuth
- **Inference**: Modal (Python), S3/R2 storage
- **Build**: pnpm workspaces, Vite

## Development Commands

```bash
# Start both frontend and API
pnpm dev

# Run API tests
pnpm --filter api test

# TypeScript check
pnpm exec tsc --noEmit

# Python scripts (Modal helpers, etc.)
uv run python <script>
```

## API Routes

- Auth: `/api/auth/*` (BetterAuth)
- Challenges: `/api/challenges`, `/api/challenges/:id`
- Jobs: `/api/jobs`, `/api/jobs/:id`
- Submissions: `/api/submissions`, `/api/submissions/:id`
- Users: `/api/users/me`
- Billing: `/api/billing/deposit`, `/api/billing/presets`, `/api/billing/gpu-pricing`, `/api/billing/transactions`

## Production Database & Observability

### Database Backup (Litestream)

The production SQLite database is continuously replicated to Cloudflare R2 using Litestream. This runs as a wrapper around the API process.

- **Config**: `api/litestream.yml`
- **Backup location**: R2 bucket under `litestream/vibeproteins/`
- Backups happen automatically on every write

### Datasette Dashboard

A private Datasette instance provides ad-hoc SQL query access to production data. It restores from the Litestream backup on startup.

**Architecture:**
```
Production API (SQLite) → Litestream → R2 → Datasette Dashboard
                         (continuous)      (restore on startup)
```

**Files:**
- `datasette/Dockerfile` - Python + Litestream + Datasette
- `datasette/metadata.json` - Auth config (uses `$env` for secrets)
- `datasette/start.sh` - Restore DB then start Datasette
- `fly.datasette.toml` - Fly.io deployment config

**Authentication:**

Uses `datasette-auth-passwords` plugin. Credentials are set via Fly secrets:
- `DATASETTE_PASSWORD_HASH` - Generated with `datasette hash-password`

To generate a new password hash:
```bash
pip install datasette-auth-passwords
echo 'your-password' | datasette hash-password --no-confirm
```

**Setup:**
```bash
# 1. Copy template and set your app name
cp fly.datasette.toml fly.datasette.toml.local
# Edit fly.datasette.toml.local and replace "REPLACE_ME" with your app name

# 2. Create the Fly app and set secrets
flyctl apps create <your-app-name>
flyctl secrets set -a <your-app-name> \
  R2_ACCOUNT_ID=xxx \
  R2_ACCESS_KEY_ID=xxx \
  R2_SECRET_ACCESS_KEY=xxx \
  R2_BUCKET_NAME=vibeproteins \
  DATASETTE_PASSWORD_HASH='pbkdf2_sha256$...'
```

**Deployment:**
```bash
# Deploy/redeploy the dashboard
pnpm prod:deploy-dashboard
# Or: flyctl deploy --config fly.datasette.toml.local

# Refresh data (restores latest backup)
flyctl apps restart <your-app-name>
```

Note: `fly.datasette.toml.local` is gitignored to avoid leaking the dashboard URL.

**Cost:** ~$2-3/mo (scales to zero when idle)

### Direct Database Access

For quick CLI queries without the dashboard:
```bash
pnpm prod:db  # Opens sqlite3 shell on production
```

## Current State

See TASKS.md "Current Focus" section for what's being actively developed.
