# Durvalumab (Imfinzi)

**Type:** Fully human [monoclonal antibody](https://www.cancer.gov/publications/dictionaries/cancer-terms/def/monoclonal-antibody) (IgG1κ)  
**Target:** PD-L1 (Programmed Death-Ligand 1)  
**PDB:** [5X8M](https://www.rcsb.org/structure/5X8M)  
**FDA Approved:** 2017  
**Developer:** [AstraZeneca](https://www.astrazeneca.com/) / [MedImmune](https://www.medimmune.com/)  

## What is it?

Durvalumab (brand name Imfinzi) is a fully human monoclonal antibody that blocks PD-L1, unleashing the immune system to attack cancer. While it targets the same pathway as [atezolizumab](/help/atezolizumab), durvalumab was engineered with specific Fc modifications that alter its biological activity.

## The checkpoint inhibitor revolution

PD-L1 is an immune checkpoint—a "stop signal" that cancer cells hijack to evade destruction. By blocking PD-L1, durvalumab allows T cells to recognize and kill tumor cells.

The PD-1/PD-L1 pathway can be blocked at two points:
- **Anti-PD-1** (pembrolizumab, nivolumab) - Block the receptor on T cells
- **Anti-PD-L1** (durvalumab, atezolizumab) - Block the ligand on tumor cells

## Engineered Fc design

What makes durvalumab unique is its **engineered Fc region**. The Fc (Fragment crystallizable) portion of an antibody can trigger immune effector functions:

| Function | Effect | Durvalumab |
|----------|--------|------------|
| ADCC | Kills antibody-coated cells | Reduced |
| ADCP | Macrophages eat target cells | Reduced |
| CDC | Complement-mediated killing | Reduced |

Durvalumab contains **triple mutations (L234F, L235E, P331S)** that silence these effector functions. Why reduce killing activity in a cancer drug?

The rationale: PD-L1 is expressed on activated T cells, not just tumor cells. An antibody that killed PD-L1-expressing cells would eliminate the very immune cells needed to fight cancer. By engineering out ADCC/ADCP, durvalumab blocks the checkpoint without depleting T cells.

## PACIFIC trial breakthrough

Durvalumab's approval was driven by the [PACIFIC trial](https://www.nejm.org/doi/full/10.1056/NEJMoa1709937) in stage III non-small cell lung cancer (NSCLC):

- Patients received durvalumab after chemoradiation
- Median progression-free survival: **16.8 months** (vs 5.6 months placebo)
- 4-year overall survival: **49.6%** (vs 36.3% placebo)

This established durvalumab as a new standard of care for unresectable stage III NSCLC—a setting where outcomes had been stagnant for decades.

## Binding mechanism

The [crystal structure](https://www.rcsb.org/structure/5X8M) reveals durvalumab's binding to PD-L1:

- Blocks the PD-1 binding interface on PD-L1
- High affinity ensures durable blockade
- Fully human sequence minimizes immunogenicity

## Design lessons for protein engineers

1. **Fc engineering expands the toolkit** - Silencing effector functions can be as important as enhancing them

2. **Context matters** - A "killing" antibody isn't always best; sometimes blocking without killing is the goal

3. **Same target, different designs** - Atezolizumab and durvalumab both block PD-L1 but use different Fc strategies

4. **Combination with other modalities** - PACIFIC showed the power of combining checkpoint inhibitors with radiation

## Comparing PD-L1 blockers

| Property | Atezolizumab | Durvalumab |
|----------|--------------|------------|
| Format | Humanized IgG1 | Fully human IgG1κ |
| Fc modification | Engineered aglycosyl | Triple mutation (L234F/L235E/P331S) |
| ADCC activity | Eliminated | Eliminated |
| First indication | Bladder cancer | Lung cancer |
| Developer | Genentech/Roche | AstraZeneca |

## Further reading

- [PDB Entry 5X8M](https://www.rcsb.org/structure/5X8M) - Crystal structure
- [PACIFIC trial](https://www.nejm.org/doi/full/10.1056/NEJMoa1709937) - Pivotal clinical study
- [Atezolizumab article](/help/atezolizumab) - Another PD-L1 blocker
- [Fc engineering review](https://www.nature.com/articles/nrd.2017.227) - How antibody Fc regions are modified
