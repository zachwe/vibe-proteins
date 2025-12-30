/**
 * Seed script for initial challenge, GPU pricing, and deposit preset data
 *
 * Run with: pnpm db:seed
 */

import { db, challenges, gpuPricing, depositPresets } from "./index";
import challengesData from "./challenges.json";

interface ChainAnnotation {
  name: string;
  role: string;
  description: string;
}

interface SuggestedHotspot {
  residues: string[];
  label: string;
  description: string;
}

interface ChallengeInput {
  id: string;
  name: string;
  description: string;
  mission: string;
  difficulty: number;
  level: number;
  taskType: string;
  targetPdbId: string;
  targetUniprotId: string;
  targetStructureUrl: string;
  targetSequence: string;
  targetChainId: string;
  pdbDescription: string;
  chainAnnotations: { [key: string]: ChainAnnotation };
  suggestedHotspots?: SuggestedHotspot[];
  educationalContent: string;
}

async function seed() {
  console.log("Seeding challenges...");

  // Use upsert to update existing challenges or insert new ones
  // This avoids foreign key issues with jobs/submissions
  for (const challenge of challengesData as unknown as ChallengeInput[]) {
    await db
      .insert(challenges)
      .values({
        ...challenge,
        chainAnnotations: JSON.stringify(challenge.chainAnnotations),
        suggestedHotspots: challenge.suggestedHotspots ? JSON.stringify(challenge.suggestedHotspots) : null,
        createdAt: new Date(),
      })
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
          targetUniprotId: challenge.targetUniprotId,
          targetStructureUrl: challenge.targetStructureUrl,
          targetSequence: challenge.targetSequence,
          targetChainId: challenge.targetChainId,
          pdbDescription: challenge.pdbDescription,
          chainAnnotations: JSON.stringify(challenge.chainAnnotations),
          suggestedHotspots: challenge.suggestedHotspots ? JSON.stringify(challenge.suggestedHotspots) : null,
          educationalContent: challenge.educationalContent,
        },
      });
    console.log(`  - ${challenge.name}`);
  }

  console.log(`Done! Seeded ${challengesData.length} challenges.`);

  // Seed GPU pricing (Modal rates as of Dec 2024, +30% markup)
  console.log("\nSeeding GPU pricing...");

  const gpuRates = [
    { id: "T4", name: "NVIDIA T4", modalRatePerSec: 0.000164 },
    { id: "L4", name: "NVIDIA L4", modalRatePerSec: 0.000222 },
    { id: "A10G", name: "NVIDIA A10G", modalRatePerSec: 0.000306 },
    { id: "L40S", name: "NVIDIA L40S", modalRatePerSec: 0.000542 },
    { id: "A100_40GB", name: "NVIDIA A100 40GB", modalRatePerSec: 0.000583 },
    { id: "A100_80GB", name: "NVIDIA A100 80GB", modalRatePerSec: 0.000694 },
    { id: "H100", name: "NVIDIA H100", modalRatePerSec: 0.001097 },
    { id: "H200", name: "NVIDIA H200", modalRatePerSec: 0.001261 },
    { id: "B200", name: "NVIDIA B200", modalRatePerSec: 0.001736 },
  ];

  for (const gpu of gpuRates) {
    const ourRate = gpu.modalRatePerSec * 1.3; // 30% markup
    await db
      .insert(gpuPricing)
      .values({
        ...gpu,
        markupPercent: 30,
        isActive: true,
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: gpuPricing.id,
        set: {
          name: gpu.name,
          modalRatePerSec: gpu.modalRatePerSec,
          markupPercent: 30,
          isActive: true,
        },
      });
    console.log(`  - ${gpu.name}: $${gpu.modalRatePerSec.toFixed(6)}/sec (ours: $${ourRate.toFixed(6)}/sec)`);
  }

  console.log(`Done! Seeded ${gpuRates.length} GPU pricing entries.`);

  // Seed deposit presets
  console.log("\nSeeding deposit presets...");

  const presets = [
    { id: "5", amountCents: 500, label: "$5", sortOrder: 1 },
    { id: "10", amountCents: 1000, label: "$10", sortOrder: 2 },
    { id: "25", amountCents: 2500, label: "$25", sortOrder: 3 },
    { id: "50", amountCents: 5000, label: "$50", sortOrder: 4 },
  ];

  for (const preset of presets) {
    await db
      .insert(depositPresets)
      .values({
        ...preset,
        isActive: true,
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: depositPresets.id,
        set: {
          amountCents: preset.amountCents,
          label: preset.label,
          sortOrder: preset.sortOrder,
          isActive: true,
        },
      });
    console.log(`  - ${preset.label}`);
  }

  console.log(`Done! Seeded ${presets.length} deposit presets.`);
}

seed().catch(console.error);
