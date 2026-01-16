import { describe, it, expect, beforeAll } from "vitest";
import { db, gpuPricing } from "../db";
import { calculateJobCost, getJobCostCents } from "../billing";

describe("Billing", () => {
  beforeAll(async () => {
    // Seed GPU pricing for tests
    const now = new Date();
    await db
      .insert(gpuPricing)
      .values([
        {
          id: "A10G",
          name: "NVIDIA A10G",
          modalRatePerSec: 0.000306,
          markupPercent: 30,
          isActive: true,
          createdAt: now,
        },
        {
          id: "A100_40GB",
          name: "NVIDIA A100 40GB",
          modalRatePerSec: 0.000583,
          markupPercent: 30,
          isActive: true,
          createdAt: now,
        },
        {
          id: "A100_80GB",
          name: "NVIDIA A100 80GB",
          modalRatePerSec: 0.000694,
          markupPercent: 30,
          isActive: true,
          createdAt: now,
        },
        {
          id: "H100",
          name: "NVIDIA H100",
          modalRatePerSec: 0.001097,
          markupPercent: 30,
          isActive: true,
          createdAt: now,
        },
      ])
      .onConflictDoNothing();
  });

  describe("calculateJobCost", () => {
    it("calculates cost for A10G correctly", async () => {
      const result = await calculateJobCost("A10G", 100);

      // 0.000306 * 1.3 * 100 * 100 = 3.978 -> ceil = 4 cents
      expect(result.costCents).toBe(4);
      expect(result.ratePerSec).toBe(0.000306);
      expect(result.markupPercent).toBe(30);
      expect(result.usedFallback).toBe(false);
    });

    it("calculates cost for A100_40GB correctly", async () => {
      const result = await calculateJobCost("A100_40GB", 730);

      // 0.000583 * 1.3 * 730 * 100 = 55.33 -> ceil = 56 cents
      expect(result.costCents).toBe(56);
      expect(result.ratePerSec).toBe(0.000583);
      expect(result.usedFallback).toBe(false);
    });

    it("calculates cost for A100_80GB correctly", async () => {
      const result = await calculateJobCost("A100_80GB", 600);

      // 0.000694 * 1.3 * 600 * 100 = 54.132 -> ceil = 55 cents
      expect(result.costCents).toBe(55);
      expect(result.usedFallback).toBe(false);
    });

    it("calculates cost for H100 correctly", async () => {
      const result = await calculateJobCost("H100", 300);

      // 0.001097 * 1.3 * 300 * 100 = 42.78 -> ceil = 43 cents
      expect(result.costCents).toBe(43);
      expect(result.usedFallback).toBe(false);
    });

    it("uses fallback rate for unknown GPU type", async () => {
      const result = await calculateJobCost("UNKNOWN_GPU", 100);

      // Fallback: 0.000306 * 1.3 * 100 * 100 = 3.978 -> ceil = 4 cents
      expect(result.costCents).toBe(4);
      expect(result.usedFallback).toBe(true);
    });

    it("uses fallback for 'A100' without size suffix", async () => {
      // This tests the bug we fixed - "A100" should not match "A100_40GB"
      const result = await calculateJobCost("A100", 730);

      // Should fall back to A10G rate since "A100" != "A100_40GB"
      // 0.000306 * 1.3 * 730 * 100 = 29.04 -> ceil = 30 cents
      expect(result.costCents).toBe(30);
      expect(result.usedFallback).toBe(true);
    });

    it("handles zero execution time", async () => {
      const result = await calculateJobCost("A10G", 0);
      expect(result.costCents).toBe(0);
    });

    it("handles fractional seconds", async () => {
      const result = await calculateJobCost("A10G", 730.37);

      // 0.000306 * 1.3 * 730.37 * 100 = 29.06 -> ceil = 30 cents
      expect(result.costCents).toBe(30);
    });
  });

  describe("getJobCostCents", () => {
    it("returns just the cost in cents", async () => {
      const cost = await getJobCostCents("A100_40GB", 730);
      expect(cost).toBe(56);
    });
  });

  describe("cost expectations for common scenarios", () => {
    it("12-minute BoltzGen job on A100_40GB costs ~55 cents", async () => {
      const result = await calculateJobCost("A100_40GB", 12 * 60); // 720 seconds

      // Should be around 55 cents for 12 minutes on A100_40GB
      expect(result.costCents).toBeGreaterThanOrEqual(50);
      expect(result.costCents).toBeLessThanOrEqual(60);
    });

    it("5-minute scoring job on A10G costs ~12 cents", async () => {
      const result = await calculateJobCost("A10G", 5 * 60); // 300 seconds

      // 0.000306 * 1.3 * 300 * 100 = 11.93 -> ceil = 12 cents
      expect(result.costCents).toBe(12);
    });

    it("1-hour job on H100 costs ~$5.13", async () => {
      const result = await calculateJobCost("H100", 3600);

      // 0.001097 * 1.3 * 3600 * 100 = 513.37 cents
      expect(result.costCents).toBe(514);
    });
  });
});
