import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db, organization, member, invitation, user } from "../db";
import { auth } from "../auth";
import { randomUUID } from "crypto";
import {
  getBillingContext,
  getMembership,
  hasPermission,
} from "../lib/team-context";

const app = new Hono();

// GET /api/teams - List user's teams
app.get("/", async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Get all organizations user is a member of
  const memberships = await db
    .select({
      organizationId: member.organizationId,
      role: member.role,
    })
    .from(member)
    .where(eq(member.userId, session.user.id))
    .all();

  if (memberships.length === 0) {
    return c.json({ teams: [] });
  }

  // Get full organization details
  const teams = await Promise.all(
    memberships.map(async (m) => {
      const org = await db
        .select()
        .from(organization)
        .where(eq(organization.id, m.organizationId))
        .get();

      if (!org) return null;

      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        logo: org.logo,
        role: m.role,
        balanceUsdCents: org.balanceUsdCents,
        balanceFormatted: `$${(org.balanceUsdCents / 100).toFixed(2)}`,
        createdAt: org.createdAt,
      };
    })
  );

  return c.json({
    teams: teams.filter(Boolean),
  });
});

// GET /api/teams/active - Get active team with details
app.get("/active", async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const activeOrgId = (session.session as { activeOrganizationId?: string })
    .activeOrganizationId;

  if (!activeOrgId) {
    return c.json({ team: null });
  }

  const org = await db
    .select()
    .from(organization)
    .where(eq(organization.id, activeOrgId))
    .get();

  if (!org) {
    return c.json({ team: null });
  }

  const membership = await getMembership(session.user.id, activeOrgId);

  if (!membership) {
    return c.json({ team: null });
  }

  return c.json({
    team: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      logo: org.logo,
      role: membership.role,
      balanceUsdCents: org.balanceUsdCents,
      balanceFormatted: `$${(org.balanceUsdCents / 100).toFixed(2)}`,
      createdAt: org.createdAt,
    },
  });
});

// POST /api/teams - Create a new team
app.post("/", async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const { name, slug } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return c.json({ error: "Team name is required" }, 400);
  }

  // Generate slug if not provided
  const teamSlug =
    slug ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  // Check if slug is taken
  const existing = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.slug, teamSlug))
    .get();

  if (existing) {
    return c.json({ error: "A team with this slug already exists" }, 400);
  }

  const orgId = randomUUID();
  const now = new Date();

  // Create organization
  await db.insert(organization).values({
    id: orgId,
    name: name.trim(),
    slug: teamSlug,
    createdAt: now,
    balanceUsdCents: 0,
  });

  // Add creator as owner
  await db.insert(member).values({
    id: randomUUID(),
    userId: session.user.id,
    organizationId: orgId,
    role: "owner",
    createdAt: now,
  });

  return c.json(
    {
      team: {
        id: orgId,
        name: name.trim(),
        slug: teamSlug,
        role: "owner",
        balanceUsdCents: 0,
        balanceFormatted: "$0.00",
        createdAt: now,
      },
    },
    201
  );
});

// GET /api/teams/:id - Get team details
app.get("/:id", async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const teamId = c.req.param("id");

  // Check membership
  const membership = await getMembership(session.user.id, teamId);
  if (!membership) {
    return c.json({ error: "Team not found or access denied" }, 404);
  }

  const org = await db
    .select()
    .from(organization)
    .where(eq(organization.id, teamId))
    .get();

  if (!org) {
    return c.json({ error: "Team not found" }, 404);
  }

  // Get member count
  const members = await db
    .select({ id: member.id })
    .from(member)
    .where(eq(member.organizationId, teamId))
    .all();

  return c.json({
    team: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      logo: org.logo,
      role: membership.role,
      balanceUsdCents: org.balanceUsdCents,
      balanceFormatted: `$${(org.balanceUsdCents / 100).toFixed(2)}`,
      memberCount: members.length,
      createdAt: org.createdAt,
    },
  });
});

// PATCH /api/teams/:id - Update team (owner/admin only)
app.patch("/:id", async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const teamId = c.req.param("id");

  // Check membership and permission
  const membership = await getMembership(session.user.id, teamId);
  if (!membership || !hasPermission(membership.role, "admin")) {
    return c.json({ error: "Permission denied" }, 403);
  }

  const body = await c.req.json();
  const updates: Partial<{ name: string; logo: string | null }> = {};

  if (body.name && typeof body.name === "string") {
    updates.name = body.name.trim();
  }

  if (body.logo !== undefined) {
    updates.logo = body.logo;
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ error: "No updates provided" }, 400);
  }

  await db
    .update(organization)
    .set(updates)
    .where(eq(organization.id, teamId));

  const org = await db
    .select()
    .from(organization)
    .where(eq(organization.id, teamId))
    .get();

  return c.json({
    team: {
      id: org!.id,
      name: org!.name,
      slug: org!.slug,
      logo: org!.logo,
      role: membership.role,
      balanceUsdCents: org!.balanceUsdCents,
      balanceFormatted: `$${(org!.balanceUsdCents / 100).toFixed(2)}`,
    },
  });
});

