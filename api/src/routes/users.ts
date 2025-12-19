import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, user } from "../db";
import { auth } from "../auth";

const app = new Hono();

// GET /api/users/me - Get current authenticated user
app.get("/me", async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const currentUser = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      credits: user.credits,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(eq(user.id, session.user.id))
    .get();

  if (!currentUser) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({ user: currentUser });
});

export default app;
