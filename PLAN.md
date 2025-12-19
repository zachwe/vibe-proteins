# VibeProteins: A Protein Design Learning Platform

A platform for learning protein design by practicing computationally designing proteins against real druggable targets.

## Core Mental Model

- **Target** = protein you're attacking (almost always proteins: enzymes, receptors, ion channels, transcription factors)
- **Drug** = thing you design (in our case, always a protein)
- **Modality** = protein → protein binding
- **Goal** = bind, block, stabilize, or mimic

## Design Task Types

1. **Binders** - Design a protein that binds the target
2. **Blockers** - Design a protein that blocks a specific protein-protein interaction
3. **Decoys** - Design a protein that mimics a natural binding partner
4. **Stabilizers** - Design a protein that locks a target in a specific conformation

---

## Starter Targets (10 Proteins)

### Level 1 — Free Binders (Lowest Friction)

| # | Target | Task | Why | Known Drugs | Teaches |
|---|--------|------|-----|-------------|---------|
| 1 | **SARS-CoV-2 Spike RBD** | Design any binder | Huge exposed surface, thousands of solved structures | ACE2, many antibodies | Interface formation, epitope diversity |
| 2 | **IL-6** (Interleukin-6) | Design a binder | Small, stable, well-studied cytokine | Tocilizumab | Cytokine geometry, compact interfaces |
| 3 | **VEGF-A** | Design a binder | Symmetric dimer, classic biologic target | Bevacizumab, aflibercept | Dimer interfaces, symmetry |

### Level 2 — Block a Known Interaction (PPI Targeting)

| # | Target | Task | Why | Known Drugs | Teaches |
|---|--------|------|-----|-------------|---------|
| 4 | **PD-L1** | Block PD-1 binding | Flat PPI, clinically validated | Atezolizumab | Competing with natural ligands |
| 5 | **ACE2** | Design a Spike-binding decoy | Clean decoy framing, abundant data | None approved; many papers | Receptor mimicry |
| 6 | **IL-2** | Block IL-2Rα (CD25) binding | Multi-interface cytokine | Basiliximab | Selective epitope targeting |

### Level 3 — Decoys & Mimics (Protein-Design-Native)

| # | Target | Task | Why | Known Drugs | Teaches |
|---|--------|------|-----|-------------|---------|
| 7 | **TNF-α** | Design a receptor-like decoy | Trimeric symmetry, classic decoy success | Etanercept | Oligomeric targets |
| 8 | **IL-1β** | Design IL-1R mimic | Proven decoy biology | Anakinra | Stability vs affinity tradeoffs |

### Level 4 — Enzyme Modulation (Advanced)

| # | Target | Task | Why | Known Drugs | Teaches |
|---|--------|------|-----|-------------|---------|
| 9 | **MMP-9** | Allosteric inhibitor or active-site blocker | Historically hard for small molecules | — | Why enzymes are tricky for proteins |
| 10 | **KRAS (G12D or WT)** | Bind and stabilize inactive conformation | Canonical "undruggable" protein | Small-molecule covalent (G12C) | Conformational control, realism |

### Future: Level 5 — Dark Targets / Open Problems

- Pharos Tdark proteins
- Undrugged transcription factors
- Novel PPIs
- No single right answer; graded on reasoning + structure plausibility

---

## Scoring Metrics

### 1. Structural Confidence

**Goal**: Is the designed sequence folding into a plausible structure?

| Metric | Description |
|--------|-------------|
| **pLDDT** | AlphaFold/RF per-residue confidence (0-100) |
| **pTM** | Global topology score |
| **Self-consistency RMSD** | Re-predict structure from sequence, measure deviation |

### 2. Interface Quality

| Metric | Description |
|--------|-------------|
| **ipSAE** | Interface predicted Structure-Aligned Energy (from Adaptyv). Primary binding predictor. |
| **iRMSD** | Interface RMSD - deviation from intended binding pose (lower = better) |
| **Shape Complementarity** | Surface fit score (0-1, higher = snugger fit) |
| **Buried Surface Area (BSA)** | Å² of interface buried (larger = stronger) |

### 3. Task-Specific Metrics

#### Binders (Level 1)
- Interface presence (fraction of residues at target contact)
- Non-clash score
- Symmetry match (for symmetric targets)

```
Binder Score = weighted(ipSAE + Shape + BSA + Confidence)
```