// DELETE /api/teams/:id - Delete team (owner only)
app.delete("/:id", async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const teamId = c.req.param("id");

  // Check membership and permission
  const membership = await getMembership(session.user.id, teamId);
  if (!membership || !hasPermission(membership.role, "owner")) {
    return c.json({ error: "Only team owners can delete teams" }, 403);
  }

  // Delete in order: invitations, members, organization
  await db.delete(invitation).where(eq(invitation.organizationId, teamId));
  await db.delete(member).where(eq(member.organizationId, teamId));
  await db.delete(organization).where(eq(organization.id, teamId));

  return c.json({ success: true });
});

// GET /api/teams/:id/members - List team members
app.get("/:id/members", async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const teamId = c.req.param("id");

  // Check membership
  const membership = await getMembership(session.user.id, teamId);
  if (!membership) {
    return c.json({ error: "Team not found or access denied" }, 404);
  }

  // Get all members with user details
  const members = await db
    .select({
      memberId: member.id,
      userId: member.userId,
      role: member.role,
      joinedAt: member.createdAt,
      userName: user.name,
      userEmail: user.email,
      userImage: user.image,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, teamId))
    .all();

  return c.json({
    members: members.map((m) => ({
      id: m.memberId,
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt,
      user: {
        name: m.userName,
        email: m.userEmail,
        image: m.userImage,
      },
    })),
  });
});

// POST /api/teams/:id/invite - Send email invite (owner/admin only)
app.post("/:id/invite", async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const teamId = c.req.param("id");

  // Check membership and permission
  const membership = await getMembership(session.user.id, teamId);
  if (!membership || !hasPermission(membership.role, "admin")) {
    return c.json({ error: "Permission denied" }, 403);
  }

  const body = await c.req.json();
  const { email, role = "member" } = body;

  if (!email || typeof email !== "string") {
    return c.json({ error: "Email is required" }, 400);
  }

  // Validate role
  if (!["admin", "member"].includes(role)) {
    return c.json({ error: "Invalid role. Must be 'admin' or 'member'" }, 400);
  }

  // Check if user is already a member
  const existingUser = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email.toLowerCase()))
    .get();

  if (existingUser) {
    const existingMember = await db
      .select({ id: member.id })
      .from(member)
      .where(
        and(
          eq(member.userId, existingUser.id),
          eq(member.organizationId, teamId)
        )
      )
      .get();

    if (existingMember) {
      return c.json({ error: "User is already a team member" }, 400);
    }
  }

  // Check for pending invitation
  const pendingInvite = await db
    .select({ id: invitation.id })
    .from(invitation)
    .where(
      and(
        eq(invitation.email, email.toLowerCase()),
        eq(invitation.organizationId, teamId),
        eq(invitation.status, "pending")
      )
    )
    .get();

  if (pendingInvite) {
    return c.json({ error: "An invitation has already been sent to this email" }, 400);
  }

  // Create invitation using BetterAuth's organization plugin
  // This will trigger the sendInvitationEmail hook
  try {
    const result = await auth.api.createInvitation({
      body: {
        email: email.toLowerCase(),
        role,
        organizationId: teamId,
      },
      headers: c.req.raw.headers,
    });

    return c.json({
      success: true,
      invitation: result
    });
  } catch (error) {
    console.error("Failed to create invitation:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to send invitation" },
      500
    );
  }
});

// GET /api/teams/:id/invitations - List pending invitations (owner/admin only)
app.get("/:id/invitations", async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const teamId = c.req.param("id");

  // Check membership and permission
  const membership = await getMembership(session.user.id, teamId);
  if (!membership || !hasPermission(membership.role, "admin")) {
    return c.json({ error: "Permission denied" }, 403);
  }

  const invitations = await db
    .select()
    .from(invitation)
    .where(
      and(
        eq(invitation.organizationId, teamId),
        eq(invitation.status, "pending")
      )
    )
    .all();

  return c.json({
    invitations: invitations.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      status: inv.status,
      createdAt: inv.createdAt,
      expiresAt: inv.expiresAt,
    })),
  });
});

