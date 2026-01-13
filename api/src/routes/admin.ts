import { Hono } from "hono";
import { eq, desc, like, or } from "drizzle-orm";
import { db, user } from "../db";
import { auth } from "../auth";

const app = new Hono();

// Middleware to check if user is admin
async function requireAdmin(c: any, next: () => Promise<void>) {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Get user role from database
  const currentUser = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, session.user.id))
    .get();

  if (!currentUser || currentUser.role !== "admin") {
    return c.json({ error: "Forbidden: Admin access required" }, 403);
  }

  c.set("adminUser", session.user);
  await next();
}

// GET /api/admin/users - List all users (admin only)
app.get("/users", requireAdmin, async (c) => {
  const search = c.req.query("search") || "";
  const limit = parseInt(c.req.query("limit") || "50");
  const offset = parseInt(c.req.query("offset") || "0");

  let query = db
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      banned: user.banned,
      balanceUsdCents: user.balanceUsdCents,
      createdAt: user.createdAt,
    })
    .from(user)
    .orderBy(desc(user.createdAt))
    .limit(limit)
    .offset(offset);

  if (search) {
    query = query.where(
      or(
        like(user.email, `%${search}%`),
        like(user.name, `%${search}%`),
        like(user.username, `%${search}%`)
      )
    ) as typeof query;
  }

  const users = await query;

  // Get total count
  const allUsers = await db.select({ id: user.id }).from(user);
  const total = allUsers.length;

  return c.json({
    users: users.map((u) => ({
      ...u,
      balanceFormatted: `$${((u.balanceUsdCents || 0) / 100).toFixed(2)}`,
    })),
    total,
    limit,
    offset,
  });
});

// GET /api/admin/users/:id - Get specific user details (admin only)
app.get("/users/:id", requireAdmin, async (c) => {
  const userId = c.req.param("id");

  const targetUser = await db
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      banned: user.banned,
      banReason: user.banReason,
      balanceUsdCents: user.balanceUsdCents,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(eq(user.id, userId))
    .get();

  if (!targetUser) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({
    user: {
      ...targetUser,
      balanceFormatted: `$${((targetUser.balanceUsdCents || 0) / 100).toFixed(2)}`,
    },
  });
});

export default app;
