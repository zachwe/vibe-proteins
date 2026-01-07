import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, user, jobs, submissions, transactions } from "../db";
import { session, account } from "../db/auth-schema";
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
      username: user.username,
      email: user.email,
      balanceUsdCents: user.balanceUsdCents,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(eq(user.id, session.user.id))
    .get();

  if (!currentUser) {
    return c.json({ error: "User not found" }, 404);
  }

  // Also return formatted balance for convenience
  return c.json({
    user: {
      ...currentUser,
      balanceFormatted: `$${(currentUser.balanceUsdCents / 100).toFixed(2)}`,
    },
  });
});

// DELETE /api/users/me - Delete current user account
app.delete("/me", async (c) => {
  const authSession = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!authSession) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userId = authSession.user.id;

  try {
    // Delete in order respecting foreign key constraints
    // 1. Delete transactions (references jobs and user)
    await db.delete(transactions).where(eq(transactions.userId, userId));

    // 2. Delete submissions (references jobs, challenges, user)
    await db.delete(submissions).where(eq(submissions.userId, userId));

    // 3. Delete jobs (references challenges, user)
    await db.delete(jobs).where(eq(jobs.userId, userId));

    // 4. Delete sessions (references user)
    await db.delete(session).where(eq(session.userId, userId));

    // 5. Delete accounts (references user)
    await db.delete(account).where(eq(account.userId, userId));

    // 6. Finally delete the user
    await db.delete(user).where(eq(user.id, userId));

    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    return c.json({ error: "Failed to delete account" }, 500);
  }
});

export default app;
