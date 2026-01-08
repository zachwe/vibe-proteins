# S2B: The AI-Designed Insulin Receptor Binder

**Type:** [De novo](https://en.wikipedia.org/wiki/De_novo_protein_structure_prediction) designed protein  
**Target:** [Insulin receptor](https://www.uniprot.org/uniprotkb/P06213) (Site 2)  
**PDB:** [9DNN](https://www.rcsb.org/structure/9DNN)  
**Designer:** [David Baker Lab](https://www.bakerlab.org/), University of Washington  
**Published:** 2024

## Why This Matters For You

S2B represents a watershed moment in protein design: **a completely artificial protein that outperforms insulin**, created using the same tools available on ProteinDojo. This isn't science fiction—it's what modern computational methods can achieve.

## The Baker Lab Story

### The Pioneer

[David Baker](https://www.bakerlab.org/members/david-baker/) has spent 30 years at the [University of Washington](https://www.washington.edu/) trying to solve protein design. His lab created [Rosetta](https://www.rosettacommons.org/), the software suite that powered early protein design, and more recently developed [RFdiffusion](https://www.bakerlab.org/2023/07/11/diffusion-model-for-protein-design/) and [ProteinMPNN](https://www.science.org/doi/10.1126/science.add2187).

He won the [2024 Nobel Prize in Chemistry](https://www.nobelprize.org/prizes/chemistry/2024/baker/facts/) for computational protein design—announced while this article was being written.

### The Challenge

Insulin is one of medicine's most important molecules. But designing proteins that interact with the [insulin receptor](https://www.uniprot.org/uniprotkb/P06213) has been notoriously difficult:

- The receptor is huge and complex
- It has multiple binding sites
- Natural insulin uses a very specific binding mode

The Baker lab asked: **can AI design something entirely new that binds better?**

## The Design Process

### Step 1: RFdiffusion

The team used [RFdiffusion](https://www.nature.com/articles/s41586-023-06415-8)—a [diffusion model](https://lilianweng.github.io/posts/2021-07-11-diffusion-models/) trained on protein structures—to generate novel protein backbones. They conditioned the model on the insulin receptor's "Site 2" region:

- Generated ~100,000 candidate backbones
- Each with no similarity to any natural protein
- All designed to complement the receptor surface

### Step 2: ProteinMPNN

[ProteinMPNN](https://www.science.org/doi/10.1126/science.add2187) (the same tool you're using on ProteinDojo!) then designed amino acid sequences for each backbone:

- Predicts which sequences will fold into the target shape
- Optimizes for stability and solubility
- Runs in seconds per design

### Step 3: AlphaFold2 Filtering

The team used [AlphaFold2](https://alphafold.ebi.ac.uk/) to predict which designs would actually fold correctly:

- Filtered based on [pLDDT scores](https://alphafold.ebi.ac.uk/faq) (structure confidence)
- Checked that predicted structures matched intended designs
- Eliminated ~99% of candidates

### Step 4: Experimental Testing

The top candidates were synthesized and tested in the lab:

- Binding assays confirmed receptor interaction
- [Cryo-EM](https://en.wikipedia.org/wiki/Cryogenic_electron_microscopy) structures validated binding mode
- Cell assays showed functional activity
- Mouse experiments demonstrated glucose lowering

## The Results

S2B achieved remarkable performance:

| Property | Insulin | S2B |
|----------|---------|-----|
| Receptor affinity | ~1 nM | ~0.1 nM (10x better) |
| Duration of action | 4-6 hours | 12+ hours |
| Novel fold? | No (evolved) | Yes (designed) |

The [cryo-EM structure](https://www.rcsb.org/structure/9DNN) confirmed S2B binds exactly as designed.

## Why Site 2?

Insulin binds its receptor at two locations:

1. **Site 1** — Primary binding site (well-studied)
2. **Site 2** — Secondary site that enhances signaling

S2B was designed for Site 2 specifically, showing AI can find binding modes that evolution never explored.

## What This Means For Protein Design

1. **The tools work** — RFdiffusion + ProteinMPNN created a functional protein
2. **AI can beat nature** — Designed proteins can outperform evolved ones
3. **Novel interfaces are accessible** — You don't need to copy natural proteins
4. **Your designs might work too** — These methods are available on ProteinDojo

## Try It Yourself

The workflow that created S2B is essentially:
1. Define your target surface
2. Generate backbones with RFdiffusion
3. Design sequences with ProteinMPNN
4. Filter with structure prediction
5. Test experimentally

Steps 1-4 are exactly what you're doing on ProteinDojo. The main difference is scale—the Baker lab tested thousands of designs experimentally.

## References

- [Baker lab preprint](https://www.biorxiv.org/content/10.1101/2024.02.20.581293) — Full methodology
- [RFdiffusion paper](https://www.nature.com/articles/s41586-023-06415-8) — Nature, 2023
- [ProteinMPNN paper](https://www.science.org/doi/10.1126/science.add2187) — Science, 2022
- [PDB structure 9DNN](https://www.rcsb.org/structure/9DNN)
- [2024 Nobel Prize announcement](https://www.nobelprize.org/prizes/chemistry/2024/baker/facts/)
- [STAT News coverage](https://www.statnews.com/2024/02/22/insulin-ai-protein-design-baker-lab/) — Accessible summary