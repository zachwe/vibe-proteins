import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db, submissions } from "../db";
import { auth } from "../auth";
import { randomUUID } from "crypto";

const app = new Hono();

// POST /api/submissions - Submit a design for scoring
app.post("/", async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const { challengeId, jobId, designSequence, designStructureUrl } = body;

  if (!challengeId || !designSequence) {
    return c.json(
      { error: "Missing required fields: challengeId, designSequence" },
      400
    );
  }

  const submissionId = randomUUID();
  const now = new Date();

  await db.insert(submissions).values({
    id: submissionId,
    userId: session.user.id,
    challengeId,
    jobId: jobId ?? null,
    designSequence,
    designStructureUrl: designStructureUrl ?? null,
    createdAt: now,
  });

  return c.json(
    {
      submission: {
        id: submissionId,
        challengeId,
        designSequence,
        status: "pending_scoring",
      },
    },
    201
  );
});

// GET /api/submissions - List user's submissions
app.get("/", async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const challengeId = c.req.query("challengeId");

  let query = db
    .select()
    .from(submissions)
    .where(eq(submissions.userId, session.user.id));

  // Optionally filter by challenge
  if (challengeId) {
    query = db
      .select()
      .from(submissions)
      .where(
        and(
          eq(submissions.userId, session.user.id),
          eq(submissions.challengeId, challengeId)
        )
      );
  }

  const userSubmissions = await query.all();

  return c.json({ submissions: userSubmissions });
});

// GET /api/submissions/:id - Get a single submission
app.get("/:id", async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const id = c.req.param("id");

  const submission = await db
    .select()
    .from(submissions)
    .where(and(eq(submissions.id, id), eq(submissions.userId, session.user.id)))
    .get();

  if (!submission) {
    return c.json({ error: "Submission not found" }, 404);
  }

  return c.json({ submission });
});

export default app;
