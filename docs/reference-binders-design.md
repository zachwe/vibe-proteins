# Reference Binders Feature Design

## Overview

Seed each challenge's leaderboard with 2-3 well-characterized reference binders (therapeutic antibodies, nanobodies, designed proteins) to provide context and goals for users. Each reference includes educational content explaining what it is and its history.

## Database Schema

### New Table: `reference_binders`

```sql
CREATE TABLE reference_binders (
  id TEXT PRIMARY KEY,                    -- e.g., 'adalimumab-tnf'
  challenge_id TEXT NOT NULL REFERENCES challenges(id),

  -- Basic info
  name TEXT NOT NULL,                     -- e.g., 'Adalimumab (Humira)'
  slug TEXT NOT NULL,                     -- URL-safe, e.g., 'adalimumab'
  binder_type TEXT NOT NULL,              -- 'antibody', 'nanobody', 'fusion_protein', 'designed', 'natural'

  -- Structure data
  pdb_id TEXT,                            -- e.g., '3WD5'
  pdb_url TEXT,                           -- Full RCSB URL
  binder_chain_id TEXT,                   -- Which chain is the binder in the complex PDB
  binder_sequence TEXT,                   -- Extracted binder sequence
  complex_structure_url TEXT,             -- S3 URL to processed complex structure

  -- Scores (populated by running through our scoring pipeline)
  composite_score REAL,
  ip_sae_score REAL,
  plddt REAL,
  ptm REAL,
  interface_area REAL,
  shape_complementarity REAL,

  -- Educational content
  help_article_slug TEXT,                 -- e.g., 'adalimumab' -> /help/reference-binders/adalimumab
  short_description TEXT,                 -- One-liner for leaderboard display

  -- Metadata
  discovery_year INTEGER,                 -- When was it discovered/designed
  approval_status TEXT,                   -- 'fda_approved', 'clinical_trial', 'research_tool', 'de_novo_designed'
  is_active INTEGER DEFAULT 1,            -- For soft delete
  sort_order INTEGER DEFAULT 0,           -- Display order within challenge
  created_at INTEGER NOT NULL
);
```

### Help Article Content Structure

Store as markdown files or in a `help_articles` table:

```sql
CREATE TABLE help_articles (
  slug TEXT PRIMARY KEY,                  -- e.g., 'adalimumab'
  title TEXT NOT NULL,
  content TEXT NOT NULL,                  -- Full markdown content
  category TEXT NOT NULL,                 -- 'reference-binder', 'concept', 'tutorial'
  related_challenges TEXT,                -- JSON array of challenge IDs
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

## Sample Reference Binders Data

### TNF-alpha (3 references)

```json
[
  {
    "id": "adalimumab-tnf",
    "challengeId": "tnf-alpha",
    "name": "Adalimumab (Humira)",
    "slug": "adalimumab",
    "binderType": "antibody",
    "pdbId": "3WD5",
    "shortDescription": "Fully human antibody, once the world's best-selling drug",
    "helpArticleSlug": "adalimumab",
    "discoveryYear": 2002,
    "approvalStatus": "fda_approved"
  },
  {
    "id": "infliximab-tnf",
    "challengeId": "tnf-alpha",
    "name": "Infliximab (Remicade)",
    "slug": "infliximab",
    "binderType": "antibody",
    "pdbId": "4G3Y",
    "shortDescription": "Chimeric antibody with different binding mechanism than adalimumab",
    "helpArticleSlug": "infliximab",
    "discoveryYear": 1998,
    "approvalStatus": "fda_approved"
  },
  {
    "id": "etanercept-tnf",
    "challengeId": "tnf-alpha",
    "name": "Etanercept (Enbrel)",
    "slug": "etanercept",
    "binderType": "fusion_protein",
    "pdbId": null,
    "shortDescription": "Receptor-Fc fusion - a 'decoy receptor' approach",
    "helpArticleSlug": "etanercept",
    "discoveryYear": 1998,
    "approvalStatus": "fda_approved"
  }
]
```

### GFP (3 references - great variety)

```json
[
  {
    "id": "gfp-enhancer-nanobody",
    "challengeId": "gfp",
    "name": "GFP Enhancer Nanobody",
    "slug": "gfp-enhancer",
    "binderType": "nanobody",
    "pdbId": "3K1K",
    "shortDescription": "Camelid nanobody that enhances GFP fluorescence",
    "helpArticleSlug": "gfp-enhancer-nanobody",
    "discoveryYear": 2009,
    "approvalStatus": "research_tool"
  },
  {
    "id": "lag16-gfp",
    "challengeId": "gfp",
    "name": "LaG16 Nanobody",
    "slug": "lag16",
    "binderType": "nanobody",
    "pdbId": "6LR7",
    "shortDescription": "High-affinity nanobody binding opposite side from enhancer",
    "helpArticleSlug": "lag16-nanobody",
    "discoveryYear": 2020,
    "approvalStatus": "research_tool"
  },
  {
    "id": "gfp-minimizer",
    "challengeId": "gfp",
    "name": "GFP Minimizer Nanobody",
    "slug": "gfp-minimizer",
    "binderType": "nanobody",
    "pdbId": "3G9A",
    "shortDescription": "Nanobody that slightly dims GFP - opposite effect of enhancer",
    "helpArticleSlug": "gfp-minimizer-nanobody",
    "discoveryYear": 2009,
    "approvalStatus": "research_tool"
  }
]
```

### Insulin (great example of designed binder)

```json
[
  {
    "id": "s2b-insulin",
    "challengeId": "insulin",
    "name": "S2B (De Novo Designed)",
    "slug": "s2b-designed-binder",
    "binderType": "designed",
    "pdbId": "9DNN",
    "shortDescription": "Computationally designed binder - more potent than insulin itself!",
    "helpArticleSlug": "s2b-insulin-binder",
    "discoveryYear": 2024,
    "approvalStatus": "de_novo_designed"
  },
  {
    "id": "oxi005-insulin",
    "challengeId": "insulin",
    "name": "OXI-005 Analytical Antibody",
    "slug": "oxi005",
    "binderType": "antibody",
    "pdbId": "6Z7Y",
    "shortDescription": "Research antibody used in insulin detection assays",
    "helpArticleSlug": "oxi005-antibody",
    "discoveryYear": 2020,
    "approvalStatus": "research_tool"
  }
]
```

## Sample Help Article Content

### adalimumab.md

```markdown
# Adalimumab (Humira)

