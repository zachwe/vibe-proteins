# VibeProteins - Task Tracker

## Phase 1: Project Setup

- [x] Initialize monorepo structure
  - [x] `/frontend` - Vite + React + TypeScript
  - [x] `/api` - Node.js + TypeScript API server
  - [x] `/modal` - Python Modal functions
- [x] Set up frontend (Vite + React)
  - [x] Initialize Vite project
  - [x] Configure TypeScript
  - [x] Set up routing (React Router)
  - [x] Add Tailwind CSS
- [x] Set up API server
  - [x] Initialize Node.js + TypeScript project
  - [x] Set up Hono
  - [x] Configure SQLite + Drizzle
  - [x] Set up BetterAuth
- [x] Set up Modal
  - [x] Create Modal account/project
  - [x] Set up basic Modal function structure (placeholder)
  - [x] Configure S3/R2 for file storage (vibeproteins bucket created)

## Phase 2: Core Infrastructure

- [x] Database schema
  - [x] Users table
  - [x] Challenges table
  - [x] Submissions table
  - [x] Jobs table (for tracking inference jobs)
  - [x] Credits/transactions table
- [x] API endpoints
  - [x] Auth routes (handled by BetterAuth)
  - [x] `GET /challenges` - list challenges
  - [x] `GET /challenges/:id` - challenge details
  - [x] `POST /jobs` - submit inference job
  - [x] `GET /jobs/:id` - job status/result
  - [x] `GET /jobs` - list user's jobs
  - [x] `POST /submissions` - submit design for scoring
  - [x] `GET /submissions` - user's submission history
  - [x] `GET /submissions/:id` - single submission
  - [x] `GET /users/me` - current user + credits
  - [x] API tests (vitest)
- [x] Inference provider abstraction
  - [x] Define `InferenceProvider` interface
  - [x] Implement `ModalProvider`
  - [x] Job status polling mechanism

## Phase 3: Modal Inference Functions

- [x] Set up base infrastructure
  - [x] Shared utilities (S3 upload/download, etc.)
  - [x] Base image with common dependencies
- [x] Implement design tools
  - [x] RFdiffusion + ProteinMPNN pipeline function
  - [x] Boltz-2 sanity check pipeline
  - [x] ProteinMPNN function (standalone)
- [x] Replace mocked Boltz-2 with real inference (Boltz CLI + cached weights)
- [ ] Implement scoring/prediction
  - [ ] AlphaFold/Boltz structure prediction
  - [x] ipSAE scoring
  - [x] Interface metrics (shape complementarity, BSA, etc.)

## Phase 4: Frontend - Browse & Explore

- [x] Landing page (Home component with hero and feature cards)
- [x] Auth pages (login, signup)
- [x] Challenge browser
  - [x] Challenge list with difficulty levels
  - [x] Challenge detail page with educational content
- [x] Mol* integration
  - [x] Basic viewer component
  - [x] Load PDB/mmCIF structures
  - [ ] Highlight binding sites / hotspots
- [x] API integration
  - [x] React Query setup
  - [x] API client with typed endpoints
  - [x] Hooks for challenges, jobs, submissions

## Phase 5: Frontend - Design Workflow

- [x] Challenge workspace page
  - [x] Step 1: Explore (target viewer, info panel)
  - [x] Step 2: Design (tool selection, parameters, run job)
  - [ ] Step 3: Evaluate (view results, compare candidates)
  - [ ] Step 4: Submit
- [x] Job status UI
  - [x] Pending/running/completed states
  - [x] Progress indication for long jobs
- [x] Results visualization
  - [x] View predicted complex in Mol*
  - [x] Score breakdown display

## Phase 6: Scoring & Feedback

- [ ] Implement composite scoring
- [ ] Score breakdown UI
- [ ] Intuitive feedback generation
  - [ ] "Strong binding but wrong epitope"
  - [ ] "Good shape complementarity, low confidence"
  - [ ] etc.
- [ ] Leaderboard per challenge

## Phase 7: Progress & Credits

- [ ] User dashboard
  - [ ] Curriculum progress
  - [ ] Submission history
