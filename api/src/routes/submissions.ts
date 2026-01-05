import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db, submissions, challenges } from "../db";
import { auth } from "../auth";
import { randomUUID } from "crypto";
import { getInferenceProvider } from "../inference/modal";

const app = new Hono();

const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "vibeproteins";
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "";

/**
 * Check if a URL is from R2 storage (not external like RCSB)
 */
function isR2Url(url: string): boolean {
  if (url.startsWith("s3://") || url.startsWith("r2://")) {
    return true;
  }
  try {
    const parsed = new URL(url);
    // Check if it's an R2 URL (contains r2.cloudflarestorage.com or our bucket in path)
    if (parsed.hostname.includes("r2.cloudflarestorage.com")) {
      return true;
    }
    // Check if it's our CDN or has our bucket prefix
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    if (pathParts[0] === R2_BUCKET_NAME || pathParts[0] === "designs") {
      return true;
    }
  } catch {
    // Not a valid URL
  }
  return false;
}

/**
 * Extract R2 key from a URL (handles presigned URLs and plain URLs)
 * Only works for R2 URLs, returns null for external URLs
 *
 * Examples:
 * - https://xxx.r2.cloudflarestorage.com/bucket/key/path.pdb?X-Amz-... -> key/path.pdb
 * - s3://bucket/key/path.pdb -> key/path.pdb
 */
function extractR2Key(urlOrKey: string): string | null {
  if (!isR2Url(urlOrKey)) {
    return null;
  }

  // Already an s3:// URI - extract the key
  if (urlOrKey.startsWith("s3://") || urlOrKey.startsWith("r2://")) {
    const parts = urlOrKey.split("://")[1].split("/");
    return parts.slice(1).join("/"); // Skip bucket name
  }

  try {
    const url = new URL(urlOrKey);
    // R2 storage URL: /bucket/key...
    const pathParts = url.pathname.split("/").filter(Boolean);
    if (pathParts.length >= 2 && pathParts[0] === R2_BUCKET_NAME) {
      return pathParts.slice(1).join("/");
    }
    // Direct key path (e.g., /designs/xxx/complex.pdb)
    if (pathParts.length >= 1) {
      return pathParts.join("/");
    }
  } catch {
    // Not a valid URL
  }
  return null;
}

/**
 * Convert an R2 key to an s3:// URI that Modal can download directly
 */
function keyToS3Uri(key: string): string {
  return `s3://${R2_BUCKET_NAME}/${key}`;
}

/**
 * Convert a URL to an s3:// URI if it's from R2, otherwise return as-is
 */
function toModalDownloadUri(url: string): string {
  const key = extractR2Key(url);
  if (key) {
    return keyToS3Uri(key);
  }
  // External URL (e.g., RCSB) - return as-is for direct HTTP download
  return url;
}

/**
 * Run scoring job in background and update submission status
 */
