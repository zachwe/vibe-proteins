import { Hono } from "hono";
import { eq, and, isNull } from "drizzle-orm";
import { db, submissions, challenges, jobs, user, transactions, gpuPricing } from "../db";
import { auth } from "../auth";
import { randomUUID } from "crypto";
import { getInferenceProvider } from "../inference/modal";
import { analytics } from "../services/analytics";
import {
  getBillingContext,
  deductBalance,
  getMembership,
} from "../lib/team-context";
import { getSignedUrl } from "../storage/r2";

const app = new Hono();

const SIGNED_URL_TTL_SECONDS = Number.parseInt(
  process.env.R2_SIGNED_URL_TTL_SECONDS || "900",
  10
);

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
 * Convert an S3 URI or R2 URL to a signed URL for browser access
 * Returns null if the URL is not from R2 (e.g., external RCSB URLs)
 */
function getSignedStructureUrl(url: string | null): string | null {
  if (!url) return null;

  const key = extractR2Key(url);
  if (!key) {
    // Not an R2 URL - return as-is (might be external URL)
    return url;
  }

  try {
    return getSignedUrl(key, SIGNED_URL_TTL_SECONDS);
  } catch (error) {
    console.warn("Unable to sign structure URL:", error);
    return null;
  }
}

/**
 * Attach signed URLs to a submission object for browser access
 */
function attachSignedUrlsToSubmission<T extends { designStructureUrl?: string | null }>(
  submission: T
): T & { designStructureSignedUrl?: string | null } {
  return {
    ...submission,
    designStructureSignedUrl: getSignedStructureUrl(submission.designStructureUrl ?? null),
  };
}

/**
 * Run scoring job in background and update submission status
 */
