# ProteinDojo

A platform for learning protein design by practicing against real druggable targets.

> **Note:** The user-facing site is called **ProteinDojo**. The codebase and infrastructure still use the legacy name "vibeproteins" for now.

## Prerequisites

- Node.js >= 20
- pnpm (`npm install -g pnpm`)
- Python 3.11+ (for Modal functions)

## Project Structure

```
vibeproteins/
├── frontend/     # React + Vite + Tailwind
├── api/          # Hono + Drizzle + BetterAuth
├── modal/        # Python Modal functions for GPU inference
├── PLAN.md       # Product spec and architecture
└── TASKS.md      # Development task tracker
```

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set up environment variables

```bash
# Copy the example env file
cp api/.env.example api/.env

# Edit api/.env and set your BETTER_AUTH_SECRET
# Generate a secret with: openssl rand -base64 32
```

### 3. Run database migrations

```bash
pnpm db:migrate
```

### 4. Start development servers

```bash
# Start both frontend and API
pnpm dev

# Or start individually:
pnpm dev:frontend  # http://localhost:5173
pnpm dev:api       # http://localhost:3000
```

## External Services Setup

### Modal (GPU Inference)

Modal runs the GPU inference functions (RFDiffusion3 + ProteinMPNN pipeline, Boltz-2 sanity checks, scoring utilities).

```bash
cd modal

# Create venv and install dependencies (requires uv)
uv venv --python 3.11
source .venv/bin/activate
uv pip install -r requirements.txt

# Authenticate with Modal (opens browser)
modal token new

# Verify setup
modal run app.py::health_check

# Deploy functions (for production)
modal deploy app.py
```

### Modal Unit Tests (helpers)

```bash
cd modal
uv venv --python 3.11
source .venv/bin/activate
uv pip install -r requirements.txt
uv run python -m unittest discover -s tests
```

### Jobs API E2E Tests (real Modal)

These tests hit the deployed Modal endpoint and will incur GPU usage.

```bash
# From repo root
MODAL_E2E=true \
MODAL_ENDPOINT=https://zach-b-ocean--vibeproteins-submit-job.modal.run \
pnpm --filter api test -- jobs.e2e.test.ts
```

### Manual Modal Smoke Test (GPU-backed, optional)

Use the bundled sample structures under `sample_data/` plus the helper script to exercise each Modal function. This is intentionally **not** run in CI – GPU calls can incur cost.

```bash
# Runs RFDiffusion3, ProteinMPNN, Boltz-2, and scoring against the sample PDBs
UV_CACHE_DIR=.uv-cache uv run python modal/scripts/run_modal_smoketest.py

# Target only a subset of the pipeline
UV_CACHE_DIR=.uv-cache uv run python modal/scripts/run_modal_smoketest.py --jobs rfdiffusion3 boltz2

# Hit an already deployed Modal app instead of a local ephemeral run
UV_CACHE_DIR=.uv-cache uv run python modal/scripts/run_modal_smoketest.py --mode deployed --app-name vibeproteins
```

Make sure you have already authenticated with Modal (`modal token new`) and deployed `app.py` before running the smoke test.
Use `--environment <name>` if you need to look up functions from a specific Modal environment.

### Cloudflare R2 (File Storage)

R2 stores PDB files, inference results, and other assets.

**1. Create R2 Bucket**

Via CLI (requires wrangler):
```bash
# Create API token at: https://dash.cloudflare.com/profile/api-tokens
# Use "Edit Cloudflare Workers" template (includes R2 permissions)

CLOUDFLARE_API_TOKEN=your_token wrangler r2 bucket create vibeproteins
```

Or via dashboard:
1. Go to https://dash.cloudflare.com → R2 Object Storage
2. Click "Create bucket"
3. Name: `vibeproteins`

**2. Create S3-Compatible API Credentials**

1. Go to https://dash.cloudflare.com → R2 Object Storage → Manage R2 API Tokens
2. Click "Create API token"
3. Permissions: Object Read & Write
4. Specify bucket: `vibeproteins`
5. Save the Access Key ID and Secret Access Key

**3. Configure Environment**

