import { describe, it, expect, beforeAll } from "vitest";
import { app } from "../app";
import { db, challenges } from "../db";

// Test data
const testChallenge = {
  id: "test-challenge-1",
  name: "Test Challenge",
  description: "A test challenge for unit tests",
  difficulty: 1,
  level: 1,
  taskType: "binder",
  createdAt: new Date(),
};

describe("API Endpoints", () => {
  beforeAll(async () => {
    // Seed test data (test database is created fresh in globalSetup.ts)
    await db.insert(challenges).values(testChallenge).onConflictDoNothing();
  });

  describe("GET /", () => {
    it("should return health check", async () => {
      const res = await app.request("/");
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toEqual({
        status: "ok",
        message: "ProteinDojo API",
      });
    });
  });

  describe("GET /api/challenges", () => {
    it("should return a list of challenges", async () => {
      const res = await app.request("/api/challenges");
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toHaveProperty("challenges");
      expect(Array.isArray(data.challenges)).toBe(true);
    });

    it("should include the test challenge", async () => {
      const res = await app.request("/api/challenges");
      const data = await res.json();

      const found = data.challenges.find(
        (c: { id: string }) => c.id === testChallenge.id
      );
      expect(found).toBeDefined();
      expect(found.name).toBe(testChallenge.name);
    });
  });

  describe("GET /api/challenges/:id", () => {
    it("should return a single challenge", async () => {
      const res = await app.request(`/api/challenges/${testChallenge.id}`);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toHaveProperty("challenge");
      expect(data.challenge.id).toBe(testChallenge.id);
      expect(data.challenge.name).toBe(testChallenge.name);
    });

    it("should return 404 for non-existent challenge", async () => {
      const res = await app.request("/api/challenges/non-existent-id");
      expect(res.status).toBe(404);

      const data = await res.json();
      expect(data).toHaveProperty("error");
    });
  });

  describe("GET /api/users/me", () => {
    it("should return 401 when not authenticated", async () => {
      const res = await app.request("/api/users/me");
      expect(res.status).toBe(401);

      const data = await res.json();
      expect(data).toHaveProperty("error");
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("POST /api/jobs", () => {
    it("should return 401 when not authenticated", async () => {
      const res = await app.request("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: testChallenge.id,
          type: "rfdiffusion3",
        }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/jobs", () => {
    it("should return 401 when not authenticated", async () => {
      const res = await app.request("/api/jobs");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/jobs/health", () => {
    // This test makes a real HTTP call to Modal - skip in CI, run manually for integration testing
    it.skipIf(process.env.CI === "true")(
      "should return inference provider health status (no auth required)",
      { timeout: 15000 },
      async () => {
        const res = await app.request("/api/jobs/health");
        // May return 200 (ok) or 503 (error) depending on Modal availability
        expect([200, 503]).toContain(res.status);

        const data = await res.json();
        expect(data).toHaveProperty("status");
        expect(["ok", "error"]).toContain(data.status);
        expect(data).toHaveProperty("message");
      }
    );
  });

  describe("POST /api/submissions", () => {
    it("should return 401 when not authenticated", async () => {
      const res = await app.request("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: testChallenge.id,
          designSequence: "MVLSPADKTNVKAAWGKVGAHAGEYGAEALERMFLSFPTTKTYFPHFDLSH",
        }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/submissions", () => {
    it("should return 401 when not authenticated", async () => {
      const res = await app.request("/api/submissions");
      expect(res.status).toBe(401);
    });
  });
});