async function runScoringInBackground(
  submissionId: string,
  designStructureUrl: string,
  targetStructureUrl: string,
  binderSequence?: string,
  targetChainIds?: string[],
  userId?: string
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

    // Compute composite score (boltz_pae)
    let compositeScore: number | null = null;
    if (iptm !== null) {
      // PAE-based: use ipTM as primary metric (0-1 scale, higher = better)
      // Also factor in pLDDT if available
      const plddtNorm = plddt !== null ? plddt / 100 : 0.5;
      compositeScore = (iptm * 0.6 + plddtNorm * 0.4) * 100;
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

    // Track submission scored
    if (userId) {
      analytics.track(userId, "submission_scored", {
        submissionId,
        compositeScore,
        plddt,
        ptm,
        iptm,
        ipSae,
        interfaceArea,
      });
    }
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

// Minimum balance required to submit custom sequences (in cents)
const MIN_BALANCE_CENTS = 10; // $0.10 minimum

// Valid amino acid characters
const VALID_AA_REGEX = /^[ACDEFGHIKLMNPQRSTVWY]+$/i;

// Helper to calculate cost from GPU usage (duplicated from jobs.ts for isolation)
async function calculateJobCost(gpuType: string, executionSeconds: number): Promise<number> {
  const pricing = await db
    .select()
    .from(gpuPricing)
    .where(eq(gpuPricing.id, gpuType))
    .get();

  if (!pricing) {
    // Fallback to A10G rate if GPU type not found
    const fallbackRate = 0.000306 * 1.3; // A10G + 30%
    return Math.ceil(fallbackRate * executionSeconds * 100);
  }

  const ourRate = pricing.modalRatePerSec * (1 + pricing.markupPercent / 100);
  return Math.ceil(ourRate * executionSeconds * 100);
}

/**
 * Validate amino acid sequence
 */
function validateSequence(sequence: string): { valid: boolean; cleaned: string; error?: string } {
  // Remove whitespace and convert to uppercase
  const cleaned = sequence.toUpperCase().replace(/\s/g, "");

  if (!cleaned) {
    return { valid: false, cleaned, error: "Sequence is required" };
  }

  if (cleaned.length < 20) {
    return { valid: false, cleaned, error: "Sequence too short (minimum 20 residues)" };
  }

  if (cleaned.length > 500) {
    return { valid: false, cleaned, error: "Sequence too long (maximum 500 residues)" };
  }

  if (!VALID_AA_REGEX.test(cleaned)) {
    return { valid: false, cleaned, error: "Invalid characters - use only standard amino acids (ACDEFGHIKLMNPQRSTVWY)" };
  }

  return { valid: true, cleaned };
}

/**
 * Run custom submission pipeline: Boltz-2 folding → Scoring
 * Creates a job for billing, runs folding, then scoring
 */
async function runCustomSubmissionPipeline(
  submissionId: string,
  jobId: string,
  challengeId: string,
  binderSequence: string,
  userId: string,
  organizationId: string | null,
  targetStructureUrl: string,
  targetChainIds: string[]
) {
  const provider = getInferenceProvider();

  try {
    // Convert target URL to Modal-compatible format
    const targetUri = toModalDownloadUri(targetStructureUrl);

    // Update submission status to "running"
    await db
      .update(submissions)
      .set({ status: "running" })
      .where(eq(submissions.id, submissionId));

    // Submit Boltz-2 job to Modal
    const submitResult = await provider.submitJob("boltz2", {
      targetPdb: targetUri,
      binderSequence: binderSequence,
      numSamples: 1,
      boltzMode: "complex",
      jobId: jobId,
    });

    if (submitResult.status === "failed") {
      await db
        .update(submissions)
        .set({ status: "failed", error: "Failed to submit folding job" })
        .where(eq(submissions.id, submissionId));
      await db
        .update(jobs)
        .set({ status: "failed", error: "Failed to submit to Modal" })
        .where(eq(jobs.id, jobId));
      return;
    }

    // Update job with Modal call ID
    await db
      .update(jobs)
      .set({ modalCallId: submitResult.callId, status: "running" })
      .where(eq(jobs.id, jobId));

    // Poll for Boltz-2 completion
    const maxWaitMs = 5 * 60 * 1000; // 5 minutes for folding
    const pollIntervalMs = 3000;
    const startTime = Date.now();
    let result = submitResult;

    while (Date.now() - startTime < maxWaitMs) {
      if (result.status === "completed" || result.status === "failed") {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

      const statusResult = await provider.getJobStatus(jobId);
      result = {
        ...result,
        status: statusResult.status,
        result: statusResult.result,
      };

      // Handle billing from usage data if available
      if (statusResult.usage?.gpu_type && statusResult.usage?.execution_seconds) {
        const gpuType = statusResult.usage.gpu_type;
        const executionSeconds = statusResult.usage.execution_seconds;
        await db
          .update(jobs)
          .set({ gpuType, executionSeconds })
          .where(eq(jobs.id, jobId));
      }
    }

    // Check if folding failed
    if (result.status === "failed" || result.result?.status === "failed") {
      const errorMsg = result.result?.error || "Folding failed";
      await db
        .update(submissions)
        .set({ status: "failed", error: errorMsg })
        .where(eq(submissions.id, submissionId));
      await db
        .update(jobs)
        .set({ status: "failed", error: errorMsg })
        .where(eq(jobs.id, jobId));
      return;
    }

    if (result.status !== "completed") {
      await db
        .update(submissions)
        .set({ status: "failed", error: "Folding job timed out" })
        .where(eq(submissions.id, submissionId));
      await db
        .update(jobs)
        .set({ status: "failed", error: "Job timed out" })
        .where(eq(jobs.id, jobId));
      return;
    }

    // Extract structure URL from output
    const output = result.result?.output as Record<string, unknown> | undefined;

    // Boltz-2 output structure: { complex: { key: "..." } } or { structureUrl: "..." }
    let structureKey: string | null = null;

    if (output?.complex) {
      // Primary format: complex.key
      const complex = output.complex as Record<string, unknown>;
      structureKey = complex?.key as string | undefined ?? null;
    } else if (output?.structureUrl) {
      // Alternative: direct structureUrl (extract key from s3:// URL)
      const url = output.structureUrl as string;
      if (url.startsWith("s3://")) {
        const parts = url.split("://")[1].split("/");
        structureKey = parts.slice(1).join("/");
      }
    } else if (output?.designs && Array.isArray(output.designs) && output.designs.length > 0) {
      // Legacy format: designs[0].structure.key
      const design = output.designs[0] as Record<string, unknown>;
      const structure = design.structure as Record<string, unknown> | undefined;
      structureKey = structure?.key as string | undefined ?? null;
    }

    if (!structureKey) {
      await db
        .update(submissions)
        .set({ status: "failed", error: "No structure generated from folding" })
        .where(eq(submissions.id, submissionId));
      await db
        .update(jobs)
        .set({ status: "failed", error: "No structure in output" })
        .where(eq(jobs.id, jobId));
      return;
    }

    // Convert key to full URL and S3 URI
    const structureUrl = `s3://${R2_BUCKET_NAME}/${structureKey}`;

    // Update submission with structure URL
    await db
      .update(submissions)
      .set({ designStructureUrl: structureUrl })
      .where(eq(submissions.id, submissionId));

    // Mark job as completed
    await db
      .update(jobs)
      .set({
        status: "completed",
        completedAt: new Date(),
        output: JSON.stringify(output),
      })
      .where(eq(jobs.id, jobId));

    // Handle billing for the job
    if (output) {
      const jobRecord = await db.select().from(jobs).where(eq(jobs.id, jobId)).get();

      if (jobRecord?.gpuType && jobRecord?.executionSeconds) {
        const costCents = await calculateJobCost(jobRecord.gpuType, jobRecord.executionSeconds);

        if (costCents > 0) {
          // Get billing context based on the job's organizationId
          const billingContext = await getBillingContext(userId, organizationId);
          const newBalance = await deductBalance(billingContext, costCents);

          await db.insert(transactions).values({
            id: randomUUID(),
            userId,
            organizationId,
            amountCents: -costCents,
            type: "job_usage",
            jobId,
            description: `Custom sequence folding (${jobRecord.gpuType}, ${jobRecord.executionSeconds.toFixed(1)}s)`,
            balanceAfterCents: newBalance,
            createdAt: new Date(),
          });

          await db
            .update(jobs)
            .set({ costUsdCents: costCents, billedSeconds: jobRecord.executionSeconds })
            .where(eq(jobs.id, jobId));
        }
      }
    }

    // Now run scoring on the folded structure
    await runScoringInBackground(
      submissionId,
      structureUrl,
      targetStructureUrl,
      binderSequence,
      targetChainIds,
      userId
    );
  } catch (error) {
    console.error("Custom submission pipeline failed:", error);
    await db
      .update(submissions)
      .set({
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown pipeline error",
      })
      .where(eq(submissions.id, submissionId));
    await db
      .update(jobs)
      .set({
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      })
      .where(eq(jobs.id, jobId));
  }
}

// POST /api/submissions/custom - Submit a custom sequence for folding and scoring
app.post("/custom", async (c) => {
  try {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = await c.req.json();
    const { challengeId, designSequence } = body;

  if (!challengeId) {
    return c.json({ error: "Missing required field: challengeId" }, 400);
  }

  if (!designSequence) {
    return c.json({ error: "Missing required field: designSequence" }, 400);
  }

  // Validate sequence
  const validation = validateSequence(designSequence);
  if (!validation.valid) {
    return c.json({ error: validation.error }, 400);
  }

  // Get challenge
  const challenge = await db
    .select()
    .from(challenges)
    .where(eq(challenges.id, challengeId))
    .get();

  if (!challenge) {
    return c.json({ error: "Challenge not found" }, 404);
  }

  if (!challenge.targetStructureUrl) {
    return c.json({ error: "Challenge has no target structure" }, 400);
  }

  // Get active organization from session (if any)
  const activeOrganizationId = (session.session as { activeOrganizationId?: string })?.activeOrganizationId ?? null;

  // Get billing context (team or personal)
  const billingContext = await getBillingContext(session.user.id, activeOrganizationId);

  // Check balance
  if (billingContext.balanceUsdCents < MIN_BALANCE_CENTS) {
    return c.json(
      {
        error: "Insufficient balance",
        message: billingContext.type === "team"
          ? "Please add funds to your team account to submit custom sequences"
          : "Please add funds to your account to submit custom sequences",
        requiredCents: MIN_BALANCE_CENTS,
        availableCents: billingContext.balanceUsdCents,
        billingType: billingContext.type,
      },
      402
    );
  }

  const submissionId = randomUUID();
  const jobId = randomUUID();
  const now = new Date();
  const organizationId = billingContext.type === "team" ? activeOrganizationId : null;

  // Create job first (submission references job via foreign key)
  await db.insert(jobs).values({
    id: jobId,
    userId: session.user.id,
    challengeId,
    organizationId,
    type: "boltz2",
    status: "pending",
    input: JSON.stringify({
      binderSequence: validation.cleaned,
      targetStructureUrl: challenge.targetStructureUrl,
      customSubmission: true,
    }),
    createdAt: now,
  });

  // Create submission (references the job we just created)
  await db.insert(submissions).values({
    id: submissionId,
    userId: session.user.id,
    challengeId,
    organizationId,
    jobId,
    designSequence: validation.cleaned,
    status: "pending",
    createdAt: now,
  });

  // Get target chain IDs
  const targetChainIds = challenge.targetChainId ? [challenge.targetChainId] : [];

  // Track custom submission created
  analytics.track(session.user.id, "submission_created", {
    submissionId,
    challengeId,
    isCustomSequence: true,
    sequenceLength: validation.cleaned.length,
  });

  // Fire and forget - run pipeline in background
  runCustomSubmissionPipeline(
    submissionId,
    jobId,
    challengeId,
    validation.cleaned,
    session.user.id,
    organizationId,
    challenge.targetStructureUrl,
    targetChainIds
  ).catch((err) => {
    console.error("Background custom submission pipeline error:", err);
  });

  return c.json(
    {
      submission: {
        id: submissionId,
        challengeId,
        jobId,
        designSequence: validation.cleaned,
        status: "pending",
      },
    },
    201
  );
  } catch (error) {
    console.error("Error in POST /api/submissions/custom:", error);
    return c.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      500
    );
  }
});

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

  // Get active organization from session (if any)
  const activeOrganizationId = (session.session as { activeOrganizationId?: string })?.activeOrganizationId ?? null;

  // Determine organizationId based on active context
  const billingContext = await getBillingContext(session.user.id, activeOrganizationId);
  const organizationId = billingContext.type === "team" ? activeOrganizationId : null;

  const submissionId = randomUUID();
  const now = new Date();

  await db.insert(submissions).values({
    id: submissionId,
    userId: session.user.id,
    challengeId,
    organizationId,
    jobId: jobId ?? null,
    designSequence,
    designStructureUrl: designStructureUrl ?? null,
    status: "pending",
    createdAt: now,
  });

  // Track submission created
  analytics.track(session.user.id, "submission_created", {
    submissionId,
    challengeId,
    isCustomSequence: false,
    hasStructure: !!designStructureUrl,
  });

  // Start scoring in background if we have both structures
  if (designStructureUrl && challenge.targetStructureUrl) {
    // Fire and forget - don't await
    runScoringInBackground(
      submissionId,
      designStructureUrl,
      challenge.targetStructureUrl,
      designSequence,
      challenge.targetChainId ? [challenge.targetChainId] : undefined,
      session.user.id
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
// Returns personal submissions OR team submissions based on active organization
app.get("/", async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const challengeId = c.req.query("challengeId");

  // Get active organization from session (if any)
  const activeOrganizationId = (session.session as { activeOrganizationId?: string })?.activeOrganizationId ?? null;

  let userSubmissions;
  if (activeOrganizationId) {
    // Verify user is a member of this organization
    const membership = await getMembership(session.user.id, activeOrganizationId);
    if (membership) {
      // Show all submissions belonging to this team
      if (challengeId) {
        userSubmissions = await db
          .select()
          .from(submissions)
          .where(
            and(
              eq(submissions.organizationId, activeOrganizationId),
              eq(submissions.challengeId, challengeId)
            )
          )
          .all();
      } else {
        userSubmissions = await db
          .select()
          .from(submissions)
          .where(eq(submissions.organizationId, activeOrganizationId))
          .all();
      }
    } else {
      // User not a member, fall back to personal submissions
      if (challengeId) {
        userSubmissions = await db
          .select()
          .from(submissions)
          .where(
            and(
              eq(submissions.userId, session.user.id),
              isNull(submissions.organizationId),
              eq(submissions.challengeId, challengeId)
            )
          )
          .all();
      } else {
        userSubmissions = await db
          .select()
          .from(submissions)
          .where(
            and(eq(submissions.userId, session.user.id), isNull(submissions.organizationId))
          )
          .all();
      }
    }
  } else {
    // No active team - show only personal submissions (organizationId is null)
    if (challengeId) {
      userSubmissions = await db
        .select()
        .from(submissions)
        .where(
          and(
            eq(submissions.userId, session.user.id),
            isNull(submissions.organizationId),
            eq(submissions.challengeId, challengeId)
          )
        )
        .all();
    } else {
      userSubmissions = await db
        .select()
        .from(submissions)
        .where(
          and(eq(submissions.userId, session.user.id), isNull(submissions.organizationId))
        )
        .all();
    }
  }

  return c.json({ submissions: userSubmissions.map(attachSignedUrlsToSubmission) });
});

// GET /api/submissions/:id - Get a single submission (public - submissions are leaderboard entries)
app.get("/:id", async (c) => {
  const id = c.req.param("id");

  const submission = await db
    .select()
    .from(submissions)
    .where(eq(submissions.id, id))
    .get();

  if (!submission) {
    return c.json({ error: "Submission not found" }, 404);
  }

  return c.json({ submission: attachSignedUrlsToSubmission(submission) });
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
    .where(eq(submissions.id, id))
    .get();

  if (!submission) {
    return c.json({ error: "Submission not found" }, 404);
  }

  // Check if user has access to this submission:
  // 1. They own it directly (personal submission)
  // 2. It belongs to a team they're a member of
  const canAccess =
    submission.userId === session.user.id ||
    (submission.organizationId && (await getMembership(session.user.id, submission.organizationId)));

  if (!canAccess) {
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
      challenge.targetChainId ? [challenge.targetChainId] : undefined,
      session.user.id
    ).catch((err) => {
      console.error("Background scoring error on retry:", err);
    });
  }

  return c.json({ success: true, status: "pending" });
});

export default app;
