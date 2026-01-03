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

## Current State

See TASKS.md "Current Focus" section for what's being actively developed.
