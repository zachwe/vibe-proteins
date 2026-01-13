# Evolocumab (Repatha)

**Type:** Fully human [monoclonal antibody](https://www.cancer.gov/publications/dictionaries/cancer-terms/def/monoclonal-antibody) (IgG2)  
**Target:** PCSK9 (Proprotein Convertase Subtilisin/Kexin type 9)  
**PDB:** [3H42](https://www.rcsb.org/structure/3H42) (precursor antibody structure)  
**FDA Approved:** 2015  
**Developer:** [Amgen](https://www.amgen.com/)  

## What is it?

Evolocumab (brand name Repatha) blocks PCSK9, an enzyme that degrades LDL receptors. By inhibiting PCSK9, more LDL receptors survive on liver cells, clearing more "bad" cholesterol from the blood. It can lower LDL by **60-70%**—far more than statins alone.

What makes evolocumab remarkable is that the target was validated entirely by human genetics before any drug was developed. This "genetics-first" approach has become a model for modern drug discovery.

## The origin story: from French families to drug target

The PCSK9 story begins in 2003, when [Catherine Boileau](https://en.wikipedia.org/wiki/Catherine_Boileau) and her colleagues in France were studying families with [familial hypercholesterolemia](https://www.cdc.gov/genomics/disease/fh/index.htm)—a genetic disorder causing dangerously high cholesterol. Most families had mutations in the LDL receptor gene itself, but some did not.

[Nabil Seidah](https://en.wikipedia.org/wiki/Nabil_G._Seidah) at the Clinical Research Institute of Montreal had just discovered a new enzyme he called PCSK9. Boileau's team found that some French families with high cholesterol carried **gain-of-function mutations** in PCSK9—the enzyme was too active, destroying too many LDL receptors.

But the real breakthrough came in 2006. [Helen Hobbs](https://profiles.utsouthwestern.edu/profile/8952/helen-hobbs.html) and [Jonathan Cohen](https://profiles.utsouthwestern.edu/profile/8804/jonathan-cohen.html) at UT Southwestern were studying the Dallas Heart Study, a large population survey. They found individuals with **loss-of-function mutations** in PCSK9—people born with naturally low PCSK9 activity.

The results were stunning:

| Finding | Implication |
|---------|-------------|
| PCSK9 loss-of-function carriers had LDL ~28% lower | Target validation |
| These individuals had **88% fewer heart attacks** | Safety and efficacy proof |
| They were otherwise healthy | Long-term inhibition is safe |

> "It was the perfect human experiment. Nature had already done the clinical trial for us."
> — Helen Hobbs

This genetic evidence triggered a race among pharmaceutical companies to develop PCSK9 inhibitors. Amgen, Regeneron, and Pfizer all launched programs. Amgen's evolocumab reached the market first (along with Regeneron's alirocumab).

## Understanding PCSK9 biology

[PCSK9](https://www.ncbi.nlm.nih.gov/gene/255738) is a [serine protease](https://en.wikipedia.org/wiki/Serine_protease) with an unusual function: rather than cutting proteins, it acts as a "chaperone of doom" for LDL receptors.

Here's how it works:

1. [LDL receptors](https://www.ncbi.nlm.nih.gov/books/NBK22212/) on liver cells bind LDL particles and internalize them
2. Normally, the receptor releases LDL in the endosome and recycles back to the surface
3. But if PCSK9 is bound to the receptor, the whole complex is sent for degradation
4. Fewer receptors → less LDL clearance → higher blood cholesterol

| PCSK9 Status | Effect on Receptors | Effect on LDL |
|--------------|---------------------|---------------|
| Normal | ~150 recyclings per receptor | Normal levels |
| High (gain-of-function) | Rapid degradation | Very high LDL |
| Low (loss-of-function) | More recycling | Low LDL |
| Blocked by antibody | Maximum recycling | Very low LDL |

## Binding mechanism

[Structural studies](https://www.jbc.org/article/S0021-9258(20)55679-7/fulltext) reveal how evolocumab blocks PCSK9:

| Feature | Description |
|---------|-------------|
| Binding site | Catalytic domain of PCSK9 |
| Key interaction | Overlaps with LDLR EGF-A binding site |
| Interface area | ~2,000 Å² |
| Mechanism | Competitive inhibition of LDLR binding |

Evolocumab doesn't inhibit PCSK9's enzymatic activity directly—it simply blocks the surface that PCSK9 uses to bind LDL receptors. This is an example of blocking a [protein-protein interaction](https://en.wikipedia.org/wiki/Protein%E2%80%93protein_interaction), which was once considered very difficult for antibody therapeutics.

## Clinical impact

The [FOURIER trial](https://www.nejm.org/doi/full/10.1056/NEJMoa1615664) with over 27,000 patients established evolocumab's cardiovascular benefits:

| Outcome | Result |
|---------|--------|
| LDL reduction | 59% (to median 30 mg/dL) |
| Major cardiovascular events | 15% reduction |
| Heart attacks | 27% reduction |
| Stroke | 21% reduction |
| Safety | Well-tolerated, no increase in adverse events |

### The affordability challenge

Despite its efficacy, evolocumab faces adoption challenges:

- **High cost** - Originally ~$14,000/year (now reduced but still expensive)
- **Injectable** - Requires subcutaneous injection every 2-4 weeks
- **Insurance barriers** - Often requires prior authorization and statin failure

This has sparked debates about [healthcare costs and value-based pricing](https://www.statnews.com/2018/03/02/pcsk9-inhibitors-price-cuts/).

## The genetics-first paradigm

PCSK9 has become the poster child for **genetically validated drug targets**. The approach works like this:

1. **Find natural experiments** - People with mutations that increase or decrease gene function
2. **Study their phenotypes** - What happens to their health over a lifetime?
3. **If loss-of-function is beneficial and safe** - That gene is a validated drug target

This de-risks drug development enormously. Studies suggest that [genetically supported targets are 2x more likely to succeed](https://www.nature.com/articles/ng.3314) in clinical trials.

Other drugs following this paradigm:
- [Inclisiran](https://www.nejm.org/doi/full/10.1056/NEJMoa1912387) - siRNA targeting PCSK9 (same validation)
- [Evinacumab](https://www.nejm.org/doi/full/10.1056/NEJMoa1611996) - anti-ANGPTL3 (validated by loss-of-function genetics)

## Design lessons for protein engineers

1. **Genetics validates targets better than anything else** - If humans with lifelong gene inhibition are healthy and protected, your drug will likely be safe and effective

2. **Blocking protein-protein interactions works** - Even for enzymes, you can block function by preventing substrate/partner binding rather than inhibiting catalytic activity

3. **Fully human antibodies enable chronic dosing** - Patients take evolocumab for years; the fully human format minimizes immunogenicity

4. **Structure-guided optimization** - Understanding exactly how PCSK9 binds LDLR guided antibody design

5. **Competitive inhibition is a viable strategy** - Evolocumab competes with LDLR for PCSK9 binding

## Further reading

- [Bottomley et al. 2009](https://www.jbc.org/article/S0021-9258(20)55679-7/fulltext) - Structural basis for PCSK9 antibody binding
- [Cohen et al. 2006](https://www.nejm.org/doi/full/10.1056/NEJMoa054013) - Loss-of-function genetics
- [Sabatine et al. 2017](https://www.nejm.org/doi/full/10.1056/NEJMoa1615664) - FOURIER clinical trial
- [PDB Entry 3H42](https://www.rcsb.org/structure/3H42) - Explore the structure
- [Hobbs & Cohen perspective](https://www.jci.org/articles/view/38001) - Discovery story from the researchers
- [Nature Milestones: PCSK9](https://www.nature.com/articles/d42859-021-00011-6) - Historical overview
