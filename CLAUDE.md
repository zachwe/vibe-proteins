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
```

## Python Commands

**IMPORTANT:** Always use `uv run` for all Python commands to ensure the correct environment and dependencies are used. Never use `python`, `pip`, or activate venvs manually.

```bash
# Python scripts (from project root)
uv run python <script>

# Modal CLI commands (must run from modal/ directory)
cd modal && uv run modal deploy app.py
cd modal && uv run modal run pipelines/boltzgen.py

# Any other Python tools
uv run <tool-name> <args>
```

## Database Migrations

The project uses Drizzle ORM with SQL migrations stored in `api/drizzle/`.

**How migrations work:**
- Migrations run automatically on deploy (see `Dockerfile`: `node dist/db/migrate.js`)
- Migration files: `api/drizzle/XXXX_name.sql`
- Journal file: `api/drizzle/meta/_journal.json` (tracks which migrations have run)

**Creating a new migration:**

1. Update the schema in `api/src/db/schema.ts` or `api/src/db/auth-schema.ts`
2. Create a new SQL file in `api/drizzle/` with the next sequence number:
   ```sql
   -- api/drizzle/0012_description.sql
   ALTER TABLE `table_name` ADD COLUMN `column_name` text;
   ```
   **IMPORTANT:** If your migration has multiple statements, add `--> statement-breakpoint` between them:
   ```sql
   ALTER TABLE foo ADD COLUMN bar TEXT;
   --> statement-breakpoint
   ALTER TABLE foo ADD COLUMN baz INTEGER;
   ```
   Without these breakpoints, Drizzle's SQLite driver (better-sqlite3) will fail with "more than one statement" error.
3. Add an entry to `api/drizzle/meta/_journal.json`:
   ```json
   {
     "idx": 12,
     "version": "6",
     "when": 1736294400000,
     "tag": "0012_description",
     "breakpoints": true
   }
   ```
4. Test locally: migrations auto-run when the API starts, or run manually:
   ```bash
   cd api && pnpm exec tsx src/db/migrate.ts
   ```

**Local database:**
```bash
# Direct SQLite access
sqlite3 api/vibeproteins.db

# Quick schema check
sqlite3 api/vibeproteins.db ".schema table_name"
```

**Known issue:** Drizzle's migrator may report "completed" without actually applying migrations. This happens due to a mismatch between hash-based tracking (older migrations) and tag-based tracking (newer migrations) in `__drizzle_migrations`. If `pnpm prod:migrate` doesn't apply your migration:

1. Connect to prod: `pnpm prod:db`
2. Check what's missing: `.schema table_name`
3. Run the SQL manually from `api/drizzle/XXXX_name.sql`
4. Record it: `INSERT INTO __drizzle_migrations VALUES (NULL, '0012_name', 1736294400000);`

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
