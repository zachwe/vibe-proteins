import { Hono } from "hono";
import { eq, and, or, isNull } from "drizzle-orm";
import { db, jobs, user, organization, challenges, transactions } from "../db";
import { auth } from "../auth";
import { randomUUID } from "crypto";
import { getInferenceProvider, type JobType } from "../inference";
import { getSignedUrl } from "../storage/r2";
import { analytics } from "../services/analytics";
import { getJobCostCents } from "../billing";
import {
  getBillingContext,
  deductBalance,
  getMembership,
  type BillingContext,
} from "../lib/team-context";

const app = new Hono();

// Minimum balance required to submit a job (in cents) - prevents users with $0 from submitting
const MIN_BALANCE_CENTS = 10; // $0.10 minimum

// Alias for backward compatibility within this file
const calculateJobCost = getJobCostCents;

// Helper to process partial billing for long-running jobs
async function processPartialBilling(
  jobId: string,
  userId: string,
  organizationId: string | null,
  jobType: string,
  gpuType: string,
  executionSeconds: number,
  currentBilledSeconds: number
): Promise<{ billedSeconds: number; costCents: number } | null> {
  // Only bill for time beyond what we've already billed
  const unbilledSeconds = executionSeconds - currentBilledSeconds;

  // Skip if less than 30 seconds of new usage (avoid micro-transactions)
  if (unbilledSeconds < 30) {
    return null;
  }

  const costCents = await calculateJobCost(gpuType, unbilledSeconds);

  // Skip if cost is less than 1 cent
  if (costCents < 1) {
    return null;
  }

  // Get billing context (team or personal based on the job's organizationId)
  const billingContext = await getBillingContext(userId, organizationId);

  // Deduct from appropriate balance (user or team)
  const newBalance = await deductBalance(billingContext, costCents);

  // Record transaction for partial billing
  await db.insert(transactions).values({
    id: randomUUID(),
    userId,
    organizationId,
    amountCents: -costCents,
    type: "job_usage",
    jobId,
    description: `${jobType} job (${gpuType}, ${unbilledSeconds.toFixed(1)}s partial)`,
    balanceAfterCents: newBalance,
    createdAt: new Date(),
  });

  return {
    billedSeconds: executionSeconds,
    costCents,
  };
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

  // Get active organization from session (if any)
  const activeOrganizationId = (session.session as { activeOrganizationId?: string })?.activeOrganizationId ?? null;

  // Get billing context (team or personal)
  const billingContext = await getBillingContext(session.user.id, activeOrganizationId);

  // Require minimum balance to submit jobs
  if (billingContext.balanceUsdCents < MIN_BALANCE_CENTS) {
    return c.json(
      {
        error: "Insufficient balance",
        message: billingContext.type === "team"
          ? "Please add funds to your team account to run jobs"
          : "Please add funds to your account to run jobs",
        requiredCents: MIN_BALANCE_CENTS,
        availableCents: billingContext.balanceUsdCents,
        billingType: billingContext.type,
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
  // Store organizationId if in team context
  await db.insert(jobs).values({
    id: jobId,
    userId: session.user.id,
    challengeId,
    organizationId: billingContext.type === "team" ? activeOrganizationId : null,
    type,
    status: "pending",
    input: JSON.stringify(normalizedInput ?? {}),
    createdAt: now,
  });

  // Submit to inference provider (async - returns immediately)
  const provider = getInferenceProvider();

  try {
    const result = await provider.submitJob(type as JobType, {
      ...normalizedInput,
      jobId,
      challengeId,
    });

    if (result.status === "failed") {
      await db
        .update(jobs)
        .set({
          status: "failed",
          error: "Failed to submit job to Modal",
        })
        .where(eq(jobs.id, jobId));

      return c.json({
        job: {
          id: jobId,
          status: "failed",
          type,
          error: "Failed to submit job to Modal",
        },
      }, 500);
    }

    // Job is now running in Modal - store call_id for tracking
    await db
      .update(jobs)
      .set({
        modalCallId: result.callId,
        status: "running",
      })
      .where(eq(jobs.id, jobId));

    // Track job creation
    analytics.track(session.user.id, "job_created", {
      jobId,
      challengeId,
      jobType: type,
    });

    return c.json({
      job: {
        id: jobId,
        status: "running",
        type,
        modalCallId: result.callId,
      },
    }, 201);
  } catch (error) {
    console.error("Failed to submit job to inference provider:", error);
    await db
      .update(jobs)
      .set({
        status: "failed",
        error: error instanceof Error ? error.message : "Modal job failed",
      })
      .where(eq(jobs.id, jobId));

    return c.json({
      job: {
        id: jobId,
        status: "failed",
        type,
        error: error instanceof Error ? error.message : "Modal job failed",
      },
    }, 500);
  }
});

// GET /api/jobs/health - Check inference provider health (must be before /:id)
app.get("/health", async (c) => {
  const provider = getInferenceProvider();
  const health = await provider.healthCheck();
  return c.json(health, health.status === "ok" ? 200 : 503);
});

// Verify Modal callback secret helper
function verifyCallbackSecret(c: { req: { header: (name: string) => string | undefined } }): boolean {
  const callbackSecret = process.env.MODAL_CALLBACK_SECRET;
  if (!callbackSecret) return true; // No secret configured, allow all
  const providedSecret = c.req.header("X-Callback-Secret");
  return providedSecret === callbackSecret;
}

// POST /api/jobs/:id/progress - Update job progress (called by Modal)
app.post("/:id/progress", async (c) => {
  if (!verifyCallbackSecret(c)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const id = c.req.param("id");
  const body = await c.req.json();
  const { stage, message, timestamp } = body;

  if (!stage || !message) {
    return c.json({ error: "Missing required fields: stage, message" }, 400);
  }

  const job = await db.select().from(jobs).where(eq(jobs.id, id)).get();

  if (!job) {
    return c.json({ error: "Job not found" }, 404);
  }

  // Parse existing progress or start with empty array
  const existingProgress = job.progress ? JSON.parse(job.progress) : [];

  // Append new progress event
  existingProgress.push({
    stage,
    message,
    timestamp: timestamp || Date.now(),
  });

  // Update job with new progress
  await db
    .update(jobs)
    .set({
      progress: JSON.stringify(existingProgress),
      // Also update status to running if still pending
      ...(job.status === "pending" ? { status: "running" } : {}),
    })
    .where(eq(jobs.id, id));

  return c.json({ success: true });
});

// POST /api/jobs/:id/complete - Mark job as completed (called by Modal)
app.post("/:id/complete", async (c) => {
  if (!verifyCallbackSecret(c)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const id = c.req.param("id");
  const body = await c.req.json();
  const { status, output, error: jobError, usage } = body;

  if (!status || !["completed", "failed"].includes(status)) {
    return c.json({ error: "Invalid status, must be 'completed' or 'failed'" }, 400);
  }

  const job = await db.select().from(jobs).where(eq(jobs.id, id)).get();

  if (!job) {
    return c.json({ error: "Job not found" }, 404);
  }

  const updatePayload: Record<string, unknown> = {
    status,
    output: output ? JSON.stringify(output) : null,
  };

  if (status === "completed") {
    updatePayload.completedAt = new Date();

    // Handle final billing if usage data provided (only for unbilled time)
    if (usage?.gpu_type && usage?.execution_seconds) {
      const gpuType = usage.gpu_type;
      const totalExecutionSeconds = usage.execution_seconds;
      const billedSeconds = job.billedSeconds ?? 0;
      const unbilledSeconds = totalExecutionSeconds - billedSeconds;

      updatePayload.gpuType = gpuType;
      updatePayload.executionSeconds = totalExecutionSeconds;
      updatePayload.billedSeconds = totalExecutionSeconds;

      // Only charge for remaining unbilled time
      if (unbilledSeconds > 0) {
        const costCents = await calculateJobCost(gpuType, unbilledSeconds);

        // Track total cost across all partial + final billing
        const previousCost = job.costUsdCents ?? 0;
        updatePayload.costUsdCents = previousCost + costCents;

        // Get billing context based on the job's organizationId (not current session)
        const billingContext = await getBillingContext(job.userId, job.organizationId);

        // Deduct remaining cost from appropriate balance (user or team)
        const newBalance = await deductBalance(billingContext, costCents);

        // Record transaction for final billing
        await db.insert(transactions).values({
          id: randomUUID(),
          userId: job.userId,
          organizationId: job.organizationId,
          amountCents: -costCents,
          type: "job_usage",
          jobId: id,
          description: `${job.type} job (${gpuType}, ${unbilledSeconds.toFixed(1)}s final)`,
          balanceAfterCents: newBalance,
          createdAt: new Date(),
        });
      } else {
        // All time was already billed via partial billing
        updatePayload.costUsdCents = job.costUsdCents ?? 0;
      }
    }
  } else if (status === "failed") {
    updatePayload.error = jobError || "Job failed";
  }

  await db.update(jobs).set(updatePayload).where(eq(jobs.id, id));

  // Track job completion
  analytics.track(job.userId, "job_completed", {
    jobId: id,
    challengeId: job.challengeId,
    jobType: job.type,
    status,
    gpuType: updatePayload.gpuType ?? null,
    executionSeconds: updatePayload.executionSeconds ?? null,
    costCents: updatePayload.costUsdCents ?? null,
  });

  return c.json({ success: true });
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

  // First get the job
  let job = await db.select().from(jobs).where(eq(jobs.id, id)).get();

  if (!job) {
    return c.json({ error: "Job not found" }, 404);
  }

  // Check if user has access to this job:
  // 1. They own it directly (personal job)
  // 2. It belongs to a team they're a member of
  const canAccess =
    job.userId === session.user.id ||
    (job.organizationId && (await getMembership(session.user.id, job.organizationId)));

  if (!canAccess) {
    return c.json({ error: "Job not found" }, 404);
  }

  // If job is still running, poll Modal for latest status
  if (job.status === "pending" || job.status === "running") {
    const provider = getInferenceProvider();
    const modalStatus = await provider.getJobStatus(id);

    // Update local DB with latest status from Modal
    if (modalStatus.status !== job.status || modalStatus.progress || modalStatus.result) {
      const updatePayload: Record<string, unknown> = {};

      if (modalStatus.progress) {
        updatePayload.progress = JSON.stringify(modalStatus.progress);
      }

      if (modalStatus.status === "completed" && modalStatus.result?.output) {
        updatePayload.status = "completed";
        updatePayload.output = JSON.stringify(modalStatus.result.output);
        updatePayload.completedAt = new Date();

        // Handle final billing (only for unbilled time if partial billing occurred)
        if (modalStatus.usage?.gpu_type && modalStatus.usage?.execution_seconds) {
          const totalExecutionSeconds = modalStatus.usage.execution_seconds;
          const billedSeconds = job.billedSeconds ?? 0;
          const unbilledSeconds = totalExecutionSeconds - billedSeconds;

          updatePayload.gpuType = modalStatus.usage.gpu_type;
          updatePayload.executionSeconds = totalExecutionSeconds;
          updatePayload.billedSeconds = totalExecutionSeconds;

          // Only charge for remaining unbilled time
          if (unbilledSeconds > 0) {
            const costCents = await calculateJobCost(
              modalStatus.usage.gpu_type,
              unbilledSeconds
            );

            // Track total cost across all partial + final billing
            const previousCost = job.costUsdCents ?? 0;
            updatePayload.costUsdCents = previousCost + costCents;

            // Get billing context based on the job's organizationId
            const billingContext = await getBillingContext(job.userId, job.organizationId);

            if (costCents > 0) {
              const newBalance = await deductBalance(billingContext, costCents);

              await db.insert(transactions).values({
                id: randomUUID(),
                userId: job.userId,
                organizationId: job.organizationId,
                amountCents: -costCents,
                type: "job_usage",
                jobId: id,
                description: `${job.type} job (${modalStatus.usage.gpu_type}, ${unbilledSeconds.toFixed(1)}s final)`,
                balanceAfterCents: newBalance,
                createdAt: new Date(),
              });
            }
          } else {
            // All time was already billed via partial billing
            updatePayload.costUsdCents = job.costUsdCents ?? 0;
          }
        }
      } else if (modalStatus.status === "failed") {
        updatePayload.status = "failed";
        updatePayload.error = modalStatus.result?.error || "Job failed";
      } else if (modalStatus.status === "running" && job.status === "pending") {
        updatePayload.status = "running";
      }

      // Handle partial billing for long-running jobs (e.g., BoltzGen)
      if (
        modalStatus.status === "running" &&
        modalStatus.usage?.gpu_type &&
        modalStatus.usage?.execution_seconds
      ) {
        const currentBilledSeconds = job.billedSeconds ?? 0;
        const partialBilling = await processPartialBilling(
          id,
          job.userId,
          job.organizationId,
          job.type,
          modalStatus.usage.gpu_type,
          modalStatus.usage.execution_seconds,
          currentBilledSeconds
        );

        if (partialBilling) {
          updatePayload.billedSeconds = partialBilling.billedSeconds;
          updatePayload.gpuType = modalStatus.usage.gpu_type;
          updatePayload.executionSeconds = modalStatus.usage.execution_seconds;
          // Accumulate cost from partial billing
          const previousCost = job.costUsdCents ?? 0;
          updatePayload.costUsdCents = previousCost + partialBilling.costCents;
        }
      }

      if (Object.keys(updatePayload).length > 0) {
        await db.update(jobs).set(updatePayload).where(eq(jobs.id, id));

        // Re-fetch updated job
        job = await db
          .select()
          .from(jobs)
          .where(eq(jobs.id, id))
          .get();
      }
    }
  }

  const parsedOutput = job?.output ? JSON.parse(job.output) : null;
  const parsedProgress = job?.progress ? JSON.parse(job.progress) : [];

  // Calculate estimated total cost based on current execution time
  let estimatedCostCents: number | null = null;
  if (job?.executionSeconds && job?.gpuType) {
    estimatedCostCents = await calculateJobCost(job.gpuType, job.executionSeconds);
  }

  return c.json({
    job: {
      ...job,
      input: job?.input ? JSON.parse(job.input) : null,
      output: parsedOutput ? attachSignedUrls(parsedOutput) : null,
      progress: parsedProgress,
      estimatedCostCents,
    },
  });
});

// GET /api/jobs - List user's jobs
// Returns personal jobs OR team jobs based on active organization
app.get("/", async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Get active organization from session (if any)
  const activeOrganizationId = (session.session as { activeOrganizationId?: string })?.activeOrganizationId ?? null;

  let userJobs;
  if (activeOrganizationId) {
    // Verify user is a member of this organization
    const membership = await getMembership(session.user.id, activeOrganizationId);
    if (membership) {
      // Show all jobs belonging to this team
      userJobs = await db
        .select()
        .from(jobs)
        .where(eq(jobs.organizationId, activeOrganizationId))
        .all();
    } else {
      // User not a member, fall back to personal jobs
      userJobs = await db
        .select()
        .from(jobs)
        .where(and(eq(jobs.userId, session.user.id), isNull(jobs.organizationId)))
        .all();
    }
  } else {
    // No active team - show only personal jobs (organizationId is null)
    userJobs = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.userId, session.user.id), isNull(jobs.organizationId)))
      .all();
  }

  return c.json({
    jobs: userJobs.map((job) => {
      const parsedOutput = job.output ? JSON.parse(job.output) : null;
      const parsedProgress = job.progress ? JSON.parse(job.progress) : [];
      return {
        ...job,
        input: job.input ? JSON.parse(job.input) : null,
        output: parsedOutput ? attachSignedUrls(parsedOutput) : null,
        progress: parsedProgress,
      };
    }),
  });
});

export default app;
