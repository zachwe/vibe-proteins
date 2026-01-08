import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, referenceBinders, helpArticles, challenges } from "../db";

const app = new Hono();

// GET /api/reference-binders - List all reference binders
app.get("/", async (c) => {
  const allBinders = await db
    .select()
    .from(referenceBinders)
    .where(eq(referenceBinders.isActive, true))
    .orderBy(referenceBinders.sortOrder)
    .all();

  return c.json({ referenceBinders: allBinders });
});

// GET /api/reference-binders/:id - Get a single reference binder with help article
app.get("/:id", async (c) => {
  const id = c.req.param("id");

  const binder = await db
    .select()
    .from(referenceBinders)
    .where(eq(referenceBinders.id, id))
    .get();

  if (!binder) {
    return c.json({ error: "Reference binder not found" }, 404);
  }

  // Fetch associated help article if exists
  let article = null;
  if (binder.helpArticleSlug) {
    article = await db
      .select()
      .from(helpArticles)
      .where(eq(helpArticles.slug, binder.helpArticleSlug))
      .get();
  }

  return c.json({ referenceBinder: binder, article });
});

// GET /api/challenges/:challengeId/reference-binders - Get reference binders for a challenge
// Note: This is mounted under /api/challenges in app.ts, so path is relative
app.get("/challenge/:challengeId", async (c) => {
  const challengeId = c.req.param("challengeId");

  // Verify challenge exists
  const challenge = await db
    .select()
    .from(challenges)
    .where(eq(challenges.id, challengeId))
    .get();

  if (!challenge) {
    return c.json({ error: "Challenge not found" }, 404);
  }

  const binders = await db
    .select()
    .from(referenceBinders)
    .where(eq(referenceBinders.challengeId, challengeId))
    .orderBy(referenceBinders.sortOrder)
    .all();

  return c.json({ referenceBinders: binders });
});

export default app;
