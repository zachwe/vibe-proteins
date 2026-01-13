# Bamlanivimab (LY-CoV555)

**Type:** Human [monoclonal antibody](https://www.cancer.gov/publications/dictionaries/cancer-terms/def/monoclonal-antibody) (IgG1)  
**Target:** [SARS-CoV-2 Spike RBD](https://www.ncbi.nlm.nih.gov/gene/43740568)  
**PDB:** [7KMG](https://www.rcsb.org/structure/7KMG)  
**Developers:** [AbCellera](https://www.abcellera.com/) & [Eli Lilly](https://www.lilly.com/)  
**FDA EUA:** November 2020  

## The Fastest Drug Ever

Bamlanivimab holds a remarkable record: from blood sample to FDA authorization in just **259 days**. In an industry where drug development typically takes 10-15 years, this was unprecedented—a testament to what's possible when science, technology, and urgency align.

## The Origin Story

### Patient Zero (March 2020)

In early March 2020, researchers at [AbCellera Biologics](https://www.abcellera.com/) in Vancouver received a blood sample from one of the first recovered COVID-19 patients in the United States—a man in his 40s from Washington State who had survived a confirmed infection.

The race was on.

### The 11-Day Sprint

AbCellera's platform uses [microfluidics](https://en.wikipedia.org/wiki/Microfluidics) to analyze millions of individual immune cells. CEO [Carl Hansen](https://www.forbes.com/sites/leahrosenbaum/2020/06/11/how-a-41-year-old-scientist-is-racing-to-deliver-covid-19-antibodies-before-a-vaccine/) and his team worked around the clock:

- **Day 1-3:** Isolated [B cells](https://www.immunology.org/public-information/bitesized-immunology/cells/b-cells) from the patient's blood
- **Day 4-7:** Screened 5.8 million cells using proprietary microfluidic chips
- **Day 8-11:** Identified ~500 antibodies that bound the spike protein

By **March 25, 2020**—just 11 days after receiving the sample—they had identified LY-CoV555 as their lead candidate.

### The Lilly Partnership

AbCellera partnered with pharmaceutical giant [Eli Lilly](https://www.lilly.com/), which had the manufacturing capacity and clinical trial infrastructure to move fast. Lilly's [Daniel Skovronsky](https://www.lilly.com/leadership/daniel-skovronsky), chief scientific officer, made the antibody a top priority.

> "We didn't know if vaccines would work. Antibodies were our insurance policy." — [Daniel Skovronsky](https://www.nytimes.com/2020/06/01/health/coronavirus-drug-antibody-treatment.html), New York Times

### Record Timeline

| Milestone | Date | Days from sample |
|-----------|------|-----------------|
| Blood sample received | March 9, 2020 | 0 |
| Lead antibody identified | March 25, 2020 | 16 |
| First patient dosed | June 1, 2020 | 84 |
| Phase 3 trial started | August 2020 | ~150 |
| FDA EUA granted | November 9, 2020 | 259 |

## How It Works

### The Target: Spike RBD

SARS-CoV-2 uses its [Spike protein](https://www.nature.com/articles/s41401-020-0485-4) to enter human cells. The [Receptor Binding Domain (RBD)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7526584/) is the part that actually grabs onto human [ACE2 receptors](https://www.ncbi.nlm.nih.gov/gene/59272).

### Binding Mechanism

[The crystal structure](https://www.rcsb.org/structure/7KMG) reveals bamlanivimab's approach:

- Binds directly to the receptor-binding motif (RBM)
- Competes with ACE2 for the same binding site
- Key contacts at residues E484, F490, Q493
- Classic [neutralization](https://en.wikipedia.org/wiki/Neutralizing_antibody) by blocking entry

## The Variant Challenge

Bamlanivimab's story also illustrates the challenge of targeting a rapidly evolving virus:

- **Original strain & Alpha:** Highly effective
- **Beta & Gamma (E484K mutation):** Dramatically reduced activity
- **Omicron:** Essentially inactive

By early 2021, Lilly was combining bamlanivimab with a second antibody ([etesevimab](https://www.covid19treatmentguidelines.nih.gov/therapies/antivirals-including-antibody-products/anti-sars-cov-2-monoclonal-antibodies/)) to maintain coverage against variants.

## Lessons for Protein Design

1. **Speed is possible** — Modern platforms can compress discovery timelines dramatically
2. **Natural immune responses are a gold mine** — Recovered patients produce optimized antibodies
3. **Variants matter** — Single mutations can escape even excellent binders
4. **Conserved epitopes are safer** — See [S309/Sotrovimab](./s309) for a more durable approach

## The Human Cost & Benefit

Bamlanivimab's impact is hard to quantify. It was [authorized](https://www.fda.gov/news-events/press-announcements/coronavirus-covid-19-update-fda-authorizes-monoclonal-antibody-treatment-covid-19) for high-risk patients when hospitals were overwhelmed and vaccines didn't yet exist.

But it also showed the vulnerability of targeting viral proteins—mutations eventually rendered it useless. The next generation of designers (including you!) will need to think about durability.

## References

- [AbCellera discovery story](https://www.nature.com/articles/d41586-020-01402-3) — Nature News coverage
- [Jones et al. 2021](https://www.science.org/doi/10.1126/scitranslmed.abf1906) — Discovery paper
- [Crystal structure (PDB 7KMG)](https://www.rcsb.org/structure/7KMG)
- [FDA EUA letter](https://www.fda.gov/media/143603/download)
- [Carl Hansen interview](https://www.forbes.com/sites/leahrosenbaum/2020/06/11/how-a-41-year-old-scientist-is-racing-to-deliver-covid-19-antibodies-before-a-vaccine/) — Forbes
