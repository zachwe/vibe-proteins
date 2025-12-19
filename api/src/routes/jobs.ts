import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db, jobs, user } from "../db";
import { auth } from "../auth";
import { randomUUID } from "crypto";
import { getInferenceProvider, type JobType } from "../inference";

const app = new Hono();

// Credit costs for different job types
const JOB_COSTS: Record<string, number> = {
  bindcraft: 10,
  boltzgen: 20,
  predict: 5,
  score: 1,
};

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

  // Create the job
  const jobId = randomUUID();
  const now = new Date();

  await db.insert(jobs).values({
    id: jobId,
    userId: session.user.id,
    challengeId,
    type,
    status: "pending",
    input: JSON.stringify(input ?? {}),
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

  // Fire off the job - for now we do this synchronously since placeholders are fast
  // TODO: For real inference, use background processing
  try {
    const result = await provider.submitJob(type as JobType, input ?? {});

    // Update job status
    await db
      .update(jobs)
      .set({
        status: result.status,
        output: JSON.stringify({ callId: result.callId }),
      })
      .where(eq(jobs.id, jobId));
  } catch (error) {
    console.error("Failed to submit job to inference provider:", error);
    // Job stays in pending state, can be retried
  }

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

  return c.json({
    job: {
      ...job,
      input: job.input ? JSON.parse(job.input) : null,
      output: job.output ? JSON.parse(job.output) : null,
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
    jobs: userJobs.map((job) => ({
      ...job,
      input: job.input ? JSON.parse(job.input) : null,
      output: job.output ? JSON.parse(job.output) : null,
    })),
  });
});

export default app;
