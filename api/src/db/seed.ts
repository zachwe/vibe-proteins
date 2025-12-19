/**
 * Seed script for initial challenge data
 *
 * Run with: pnpm db:seed
 */

import { db, challenges } from "./index";
import { sql } from "drizzle-orm";

const seedChallenges = [
  {
    id: "spike-rbd",
    name: "SARS-CoV-2 Spike RBD",
    description:
      "Design a binder for the Spike receptor-binding domain. This is the key region that binds to human ACE2 receptors, making it a prime therapeutic target.",
    difficulty: 1,
    level: 1,
    taskType: "binder",
    targetPdbId: "6M0J",
    targetStructureUrl: "https://files.rcsb.org/download/6M0J.pdb",
    targetSequence:
      "NITNLCPFGEVFNATRFASVYAWNRKRISNCVADYSVLYNSASFSTFKCYGVSPTKLNDLCFTNVYADSFVIRGDEVRQIAPGQTGKIADYNYKLPDDFTGCVIAWNSNNLDSKVGGNYNYLYRLFRKSNLKPFERDISTEIYQAGSTPCNGVEGFNCYFPLQSYGFQPTNGVGYQPYRVVVLSFELLHAPATVCGPKKSTNLVKNKCVNF",
    educationalContent: `## About SARS-CoV-2 Spike RBD

The receptor-binding domain (RBD) of the SARS-CoV-2 spike protein is responsible for recognizing and binding to the human ACE2 receptor, which is the first step in viral entry into cells.

### Why target this?
- Critical for viral infection
- Well-characterized structure (many crystal structures available)
- Multiple therapeutic antibodies target this region
- Good starting point for learning binder design

### Key binding residues
The RBD-ACE2 interface involves several key residues including K417, Y453, L455, F486, and Y505. These form hydrogen bonds and hydrophobic contacts with ACE2.

### Design strategy
Consider targeting the ACE2 binding face of the RBD. Look for pockets and grooves that could accommodate your binder.`,
    createdAt: new Date(),
  },
  {
    id: "il-6",
    name: "IL-6 (Interleukin-6)",
    description:
      "Design a binder for this small, stable cytokine. IL-6 is involved in inflammation and is a target for treating autoimmune diseases.",
    difficulty: 2,
    level: 1,
    taskType: "binder",
    targetPdbId: "1ALU",
    targetStructureUrl: "https://files.rcsb.org/download/1ALU.pdb",
    targetSequence:
      "MNSFSTSAFGPVAFSLGLLLVLPAAFPAPVPPGEDSKDVAAPHRQPLTSSERIDKQIRYILDGISALRKETCNKSNMCESSKEALAENNLNLPKMAEKDGCFQSGFNEETCLVKIITGLLEFEVYLEYLQNRFESSEEQARAVQMSTKVLIQFLQKKAKNLDAITTPDPTTNASLLTKLQAQNQWLQDMTTHLILRSFKEFLQSSLRALRQM",
    educationalContent: `## About IL-6

Interleukin-6 (IL-6) is a pleiotropic cytokine with roles in inflammation, immune response, and hematopoiesis.

### Clinical relevance
- Elevated in COVID-19 cytokine storm
- Target of tocilizumab (anti-IL-6R antibody)
- Involved in rheumatoid arthritis, Castleman disease

### Structure
IL-6 is a 4-helix bundle cytokine. It signals through a receptor complex involving IL-6R and gp130.

### Design challenge
IL-6 is relatively small (~20 kDa) and compact, making it a moderate difficulty target.`,
    createdAt: new Date(),
  },
  {
    id: "vegf-a",
    name: "VEGF-A",
    description:
      "Design a binder for this symmetric dimer growth factor. VEGF-A drives angiogenesis and is targeted in cancer and eye diseases.",
    difficulty: 2,
    level: 1,
    taskType: "binder",
    targetPdbId: "1VPF",
    targetStructureUrl: "https://files.rcsb.org/download/1VPF.pdb",
    targetSequence:
      "APMAEGGGQNHHEVVKFMDVYQRSYCHPIETLVDIFQEYPDEIEYIFKPSCVPLMRCGGCCNDEGLECVPTEESNITMQIMRIKPHQGQHIGEMSFLQHNKCECRPKKDRARQENPCGPCSERRKHLFVQDPQTCKCSCKNTDSRCKARQLELNERTCRCDKPRR",
    educationalContent: `## About VEGF-A

Vascular Endothelial Growth Factor A (VEGF-A) is the master regulator of angiogenesis (blood vessel formation).

### Clinical relevance
- Target of bevacizumab (Avastin) for cancer
- Target of ranibizumab (Lucentis) for wet AMD
- Key in tumor vascularization

### Structure
VEGF-A is a homodimer with a cystine-knot fold. Each monomer has a receptor-binding interface.

### Design challenge
The dimeric nature adds complexity. Consider whether to target the VEGFR binding site or create a binder that blocks dimerization.`,
    createdAt: new Date(),
  },
];

async function seed() {
  console.log("Seeding challenges...");

  // Delete existing seed challenges to allow re-seeding with updated data
  const seedIds = seedChallenges.map((c) => c.id);
  await db.delete(challenges).where(sql`${challenges.id} IN (${sql.join(seedIds.map(id => sql`${id}`), sql`, `)})`);
  console.log("  Cleared existing seed challenges");

  for (const challenge of seedChallenges) {
    await db.insert(challenges).values(challenge);
    console.log(`  - ${challenge.name}`);
  }

  console.log("Done!");
}

seed().catch(console.error);
