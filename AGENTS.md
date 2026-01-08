# Instructions

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

## Boltz-2 Inference

**IMPORTANT:** Always run Boltz-2 with MSA enabled for production scoring. Single-sequence mode produces suboptimal predictions, especially for antibody-antigen complexes.

```bash
# Boltz CLI with MSA (recommended)
boltz predict input.yaml --use_msa_server --cache /cache --output_format pdb
```

**Key parameters:**
- `--use_msa_server`: Fetches MSAs from ColabFold public server (required for good predictions)
- `--diffusion_samples 1`: Number of structure samples
- `--write_full_pae`: Outputs PAE matrix for interface scoring

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

## Current State

See TASKS.md "Current Focus" section for what's being actively developed.
