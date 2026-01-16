/**
 * Billing utilities for job cost calculation.
 */
import { eq } from "drizzle-orm";
import { db, gpuPricing } from "./db";

// A10G fallback rate (Modal's rate per second)
const A10G_RATE_PER_SEC = 0.000306;
const DEFAULT_MARKUP_PERCENT = 30;

export interface CostCalculation {
  costCents: number;
  ratePerSec: number;
  markupPercent: number;
  usedFallback: boolean;
}

/**
 * Calculate job cost from GPU usage.
 *
 * @param gpuType - The GPU type identifier (must match gpu_pricing table)
 * @param executionSeconds - Total GPU execution time in seconds
 * @returns Cost in cents and calculation details
 */
export async function calculateJobCost(
  gpuType: string,
  executionSeconds: number
): Promise<CostCalculation> {
  // Look up GPU pricing
  const pricing = await db
    .select()
    .from(gpuPricing)
    .where(eq(gpuPricing.id, gpuType))
    .get();

  if (!pricing) {
    // Fallback to A10G rate if GPU type not found
    const fallbackRate = A10G_RATE_PER_SEC * (1 + DEFAULT_MARKUP_PERCENT / 100);
    return {
      costCents: Math.ceil(fallbackRate * executionSeconds * 100),
      ratePerSec: A10G_RATE_PER_SEC,
      markupPercent: DEFAULT_MARKUP_PERCENT,
      usedFallback: true,
    };
  }

  // Calculate: modalRate * (1 + markup%) * seconds * 100 (to cents)
  const ourRate = pricing.modalRatePerSec * (1 + pricing.markupPercent / 100);
  return {
    costCents: Math.ceil(ourRate * executionSeconds * 100),
    ratePerSec: pricing.modalRatePerSec,
    markupPercent: pricing.markupPercent,
    usedFallback: false,
  };
}

/**
 * Get cost in cents only (for backward compatibility).
 */
export async function getJobCostCents(
  gpuType: string,
  executionSeconds: number
): Promise<number> {
  const result = await calculateJobCost(gpuType, executionSeconds);
  return result.costCents;
}