Add to `api/.env`:
```
R2_ACCOUNT_ID=<your cloudflare account id>
R2_ACCESS_KEY_ID=<from step 2>
R2_SECRET_ACCESS_KEY=<from step 2>
R2_BUCKET_NAME=vibeproteins
```

Add to Modal secrets (for inference functions):
```bash
modal secret create r2-credentials \
  R2_ACCOUNT_ID=<your account id> \
  R2_ACCESS_KEY_ID=<key id> \
  R2_SECRET_ACCESS_KEY=<secret key> \
  R2_BUCKET_NAME=vibeproteins
```

## Development Commands

### Root (monorepo)

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all dev servers in parallel |
| `pnpm dev:frontend` | Start only frontend |
| `pnpm dev:api` | Start only API |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint all packages |
| `pnpm db:generate` | Generate Drizzle migrations |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:seed` | Seed challenges to local database |
| `pnpm db:studio` | Open Drizzle Studio (browser DB UI) |
| `pnpm db:shell` | Open SQLite shell |
| `pnpm test` | Run API tests |
| `pnpm test:watch` | Run tests in watch mode |

### API (`pnpm --filter api <command>`)

| Command | Description |
|---------|-------------|
| `dev` | Start dev server with hot reload |
| `build` | Compile TypeScript |
| `start` | Run compiled output |
| `test` | Run tests once |
| `test:watch` | Run tests in watch mode |
| `db:generate` | Generate Drizzle migrations |
| `db:migrate` | Apply pending migrations |
| `db:studio` | Open Drizzle Studio (DB browser) |

### Frontend (`pnpm --filter frontend <command>`)

| Command | Description |
|---------|-------------|
| `dev` | Start Vite dev server |
| `build` | Build for production |
| `preview` | Preview production build |
| `lint` | Run ESLint |

## Database

SQLite database stored at `api/vibeproteins.db`.

### Schema

**App tables:**
- `challenges` - Protein design challenges
- `jobs` - GPU inference job tracking (includes GPU usage and cost)
- `submissions` - User design submissions
- `gpu_pricing` - GPU rates for billing (Modal rates + markup)
- `deposit_presets` - Preset deposit amounts ($5, $10, etc.)
- `transactions` - Balance deposits and job usage charges

**Auth tables (BetterAuth):**
- `user` - User accounts (includes `balance_usd_cents` field)
- `session` - Active sessions (includes `active_organization_id` for team context)
- `account` - OAuth/credential accounts
- `verification` - Email verification tokens
- `organization` - Teams with shared billing (`balance_usd_cents`)
- `member` - Team membership (user ↔ organization with role)
- `invitation` - Pending team invites

### Database Commands

```bash
# Generate migrations after schema changes
pnpm db:generate

# Apply pending migrations
pnpm db:migrate

# Open Drizzle Studio (browser-based UI)
pnpm db:studio

# Open SQLite shell for quick queries
pnpm db:shell
```

### SQLite Shell Quick Reference

```sql
.tables              -- List all tables
.schema user         -- Show table schema
SELECT * FROM user;  -- Query data
.quit                -- Exit
```

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  React Frontend │────▶│  Hono API       │────▶│  Modal (Python) │
│  localhost:5173 │     │  localhost:3000 │     │  GPU Inference  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │  SQLite + S3/R2 │
                        └─────────────────┘
```

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, React Router
- **API**: Hono, TypeScript, Drizzle ORM, BetterAuth
- **Database**: SQLite (dev), S3/R2 (file storage)
- **Inference**: Modal (Python), RFDiffusion3 + ProteinMPNN, Boltz-2, AlphaFold
- **Payments**: Stripe (balance deposits)
- **Visualization**: Mol* (molecular viewer)

## Usage-Based Billing

Users pay for GPU inference jobs based on actual GPU time used. Billing is per-second with Modal's rates plus a 30% markup.

### How it works

1. **User balance** is stored in cents (`balance_usd_cents` on user table)
2. **GPU pricing** is stored in `gpu_pricing` table (seeded via `pnpm db:seed`)
3. **Deposit presets** ($5, $10, $25, $50) are stored in `deposit_presets` table
4. **Stripe Checkout** is used with dynamic `price_data` for deposits
5. **Self-timing** in Modal functions tracks GPU usage (returns `gpu_type` + `execution_seconds`)
6. **Post-completion billing** deducts cost from balance after job completes