- [ ] Credits system
  - [ ] Track credit balance
  - [ ] Deduct credits on job run
  - [ ] Credit purchase flow (Stripe?)

## Phase 8: Content

- [ ] Create first 3 target packs (Level 1)
  - [ ] SARS-CoV-2 Spike RBD
  - [ ] IL-6
  - [ ] VEGF-A
- [ ] Educational content for each target
- [ ] Hints system

## Phase 9: CI/CD & Deployment

- [x] CI Pipeline (GitHub Actions)
  - [x] Run API tests on push/PR
  - [x] Run TypeScript type checking
  - [x] Run frontend build check
  - [ ] Lint checks (if configured)
- [x] Frontend Deployment (Vercel)
  - [x] Choose hosting platform (Vercel)
  - [x] Configure build settings (`pnpm --filter frontend build`)
  - [x] Set up environment variables (VITE_API_URL)
  - [x] Configure custom domain (vibe-proteins.zachocean.com - pending DNS)
  - [x] Set up preview deployments for PRs (via Vercel GitHub integration)
- [x] API Deployment (Fly.io)
  - [x] Choose hosting platform (Fly.io)
  - [x] Configure persistent volume for SQLite database
  - [x] Set up environment variables (secrets)
  - [x] Configure health check endpoint
  - [x] Set up database migrations on deploy
  - [x] Auto-deploy on push to main (GitHub Actions)
  - [ ] Set up R2 credentials in Fly.io secrets
  - [ ] Set up Modal token in Fly.io secrets
  - [x] Configure CORS for production frontend URL
- [ ] Modal Deployment
  - [ ] Modal functions auto-deploy on `modal deploy` (no CI needed)
  - [ ] Set up Modal secrets in production environment
  - [ ] Verify R2 bucket access from Modal
- [ ] Production Configuration
  - [ ] Update BetterAuth `trustedOrigins` for production domain
  - [ ] Configure production API URL in frontend
  - [ ] Set up monitoring/logging (optional)
  - [ ] Configure rate limiting (optional)

## Phase 10: Product Improvements

- [ ] Interactive educational content
  - [ ] Hover over residue mentions (e.g., "K417, Y453") to highlight in Mol* viewer
  - [ ] Define named regions in challenge data (e.g., "ACE2 binding face")
  - [ ] Custom markdown syntax for interactive elements `[[region:id|display text]]`
  - [ ] MolstarViewer ref/context API for `highlightResidues(chainId, residues[])`
- [ ] Hotspot selection for RFdiffusion
  - [ ] Add `suggestedHotspots` field to challenge schema
  - [ ] "Advanced options" accordion in DesignPanel
  - [ ] Click-to-select residues in Mol* viewer
  - [ ] Pass hotspots to RFdiffusion inference
- [ ] Mol* viewer enhancements
  - [ ] Color chains by role (target vs context) matching legend colors
  - [ ] Sync legend hover with viewer highlighting
  - [ ] Show/hide individual chains toggle
- [ ] Challenge content improvements
  - [ ] Add more detailed chain annotations for all targets
  - [ ] Expand educational content with more terminology links
  - [ ] Add hints that unlock progressively

---

## Current Focus

> Update this section with what we're actively working on

**Phase 5 in progress - Design Workflow UI**

Completed:
- All API endpoints implemented and tested (31 tests passing)
- Modal authenticated and health check working
- R2 bucket created (`vibeproteins`) with credentials configured
- Inference provider abstraction (`ModalProvider`)
- React Query integration with typed API client
- Challenge list and detail pages
- Mol* 3D protein viewer component
- Seed data with 3 real protein targets (Spike RBD, IL-6, VEGF-A)
- Landing page with hero and feature cards
- Auth pages (login, signup)
- DesignPanel component with tool selection, job submission, and status tracking
- Job status UI with pending/running/completed/failed states
- ResultsPanel component with Mol* viewer and score breakdown display

Currently working on:
- Phase 3: Modal inference + scoring (Boltz-2 real inference integration + validation)
- Phase 5: Step 3 Evaluate (compare candidates) & Step 4 submit workflow

Next up:
- Phase 3: Modal Inference Functions (actual AI design implementation)

---

## Completed

_Move completed tasks here_