async function runScoringInBackground(
  submissionId: string,
  designStructureUrl: string,
  targetStructureUrl: string,
  binderSequence?: string,
  targetChainIds?: string[]
) {
  const provider = getInferenceProvider();

  // Convert R2 URLs to s3:// URIs (avoids presigned URL expiration)
  // External URLs (like RCSB) are passed through as-is
  const designUri = toModalDownloadUri(designStructureUrl);
  const targetUri = toModalDownloadUri(targetStructureUrl);

  // Update status to running
  await db
    .update(submissions)
    .set({ status: "running" })
    .where(eq(submissions.id, submissionId));

  try {
    // Call Modal's compute_scores
    const submitResult = await provider.submitJob("score", {
      designPdb: designUri,
      targetPdb: targetUri,
      binderSequence,
      targetChainIds,
      jobId: submissionId,
    });

    if (submitResult.status === "failed") {
      await db
        .update(submissions)
        .set({
          status: "failed",
          error: "Failed to submit scoring job",
        })
        .where(eq(submissions.id, submissionId));
      return;
    }

    // Poll for job completion (scoring jobs are async)
    const maxWaitMs = 10 * 60 * 1000; // 10 minutes max
    const pollIntervalMs = 3000; // 3 seconds
    const startTime = Date.now();
    let result = submitResult;

    while (Date.now() - startTime < maxWaitMs) {
      // Check if job completed
      if (result.status === "completed" || result.status === "failed") {
        break;
      }

      // Wait before polling
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

      // Poll for status
      const statusResult = await provider.getJobStatus(submissionId);
      result = {
        ...result,
        status: statusResult.status,
        result: statusResult.result,
      };
    }

    // Check final status
    if (result.status === "failed" || result.result?.status === "failed") {
      await db
        .update(submissions)
        .set({
          status: "failed",
          error: result.result?.error || "Scoring failed",
        })
        .where(eq(submissions.id, submissionId));
      return;
    }

    if (result.status !== "completed") {
      await db
        .update(submissions)
        .set({
          status: "failed",
          error: "Scoring job timed out",
        })
        .where(eq(submissions.id, submissionId));
      return;
    }

    // Extract scores from result
    const output = result.result?.output as Record<string, unknown> | undefined;
    const scores = output?.scores as Record<string, number | string> | undefined;

    // Get individual score values
    const ipSae = typeof scores?.ip_sae === "number" ? scores.ip_sae : null;
    const iptm = typeof scores?.iptm === "number" ? scores.iptm : null;
    const plddt = typeof scores?.plddt === "number" ? scores.plddt : null;
    const ptm = typeof scores?.ptm === "number" ? scores.ptm : null;
    const interfaceArea = typeof scores?.interface_area === "number" ? scores.interface_area : null;
    const shapeComplementarity = typeof scores?.shape_complementarity === "number" ? scores.shape_complementarity : null;
    const scoringMethod = scores?.scoring_method as string | undefined;

    // Compute composite score based on scoring method
    let compositeScore: number | null = null;
    if (scoringMethod === "boltz_pae" && iptm !== null) {
      // PAE-based: use ipTM as primary metric (0-1 scale, higher = better)
      // Also factor in pLDDT if available
      const plddtNorm = plddt !== null ? plddt / 100 : 0.5;
      compositeScore = (iptm * 0.6 + plddtNorm * 0.4) * 100;
    } else if (ipSae !== null) {
      // Distance-based fallback: use geometric metrics
      compositeScore = Math.abs(ipSae) * 10 + (interfaceArea ?? 0) / 100;
    }

    await db
      .update(submissions)
      .set({
        status: "completed",
        ipSaeScore: ipSae,
        plddt: plddt,
        ptm: ptm,
        interfaceArea: interfaceArea,
        shapeComplementarity: shapeComplementarity,
        compositeScore: compositeScore,
      })
      .where(eq(submissions.id, submissionId));
  } catch (error) {
    console.error("Scoring failed for submission", submissionId, error);
    await db
      .update(submissions)
      .set({
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown scoring error",
      })
      .where(eq(submissions.id, submissionId));
  }
}

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

  // Get the challenge to find the target structure
  const challenge = await db
    .select()
    .from(challenges)
    .where(eq(challenges.id, challengeId))
    .get();

  if (!challenge) {
    return c.json({ error: "Challenge not found" }, 404);
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
    status: "pending",
    createdAt: now,
  });

  // Start scoring in background if we have both structures
  if (designStructureUrl && challenge.targetStructureUrl) {
    // Fire and forget - don't await
    runScoringInBackground(
      submissionId,
      designStructureUrl,
      challenge.targetStructureUrl,
      designSequence,
      challenge.targetChainId ? [challenge.targetChainId] : undefined
    ).catch((err) => {
      console.error("Background scoring error:", err);
    });
  }

  return c.json(
    {
      submission: {
        id: submissionId,
        challengeId,
        designSequence,
        status: "pending",
      },
    },
    201
  );
});

// PATCH /api/submissions/:id/status - Update submission status (internal use)
app.patch("/:id/status", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const { status, error, scores } = body;

  if (!status || !["pending", "running", "completed", "failed"].includes(status)) {
    return c.json({ error: "Invalid status" }, 400);
  }

  const updateData: Record<string, unknown> = { status };
  if (error) {
    updateData.error = error;
  }
  if (scores) {
    if (typeof scores.compositeScore === "number") updateData.compositeScore = scores.compositeScore;
    if (typeof scores.ipSaeScore === "number") updateData.ipSaeScore = scores.ipSaeScore;
    if (typeof scores.plddt === "number") updateData.plddt = scores.plddt;
    if (typeof scores.ptm === "number") updateData.ptm = scores.ptm;
    if (typeof scores.interfaceArea === "number") updateData.interfaceArea = scores.interfaceArea;
    if (typeof scores.shapeComplementarity === "number") updateData.shapeComplementarity = scores.shapeComplementarity;
  }

  await db
    .update(submissions)
    .set(updateData)
    .where(eq(submissions.id, id));

  return c.json({ success: true });
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

// POST /api/submissions/:id/retry - Retry scoring for a failed/stuck submission
app.post("/:id/retry", async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const id = c.req.param("id");

  // Get the submission
  const submission = await db
    .select()
    .from(submissions)
    .where(and(eq(submissions.id, id), eq(submissions.userId, session.user.id)))
    .get();

  if (!submission) {
    return c.json({ error: "Submission not found" }, 404);
  }

  // Only allow retry for failed or stuck (pending for too long) submissions
  if (submission.status === "completed") {
    return c.json({ error: "Submission already completed" }, 400);
  }

  if (submission.status === "running") {
    return c.json({ error: "Submission is currently being scored" }, 400);
  }

  // Get the challenge for target structure
  const challenge = await db
    .select()
    .from(challenges)
    .where(eq(challenges.id, submission.challengeId))
    .get();

  if (!challenge) {
    return c.json({ error: "Challenge not found" }, 404);
  }

  // Reset status and error
  await db
    .update(submissions)
    .set({ status: "pending", error: null })
    .where(eq(submissions.id, id));

  // Start scoring in background if we have both structures
  if (submission.designStructureUrl && challenge.targetStructureUrl) {
    runScoringInBackground(
      id,
      submission.designStructureUrl,
      challenge.targetStructureUrl,
      submission.designSequence,
      challenge.targetChainId ? [challenge.targetChainId] : undefined
    ).catch((err) => {
      console.error("Background scoring error on retry:", err);
    });
  }

  return c.json({ success: true, status: "pending" });
});

export default app;
