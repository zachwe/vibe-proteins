import { describe, it, expect, beforeAll } from "vitest";
import { randomUUID } from "crypto";
import dotenv from "dotenv";
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

function expectString(value: unknown) {
  expect(typeof value).toBe("string");
  expect((value as string).length).toBeGreaterThan(0);
}

function expectUrl(value: unknown) {
  expectString(value);
  expect((value as string).startsWith("http")).toBe(true);
}

function expectSignedUrl(value: unknown) {
  expectUrl(value);
  expect((value as string).includes("X-Amz-Signature=")).toBe(true);
}

function expectUrlWithSuffix(value: unknown, suffixes: string[]) {
  expectUrl(value);
  const lower = (value as string).toLowerCase();
  const matches = suffixes.some((suffix) => lower.endsWith(suffix));
  expect(matches).toBe(true);
}

function expectAASequence(value: unknown) {
  expectString(value);
  expect(/^[A-Z]+$/.test(value as string)).toBe(true);
}

function expectNumber(value: unknown) {
  expect(typeof value).toBe("number");
  expect(Number.isNaN(value as number)).toBe(false);
}

function expectArray(value: unknown) {
  expect(Array.isArray(value)).toBe(true);
}

function assertBoltz2Output(output: Record<string, unknown>) {
  expect(output.status).toBe("completed");
  expect(output.boltz2).toBeTruthy();
  expectUrlWithSuffix(output.structureUrl, [".pdb", ".cif"]);
  expectUrlWithSuffix((output.complex as Record<string, unknown>)?.url, [".pdb", ".cif"]);
  expectString((output.complex as Record<string, unknown>)?.key);
  expectSignedUrl((output.complex as Record<string, unknown>)?.signedUrl);
  expectNumber((output.boltz2 as Record<string, unknown>)?.samples);
  expectNumber((output.interface_metrics as Record<string, unknown>)?.ip_sae);
  expectArray((output.interface_metrics as Record<string, unknown>)?.contact_pairs);
  if (output.confidence) {
    expectSignedUrl((output.confidence as Record<string, unknown>)?.signedUrl);
  }
}

function assertProteinMPNNOutput(output: Record<string, unknown>) {
  expect(output.status).toBe("completed");
  expectArray(output.sequences);
  const sequences = output.sequences as Array<Record<string, unknown>>;
  expect(sequences.length).toBeGreaterThan(0);
  expectAASequence(sequences[0]?.sequence);
  expectNumber(output.backbone_length);
}

function assertRFDiffusion3Output(output: Record<string, unknown>) {
  expect(output.status).toBe("completed");
  expectArray(output.designs);
  const designs = output.designs as Array<Record<string, unknown>>;
  expect(designs.length).toBeGreaterThan(0);
  const first = designs[0] || {};
  expectString(first.design_id);
  expectUrlWithSuffix((first.backbone as Record<string, unknown>)?.url, [".pdb"]);
  expectUrlWithSuffix((first.complex as Record<string, unknown>)?.url, [".pdb"]);
  expectSignedUrl((first.backbone as Record<string, unknown>)?.signedUrl);
  expectSignedUrl((first.complex as Record<string, unknown>)?.signedUrl);
  expectArray(first.mpnn_sequences);
  const mpnn = first.mpnn_sequences as Array<Record<string, unknown>>;
  expect(mpnn.length).toBeGreaterThan(0);
  expectAASequence(mpnn[0]?.sequence);
  expectAASequence(first.sequence);
  expectUrlWithSuffix((output.manifest as Record<string, unknown>)?.url, [".json"]);
  expectSignedUrl((output.manifest as Record<string, unknown>)?.signedUrl);
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
    dotenv.config({ path: resolve(repoRoot, "api/.env") });
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
      assertBoltz2Output(jobData.job.output as Record<string, unknown>);
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
      assertProteinMPNNOutput(jobData.job.output as Record<string, unknown>);
    }
  );

  it(
    "submits an rfdiffusion3 job and returns designs",
    { timeout: 900000 },
    async () => {
      const createRes = await app.request("/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: authCookie,
        },
        body: JSON.stringify({
          challengeId,
          type: "rfdiffusion3",
          input: {
            numDesigns: 1,
            binderLength: 60,
            diffusionSteps: 10,
            sequencesPerBackbone: 1,
            boltzSamples: 0,
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
      assertRFDiffusion3Output(jobData.job.output as Record<string, unknown>);
    }
  );
});
