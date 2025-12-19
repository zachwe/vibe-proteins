import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, challenges } from "../db";

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

export default app;