### Estimated costs (A10G GPU)

| Job Type | Estimated Cost | Estimated Time |
|----------|----------------|----------------|
| RFDiffusion3 (binder design) | $0.50-2.00 | 2-5 min |
| Boltz-2 (co-fold) | $0.10-0.50 | 30s-2 min |
| ProteinMPNN (sequence design) | $0.05-0.20 | 15s-1 min |

### GPU Pricing

GPU rates are based on Modal's pricing plus 30% markup:

| GPU | Modal Rate/sec | Our Rate/sec |
|-----|----------------|--------------|
| A10G | $0.000306 | $0.000398 |
| H100 | $0.001097 | $0.001426 |

### Updating pricing

To change GPU pricing or deposit presets:
1. Edit `api/src/db/seed.ts`
2. Run `pnpm db:seed` locally or `pnpm prod:seed` for production

To update estimated costs in the UI:
1. Edit `toolInfo` in `frontend/src/components/DesignPanel.tsx`

### Stripe webhook setup

For local development:
```bash
# Install Stripe CLI and login
stripe login

# Forward webhooks to local API
stripe listen --forward-to localhost:3000/api/billing/webhook

# Copy the webhook secret (whsec_...) to your .env
```

For production, create a webhook endpoint in the Stripe dashboard pointing to:
`https://your-api-domain.com/api/billing/webhook`

## Environment Variables

### API (`api/.env`)

```bash
# Auth (required)
BETTER_AUTH_SECRET=<generate with: openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:3000

# Frontend URL (for Stripe redirects)
FRONTEND_URL=http://localhost:5173

# R2 Storage (optional for dev, required for inference)
R2_ACCOUNT_ID=<your cloudflare account id>
R2_ACCESS_KEY_ID=<from R2 API token>
R2_SECRET_ACCESS_KEY=<from R2 API token>
R2_BUCKET_NAME=vibeproteins
R2_PUBLIC_BASE_URL=<optional CDN base for serving artifacts>
DESIGN_RESULTS_PREFIX=designs

# Stripe (for balance deposits)
STRIPE_SECRET_KEY=<from Stripe dashboard>
STRIPE_WEBHOOK_SECRET=<from Stripe CLI or dashboard>
```

### Modal

Modal credentials are stored in `~/.modal.toml` after running `modal token new`.

For R2 access from Modal functions, create a secret:
```bash
modal secret create r2-credentials \
  R2_ACCOUNT_ID=<account id> \
  R2_ACCESS_KEY_ID=<key id> \
  R2_SECRET_ACCESS_KEY=<secret key> \
  R2_BUCKET_NAME=vibeproteins

# Optional runtime tuning (set in your Modal environment or `.env`)
# - DESIGN_RESULTS_PREFIX=designs
# - R2_PUBLIC_BASE_URL=https://cdn.example.com
```

## Deployment

### Frontend (Vercel)

The frontend is deployed to Vercel with automatic deploys on push to `main`.

**Live URLs:**
- Production: https://vibeproteins.vercel.app
- Custom domain: https://vibe-proteins.zachocean.com (requires DNS setup)

**Setup (already configured):**

1. **Link project to Vercel** (from repo root):
   ```bash
   vercel link --yes
   ```

2. **Set environment variables:**
   ```bash
   vercel env add VITE_API_URL production
   # Enter: https://vibe-proteins-api.fly.dev
   ```

3. **Connect GitHub for auto-deploy:**
   ```bash
   vercel git connect
   ```

4. **Deploy:**
   ```bash
   vercel --prod
   ```

**Custom Domain Setup:**

To use a custom domain like `vibe-proteins.zachocean.com`:

1. Add domain to Vercel:
   ```bash
   vercel domains add vibe-proteins.zachocean.com
   ```

2. Add DNS record at your DNS provider:
   ```
   Type: CNAME
   Name: vibe-proteins
   Value: cname.vercel-dns.com
   ```

