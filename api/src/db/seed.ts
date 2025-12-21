/**
 * Seed script for initial challenge data
 *
 * Run with: pnpm db:seed
 */

import { db, challenges } from "./index";
import challengesData from "./challenges.json";

interface ChainAnnotation {
  name: string;
  role: string;
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
          educationalContent: challenge.educationalContent,
        },
      });
    console.log(`  - ${challenge.name}`);
  }

  console.log(`Done! Seeded ${challengesData.length} challenges.`);
}

seed().catch(console.error);
