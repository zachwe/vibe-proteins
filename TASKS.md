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
  - [ ] Create Modal account/project (requires user signup)
  - [x] Set up basic Modal function structure (placeholder)
  - [ ] Configure S3/R2 for file storage (requires user credentials)

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
- [ ] Inference provider abstraction
  - [ ] Define `InferenceProvider` interface
  - [ ] Implement `ModalProvider`
  - [ ] Job status polling mechanism

## Phase 3: Modal Inference Functions

- [ ] Set up base infrastructure
  - [ ] Shared utilities (S3 upload/download, etc.)
  - [ ] Base image with common dependencies
- [ ] Implement design tools
  - [ ] BindCraft function
  - [ ] BoltzGen function
  - [ ] ProteinMPNN function (if needed separately)
- [ ] Implement scoring/prediction
  - [ ] AlphaFold/Boltz structure prediction
  - [ ] ipSAE scoring
  - [ ] Interface metrics (shape complementarity, BSA, etc.)

## Phase 4: Frontend - Browse & Explore

- [ ] Landing page (static, SEO-friendly)
- [ ] Auth pages (login, signup)
- [ ] Challenge browser
  - [ ] Challenge list with difficulty levels
  - [ ] Challenge detail page with educational content
- [ ] Mol* integration
  - [ ] Basic viewer component
  - [ ] Load PDB/mmCIF structures
  - [ ] Highlight binding sites / hotspots

## Phase 5: Frontend - Design Workflow

- [ ] Challenge workspace page
  - [ ] Step 1: Explore (target viewer, info panel)
  - [ ] Step 2: Design (tool selection, parameters, run job)
  - [ ] Step 3: Evaluate (view results, compare candidates)
  - [ ] Step 4: Submit
- [ ] Job status UI
  - [ ] Pending/running/completed states
  - [ ] Progress indication for long jobs
- [ ] Results visualization
  - [ ] View predicted complex in Mol*
  - [ ] Score breakdown display

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

---

## Current Focus

> Update this section with what we're actively working on

**Phase 2 in progress!**

Completed:
- All API endpoints implemented and tested
- vitest test suite passing (10 tests)

Remaining for Phase 2:
- Inference provider abstraction (when Modal is set up)

Blocked (waiting on user):
- Create Modal account and authenticate (`modal token new`)
- Configure S3/R2 for file storage

---

## Completed

_Move completed tasks here_