**Type:** Fully human monoclonal antibody (IgG1)
**Target:** TNF-alpha
**PDB:** [3WD5](https://www.rcsb.org/structure/3WD5)
**Approved:** 2002 (FDA)

## What is it?

Adalimumab is a fully human monoclonal antibody that binds and neutralizes
TNF-alpha, a key inflammatory signaling protein. It was the first fully
human antibody approved by the FDA and became the world's best-selling
drug, generating over $20 billion in annual revenue at its peak.

## Discovery & Development

Adalimumab was developed using **phage display technology** at Cambridge
Antibody Technology (now part of AstraZeneca) and BASF (later Abbott,
now AbbVie). Unlike earlier TNF blockers like infliximab, which contain
mouse sequences, adalimumab is entirely human, reducing immunogenicity.

The development process:
1. Human antibody gene libraries were created
2. Phage display selected high-affinity TNF-alpha binders
3. Lead candidates were optimized for stability and manufacturability
4. Clinical trials showed remarkable efficacy in rheumatoid arthritis

## How it binds

Adalimumab binds TNF-alpha at a site that overlaps with the receptor
binding interface. The crystal structure (PDB 3WD5) shows that the
antibody makes extensive contacts across a large surface area, with
the heavy chain contributing most of the binding energy.

Key binding features:
- Buries ~2,000 Å² of surface area
- Heavy chain CDR3 makes critical contacts
- Blocks TNF from binding its receptor TNFR1/TNFR2

## Clinical use today

Adalimumab is approved for:
- Rheumatoid arthritis
- Psoriatic arthritis
- Ankylosing spondylitis
- Crohn's disease
- Ulcerative colitis
- Plaque psoriasis
- Hidradenitis suppurativa
- Uveitis
- Juvenile idiopathic arthritis

Biosimilars are now available as the original patents have expired.

## Why this matters for protein design

Adalimumab demonstrates that:
1. **Large interfaces work** - ~2,000 Å² buried surface area provides
   high affinity and specificity
2. **Blocking the receptor site is effective** - competitive inhibition
   is a validated mechanism
3. **Stability matters** - the drug must survive manufacturing, storage,
   and injection

When designing your own TNF-alpha binder, consider whether you can
achieve similar interface coverage and receptor site overlap.

## References

- Hu S, et al. (2013) "Comparison of the Inhibition Mechanisms of Adalimumab
  and Infliximab" J Biol Chem 288:27059-27067
- Structure: https://www.rcsb.org/structure/3WD5
```

### s2b-insulin-binder.md

```markdown
# S2B - De Novo Designed Insulin Receptor Binder

**Type:** Computationally designed protein
**Target:** Insulin receptor (Site 2)
**PDB:** [9DNN](https://www.rcsb.org/structure/9DNN)
**Published:** 2024

## What is it?

S2B is a **de novo designed protein** that binds to the insulin receptor
at "Site 2" - a different location than where insulin itself binds
(Site 1). Remarkably, S2B is more potent than insulin at lowering blood
glucose in animal studies!

## Why this is exciting for protein design

This is one of the most impressive demonstrations of computational protein
design for therapeutic applications:

1. **It works better than nature** - S2B designs showed longer-lasting
   glucose lowering than insulin itself
2. **Novel binding site** - Rather than copying insulin, researchers
   designed something entirely new
3. **Modern AI methods** - Used RFdiffusion and ProteinMPNN (similar
   tools available on ProteinDojo!)

## How it was designed

The Baker lab at University of Washington used:

1. **RFdiffusion** - Generated protein backbones conditioned on the
   insulin receptor structure
2. **ProteinMPNN** - Designed sequences for promising backbones
3. **AlphaFold2** - Predicted structures to filter candidates
4. **Experimental testing** - Validated top designs in cells and mice

Over 100,000 designs were computationally screened, with dozens tested
experimentally. The best (S2B) showed:
- Sub-nanomolar binding affinity
- Glucose lowering lasting 2-3x longer than insulin
- Activity on disease-causing insulin receptor mutants

## Structure insights

Looking at PDB 9DNN:
- S2B forms a compact helical bundle
- Binds the FnIII-1 domain of the insulin receptor
- Creates a novel protein-protein interface not seen in nature

## What you can learn

When you're designing binders on ProteinDojo, S2B shows that:
1. **De novo design works** - You don't need to copy existing binders
2. **Novel epitopes are possible** - Don't limit yourself to known binding sites
3. **Iteration matters** - The best design came from screening many candidates

Your designs use similar methods to those that created S2B!

## References

- Fallas JA, et al. (2024) "De novo design of insulin receptor agonists"
  Nature (in press)
- Structure: https://www.rcsb.org/structure/9DNN
```

## UI/UX Design

### Leaderboard Display

```
┌─────────────────────────────────────────────────────────────────────┐
│  TNF-alpha Leaderboard                                              │
├─────────────────────────────────────────────────────────────────────┤
│  REFERENCE BINDERS                                                  │
│  ─────────────────                                                  │
│  🏆 Adalimumab (Humira)         A+   ipSAE: 2.1   [Learn more →]  │
│     FDA-approved antibody • PDB 3WD5                               │
│                                                                     │
│  🥈 Infliximab (Remicade)       A    ipSAE: 2.4   [Learn more →]  │
│     FDA-approved antibody • PDB 4G3Y                               │
│                                                                     │
│  🧬 Etanercept (Enbrel)         A-   ipSAE: 2.8   [Learn more →]  │
│     Receptor-Fc fusion protein                                      │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  USER SUBMISSIONS                                                   │
│  ────────────────                                                   │
│  1. @proteinwizard              B+   ipSAE: 3.2   Jan 7, 2025      │
│  2. @molecule_master            B    ipSAE: 3.5   Jan 6, 2025      │
│  3. @design_rookie              C+   ipSAE: 4.1   Jan 5, 2025      │
│  ...                                                                │
└─────────────────────────────────────────────────────────────────────┘
```

### Reference Binder Detail Page

Route: `/challenges/:challengeId/reference/:slug`

Shows:
- Full help article content
- 3D structure viewer (Mol*) with binder highlighted
- Score comparison with user's best submission
- Link to original PDB entry

### Binder Type Badges

| Type | Badge | Color |
|------|-------|-------|
| `antibody` | 🧪 Antibody | Blue |
| `nanobody` | 🔬 Nanobody | Purple |
| `fusion_protein` | 🔗 Fusion | Green |
| `designed` | 🤖 Designed | Orange |
| `natural` | 🌿 Natural | Teal |

## API Endpoints

```typescript
// Get reference binders for a challenge
GET /api/challenges/:challengeId/reference-binders
Response: ReferenceBinder[]

// Get single reference binder with full article
GET /api/reference-binders/:id
Response: ReferenceBinder & { article: HelpArticle }

// Get help article by slug
GET /api/help/:slug
Response: HelpArticle
```

## Implementation Tasks

See TASKS.md Phase 12 for implementation checklist.

## Content Creation Process

For each reference binder article:

1. **Research phase**
   - Find PDB structure
   - Read original publication
   - Gather discovery/development history
   - Note current clinical/research use

2. **Writing phase**
   - What is it (1 paragraph)
   - Discovery & development (2-3 paragraphs)
   - How it binds - structural insights (2 paragraphs)
   - Current use (bullet list)
   - Why this matters for protein design (2 paragraphs)
   - References (3-5 links)

3. **Technical phase**
   - Download PDB structure
   - Extract binder chain
   - Run through scoring pipeline
   - Upload processed structure to S3

## Priority Order

### Must have (MVP)
1. **Lysozyme** (3 binders) - Classic model, tons of structures
2. **GFP** (3 binders) - Good variety of nanobodies
3. **Spike RBD** (3 binders) - Highly relevant, well-known

### Should have
4. **TNF-alpha** (3 binders) - Shows different mechanisms
5. **IL-6** (2 binders) - Major therapeutic target
6. **HER2** (2 binders) - Demonstrates combination therapy

### Nice to have
7. **PD-L1** (2 binders) - Checkpoint inhibitors
8. **VEGF** (2 binders) - Anti-angiogenesis
9. **Insulin** (2 binders) - Includes designed binder!
10. Rest of targets (1-2 each)
