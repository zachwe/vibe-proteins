# ACE2: The Natural Receptor as Decoy

**Type:** Natural human protein / Engineered decoy  
**Target:** [SARS-CoV-2 Spike RBD](https://www.ncbi.nlm.nih.gov/gene/43740568)  
**PDB:** [6M0J](https://www.rcsb.org/structure/6M0J)  
**Concept:** Use the virus's own target against it

## The Elegant Idea

[ACE2](https://en.wikipedia.org/wiki/Angiotensin-converting_enzyme_2) (Angiotensin-Converting Enzyme 2) is the human receptor that SARS-CoV-2 uses to enter cells. The virus's [Spike protein](https://en.wikipedia.org/wiki/Coronavirus_spike_protein) evolved specifically to grab ACE2.

The decoy strategy is beautifully simple: **flood the body with soluble ACE2 that binds the virus before it can reach cells.**

It's like sending out decoys to distract incoming missiles.

## The Structure That Changed Everything

### The First Glimpse

In early 2020, researchers at [Westlake University](https://en.westlake.edu.cn/) in China raced to determine how SARS-CoV-2 binds human cells. [Jun Lan](https://scholar.google.com/citations?user=jWWNqGMAAAAJ) and colleagues crystallized the Spike-ACE2 complex and [published the structure](https://www.nature.com/articles/s41586-020-2180-5) on March 30, 2020.

This 2.45 Å resolution structure ([PDB 6M0J](https://www.rcsb.org/structure/6M0J)) became one of the most important in pandemic science.

### What It Revealed

The structure showed exactly how Spike's [Receptor Binding Domain (RBD)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7526584/) engages ACE2:

- **Large interface** — ~850 Å² buried surface area
- **Key contacts** — Spike K417, Y453, Q493, Y505 → ACE2 K31, E35, D38, K353
- **Why so infectious** — SARS-CoV-2 binds ACE2 tighter than SARS-CoV-1

Every drug and vaccine designer in the world used this structure.

## Engineered ACE2 Decoys

### Improving on Nature

Several groups engineered enhanced ACE2 variants:

| Modification | Effect |
|--------------|--------|
| S19W, N330Y mutations | Higher affinity for Spike |
| [Fc fusion](https://en.wikipedia.org/wiki/Fc_fusion) | Longer half-life in body |
| Trimeric constructs | Mimics cell surface presentation |
| Domain truncation | Smaller, easier to produce |

[APN01](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7418709/), a recombinant soluble ACE2 from [Apeiron Biologics](https://www.apeiron-biologics.com/), entered clinical trials.

### The Variant-Proof Promise

In theory, ACE2 decoys should be resistant to viral escape:

> **If the virus mutates away from ACE2, it can't infect cells.**

Unlike antibodies targeting variable viral surfaces, ACE2 targets the virus's essential binding site. The virus is trapped by its own entry mechanism.

## Why It's Included Here

For ProteinDojo, ACE2 represents the **ground truth**—the protein that evolution optimized Spike to bind.

When you design binders for Spike RBD, you're competing against ACE2. Your designs will be evaluated on how they compare to this natural interaction:

- **Can you beat ACE2's affinity?** — Engineered binders have achieved sub-nanomolar Kd
- **Can you find different binding modes?** — Alternative sites might be more durable
- **What can you learn from ACE2?** — Study the interface to inspire your designs

## Design Considerations

Study the [6M0J structure](https://www.rcsb.org/structure/6M0J) carefully:

1. **Hotspot residues** — K417 and Q493 on Spike are critical
2. **Electrostatics** — Multiple salt bridges stabilize binding
3. **Shape complementarity** — The surfaces match closely
4. **Buried hydrophobics** — Core of the interface is water-excluded

Your designed binder could mimic these features, or find completely different solutions.

## References

- [Lan et al. 2020](https://www.nature.com/articles/s41586-020-2180-5) — Original structure (Nature)
- [PDB Entry 6M0J](https://www.rcsb.org/structure/6M0J)
- [Engineered ACE2 review](https://www.nature.com/articles/s41392-020-00374-6) — Signal Transduction and Targeted Therapy
- [ACE2 at UniProt](https://www.uniprot.org/uniprotkb/Q9BYF1)
- [Apeiron Biologics](https://www.apeiron-biologics.com/) — APN01 developer