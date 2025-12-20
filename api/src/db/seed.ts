/**
 * Seed script for initial challenge data
 *
 * Run with: pnpm db:seed
 */

import { db, challenges } from "./index";

const seedChallenges = [
  {
    id: "spike-rbd",
    name: "SARS-CoV-2 Spike RBD",
    description:
      "Design a binder for the Spike receptor-binding domain. This is the key region that binds to human ACE2 receptors, making it a prime therapeutic target.",
    mission:
      "Design a protein that could help cure COVID-19 by blocking the virus from entering human cells.",
    difficulty: 1,
    level: 1,
    taskType: "binder",
    targetPdbId: "6M0J",
    targetStructureUrl: "https://files.rcsb.org/download/6M0J.pdb",
    targetSequence:
      "NITNLCPFGEVFNATRFASVYAWNRKRISNCVADYSVLYNSASFSTFKCYGVSPTKLNDLCFTNVYADSFVIRGDEVRQIAPGQTGKIADYNYKLPDDFTGCVIAWNSNNLDSKVGGNYNYLYRLFRKSNLKPFERDISTEIYQAGSTPCNGVEGFNCYFPLQSYGFQPTNGVGYQPYRVVVLSFELLHAPATVCGPKKSTNLVKNKCVNF",
    targetChainId: "E",
    pdbDescription:
      "Crystal structure of SARS-CoV-2 Spike RBD bound to human ACE2 receptor",
    chainAnnotations: JSON.stringify({
      E: {
        name: "Spike RBD",
        role: "target",
        description: "The viral receptor-binding domain - this is what you're designing a binder for",
      },
      A: {
        name: "Human ACE2",
        role: "context",
        description: "The human receptor that the virus binds to. Shown for reference - your binder should compete with this interaction",
      },
    }),
    educationalContent: `## About SARS-CoV-2 Spike RBD

The [receptor-binding domain](gpt:receptor-binding%20domain%20in%20virology) ([RBD](gpt:RBD%20protein%20domain)) of the SARS-CoV-2 [spike protein](gpt:coronavirus%20spike%20protein) is responsible for recognizing and binding to the human [ACE2](gpt:ACE2%20receptor) receptor, which is the first step in viral entry into cells.

### Why target this?
- Critical for viral infection
- Well-characterized structure (many crystal structures available)
- Multiple therapeutic [antibodies](gpt:therapeutic%20antibodies) target this region
- Good starting point for learning [binder design](gpt:protein%20binder%20design)

### Key binding residues
The RBD-ACE2 interface involves several key residues including K417, Y453, L455, F486, and Y505. These form [hydrogen bonds](gpt:hydrogen%20bonds%20in%20proteins) and [hydrophobic contacts](gpt:hydrophobic%20interactions%20in%20proteins) with ACE2.

### Design strategy
Consider targeting the ACE2 binding face of the RBD. Look for pockets and grooves that could accommodate your binder.`,
    createdAt: new Date(),
  },
  {
    id: "il-6",
    name: "IL-6 (Interleukin-6)",
    description:
      "Design a binder for this small, stable cytokine. IL-6 is involved in inflammation and is a target for treating autoimmune diseases.",
    mission:
      "Design a protein that could treat inflammatory diseases like rheumatoid arthritis by neutralizing a key immune signaling molecule.",
    difficulty: 2,
    level: 1,
    taskType: "binder",
    targetPdbId: "1ALU",
    targetStructureUrl: "https://files.rcsb.org/download/1ALU.pdb",
    targetSequence:
      "MNSFSTSAFGPVAFSLGLLLVLPAAFPAPVPPGEDSKDVAAPHRQPLTSSERIDKQIRYILDGISALRKETCNKSNMCESSKEALAENNLNLPKMAEKDGCFQSGFNEETCLVKIITGLLEFEVYLEYLQNRFESSEEQARAVQMSTKVLIQFLQKKAKNLDAITTPDPTTNASLLTKLQAQNQWLQDMTTHLILRSFKEFLQSSLRALRQM",
    targetChainId: "A",
    pdbDescription: "Crystal structure of human Interleukin-6",
    chainAnnotations: JSON.stringify({
      A: {
        name: "IL-6",
        role: "target",
        description: "The inflammatory cytokine - this is what you're designing a binder for",
      },
    }),
    educationalContent: `## About IL-6

[Interleukin-6](gpt:Interleukin-6%20cytokine) (IL-6) is a [pleiotropic](gpt:pleiotropic%20in%20biology) [cytokine](gpt:cytokines%20immune%20system) with roles in inflammation, immune response, and [hematopoiesis](gpt:hematopoiesis).

### Clinical relevance
- Elevated in COVID-19 [cytokine storm](gpt:cytokine%20storm%20syndrome)
- Target of [tocilizumab](gpt:tocilizumab%20drug) (anti-IL-6R antibody)
- Involved in [rheumatoid arthritis](gpt:rheumatoid%20arthritis), [Castleman disease](gpt:Castleman%20disease)

### Structure
IL-6 is a [4-helix bundle](gpt:four-helix%20bundle%20protein%20structure) cytokine. It signals through a receptor complex involving [IL-6R](gpt:IL-6%20receptor) and [gp130](gpt:gp130%20protein).

### Design challenge
IL-6 is relatively small (~20 kDa) and compact, making it a moderate difficulty target.`,
    createdAt: new Date(),
  },
  {
    id: "vegf-a",
    name: "VEGF-A",
    description:
      "Design a binder for this symmetric dimer growth factor. VEGF-A drives angiogenesis and is targeted in cancer and eye diseases.",
    mission:
      "Design a protein that could fight cancer or treat blindness by stopping the growth of new blood vessels.",
    difficulty: 2,
    level: 1,
    taskType: "binder",
    targetPdbId: "1VPF",
    targetStructureUrl: "https://files.rcsb.org/download/1VPF.pdb",
    targetSequence:
      "APMAEGGGQNHHEVVKFMDVYQRSYCHPIETLVDIFQEYPDEIEYIFKPSCVPLMRCGGCCNDEGLECVPTEESNITMQIMRIKPHQGQHIGEMSFLQHNKCECRPKKDRARQENPCGPCSERRKHLFVQDPQTCKCSCKNTDSRCKARQLELNERTCRCDKPRR",
    targetChainId: "A",
    pdbDescription: "Crystal structure of Vascular Endothelial Growth Factor (VEGF) homodimer",
    chainAnnotations: JSON.stringify({
      A: {
        name: "VEGF-A (chain 1)",
        role: "target",
        description: "One monomer of the VEGF dimer - design a binder for this growth factor",
      },
      B: {
        name: "VEGF-A (chain 2)",
        role: "target",
        description: "The second monomer of the VEGF homodimer",
      },
    }),
    educationalContent: `## About VEGF-A

[Vascular Endothelial Growth Factor A](gpt:VEGF-A%20protein) (VEGF-A) is the master regulator of [angiogenesis](gpt:angiogenesis) (blood vessel formation).

### Clinical relevance
- Target of [bevacizumab](gpt:bevacizumab%20Avastin) (Avastin) for cancer
- Target of [ranibizumab](gpt:ranibizumab%20Lucentis) (Lucentis) for [wet AMD](gpt:wet%20age-related%20macular%20degeneration)
- Key in [tumor vascularization](gpt:tumor%20angiogenesis)

### Structure
VEGF-A is a [homodimer](gpt:homodimer%20protein) with a [cystine-knot fold](gpt:cystine%20knot%20protein%20structure). Each [monomer](gpt:protein%20monomer) has a receptor-binding interface.

### Design challenge
The [dimeric](gpt:protein%20dimer) nature adds complexity. Consider whether to target the [VEGFR](gpt:VEGF%20receptor) binding site or create a binder that blocks [dimerization](gpt:protein%20dimerization).`,
    createdAt: new Date(),
  },
];

async function seed() {
  console.log("Seeding challenges...");

  // Use upsert to update existing challenges or insert new ones
  // This avoids foreign key issues with jobs/submissions
  for (const challenge of seedChallenges) {
    await db
      .insert(challenges)
      .values(challenge)
      .onConflictDoUpdate({
        target: challenges.id,
        set: {
          name: challenge.name,
          description: challenge.description,
          mission: challenge.mission,
          difficulty: challenge.difficulty,
          level: challenge.level,
          taskType: challenge.taskType,
          targetPdbId: challenge.targetPdbId,
          targetStructureUrl: challenge.targetStructureUrl,
          targetSequence: challenge.targetSequence,
          targetChainId: challenge.targetChainId,
          pdbDescription: challenge.pdbDescription,
          chainAnnotations: challenge.chainAnnotations,
          educationalContent: challenge.educationalContent,
        },
      });
    console.log(`  - ${challenge.name}`);
  }

  console.log("Done!");
}

seed().catch(console.error);
