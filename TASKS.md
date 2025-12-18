# VibeProteins - Task Tracker

## Phase 1: Project Setup

- [ ] Initialize monorepo structure
  - [ ] `/frontend` - Vite + React + TypeScript
  - [ ] `/api` - Node.js + TypeScript API server
  - [ ] `/modal` - Python Modal functions
- [ ] Set up frontend (Vite + React)
  - [ ] Initialize Vite project
  - [ ] Configure TypeScript
  - [ ] Set up routing (React Router)
  - [ ] Add Tailwind or styling solution
- [ ] Set up API server
  - [ ] Initialize Node.js + TypeScript project
  - [ ] Set up Express or Hono
  - [ ] Configure SQLite + Drizzle/Kysely (or other ORM)
  - [ ] Set up BetterAuth
- [ ] Set up Modal
  - [ ] Create Modal account/project
  - [ ] Set up basic Modal function (hello world)
  - [ ] Configure S3/R2 for file storage

## Phase 2: Core Infrastructure

- [ ] Database schema
  - [ ] Users table
  - [ ] Challenges table
  - [ ] Submissions table
  - [ ] Jobs table (for tracking inference jobs)
  - [ ] Credits/transactions table
- [ ] API endpoints
  - [ ] Auth routes (handled by BetterAuth)
  - [ ] `GET /challenges` - list challenges
  - [ ] `GET /challenges/:id` - challenge details
  - [ ] `POST /jobs` - submit inference job
  - [ ] `GET /jobs/:id` - job status/result
  - [ ] `POST /submissions` - submit design for scoring
  - [ ] `GET /submissions` - user's submission history
  - [ ] `GET /users/me` - current user + credits
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

_Not started yet_

---

## Completed

_Move completed tasks here_
