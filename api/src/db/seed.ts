/**
 * Seed script for initial challenge, GPU pricing, deposit preset, reference binder, and help article data
 *
 * Run with: pnpm db:seed
 */

import * as fs from "fs";
import * as path from "path";
import { db, challenges, gpuPricing, depositPresets, referenceBinders, helpArticles } from "./index";
import challengesData from "./challenges.json";
import referenceBindersData from "./reference-binders.json";
import helpArticlesData from "./help-articles.json";

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
  level: number;
  taskType: string;
  targetPdbId: string;
  targetUniprotId: string;
  targetStructureUrl: string;
  targetSequence: string;
  targetChainId: string;
  pdbStartResidue?: number;
  pdbDescription: string;
  chainAnnotations: { [key: string]: ChainAnnotation };
  suggestedHotspots?: SuggestedHotspot[];
  educationalContent: string;
}

interface ReferenceBinderScores {
  plddt?: number;
  ptm?: number;
  iptm?: number;
  ipSaeScore?: number;
  pdockq?: number;
  pdockq2?: number;
  lis?: number;
  interfaceArea?: number;
  shapeComplementarity?: number;
}

interface ReferenceBinderInput {
  id: string;
  challengeId: string;
  name: string;
  slug: string;
  binderType: string;
  pdbId?: string;
  pdbUrl?: string;
  binderChainId?: string;
  binderSequence?: string;
  complexStructureUrl?: string;
  scores?: ReferenceBinderScores;
  // Legacy individual score fields (deprecated, use scores object)
  compositeScore?: number;
  ipSaeScore?: number;
  plddt?: number;
  ptm?: number;
  interfaceArea?: number;
  shapeComplementarity?: number;
  helpArticleSlug?: string;
  shortDescription?: string;
  scoringNote?: string;
  discoveryYear?: number;
  approvalStatus?: string;
  sortOrder?: number;
}

interface HelpArticleInput {
  slug: string;
  title: string;
  contentFile: string;
  category: string;
  relatedChallenges?: string[];
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
          level: challenge.level,
          taskType: challenge.taskType,
          targetPdbId: challenge.targetPdbId,
          targetUniprotId: challenge.targetUniprotId,
          targetStructureUrl: challenge.targetStructureUrl,
          targetSequence: challenge.targetSequence,
          targetChainId: challenge.targetChainId,
          pdbStartResidue: challenge.pdbStartResidue,
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

  // Seed help articles first (reference binders depend on them)
  console.log("\nSeeding help articles...");

  const dbDir = path.dirname(new URL(import.meta.url).pathname);

  for (const article of helpArticlesData as unknown as HelpArticleInput[]) {
    // Load content from markdown file
    const contentPath = path.join(dbDir, article.contentFile);
    const content = fs.readFileSync(contentPath, "utf-8");

    await db
      .insert(helpArticles)
      .values({
        slug: article.slug,
        title: article.title,
        content: content,
        category: article.category,
        relatedChallenges: article.relatedChallenges ? JSON.stringify(article.relatedChallenges) : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: helpArticles.slug,
        set: {
          title: article.title,
          content: content,
          category: article.category,
          relatedChallenges: article.relatedChallenges ? JSON.stringify(article.relatedChallenges) : null,
          updatedAt: new Date(),
        },
      });
    console.log(`  - ${article.title}`);
  }

  console.log(`Done! Seeded ${helpArticlesData.length} help articles.`);

  // Seed reference binders
  console.log("\nSeeding reference binders...");

  for (const binder of referenceBindersData as unknown as ReferenceBinderInput[]) {
    // Extract scores from nested object or use individual fields (for backwards compatibility)
    const scores = binder.scores ?? {};
    const plddt = scores.plddt ?? binder.plddt;
    const ptm = scores.ptm ?? binder.ptm;
    const iptm = scores.iptm;
    const ipSaeScore = scores.ipSaeScore ?? binder.ipSaeScore;
    const pdockq = scores.pdockq;
    const pdockq2 = scores.pdockq2;
    const lis = scores.lis;
    const interfaceArea = scores.interfaceArea ?? binder.interfaceArea;
    const shapeComplementarity = scores.shapeComplementarity ?? binder.shapeComplementarity;

    await db
      .insert(referenceBinders)
      .values({
        id: binder.id,
        challengeId: binder.challengeId,
        name: binder.name,
        slug: binder.slug,
        binderType: binder.binderType,
        pdbId: binder.pdbId,
        pdbUrl: binder.pdbUrl,
        binderChainId: binder.binderChainId,
        binderSequence: binder.binderSequence,
        complexStructureUrl: binder.complexStructureUrl,
        compositeScore: binder.compositeScore,
        ipSaeScore,
        plddt,
        ptm,
        iptm,
        pdockq,
        pdockq2,
        lis,
        interfaceArea,
        shapeComplementarity,
        helpArticleSlug: binder.helpArticleSlug,
        shortDescription: binder.shortDescription,
        scoringNote: binder.scoringNote,
        discoveryYear: binder.discoveryYear,
        approvalStatus: binder.approvalStatus,
        isActive: true,
        sortOrder: binder.sortOrder ?? 0,
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: referenceBinders.id,
        set: {
          challengeId: binder.challengeId,
          name: binder.name,
          slug: binder.slug,
          binderType: binder.binderType,
          pdbId: binder.pdbId,
          pdbUrl: binder.pdbUrl,
          binderChainId: binder.binderChainId,
          binderSequence: binder.binderSequence,
          complexStructureUrl: binder.complexStructureUrl,
          compositeScore: binder.compositeScore,
          ipSaeScore,
          plddt,
          ptm,
          iptm,
          pdockq,
          pdockq2,
          lis,
          interfaceArea,
          shapeComplementarity,
          helpArticleSlug: binder.helpArticleSlug,
          shortDescription: binder.shortDescription,
          scoringNote: binder.scoringNote,
          discoveryYear: binder.discoveryYear,
          approvalStatus: binder.approvalStatus,
          sortOrder: binder.sortOrder ?? 0,
          isActive: true,
        },
      });
    const scoreInfo = pdockq ? ` [pDockQ: ${pdockq.toFixed(3)}]` : "";
    console.log(`  - ${binder.name} (${binder.challengeId})${scoreInfo}`);
  }

  console.log(`Done! Seeded ${referenceBindersData.length} reference binders.`);
}

seed().catch(console.error);
