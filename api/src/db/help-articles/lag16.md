# LaG16: Ultra-High Affinity GFP Binder

**Type:** [Llama](https://en.wikipedia.org/wiki/Llama)-derived single-domain antibody (VHH)  
**Target:** [Green Fluorescent Protein](https://en.wikipedia.org/wiki/Green_fluorescent_protein)  
**PDB:** [6LR7](https://www.rcsb.org/structure/6LR7)  
**Published:** 2020  

## Sub-Nanomolar Affinity

LaG16 achieves remarkable binding strength through clever engineering: when combined with the GFP Enhancer as a tandem construct, it reaches a [dissociation constant](https://en.wikipedia.org/wiki/Dissociation_constant) (Kd) of ~0.5 nM.

To put this in perspective: at this affinity, if you mixed equal amounts of LaG16 and GFP, 99.95% would be bound together. This is "essentially irreversible" binding on biological timescales.

## The Tandem Strategy

### Why Two Nanobodies?

Single nanobodies typically achieve Kd values of 1-100 nM. To go tighter, [Akhtar et al.](https://www.nature.com/articles/s41598-020-62606-7) used a clever approach:

1. Find two nanobodies that bind **different, non-overlapping** sites on GFP
2. Connect them with a flexible [linker](https://en.wikipedia.org/wiki/Linker_(protein))
3. The [avidity effect](https://en.wikipedia.org/wiki/Avidity) multiplies the affinities

LaG16 binds the "backside" of the GFP barrel, while the Enhancer binds near the chromophore. Both can bind simultaneously.

### The Math of Avidity

If two binders each have Kd = 100 nM, their tandem construct can achieve:

Kd(apparent) ≈ Kd₁ × Kd₂ / (local concentration factor)

This can easily reach sub-nanomolar territory—a 100-1000x improvement over either component alone.

## Structural Details

The [high-resolution structure (1.67 Å)](https://www.rcsb.org/structure/6LR7) reveals:

- LaG16 binds the opposite face from the chromophore
- CDR3 loop makes the majority of contacts
- Several ordered water molecules mediate key interactions
- The epitope doesn't overlap with the Enhancer at all

This non-overlapping binding is essential—if the sites overlapped, the tandem construct wouldn't work.

## Applications

Ultra-high affinity GFP binders enable:

### Protein Purification

Pull down GFP-tagged proteins with near-complete efficiency. Even low-abundance proteins can be captured.

### Long-Term Imaging

When binders don't dissociate, you can track GFP-tagged proteins indefinitely without signal loss from unbinding.

### Single-Molecule Studies

Sub-nanomolar affinity means every GFP molecule stays bound. No blinking from dissociation events.

### Biosensors

Ultra-tight binding creates binary on/off sensors with minimal background.

## Design Lessons

LaG16 demonstrates powerful engineering principles:

1. **Avidity beats affinity** — Two weak binders become one strong one
2. **Orthogonal epitopes enable combinations** — Map your target's surface carefully
3. **Sub-nanomolar is achievable** — Even with small proteins like nanobodies
4. **Linker design matters** — Too short blocks simultaneous binding; too long loses avidity

## References

- [Akhtar et al. 2020](https://www.nature.com/articles/s41598-020-62606-7) — Tandem nanobody engineering
- [PDB Entry 6LR7](https://www.rcsb.org/structure/6LR7)
- [Avidity vs affinity](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7326972/) — Conceptual review
- [GFP nanobody tools](https://www.chromotek.com/technology/nano-traps/) — Commercial applications
