import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, user, organization, jobs, submissions, transactions } from "../db";
import { session, account, member } from "../db/auth-schema";
import { auth } from "../auth";
import { getMembership } from "../lib/team-context";

const app = new Hono();

// GET /api/users/me - Get current authenticated user
app.get("/me", async (c) => {
  const authSession = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!authSession) {
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
    .where(eq(user.id, authSession.user.id))
    .get();

  if (!currentUser) {
    return c.json({ error: "User not found" }, 404);
  }

  // Get active organization from session
  const activeOrganizationId = (authSession.session as { activeOrganizationId?: string })?.activeOrganizationId ?? null;

  // Prepare active team info if applicable
  let activeTeam: {
    id: string;
    name: string;
    slug: string;
    balanceUsdCents: number;
    balanceFormatted: string;
    role: string;
  } | null = null;

  if (activeOrganizationId) {
    // Get the organization and user's role
    const org = await db
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        balanceUsdCents: organization.balanceUsdCents,
      })
      .from(organization)
      .where(eq(organization.id, activeOrganizationId))
      .get();

    const membership = await getMembership(authSession.user.id, activeOrganizationId);

    if (org && membership) {
      activeTeam = {
        id: org.id,
        name: org.name,
        slug: org.slug,
        balanceUsdCents: org.balanceUsdCents,
        balanceFormatted: `$${(org.balanceUsdCents / 100).toFixed(2)}`,
        role: membership.role,
      };
    }
  }

  // Return user with active team info
  return c.json({
    user: {
      ...currentUser,
      balanceFormatted: `$${(currentUser.balanceUsdCents / 100).toFixed(2)}`,
    },
    // Effective balance: team balance when team is active, personal otherwise
    effectiveBalance: activeTeam
      ? {
          type: "team",
          balanceUsdCents: activeTeam.balanceUsdCents,
          balanceFormatted: activeTeam.balanceFormatted,
          teamName: activeTeam.name,
        }
      : {
          type: "personal",
          balanceUsdCents: currentUser.balanceUsdCents,
          balanceFormatted: `$${(currentUser.balanceUsdCents / 100).toFixed(2)}`,
        },
    activeTeam,
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
    // Check if user owns any organizations
    const ownedOrgs = await db
      .select({ id: organization.id, name: organization.name })
      .from(organization)
      .innerJoin(member, eq(member.organizationId, organization.id))
      .where(eq(member.userId, userId))
      .all();

    // Filter to only orgs where user is owner
    const ownedAsOwner = [];
    for (const org of ownedOrgs) {
      const membership = await getMembership(userId, org.id);
      if (membership?.role === "owner") {
        ownedAsOwner.push(org);
      }
    }

    if (ownedAsOwner.length > 0) {
      return c.json({
        error: "Cannot delete account",
        message: "You must transfer ownership or delete your teams before deleting your account",
        ownedTeams: ownedAsOwner.map((o) => o.name),
      }, 400);
    }

    // Delete in order respecting foreign key constraints
    // 1. Delete transactions (references jobs and user)
    await db.delete(transactions).where(eq(transactions.userId, userId));

    // 2. Delete submissions (references jobs, challenges, user)
    await db.delete(submissions).where(eq(submissions.userId, userId));

    // 3. Delete jobs (references challenges, user)
    await db.delete(jobs).where(eq(jobs.userId, userId));

    // 4. Delete team memberships (must be before user deletion due to FK)
    await db.delete(member).where(eq(member.userId, userId));

    // 5. Delete sessions (references user)
    await db.delete(session).where(eq(session.userId, userId));

    // 6. Delete accounts (references user)
    await db.delete(account).where(eq(account.userId, userId));

    // 7. Finally delete the user
    await db.delete(user).where(eq(user.id, userId));

    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    return c.json({ error: "Failed to delete account" }, 500);
  }
});

export default app;