// DELETE /api/teams/:id/invitations/:invitationId - Cancel invitation (owner/admin only)
app.delete("/:id/invitations/:invitationId", async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const teamId = c.req.param("id");
  const invitationId = c.req.param("invitationId");

  // Check membership and permission
  const membership = await getMembership(session.user.id, teamId);
  if (!membership || !hasPermission(membership.role, "admin")) {
    return c.json({ error: "Permission denied" }, 403);
  }

  await db
    .update(invitation)
    .set({ status: "canceled" })
    .where(
      and(eq(invitation.id, invitationId), eq(invitation.organizationId, teamId))
    );

  return c.json({ success: true });
});

// DELETE /api/teams/:id/members/:memberId - Remove member (owner/admin only)
app.delete("/:id/members/:memberId", async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const teamId = c.req.param("id");
  const memberId = c.req.param("memberId");

  // Check membership and permission
  const membership = await getMembership(session.user.id, teamId);
  if (!membership || !hasPermission(membership.role, "admin")) {
    return c.json({ error: "Permission denied" }, 403);
  }

  // Get the member to be removed
  const targetMember = await db
    .select()
    .from(member)
    .where(and(eq(member.id, memberId), eq(member.organizationId, teamId)))
    .get();

  if (!targetMember) {
    return c.json({ error: "Member not found" }, 404);
  }

  // Owners can't be removed (except by themselves leaving)
  if (targetMember.role === "owner" && targetMember.userId !== session.user.id) {
    return c.json({ error: "Cannot remove team owner" }, 403);
  }

  await db
    .delete(member)
    .where(and(eq(member.id, memberId), eq(member.organizationId, teamId)));

  return c.json({ success: true });
});

// PATCH /api/teams/:id/members/:memberId/role - Update member role (owner only)
app.patch("/:id/members/:memberId/role", async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const teamId = c.req.param("id");
  const memberId = c.req.param("memberId");

  // Check membership and permission (owner only for role changes)
  const membership = await getMembership(session.user.id, teamId);
  if (!membership || !hasPermission(membership.role, "owner")) {
    return c.json({ error: "Only team owners can change roles" }, 403);
  }

  const body = await c.req.json();
  const { role } = body;

  if (!["admin", "member"].includes(role)) {
    return c.json({ error: "Invalid role. Must be 'admin' or 'member'" }, 400);
  }

  // Get the member
  const targetMember = await db
    .select()
    .from(member)
    .where(and(eq(member.id, memberId), eq(member.organizationId, teamId)))
    .get();

  if (!targetMember) {
    return c.json({ error: "Member not found" }, 404);
  }

  // Can't change owner's role
  if (targetMember.role === "owner") {
    return c.json({ error: "Cannot change owner's role" }, 403);
  }

  await db
    .update(member)
    .set({ role })
    .where(and(eq(member.id, memberId), eq(member.organizationId, teamId)));

  return c.json({ success: true, role });
});

// POST /api/teams/:id/set-active - Set this team as active
app.post("/:id/set-active", async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const teamId = c.req.param("id");

  // "personal" clears the active organization
  if (teamId === "personal") {
    try {
      await auth.api.setActiveOrganization({
        headers: c.req.raw.headers,
        body: { organizationId: null },
      });
      return c.json({ success: true, activeTeamId: null });
    } catch (error) {
      console.error("Failed to clear active organization:", error);
      return c.json({ error: "Failed to switch to personal account" }, 500);
    }
  }

  // Check membership
  const membership = await getMembership(session.user.id, teamId);
  if (!membership) {
    return c.json({ error: "Team not found or access denied" }, 404);
  }

  try {
    await auth.api.setActiveOrganization({
      headers: c.req.raw.headers,
      body: { organizationId: teamId },
    });
    return c.json({ success: true, activeTeamId: teamId });
  } catch (error) {
    console.error("Failed to set active organization:", error);
    return c.json({ error: "Failed to switch team" }, 500);
  }
});

// GET /api/teams/invitations/pending - Get user's pending invitations
app.get("/invitations/pending", async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userEmail = session.user.email;

  const pendingInvitations = await db
    .select({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      createdAt: invitation.createdAt,
      expiresAt: invitation.expiresAt,
      organizationId: invitation.organizationId,
      organizationName: organization.name,
      organizationSlug: organization.slug,
    })
    .from(invitation)
    .innerJoin(organization, eq(invitation.organizationId, organization.id))
    .where(
      and(
        eq(invitation.email, userEmail),
        eq(invitation.status, "pending")
      )
    )
    .all();

  return c.json({
    invitations: pendingInvitations.map((inv) => ({
      id: inv.id,
      role: inv.role,
      createdAt: inv.createdAt,
      expiresAt: inv.expiresAt,
      organization: {
        id: inv.organizationId,
        name: inv.organizationName,
        slug: inv.organizationSlug,
      },
    })),
  });
});

export default app;
