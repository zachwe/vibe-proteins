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

### API (`pnpm --filter api <command>`)

| Command | Description |
|---------|-------------|
| `dev` | Start dev server with hot reload |
| `build` | Compile TypeScript |
| `start` | Run compiled output |
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

### Modal (Python)

```bash
cd modal

# Install dependencies
pip install -r requirements.txt

# Authenticate with Modal (first time)
modal token new

# Deploy functions
modal deploy app.py

# Run locally for testing
modal run app.py::health_check
```

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
- **Inference**: Modal (Python), BindCraft, BoltzGen, AlphaFold
- **Visualization**: Mol* (molecular viewer)

## Environment Variables

### API (`api/.env`)

```
BETTER_AUTH_SECRET=<generate with: openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:3000
```

### Modal (future)

```
MODAL_TOKEN_ID=<from modal.com>
MODAL_TOKEN_SECRET=<from modal.com>
AWS_ACCESS_KEY_ID=<for S3/R2>
AWS_SECRET_ACCESS_KEY=<for S3/R2>
```

## Contributing

See [TASKS.md](./TASKS.md) for current development status and task list.
