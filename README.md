# VibeProteins

A platform for learning protein design by practicing against real druggable targets.

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

Modal runs the GPU inference functions (RFdiffusion + ProteinMPNN pipeline, Boltz-2 sanity checks, scoring utilities).

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

### Manual Modal Smoke Test (GPU-backed, optional)

Use the bundled sample structures under `sample_data/` plus the helper script to exercise each Modal function. This is intentionally **not** run in CI – GPU calls can incur cost.

```bash
# Runs RFdiffusion, ProteinMPNN, Boltz-2, and scoring against the sample PDBs
UV_CACHE_DIR=.uv-cache uv run python modal/scripts/run_modal_smoketest.py

# Target only a subset of the pipeline
UV_CACHE_DIR=.uv-cache uv run python modal/scripts/run_modal_smoketest.py --jobs rfdiffusion boltz2
```

Make sure you have already authenticated with Modal (`modal token new`) and deployed `app.py` before running the smoke test.

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
- `jobs` - GPU inference job tracking
- `submissions` - User design submissions
- `credit_transactions` - Credit usage history

**Auth tables (BetterAuth):**
- `user` - User accounts (includes `credits` field)
- `session` - Active sessions
- `account` - OAuth/credential accounts
- `verification` - Email verification tokens

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
- **Inference**: Modal (Python), RFdiffusion + ProteinMPNN, Boltz-2, AlphaFold
- **Visualization**: Mol* (molecular viewer)

## Environment Variables

### API (`api/.env`)

```bash
# Auth (required)
BETTER_AUTH_SECRET=<generate with: openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:3000

# R2 Storage (optional for dev, required for inference)
R2_ACCOUNT_ID=<your cloudflare account id>
R2_ACCESS_KEY_ID=<from R2 API token>
R2_SECRET_ACCESS_KEY=<from R2 API token>
R2_BUCKET_NAME=vibeproteins
R2_PUBLIC_BASE_URL=<optional CDN base for serving artifacts>
DESIGN_RESULTS_PREFIX=designs
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
# - DUMMY_INFERENCE=0           # flip to real model hooks (default is fast stub mode)
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

## Contributing

See [TASKS.md](./TASKS.md) for current development status and task list.
