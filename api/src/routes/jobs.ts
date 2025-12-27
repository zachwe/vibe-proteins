import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db, jobs, user, challenges, transactions, gpuPricing } from "../db";
import { auth } from "../auth";
import { randomUUID } from "crypto";
import { getInferenceProvider, type JobType } from "../inference";
import { getSignedUrl } from "../storage/r2";

const app = new Hono();

// Minimum balance required to submit a job (in cents) - prevents users with $0 from submitting
const MIN_BALANCE_CENTS = 10; // $0.10 minimum

// Helper to calculate cost from GPU usage
async function calculateJobCost(gpuType: string, executionSeconds: number): Promise<number> {
  // Look up GPU pricing
  const pricing = await db
    .select()
    .from(gpuPricing)
    .where(eq(gpuPricing.id, gpuType))
    .get();

  if (!pricing) {
    // Fallback to A10G rate if GPU type not found
    const fallbackRate = 0.000306 * 1.3; // A10G + 30%
    return Math.ceil(fallbackRate * executionSeconds * 100); // Convert to cents
  }

  // Calculate: modalRate * (1 + markup%) * seconds * 100 (to cents)
  const ourRate = pricing.modalRatePerSec * (1 + pricing.markupPercent / 100);
  return Math.ceil(ourRate * executionSeconds * 100);
}

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

  // Get user's current balance (in cents)
  const currentUser = await db
    .select({ balanceUsdCents: user.balanceUsdCents })
    .from(user)
    .where(eq(user.id, session.user.id))
    .get();

  // Require minimum balance to submit jobs
  if (!currentUser || currentUser.balanceUsdCents < MIN_BALANCE_CENTS) {
    return c.json(
      {
        error: "Insufficient balance",
        message: "Please add funds to your account to run jobs",
        requiredCents: MIN_BALANCE_CENTS,
        availableCents: currentUser?.balanceUsdCents ?? 0
      },
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

  // Create job without charging - billing happens on completion
  await db.insert(jobs).values({
    id: jobId,
    userId: session.user.id,
    challengeId,
    type,
    status: "pending",
    input: JSON.stringify(normalizedInput ?? {}),
    createdAt: now,
  });

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

      const output = result.result?.output ?? { callId: result.callId };
      const updatePayload: Record<string, unknown> = {
        status: result.status,
        output: JSON.stringify(output),
      };

      if (result.status === "completed") {
        updatePayload.completedAt = new Date();

        // Extract usage data and calculate cost
        const usage = output?.usage as { gpu_type?: string; execution_seconds?: number } | undefined;
        if (usage?.gpu_type && usage?.execution_seconds) {
          const gpuType = usage.gpu_type;
          const executionSeconds = usage.execution_seconds;
          const costCents = await calculateJobCost(gpuType, executionSeconds);

          updatePayload.gpuType = gpuType;
          updatePayload.executionSeconds = executionSeconds;
          updatePayload.costUsdCents = costCents;

          // Deduct from user balance
          const jobUser = await db
            .select({ balanceUsdCents: user.balanceUsdCents })
            .from(user)
            .where(eq(user.id, session.user.id))
            .get();

          if (jobUser) {
            const newBalance = Math.max(0, jobUser.balanceUsdCents - costCents);
            await db
              .update(user)
              .set({ balanceUsdCents: newBalance })
              .where(eq(user.id, session.user.id));

            // Record transaction
            await db.insert(transactions).values({
              id: randomUUID(),
              userId: session.user.id,
              amountCents: -costCents,
              type: "job_usage",
              jobId,
              description: `${type} job (${gpuType}, ${executionSeconds.toFixed(1)}s)`,
              balanceAfterCents: newBalance,
              createdAt: new Date(),
            });
          }
        }
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
