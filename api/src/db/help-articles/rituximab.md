# Rituximab (Rituxan)

**Type:** Chimeric [monoclonal antibody](https://www.cancer.gov/publications/dictionaries/cancer-terms/def/monoclonal-antibody) (IgG1)  
**Target:** CD20 (B-lymphocyte antigen)  
**PDB:** [6Y90](https://www.rcsb.org/structure/6Y90)  
**FDA Approved:** 1997  
**Developer:** [IDEC Pharmaceuticals](https://en.wikipedia.org/wiki/Biogen) (now Biogen) & [Genentech](https://www.gene.com/)  

## What is it?

Rituximab (brand name Rituxan/MabThera) was the **first monoclonal antibody approved for cancer treatment** in the United States. It proved that antibodies could be effective anti-cancer drugs, opening the floodgates for the therapeutic antibody industry we know today.

## The origin story

The story of rituximab begins at IDEC Pharmaceuticals, a small San Diego biotech founded in 1986. [Nabil Hanna](https://en.wikipedia.org/wiki/Nabil_Hanna) and his team had an audacious goal: use antibodies to treat cancer at a time when most industry experts believed antibodies were too weak to kill tumor cells.

The team chose **CD20** as their target—a protein found on the surface of B cells (a type of white blood cell). Their reasoning was elegant:

- B-cell lymphomas express high levels of CD20
- CD20 doesn't shed from the cell surface (so the antibody stays attached)
- CD20 doesn't internalize when bound (leaving it exposed to immune attack)
- Healthy B cells also express CD20, but the body can regenerate them

IDEC created a chimeric antibody—mouse variable regions (for CD20 binding) fused to human constant regions (for reduced immunogenicity). They partnered with Genentech for manufacturing and clinical development.

The [first clinical trials in the early 1990s](https://www.nejm.org/doi/full/10.1056/NEJM199702133360702) showed remarkable results: tumors shrank in many patients with follicular lymphoma who had failed chemotherapy. The 1997 FDA approval was a watershed moment in oncology.

> "Rituximab proved that the immune system could be harnessed to fight cancer. That single drug opened the door to everything that followed."

## Understanding CD20 biology

[CD20](https://www.ncbi.nlm.nih.gov/gene/931) (also called MS4A1) is a cell surface protein with several unusual properties that make it an ideal antibody target:

| Property | Why it matters |
|----------|----------------|
| High expression on B cells | Strong signal for targeting |
| Not on stem cells or plasma cells | B cells can regenerate |
| Doesn't shed | Antibody stays bound |
| Doesn't internalize | Accessible for immune attack |
| Forms tetramers | Creates clustered epitopes |

CD20 functions as a calcium channel regulator, important for B-cell activation and proliferation. However, its exact role in normal B-cell function is still debated.

## Binding mechanism

[Recent cryo-EM structures](https://www.science.org/doi/10.1126/science.aaz9356) by [Rougé et al. (2020)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7319159/) revealed fascinating details about how rituximab binds:

1. **Dimeric binding** - Two Fab arms of rituximab can bind simultaneously to a CD20 dimer
2. **Critical epitope** - The (170)ANPS(173) loop is essential for binding
3. **Lattice formation** - Rituximab can cross-link CD20 dimers into higher-order arrays
4. **Complement activation** - The antibody orientation promotes C1q binding and complement-dependent cytotoxicity (CDC)

The structure also explains why some patients develop resistance—mutations in the ANPS loop can abolish rituximab binding.

## Mechanisms of action

Rituximab kills B cells through multiple mechanisms:

1. **ADCC (Antibody-Dependent Cellular Cytotoxicity)** - The Fc region recruits [NK cells](https://www.cancer.gov/publications/dictionaries/cancer-terms/def/natural-killer-cell) that release cytotoxic granules

2. **CDC (Complement-Dependent Cytotoxicity)** - The Fc region activates the [complement cascade](https://www.ncbi.nlm.nih.gov/books/NBK27100/), forming membrane attack complexes

3. **Direct signaling** - Binding may trigger apoptotic signals in some contexts

4. **Phagocytosis** - Macrophages engulf antibody-coated B cells

## Beyond cancer: autoimmune disease

The success in lymphoma led researchers to ask: could rituximab help in autoimmune diseases where B cells attack the body? The answer was yes.

Rituximab is now approved for:
- [Rheumatoid arthritis](https://www.rheumatology.org/I-Am-A/Patient-Caregiver/Treatments/Rituximab-Rituxan) - When other treatments fail
- [Granulomatosis with polyangiitis](https://rarediseases.org/rare-diseases/granulomatosis-with-polyangiitis/) - A rare vasculitis
- [Pemphigus vulgaris](https://rarediseases.org/rare-diseases/pemphigus/) - A severe blistering disease
- [Multiple sclerosis](https://www.nationalmssociety.org/Treating-MS/Medications) - Off-label but widely used

## The next generation: obinutuzumab and others

Learning from rituximab, researchers developed improved anti-CD20 antibodies:

| Antibody | Improvement |
|----------|-------------|
| [Obinutuzumab](https://www.cancer.gov/about-cancer/treatment/drugs/obinutuzumab) | Glycoengineered for enhanced ADCC |
| [Ofatumumab](https://www.cancer.gov/about-cancer/treatment/drugs/ofatumumab) | Different epitope, better CDC |
| [Ocrelizumab](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5440229/) | Humanized, used for MS |

## Design lessons for protein engineers

1. **Target biology is everything** - CD20's unique properties (no shedding, no internalization) make it an ideal antibody target. Not all surface proteins are equally druggable.

2. **Multiple killing mechanisms add robustness** - ADCC, CDC, and direct signaling all contribute. If one pathway fails, others can compensate.

3. **First-in-class defines standards** - Rituximab became the benchmark against which all subsequent lymphoma therapies are measured.

4. **Cross-indication potential** - An antibody developed for cancer can find use in autoimmune disease if the target is relevant.

5. **Structure enables optimization** - Understanding exactly how rituximab binds CD20 enabled design of improved next-generation antibodies.

## Further reading

- [Rougé et al. 2020](https://www.science.org/doi/10.1126/science.aaz9356) - Cryo-EM structure of CD20-rituximab complex
- [Maloney et al. 1997](https://www.nejm.org/doi/full/10.1056/NEJM199702133360702) - First major clinical trial
- [PDB Entry 6Y90](https://www.rcsb.org/structure/6Y90) - Explore the structure
- [Rituximab 20-year impact](https://www.nature.com/articles/s41571-017-0036-4) - Clinical legacy review
- [The History of Rituxan](https://www.gene.com/stories/rituxan-a-history) - Genentech's perspective