3. Vercel will automatically provision SSL once DNS propagates.

**Configuration Files:**
- `vercel.json` - Build settings for monorepo (root directory)
- `frontend/src/lib/api.ts` - Uses `VITE_API_URL` env var
- `frontend/src/lib/auth.ts` - Uses `VITE_API_URL` env var

### API (Fly.io)

The API is deployed to Fly.io with automatic deploys via GitHub Actions.

**Live URL:** https://vibe-proteins-api.fly.dev

**Setup:**

1. **Install Fly CLI:**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login:**
   ```bash
   fly auth login
   ```

3. **Create app** (already done):
   ```bash
   fly apps create vibe-proteins-api
   ```

4. **Create persistent volume for SQLite:**
   ```bash
   fly volumes create vibeproteins_data --size 1 --region iad
   ```

5. **Set secrets:**
   ```bash
   fly secrets set BETTER_AUTH_SECRET="<your-secret>"
   fly secrets set BETTER_AUTH_URL="https://vibe-proteins-api.fly.dev"
   # Add R2 credentials when ready:
   # fly secrets set R2_ACCOUNT_ID="..." R2_ACCESS_KEY_ID="..." R2_SECRET_ACCESS_KEY="..." R2_BUCKET_NAME="vibeproteins"
   ```

6. **Deploy:**
   ```bash
   fly deploy
   ```

**Auto-Deploy:**

GitHub Actions automatically deploys to Fly.io on push to `main`. The workflow is in `.github/workflows/deploy-api.yml`.

To set up auto-deploy, add `FLY_API_TOKEN` to GitHub secrets:
```bash
fly tokens create deploy --app vibe-proteins-api
gh secret set FLY_API_TOKEN --body "<token>"
```

**Configuration Files:**
- `api/fly.toml` - Fly.io app configuration
- `api/Dockerfile` - Production Docker image
- `.github/workflows/deploy-api.yml` - CI/CD pipeline

### Production Database Management

#### Automatic Migrations on Deploy

Migrations run **automatically** when the API container starts. The Docker entrypoint (see `api/Dockerfile`) runs:

```bash
node dist/db/migrate.js && litestream replicate -exec 'node dist/index.js'
```

This means:
1. Every deploy applies any pending migrations before the server starts
2. No manual intervention needed for schema changes
3. Migrations are tracked in `api/drizzle/` folder with a journal file

**To add a new migration:**

1. Update schema in `api/src/db/schema.ts` or `api/src/db/auth-schema.ts`
2. Create a SQL file: `api/drizzle/00XX_description.sql`
3. Add entry to `api/drizzle/meta/_journal.json`
4. Deploy - migration runs automatically on container start

See `CLAUDE.md` for detailed migration instructions and known issues.

#### Manual Commands

Scripts for managing the production SQLite database on Fly.io:

| Command | Description |
|---------|-------------|
| `pnpm prod:seed` | Seed/update challenges from `api/src/db/challenges.json` |
| `pnpm prod:db` | Open interactive SQLite shell on production |
| `pnpm prod:migrate` | Run database migrations on production |
| `pnpm prod:reset-db` | **Delete all data** and recreate database (requires confirmation) |

**Seeding Challenges:**

Challenge data is stored in `api/src/db/challenges.json`. To add or update challenges:

1. Edit `api/src/db/challenges.json`
2. Run `pnpm prod:seed` to push changes to production

The seed script uses upsert, so existing challenges are updated and new ones are added without affecting user data (jobs, submissions, etc.).

**Quick Database Queries:**

```bash
# Open production SQLite shell
pnpm prod:db

# Or run a single query
flyctl ssh console --app vibe-proteins-api --command "sqlite3 /data/vibeproteins.db 'SELECT id, name FROM challenges'"
```

**Resetting the Database:**

For backwards-incompatible schema changes during early development:

```bash
pnpm prod:reset-db  # Prompts for confirmation
pnpm prod:seed      # Re-seed challenge data
```

⚠️ This deletes all data including user accounts, jobs, and submissions.

## Contributing

See [TASKS.md](./TASKS.md) for current development status and task list.
