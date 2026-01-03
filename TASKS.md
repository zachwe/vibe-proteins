# ProteinDojo - Task Tracker

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
  - [x] Billing/transactions table
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
  - [x] `GET /users/me` - current user + balance
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
  - [x] RFDiffusion3 + ProteinMPNN pipeline function
  - [x] Boltz-2 sanity check pipeline
  - [x] ProteinMPNN function (standalone)
- [x] Replace mocked Boltz-2 with real inference (Boltz CLI + cached weights)
- [x] Replace mocked RFDiffusion3 with real inference (RFD3 repo + checkpoints)
- [x] Replace mocked ProteinMPNN with real inference (ProteinMPNN repo)
- [ ] Implement scoring/prediction
  - [ ] AlphaFold/Boltz structure prediction
  - [x] ipSAE scoring
  - [x] Interface metrics (shape complementarity, BSA, etc.)
- [x] Add Modal helper unit tests + CI coverage

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

- [x] Implement PAE-based ipSAE scoring
  - [x] ipSAE (Interface Predicted SAE) from PAE matrices
  - [x] ipTM, pDockQ, pDockQ2, LIS metrics
  - [x] Adapted from DunbrackLab/IPSAE implementation
- [x] Implement composite scoring
  - [x] Weighted combination of ipSAE + interface + confidence
  - [x] Letter grades (A-F)
- [x] Score breakdown UI
  - [x] Color-coded metrics display in ResultsPanel
  - [x] pLDDT, ipSAE, pDockQ, ipTM, LIS, contact count
- [x] Intuitive feedback generation
  - [x] "Strong predicted binding affinity"
  - [x] "Moderate confidence in complex formation"
  - [x] "Low structural confidence - consider verifying experimentally"
  - [x] etc.
- [x] Leaderboard per challenge

## Phase 7: Progress & Billing

- [ ] User dashboard
  - [ ] Curriculum progress
  - [ ] Submission history
- [x] Usage-based billing system
  - [x] Track USD balance in cents (displayed in header)
  - [x] Per-second GPU billing (Modal rates + 30% markup)
  - [x] Self-timing in Modal functions (returns gpu_type + execution_seconds)
  - [x] Post-completion billing (charge after job completes, not upfront)
  - [x] GPU pricing table in database (flexible, easy to update)
  - [x] Deposit presets ($5, $10, $25, $50)
  - [x] Stripe Checkout for deposits (dynamic price_data)
  - [x] Billing page (/billing) with GPU pricing, deposit buttons, transaction history
  - [x] Stripe webhook for payment confirmation

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
  - [x] Set up R2 credentials in Fly.io secrets
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
- [x] Hotspot selection for RFDiffusion3
  - [x] Add `suggestedHotspots` field to challenge schema
  - [x] "Advanced options" accordion in DesignPanel
  - [x] Click-to-select residues in Mol* viewer (via SequenceSelector)
  - [x] Pass hotspots to RFDiffusion3 inference
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

**Production deployment complete!**

Site live at: https://proteindojo.com

In progress:
- Phase 5: Step 3 Evaluate (compare candidates) & Step 4 submit workflow

Recently completed:
- **Leaderboard per challenge** (Phase 6): API endpoint + frontend component with sorting by multiple metrics
- **Hotspot selection for RFDiffusion3** (Phase 10): SequenceSelector with residue picking, HotspotIndicator with range support, shared state between panels
- **ProteinDojo rename**: Updated all user-facing branding, documented naming convention
- **Domain setup**: proteindojo.com + proteindojo.zachocean.com on Vercel
- **Drizzle migrations**: Fixed tracking, synced with production
- PAE-based ipSAE scoring, composite scores, feedback generation
- Usage-based billing with Stripe integration

Next up:
- Set up ColabFold databases on Modal Volume (~500GB-1TB)
- Phase 9: Production configuration (R2/Modal credentials in Fly.io)

---

## Completed

_Move completed tasks here_
