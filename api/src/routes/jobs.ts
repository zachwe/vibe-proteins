import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db, jobs, user, challenges } from "../db";
import { auth } from "../auth";
import { randomUUID } from "crypto";
import { getInferenceProvider, type JobType } from "../inference";
import { getSignedUrl } from "../storage/r2";

const app = new Hono();

// Credit costs for different job types
const JOB_COSTS: Record<string, number> = {
  rfdiffusion3: 12,
  boltz2: 6,
  proteinmpnn: 4,
  predict: 5,
  score: 1,
};

const SIGNED_URL_TTL_SECONDS = Number.parseInt(
  process.env.R2_SIGNED_URL_TTL_SECONDS || "900",
  10
);

function attachSignedUrls(value: unknown, cache = new Map<string, string>()): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => attachSignedUrls(entry, cache));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;
  const next: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(record)) {
    next[key] = attachSignedUrls(val, cache);
  }

  if (typeof record.key === "string") {
    const key = record.key;
    const cached = cache.get(key);
    if (cached) {
      next.signedUrl = cached;
    } else {
      try {
        const signed = getSignedUrl(key, SIGNED_URL_TTL_SECONDS);
        cache.set(key, signed);
        next.signedUrl = signed;
      } catch (error) {
        console.warn("Unable to sign R2 URL:", error);
      }
    }
  }

  return next;
}

// POST /api/jobs - Submit a new inference job
app.post("/", async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const { challengeId, type, input } = body;

  if (!challengeId || !type) {
    return c.json({ error: "Missing required fields: challengeId, type" }, 400);
  }

  const challenge = await db
    .select({
      targetStructureUrl: challenges.targetStructureUrl,
      targetSequence: challenges.targetSequence,
    })
    .from(challenges)
    .where(eq(challenges.id, challengeId))
    .get();

  if (!challenge) {
    return c.json({ error: "Challenge not found" }, 404);
  }

  // Check credit cost
  const cost = JOB_COSTS[type] ?? 5;

  // Get user's current credits
  const currentUser = await db
    .select({ credits: user.credits })
    .from(user)
    .where(eq(user.id, session.user.id))
    .get();

  if (!currentUser || currentUser.credits < cost) {
    return c.json(
      { error: "Insufficient credits", required: cost, available: currentUser?.credits ?? 0 },
      402
    );
  }

  const jobId = randomUUID();
  const now = new Date();

  const normalizedInput = {
    challengeId,
    targetStructureUrl: challenge.targetStructureUrl,
    targetSequence: challenge.targetSequence,
    targetPdb: challenge.targetStructureUrl,
    ...(input ?? {}),
  };

  await db.insert(jobs).values({
    id: jobId,
    userId: session.user.id,
    challengeId,
    type,
    status: "pending",
    input: JSON.stringify(normalizedInput ?? {}),
    creditsUsed: cost,
    createdAt: now,
  });

  // Deduct credits
  await db
    .update(user)
    .set({ credits: currentUser.credits - cost })
    .where(eq(user.id, session.user.id));

  // Submit to inference provider (async, don't await for long-running jobs)
  const provider = getInferenceProvider();

  void (async () => {
    try {
      await db.update(jobs).set({ status: "running" }).where(eq(jobs.id, jobId));

      const result = await provider.submitJob(type as JobType, {
        ...normalizedInput,
        jobId,
        challengeId,
      });

      const updatePayload: Record<string, unknown> = {
        status: result.status,
        output: JSON.stringify(result.result?.output ?? { callId: result.callId }),
      };

      if (result.status === "completed") {
        updatePayload.completedAt = new Date();
      } else if (result.status === "failed") {
        updatePayload.error =
          result.result?.error ||
          (result.result?.output?.message as string | undefined) ||
          "Modal job failed";
      }

      await db.update(jobs).set(updatePayload).where(eq(jobs.id, jobId));
    } catch (error) {
      console.error("Failed to submit job to inference provider:", error);
      await db
        .update(jobs)
        .set({
          status: "failed",
          error: error instanceof Error ? error.message : "Modal job failed",
        })
        .where(eq(jobs.id, jobId));
    }
  })();

  return c.json({
    job: {
      id: jobId,
      status: "pending",
      type,
      creditsUsed: cost,
    },
  }, 201);
});

// GET /api/jobs/health - Check inference provider health (must be before /:id)
app.get("/health", async (c) => {
  const provider = getInferenceProvider();
  const health = await provider.healthCheck();
  return c.json(health, health.status === "ok" ? 200 : 503);
});

// GET /api/jobs/:id - Get job status and result
app.get("/:id", async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const id = c.req.param("id");

  const job = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, id), eq(jobs.userId, session.user.id)))
    .get();

  if (!job) {
    return c.json({ error: "Job not found" }, 404);
  }

  const parsedOutput = job.output ? JSON.parse(job.output) : null;

  return c.json({
    job: {
      ...job,
      input: job.input ? JSON.parse(job.input) : null,
      output: parsedOutput ? attachSignedUrls(parsedOutput) : null,
    },
  });
});

// GET /api/jobs - List user's jobs
app.get("/", async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userJobs = await db
    .select()
    .from(jobs)
    .where(eq(jobs.userId, session.user.id))
    .all();

  return c.json({
    jobs: userJobs.map((job) => {
      const parsedOutput = job.output ? JSON.parse(job.output) : null;
      return {
        ...job,
        input: job.input ? JSON.parse(job.input) : null,
        output: parsedOutput ? attachSignedUrls(parsedOutput) : null,
      };
    }),
  });
});

export default app;