#### Blockers (Level 2)
- Epitope overlap (% overlap with known PPI site)
- Competition likelihood (design vs natural partner)

```
Blocker Score = weighted(ipSAE + Epitope/Competition + Confidence)
```

#### Decoys (Level 3)
- Mimic similarity (RMSD to natural partner's interface)
- Charge pattern match
- Secondary structure match

```
Decoy Score = weighted(ipSAE + Mimic RMSD + Confidence)
```

#### Enzyme Modulation (Level 4)
- Active site proximity (distance to catalytic residues)
- Allosteric shift proxy (differential AF2/RF with/without ligand)

```
Enzyme Score = weighted(ipSAE + Active site/Allostery + Confidence)
```

### 4. Composite Score

```
Design_Score = 0.4 * normalized(ipSAE)
             + 0.3 * normalized(interface + target-specific)
             + 0.3 * normalized(structure confidence)
```

### 5. Robustness Metrics

- **Cross-conformation scores**: Score design against alternate conformations
- **Mutational sensitivity**: Small perturbations to sequence; penalize if structure collapses

---

## Data Sources

| Need | Source |
|------|--------|
| Valid targets | ChEMBL, Open Targets |
| Protein structures | AlphaFold DB, PDB |
| Known interfaces | PDB, literature |
| Difficulty labels | Pharos (Tclin → Tdark) |
| Ground truth binders | DrugBank, BindingDB |
| Druggability annotations | CanSAR, DGIdb, Pharos |

---

## Platform Design

### Target Pack Format

Each exercise ships as a **Target Pack** containing:

- Target protein sequence + structure
- Known partners (optional)
- Allowed modality (binder / blocker / decoy)
- Scoring rubric
- "Hints" unlocked progressively

### User Submission

Users submit:
- Designed protein sequence/structure
- Claimed mechanism ("binds epitope X")

### System Response

- Structural confidence scores
- Interface metrics
- Qualitative feedback ("likely binder but wrong surface")
- Leaderboard position

### Visual Feedback

- 3D model viewer with interactive interface mapping
- Confidence heatmaps
- Contact frequency visualization
- Metric badges (green/yellow/red)

---

## Technology Stack

### Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  React Frontend │────▶│  Node.js API    │────▶│  Modal (Python) │
│  (TypeScript)   │     │  (TypeScript)   │     │  GPU Inference  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │  SQLite + S3/R2 │
                        │  (Data Storage) │
                        └─────────────────┘
```

### Frontend
- **React** with TypeScript
- **Vite** for build tooling
- **vite-ssg** or similar for prerendering public pages (splash, blog) for SEO
- App pages (dashboard, design tools) remain client-side SPA

### API Server
- **Node.js** with TypeScript
- **BetterAuth** for authentication
- RESTful endpoints
- Job orchestration (trigger Modal jobs, poll for completion)

### Database & Storage
- **SQLite** for relational data (users, jobs, targets, submissions)
- **S3 / Cloudflare R2** for file storage (protein structures, design outputs)

### GPU Inference (Modal)
- **Python** functions running on Modal's infrastructure
- Models: RFdiffusion, BoltzGen, ProteinMPNN, AlphaFold2
- Abstraction layer for swapping inference providers

### Inference Provider Abstraction

```typescript
// Pseudocode for provider abstraction
interface InferenceProvider {
  submitJob(type: JobType, input: JobInput): Promise<JobId>
  getJobStatus(jobId: JobId): Promise<JobStatus>
  getJobResult(jobId: JobId): Promise<JobResult>
}

// Implementations
class ModalProvider implements InferenceProvider { ... }
class ReplicateProvider implements InferenceProvider { ... }  // Future
class LocalGPUProvider implements InferenceProvider { ... }   // Future
```

### Job Flow

1. User submits design request via frontend
2. API server creates job record in SQLite
3. API server triggers Modal function (HTTP call)
4. Frontend polls `/jobs/{id}/status` endpoint
5. Modal function completes, stores result in S3
6. API server updates job status, returns result URL
7. Frontend fetches and displays result

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| API Language | TypeScript | BetterAuth compatibility, unified frontend/backend |
| Inference Code | Python | ML ecosystem, Modal's primary SDK |
| Database | SQLite | Simple for MVP, easy local dev |
| File Storage | S3/R2 | Scalable, cheap, standard |
| Job Updates | Polling | Simple, stateless, works everywhere |
| Auth | BetterAuth | Modern, TypeScript-native, good DX |

---

## Features

### Core User Stories

1. **Authentication**
   - Users can sign up / log in (BetterAuth)
   - Users start with N free credits

2. **Browse Challenges**
   - View list of protein design challenges organized by difficulty level
   - Read educational content about each target (biology, disease relevance, why it matters)
   - See challenge requirements (design a binder, block a PPI, etc.)
   - View difficulty rating and estimated credit cost

3. **Work on a Challenge** (Guided workflow)

   **Step 1: Explore**
   - View target structure in Mol* viewer
   - See highlighted binding sites / hotspots
   - View known binders as reference (if available)
   - Read hints and educational tips

   **Step 2: Design**
   - Select binding site (click residues or use suggested hotspot)
   - Choose design tool (RFdiffusion, BoltzGen, etc.)
   - Set parameters (binder length, number of designs)
   - Run generation (costs credits)
   - View generated candidates

   **Step 3: Evaluate**
   - Run structure prediction (AlphaFold/Boltz) on candidates
   - View predicted binding pose in Mol*
   - See preliminary scores (pLDDT, ipSAE, etc.)
   - Compare candidates side-by-side

   **Step 4: Iterate or Submit**
   - Refine parameters and regenerate, or
   - Submit best design for official scoring

4. **Submission & Scoring**
   - Submit design to challenge
   - Receive composite score based on metrics (ipSAE, interface quality, etc.)
   - See breakdown of score components
   - Get intuitive feedback ("strong binding predicted, but wrong epitope")
   - View position on challenge leaderboard

5. **Progress & History**
   - Track curriculum progress (levels completed)
   - View history of all submissions per challenge
   - Export designs (PDB, FASTA)
   - Save work-in-progress drafts

6. **Credits System**
   - Free credits on signup
   - Purchase additional credits
   - Different operations have different costs:

   | Operation | Cost |
   |-----------|------|
   | Browse / explore target | Free |
   | Run scoring metrics | Free or minimal |
   | Run AlphaFold prediction | Low-Medium |
   | Run RFdiffusion pipeline | Medium |
   | Run BoltzGen | High |

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Design UX | Guided step-by-step | Better for learning, clearer feedback |
| External uploads | No | Platform-only ensures consistent scoring |
| Hints | Progressive unlock | Help stuck users without giving away answers |

---

## Implementation Phases

### Phase 1: MVP (No Wet Lab Required)

- [ ] Set up target pack infrastructure
- [ ] Implement structural confidence scoring (pLDDT, pTM)
- [ ] Integrate ipSAE computation
- [ ] Build basic interface quality metrics
- [ ] Create 3D visualization component
- [ ] Implement first 3 targets (Spike RBD, IL-6, VEGF-A)

### Phase 2: Full Curriculum

- [ ] Add remaining 7 starter targets
- [ ] Implement task-specific scoring for each level
- [ ] Build progressive hint system
- [ ] Add leaderboard functionality
- [ ] Community features (design convergence analysis)

### Phase 3: Advanced Features

- [ ] "Tdark" hard mode targets
- [ ] Cross-conformation robustness testing
- [ ] Mutational sensitivity analysis

### [Speculative] Phase 4: Wet Lab Integration

- [ ] Experimental KD/IC50 validation
- [ ] Stability measurements (Tm)
- [ ] Cellular assay integration
- [ ] Retrofit experimental labels to scores

---

## Tools & Dependencies to Investigate

### Protein Design
- **RFdiffusion Binder** - End-to-end binder design
- **BoltzGen** - Generative model for protein structures
- **RFdiffusion** - Diffusion-based binder design
- **ProteinMPNN** - Sequence design from structure

### Structure Prediction
- AlphaFold2 / ColabFold

### Scoring
- ipSAE computation (need to find implementation)

### Visualization
- **Mol*** (molstar) - Web-native 3D molecular viewer, embeds in React

### Data APIs
- ChEMBL API for target data
- AlphaFold DB API for structures
- PDB API

---

## Success Criteria

1. Users can learn protein design progressively (easy → hard)
2. Immediate computational feedback without wet lab
3. Scores correlate with experimental success (validate over time)
4. Clear, actionable feedback on why designs succeed or fail
5. Community engagement and knowledge sharing
