import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, helpArticles } from "../db";

const app = new Hono();

// GET /api/help - List all help articles
app.get("/", async (c) => {
  const category = c.req.query("category");

  let query = db.select().from(helpArticles);

  if (category) {
    query = query.where(eq(helpArticles.category, category)) as typeof query;
  }

  const articles = await query.all();
  return c.json({ articles });
});

// GET /api/help/:slug - Get a single help article by slug
app.get("/:slug", async (c) => {
  const slug = c.req.param("slug");

  const article = await db
    .select()
    .from(helpArticles)
    .where(eq(helpArticles.slug, slug))
    .get();

  if (!article) {
    return c.json({ error: "Article not found" }, 404);
  }

  return c.json({ article });
});

export default app;
