import { Hono } from "hono";
import { eq, desc, sql, and, isNotNull } from "drizzle-orm";
import { db, challenges, submissions, user, referenceBinders } from "../db";

const app = new Hono();

// GET /api/challenges - List all challenges
app.get("/", async (c) => {
  const allChallenges = await db.select().from(challenges).all();
  return c.json({ challenges: allChallenges });
});

// GET /api/challenges/:id - Get a single challenge
app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const challenge = await db
    .select()
    .from(challenges)
    .where(eq(challenges.id, id))
    .get();

  if (!challenge) {
    return c.json({ error: "Challenge not found" }, 404);
  }

  return c.json({ challenge });
});

// GET /api/challenges/:id/leaderboard - Get leaderboard for a challenge
app.get("/:id/leaderboard", async (c) => {
  const id = c.req.param("id");
  const sortBy = c.req.query("sortBy") || "compositeScore";
  const limit = Math.min(parseInt(c.req.query("limit") || "50"), 100);
  const offset = parseInt(c.req.query("offset") || "0");

  // Verify challenge exists
  const challenge = await db
    .select()
    .from(challenges)
    .where(eq(challenges.id, id))
    .get();

  if (!challenge) {
    return c.json({ error: "Challenge not found" }, 404);
  }

  // Determine sort column
  type SortableColumn =
    | typeof submissions.compositeScore
    | typeof submissions.plddt
    | typeof submissions.ptm
    | typeof submissions.ipSaeScore
    | typeof submissions.interfaceArea
    | typeof submissions.shapeComplementarity;

  const sortColumns: Record<string, SortableColumn> = {
    compositeScore: submissions.compositeScore,
    plddt: submissions.plddt,
    ptm: submissions.ptm,
    ipSaeScore: submissions.ipSaeScore,
    interfaceArea: submissions.interfaceArea,
    shapeComplementarity: submissions.shapeComplementarity,
  };

  const sortColumn = sortColumns[sortBy] || submissions.compositeScore;

  // Get leaderboard entries with user info
  // Only include submissions that have a score
  const leaderboardEntries = await db
    .select({
      id: submissions.id,
      compositeScore: submissions.compositeScore,
      ipSaeScore: submissions.ipSaeScore,
      plddt: submissions.plddt,
      ptm: submissions.ptm,
      interfaceArea: submissions.interfaceArea,
      shapeComplementarity: submissions.shapeComplementarity,
      createdAt: submissions.createdAt,
      userId: submissions.userId,
      userName: sql<string>`COALESCE(${user.username}, ${user.name})`.as("user_name"),
    })
    .from(submissions)
    .innerJoin(user, eq(submissions.userId, user.id))
    .where(
      and(
        eq(submissions.challengeId, id),
        isNotNull(sortColumn)
      )
    )
    .orderBy(desc(sortColumn))
    .limit(limit)
    .offset(offset)
    .all();

  // Get total count for pagination
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(submissions)
    .where(
      and(
        eq(submissions.challengeId, id),
        isNotNull(sortColumn)
      )
    )
    .get();

  const totalCount = countResult?.count || 0;

  // Add rank to each entry
  const leaderboard = leaderboardEntries.map((entry, index) => ({
    rank: offset + index + 1,
    ...entry,
  }));

  return c.json({
    leaderboard,
    totalCount,
    sortBy,
    limit,
    offset,
  });
});

// GET /api/challenges/:id/reference-binders - Get reference binders for a challenge
app.get("/:id/reference-binders", async (c) => {
  const id = c.req.param("id");

  // Verify challenge exists
  const challenge = await db
    .select()
    .from(challenges)
    .where(eq(challenges.id, id))
    .get();

  if (!challenge) {
    return c.json({ error: "Challenge not found" }, 404);
  }

  const binders = await db
    .select()
    .from(referenceBinders)
    .where(
      and(
        eq(referenceBinders.challengeId, id),
        eq(referenceBinders.isActive, true)
      )
    )
    .orderBy(referenceBinders.sortOrder)
    .all();

  return c.json({ referenceBinders: binders });
});

export default app;
