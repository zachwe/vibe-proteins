# HyHEL-10: The Classic Antibody-Antigen Complex

**Type:** Mouse [monoclonal antibody](https://www.cancer.gov/publications/dictionaries/cancer-terms/def/monoclonal-antibody) (IgG1)  
**Target:** Hen egg-white [lysozyme](https://www.uniprot.org/uniprotkb/P00698)  
**PDB:** [3HFM](https://www.rcsb.org/structure/3HFM)  
**Lab:** [NIH/NIAID](https://www.niaid.nih.gov/)  
**First characterized:** 1984  

## A Textbook Example

If you've ever taken a biochemistry class, you may have seen HyHEL-10. This antibody-antigen complex has appeared in thousands of papers, dozens of textbooks, and countless lectures. It's the *E. coli* of antibody-antigen interactions—studied so thoroughly that it became the model for understanding how antibodies recognize their targets.

## The Origin Story

### Sandra Smith-Gill's Vision (1980s)

In the early 1980s, [Sandra J. Smith-Gill](https://pubmed.ncbi.nlm.nih.gov/?term=Smith-Gill+SJ) at the [National Institutes of Health](https://www.nih.gov/) set out to understand antibody recognition at atomic detail. She chose lysozyme as a target because:

- It was small and well-characterized
- [Multiple crystal structures](https://www.rcsb.org/structure/1LYZ) already existed
- It was easy to produce in large quantities (from egg whites!)

### The Hybridoma Screen

Smith-Gill's team immunized mice with hen egg-white lysozyme (HEL), then used [hybridoma technology](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7145310/)—invented just a few years earlier by [Köhler and Milstein](https://www.nobelprize.org/prizes/medicine/1984/summary/)—to create immortal cell lines producing single antibodies.

The naming convention tells the story:  
**Hy**bridoma anti-**H**en **E**gg **L**ysozyme = **HyHEL**

HyHEL-10 was the 10th clone they characterized in detail.

### The Crystal Structure

In 1987, the team published [the crystal structure at 2.5 Å resolution](https://www.science.org/doi/10.1126/science.2437653)—one of the first high-resolution views of an antibody bound to its target. The structure revealed:

- How [CDR loops](https://en.wikipedia.org/wiki/Complementarity-determining_region) form a complementary surface
- The role of [shape complementarity](https://en.wikipedia.org/wiki/Molecular_recognition) in recognition
- Why certain residues are critical for binding

## What It Taught Us

### The Lock-and-Key Model... Evolved

HyHEL-10 helped refine our understanding of molecular recognition. The antibody doesn't just fit the antigen like a simple lock and key—instead:

- Both proteins adjust their shapes slightly upon binding ([induced fit](https://en.wikipedia.org/wiki/Induced_fit_model))
- Water molecules are displaced from the interface
- The interaction buries about 750 Å² of surface area

### Key Binding Residues

The structure identified critical contacts:

| Antibody | Lysozyme | Interaction |
|----------|----------|-------------|
| Asp32 (VH) | Arg21 | [Salt bridge](https://en.wikipedia.org/wiki/Salt_bridge_(protein_and_supramolecular)) |
| Tyr33 (VH) | Gly22 | Hydrogen bond |
| Aromatic CDR residues | Trp63 | [Aromatic stacking](https://en.wikipedia.org/wiki/Stacking_(chemistry)) |

This residue-level detail enabled early [computational alanine scanning](https://en.wikipedia.org/wiki/Alanine_scanning) and [mutagenesis](https://en.wikipedia.org/wiki/Mutagenesis) studies that predicted which mutations would disrupt binding.

## Why Lysozyme?

### The Perfect Model Protein

Lysozyme has been called biology's favorite protein:

- **Discovered by Alexander Fleming** in 1922 (before penicillin!)
- **First enzyme structure solved** — 1965, by [David Phillips](https://en.wikipedia.org/wiki/David_Chilton_Phillips)
- **Deeply studied mechanism** — We know exactly how it cleaves bacterial cell walls
- **Easy to work with** — Stable, soluble, crystallizes readily

When you design binders for lysozyme on ProteinDojo, you're joining a scientific tradition dating back 100 years.

## Design Lessons

1. **Shape complementarity is key** — The antibody surface matches lysozyme's contours
2. **Electrostatics matter** — Charged residues form critical salt bridges
3. **Both chains contribute** — Heavy and light chains both make contacts
4. **Aromatic residues are common** — Tyrosine and tryptophan appear frequently at interfaces

## For Your Designs

When designing lysozyme binders, consider:

- **The active site cleft** — A natural groove for binder insertion
- **Arginine 21** — A key residue for electrostatic contacts
- **The "backside"** — Alternative binding surfaces if you don't want to inhibit enzyme activity

## References

- [Sheriff et al. 1987](https://www.science.org/doi/10.1126/science.2437653) — Original structure paper
- [PDB Entry 3HFM](https://www.rcsb.org/structure/3HFM)
- [Lysozyme at PDB-101](https://pdb101.rcsb.org/motm/9) — Molecule of the Month
- [Sandra Smith-Gill publications](https://pubmed.ncbi.nlm.nih.gov/?term=Smith-Gill+SJ)
- [Antibody recognition review](https://www.annualreviews.org/doi/10.1146/annurev.immunol.17.1.191) — Annual Review of Immunology
