# Obinutuzumab (Gazyva)

**Type:** Humanized, glycoengineered [monoclonal antibody](https://www.cancer.gov/publications/dictionaries/cancer-terms/def/monoclonal-antibody) (IgG1)  
**Target:** CD20  
**PDB:** [5OXK](https://www.rcsb.org/structure/5OXK)  
**FDA Approved:** 2013  
**Developer:** [Roche](https://www.roche.com/) / [Genentech](https://www.gene.com/)  

## What is it?

Obinutuzumab (brand name Gazyva) is a next-generation anti-CD20 antibody engineered to kill B cells more effectively than [rituximab](/help/rituximab). It combines two innovations: a Type II binding mode and glycoengineered Fc for enhanced ADCC.

## Type I vs. Type II anti-CD20 antibodies

CD20 antibodies come in two flavors:

| Property | Type I (rituximab) | Type II (obinutuzumab) |
|----------|-------------------|------------------------|
| CD20 clustering | Strong | Weak |
| Lipid raft localization | Yes | No |
| CDC | Strong | Weak |
| Direct cell death | Weak | **Strong** |
| Fc-mediated killing | Moderate | **Enhanced** |

Type II antibodies like obinutuzumab trigger direct cell death without needing complement—a different and potentially more effective killing mechanism.

## Glycoengineered Fc: the GlycoMab platform

Obinutuzumab's Fc region is **afucosylated** using Roche's GlycoMab technology:

Normal antibodies have fucose sugars on their Fc regions. Removing fucose dramatically increases binding to FcγRIIIa receptors on NK cells:

| Fc type | FcγRIIIa binding | ADCC activity |
|---------|------------------|---------------|
| Normal (fucosylated) | Baseline | 1x |
| Afucosylated | ~50x higher | ~10-100x |

This makes obinutuzumab a much more potent killer of CD20+ B cells.

## Superior to rituximab?

The [GALLIUM trial](https://www.nejm.org/doi/full/10.1056/NEJMoa1614598) compared obinutuzumab to rituximab in follicular lymphoma:

| Outcome | Obinutuzumab | Rituximab |
|---------|--------------|-----------|
| 3-year PFS | 80.0% | 73.3% |
| Hazard ratio | 0.66 (34% reduction in progression) |

The CLL11 trial showed similar advantages in chronic lymphocytic leukemia. These results established obinutuzumab as a more effective anti-CD20 option.

## Binding mechanism

The [crystal structure](https://www.rcsb.org/structure/5OXK) reveals obinutuzumab's binding to CD20:

- Binds a partially overlapping but distinct epitope from rituximab
- Type II binding mode doesn't stabilize CD20 in lipid rafts
- Induces homotypic adhesion and direct cell death
- Afucosylated Fc enhances NK cell recruitment

## Clinical applications

Obinutuzumab is approved for:

- **Chronic lymphocytic leukemia (CLL)** - Front-line with chlorambucil or in combination with venetoclax
- **Follicular lymphoma** - With chemotherapy, then as maintenance
- **Diffuse large B-cell lymphoma** - In combination regimens

## Design lessons for protein engineers

1. **Glycoengineering dramatically enhances ADCC** - Removing fucose is a simple modification with major functional impact

2. **Type II antibodies offer different biology** - Not all anti-CD20s are equivalent; binding mode matters

3. **Incremental improvements add up** - Better epitope + better Fc = meaningfully improved outcomes

4. **Head-to-head trials differentiate products** - GALLIUM and CLL11 proved obinutuzumab's superiority

## Comparing CD20 antibodies

| Property | Rituximab | Obinutuzumab |
|----------|-----------|--------------|
| Type | I | II |
| Fc | Normal | Afucosylated |
| CDC | Strong | Weak |
| ADCC | Moderate | Very strong |
| Direct killing | Weak | Strong |
| Generation | 1st | 2nd |

## Further reading

- [PDB Entry 5OXK](https://www.rcsb.org/structure/5OXK) - Crystal structure
- [GALLIUM trial](https://www.nejm.org/doi/full/10.1056/NEJMoa1614598) - Obinutuzumab vs rituximab
- [GlycoMab technology](https://www.roche.com/research_and_development/what_we_are_working_on/research_technologies/glycart.htm) - Fc engineering platform
- [Rituximab article](/help/rituximab) - The first-generation CD20 antibody
