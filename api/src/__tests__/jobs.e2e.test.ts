import { describe, it, expect, beforeAll } from "vitest";
import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { db, challenges } from "../db";

const runE2E = process.env.MODAL_E2E === "true";
const describeIf = runE2E ? describe : describe.skip;

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../");
const targetPdb = readFileSync(
  resolve(repoRoot, "sample_data/pdb/mini_target.pdb"),
  "utf8"
);
const binderPdb = readFileSync(
  resolve(repoRoot, "sample_data/pdb/mini_binder.pdb"),
  "utf8"
);

const challengeId = "e2e-modal-challenge";

function cookieHeaderFromSetCookie(setCookieHeader: string | null): string {
  if (!setCookieHeader) {
    throw new Error("Expected set-cookie header from auth response.");
  }
  const parts = setCookieHeader.split(/,(?=[^;]+=[^;]+)/);
  const cookies = parts
    .map((part) => part.split(";")[0]?.trim())
    .filter((value): value is string => Boolean(value));
  if (!cookies.length) {
    throw new Error("No cookies parsed from set-cookie header.");
  }
  return cookies.join("; ");
}

async function signUpAndGetCookie(app: ReturnType<typeof import("../app").createApp>) {
  const email = `e2e-${randomUUID()}@example.com`;
  const response = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "E2E Tester",
      email,
      password: "test-password-123",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sign-up failed: ${response.status} ${text}`);
  }

  return cookieHeaderFromSetCookie(response.headers.get("set-cookie"));
}

describeIf("Jobs API e2e (Modal)", () => {
  let app: ReturnType<typeof import("../app").createApp>;
  let authCookie: string;

  beforeAll(async () => {
    process.env.BETTER_AUTH_SECRET =
      process.env.BETTER_AUTH_SECRET || "test-secret";
    process.env.MODAL_ENDPOINT =
      process.env.MODAL_ENDPOINT ||
      "https://zach-b-ocean--vibeproteins-submit-job.modal.run";

    const { createApp } = await import("../app");
    app = createApp();

    await db
      .insert(challenges)
      .values({
        id: challengeId,
        name: "Modal E2E Challenge",
        description: "E2E job submission test",
        difficulty: 1,
        level: 1,
        taskType: "binder",
        targetStructureUrl: targetPdb,
        targetSequence: "GSA",
      })
      .onConflictDoNothing();

    authCookie = await signUpAndGetCookie(app);
  });

  it(
    "submits a boltz2 job and returns a completed result",
    { timeout: 600000 },
    async () => {
      const createRes = await app.request("/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: authCookie,
        },
        body: JSON.stringify({
          challengeId,
          type: "boltz2",
          input: {
            binderSequence: "TKG",
            numSamples: 1,
          },
        }),
      });

      expect(createRes.status).toBe(201);
      const created = await createRes.json();
      const jobId = created.job.id as string;

      const jobRes = await app.request(`/api/jobs/${jobId}`, {
        headers: { Cookie: authCookie },
      });
      expect(jobRes.status).toBe(200);

      const jobData = await jobRes.json();
      expect(jobData.job.status).toBe("completed");
      expect(jobData.job.output?.status).toBe("completed");
      expect(jobData.job.output?.boltz2).toBeTruthy();
    }
  );

  it(
    "submits a proteinmpnn job and returns sequences",
    { timeout: 600000 },
    async () => {
      const createRes = await app.request("/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: authCookie,
        },
        body: JSON.stringify({
          challengeId,
          type: "proteinmpnn",
          input: {
            backbonePdb: binderPdb,
            sequencesPerDesign: 2,
          },
        }),
      });

      expect(createRes.status).toBe(201);
      const created = await createRes.json();
      const jobId = created.job.id as string;

      const jobRes = await app.request(`/api/jobs/${jobId}`, {
        headers: { Cookie: authCookie },
      });
      expect(jobRes.status).toBe(200);

      const jobData = await jobRes.json();
      expect(jobData.job.status).toBe("completed");
      expect(jobData.job.output?.status).toBe("completed");
      expect(Array.isArray(jobData.job.output?.sequences)).toBe(true);
    }
  );
});
