/**
 * Static blog posts data
 *
 * For a simple blog that updates infrequently, static data is simpler than an API.
 * Posts are stored newest-first.
 */

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  content: string;
  author: string;
  publishedAt: string;
  category: "announcement" | "technical" | "industry";
}

export const blogPosts: BlogPost[] = [
  {
    slug: "antibody-design-boltzgen-proteindojo",
    title: "Antibody Design with BoltzGen: Scaffolds, CDRs, and Practical Workflows",
    description: "A friendly guide to antibody and nanobody structure, how BoltzGen models CDR design, and how to run locally or on ProteinDojo.",
    author: "ProteinDojo Team",
    publishedAt: "2026-02-20",
    category: "technical",
    content: `
Antibodies are amazing binders, but they play by different rules than generic proteins. This guide explains the basics, how BoltzGen models antibodies and nanobodies, and how to run designs locally or on ProteinDojo.

## Antibodies in 60 seconds

Antibodies have two main parts:

- **Frameworks**: the stable scaffold that folds reliably.
- **CDRs (complementarity-determining regions)**: short loops that do most of the binding.

For full antibodies (Fab fragments), you have a **heavy chain** and a **light chain**. Nanobodies are single-domain antibodies, usually just the heavy-chain variable domain.

### Quick structure map

~~~text
        Heavy chain (VH)       Light chain (VL)
             |                      |
        [Framework]            [Framework]
          /  |  \\               /  |  \\
       CDR1 CDR2 CDR3        CDR1 CDR2 CDR3
~~~

The key design idea: keep the framework stable and only vary the CDRs.

## How BoltzGen treats antibodies and nanobodies

BoltzGen models antibody and nanobody design around **scaffolds**:

- A scaffold YAML defines the framework, chain layout, and which CDRs are designable.
- BoltzGen varies CDR sequences (and optional insertions) while keeping the scaffold stable.
- This gives you realistic antibodies without drifting into unstable backbone territory.

### Why binder length ranges are usually wrong for antibodies

For antibodies and nanobodies, a wide binder-length range is not ideal. The framework size should stay close to a real antibody scaffold. If you want length variation, it should happen inside specific CDR loops via insertions, not by growing or shrinking the whole chain. The scaffold templates already encode this behavior.

## Target binding and residue numbering

BoltzGen uses **label_seq_id** when it reads mmCIF files. That means:

- If you select hotspot residues using PDB numbering, they need to be mapped to label_seq_id.
- ProteinDojo handles this mapping automatically for BoltzGen.

If you are running locally, make sure your binding residues refer to label_seq_id values from the mmCIF file.

## Example: nanobody scaffold design YAML

~~~yaml
entities:
  - file:
      path: target.cif
      include:
        - chain:
            id: A
      binding_types:
        - chain:
            id: A
            binding: "45,49,52"

  - file:
      path:
        - ./nanobody_scaffolds/7eow.yaml
        - ./nanobody_scaffolds/7xl0.yaml
        - ./nanobody_scaffolds/8coh.yaml
        - ./nanobody_scaffolds/8z8v.yaml
~~~

## Running BoltzGen locally (GPU required)

1. Install BoltzGen with CUDA support.
2. Download a target mmCIF.
3. Use scaffold YAMLs for nanobody or Fab design.

~~~bash
pip install boltzgen
boltzgen run design.yaml --protocol nanobody-anything --num_designs 200 --budget 20 --cache /tmp/boltzgen-cache
~~~

### Practical tips

- Start with a small set of hotspot residues (2 to 6) near the binding epitope.
- Use multiple scaffolds to increase diversity and robustness.
- If the target is known to move on binding, consider testing multiple target conformations.

## Designing antibodies on ProteinDojo

ProteinDojo wraps the scaffold setup for you:

1. Open the Design page for a target.
2. Choose **Nanobody** or **Antibody CDR** mode.
3. Pick hotspots on the target sequence.
4. Submit the job. The scaffold library is selected automatically.

The Raw Input Preview shows the exact BoltzGen YAML so you can compare with the official examples.

## Final note: induced fit vs conformational selection

Some targets change shape when they bind. This is often called **induced fit** (the target shifts after binding) or **conformational selection** (the binder stabilizes an existing alternative shape). If you expect this, try multiple target structures or loosen structural constraints when possible.

If you have questions, reach out or share a target you want to design against. We can help tune the scaffold and hotspot choices.
`,
  },
  // TODO: Uncomment when ready to publish
  // {
  //   slug: "2025-fda-drug-approvals-protein-targets",
  //   title: "2025 FDA Drug Approvals: A Guide to Protein Targets",
  //   description: "An overview of the protein targets from 2025's FDA-approved drugs, with implications for computational protein design.",
  //   author: "ProteinDojo Team",
  //   publishedAt: "2026-01-12",
  //   category: "industry",
  //   content: `
  // The FDA approved 46 novel drugs through CDER and 19 biologics through CBER in 2025. For those interested in computational protein design, these approvals reveal validated therapeutic targets and reference binders worth studying.
  //
  // ## Understanding FDA Approval Pathways
  //
  // Before diving into the targets, it's helpful to understand how the FDA organizes drug approvals:
  //
  // | Pathway | Center | What It Covers |
  // |---------|--------|----------------|
  // | NDA (505(b)(1)) | CDER | Novel small molecules |
  // | BLA (351(a)) | CDER | Therapeutic antibodies, proteins |
  // | BLA (351(a)) | CBER | Vaccines, gene/cell therapy, blood products |
  //
  // **Key insight**: In 2002, the FDA transferred therapeutic biologics (monoclonal antibodies, therapeutic proteins) from CBER to CDER. So when you see "Novel Drug Approvals" from CDER, it includes antibody drugs like pembrolizumab and nipocalimab—not just small molecules.
  //
  // ## Notable Protein Binders Approved in 2025
  //
  // ### Monoclonal Antibodies
  //
  // | Drug | Target | Indication |
  // |------|--------|------------|
  // | **Imaavy** (nipocalimab) | FcRn | Myasthenia gravis |
  // | **Enflonsia** (clesrovimab) | RSV F protein | RSV prevention |
  // | **Andembry** (garadacimab) | Factor XIIa | Hereditary angioedema |
  // | **Exdensur** (depemokimab) | IL-5 | Severe asthma |
  // | **Voyxact** (sibeprenlimab) | APRIL | IgA nephropathy |
  // | **Yartemlea** (narsoplimab) | MASP-2 | Transplant-associated TMA |
  //
  // ### Bispecific Antibodies
  //
  // **Lynozyfic** (linvoseltamab) targets both BCMA and CD3, engaging T-cells to kill myeloma cells. This represents the growing class of T-cell engagers in oncology.
  //
  // ### Antibody-Drug Conjugates
  //
  // | Drug | Target | Payload |
  // |------|--------|---------|
  // | **Datroway** (datopotamab deruxtecan) | TROP2 | Topoisomerase I inhibitor |
  // | **Emrelis** (telisotuzumab vedotin) | c-Met | MMAE |
  //
  // ## Interesting Targets for Binder Design
  //
  // ### RSV F Protein
  //
  // The RSV fusion protein is particularly interesting because multiple approved antibodies bind **different epitopes**:
  //
  // - **Clesrovimab** (2025): Site IV, binds both pre- and post-fusion conformations
  // - **Nirsevimab** (2024): Site 0, pre-fusion specific
  // - **Palivizumab** (1998): Site II
  //
  // This makes RSV F an excellent target for learning—you can design binders and compare your epitope to multiple reference antibodies.
  //
  // ### FcRn (Neonatal Fc Receptor)
  //
  // Nipocalimab represents a novel mechanism: blocking FcRn to accelerate IgG catabolism. FcRn normally recycles IgG, giving antibodies their long half-life (~21 days). By blocking this receptor, nipocalimab reduces pathogenic autoantibodies in diseases like myasthenia gravis.
  //
  // The target has interesting pH-dependent biology—FcRn binds IgG at pH 6.0 (in endosomes) but releases it at pH 7.4 (extracellular). Nipocalimab uniquely binds at both pH values.
  //
  // ### APRIL (TNFSF13)
  //
  // Sibeprenlimab is the first approved APRIL inhibitor. APRIL drives IgA production and is implicated in IgA nephropathy pathogenesis. This represents a new target class in the TNF superfamily.
  //
  // ## RNA Therapeutics: A Different Approach
  //
  // Several 2025 approvals use RNA to knock down protein targets rather than binding them directly:
  //
  // | Drug | Modality | Target |
  // |------|----------|--------|
  // | **Qfitlia** (fitusiran) | siRNA | Antithrombin |
  // | **Dawnzera** (donidalorsen) | ASO | Prekallikrein |
  // | **Redemplo** (plozasiran) | siRNA | Apolipoprotein C-III |
  //
  // While these aren't protein binders, they validate the therapeutic relevance of their target proteins.
  //
  // ## Gene Therapies from CBER
  //
  // CBER approved several gene therapies in 2025:
  //
  // - **ITVISMA**: AAV9 delivering SMN1 for spinal muscular atrophy
  // - **ZEVASKYN**: HSV-1 delivering COL7A1 for epidermolysis bullosa
  // - **ENCELTO**: Encapsulated cells secreting CNTF for macular telangiectasia
  //
  // ## What This Means for Protein Design
  //
  // These approvals validate specific protein targets and provide reference structures for binder design. For ProteinDojo challenges, we prioritize targets with:
  //
  // 1. **Available structural data** (PDB structures exist)
  // 2. **Multiple approved binders** (can compare different approaches)
  // 3. **Clear epitope characterization** (know where antibodies bind)
  // 4. **Therapeutic relevance** (validated drug targets)
  //
  // The 2025 approvals add several new targets to this list, particularly FcRn, APRIL, Factor XIIa, and MASP-2.
  //
  // ---
  //
  // *For more details on individual targets, see our [Help documentation](/help) or start designing on our [Challenges](/challenges) page.*
  // `,
  // },
  {
    slug: "introducing-protein-dojo",
    title: "Introducing Protein Dojo",
    description: "A platform for learning protein design by practicing with realistic drug targets and modern computational molecular design tools.",
    author: "Zach Ocean",
    publishedAt: "2026-01-12",
    category: "announcement",
    content: `
*This post was originally published on [zachocean.com](https://www.zachocean.com/posts/protein-dojo/).*

[Protein Dojo](https://www.proteindojo.com/) is a platform for learning protein design by practicing with realistic drug targets and modern computational molecular design tools. I built it over the last few weeks of winter holidays, during family nap times and around holiday celebrations.

My goals for this project are twofold. One, I wanted to make something useful for people who are just getting into computational molecule design. If you're like me, you learned about the protein folding problem a long time ago and you heard about [Alphafold 2](https://github.com/google-deepmind/alphafold) ("the ChatGPT moment for protein folding"). You know this technology is important and want to learn more about it, but where do you start? If you're not a professional biochemist, what proteins should you actually try to design?

The first reason I built Protein Dojo was to answer that question. The second was that I wanted to push LLM code-writing tools to their limits - to see how far I could get with a fairly ambitious project and a short timeframe. I barely wrote a single line of code for this project - probably in the single digits. Claude Code and OpenAI Codex wrote everything. I still spent a bunch of time debugging by reading code, asking Claude to try different things, thinking about the architecture, and iterating on the product experience. But I didn't do the actual code-typing bit.

So what can you actually do on Protein Dojo? Well, there's a whole set of computational molecular design challenges: realistic drug targets that relate to real diseases like Interleukin-6 (arthritis + more), VEGF-A (cancer), EGFR (cancer), and BDNF (Alzheimer's and other neurodegenerative diseases). If you're not a biologist, you'll learn a lot just by reading about these proteins and understanding why scientists care about binding to them. You can also see some of the existing molecules that scientists have designed against these targets - real FDA-approved drugs like [Humira](https://www.humira.com/) and [Herceptin](https://www.herceptin.com/).

Besides reading, you can also practice actually designing protein binders against those targets. I've added real computational design tools that are used by professional molecular designers.

The design tools supported right now are [RFDiffusion3](https://github.com/RosettaCommons/foundry/tree/production/models/rfd3), made by Baker Lab, and [BoltzGen](https://github.com/HannesStark/boltzgen), made by [Boltz Bio](https://boltz.bio/). Both are open-source, commercial-friendly models that are popular with industry pros. You can also use your own tools, on your own computer, or on model aggregation sites like [Ariax Bio](https://www.ariax.bio/) and [Tamarind Bio](https://www.tamarind.bio/), and submit the sequences you designed externally.

There's a leaderboard feature so that you can compete to have the best design. It uses a computational score to rank the submissions which isn't perfect - you'd have to test the designs in a real lab to have better rankings!

Building this has been a lot of fun. I'd be thrilled if you give it a try, and get in touch if you have any feedback.
`,
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug);
}

export function getAllBlogPosts(): BlogPost[] {
  return blogPosts;
}
