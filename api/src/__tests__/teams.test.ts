import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { db, user, organization, member } from "../db";
import {
  getBillingContext,
  getMembership,
  hasPermission,
  deductBalance,
  addBalance,
  getBalance,
} from "../lib/team-context";
import { app } from "../app";
import { eq } from "drizzle-orm";

// Test data IDs
const testUserId = "test-user-teams-1";
const testUserId2 = "test-user-teams-2";
const testOrgId = "test-org-1";
const testOrgId2 = "test-org-2";

describe("Teams", () => {
  beforeAll(async () => {
    const now = new Date();

    // Clean up any existing test data
    await db.delete(member).where(eq(member.userId, testUserId));
    await db.delete(member).where(eq(member.userId, testUserId2));
    await db.delete(organization).where(eq(organization.id, testOrgId));
    await db.delete(organization).where(eq(organization.id, testOrgId2));
    await db.delete(user).where(eq(user.id, testUserId));
    await db.delete(user).where(eq(user.id, testUserId2));

    // Create test users
    await db.insert(user).values([
      {
        id: testUserId,
        name: "Test User 1",
        email: "test-teams-1@example.com",
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
        balanceUsdCents: 5000, // $50.00
        stripeCustomerId: "cus_test_personal_1",
      },
      {
        id: testUserId2,
        name: "Test User 2",
        email: "test-teams-2@example.com",
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
        balanceUsdCents: 1000, // $10.00
      },
    ]);

    // Create test organizations
    await db.insert(organization).values([
      {
        id: testOrgId,
        name: "Test Team Alpha",
        slug: "test-team-alpha",
        createdAt: now,
        balanceUsdCents: 10000, // $100.00
        stripeCustomerId: "cus_test_team_1",
      },
      {
        id: testOrgId2,
        name: "Test Team Beta",
        slug: "test-team-beta",
        createdAt: now,
        balanceUsdCents: 2500, // $25.00
      },
    ]);

    // Create memberships
    await db.insert(member).values([
      {
        id: "member-1",
        userId: testUserId,
        organizationId: testOrgId,
        role: "owner",
        createdAt: now,
      },
      {
        id: "member-2",
        userId: testUserId2,
        organizationId: testOrgId,
        role: "member",
        createdAt: now,
      },
      {
        id: "member-3",
        userId: testUserId,
        organizationId: testOrgId2,
        role: "admin",
        createdAt: now,
      },
    ]);
  });

  describe("hasPermission", () => {
    it("owner has all permissions", () => {
      expect(hasPermission("owner", "member")).toBe(true);
      expect(hasPermission("owner", "admin")).toBe(true);
      expect(hasPermission("owner", "owner")).toBe(true);
    });

    it("admin has member and admin permissions", () => {
      expect(hasPermission("admin", "member")).toBe(true);
      expect(hasPermission("admin", "admin")).toBe(true);
      expect(hasPermission("admin", "owner")).toBe(false);
    });

    it("member has only member permission", () => {
      expect(hasPermission("member", "member")).toBe(true);
      expect(hasPermission("member", "admin")).toBe(false);
      expect(hasPermission("member", "owner")).toBe(false);
    });

    it("unknown role has no permissions", () => {
      expect(hasPermission("unknown", "member")).toBe(false);
      expect(hasPermission("unknown", "admin")).toBe(false);
      expect(hasPermission("unknown", "owner")).toBe(false);
    });
  });

  describe("getMembership", () => {
    it("returns membership when user is a member", async () => {
      const membership = await getMembership(testUserId, testOrgId);
      expect(membership).not.toBeNull();
      expect(membership?.organizationId).toBe(testOrgId);
      expect(membership?.role).toBe("owner");
    });

    it("returns null when user is not a member", async () => {
      const membership = await getMembership(testUserId2, testOrgId2);
      expect(membership).toBeNull();
    });

    it("returns correct role for different memberships", async () => {
      const ownerMembership = await getMembership(testUserId, testOrgId);
      expect(ownerMembership?.role).toBe("owner");

      const memberMembership = await getMembership(testUserId2, testOrgId);
      expect(memberMembership?.role).toBe("member");

      const adminMembership = await getMembership(testUserId, testOrgId2);
      expect(adminMembership?.role).toBe("admin");
    });
  });

  describe("getBillingContext", () => {
    it("returns personal context when no active organization", async () => {
      const context = await getBillingContext(testUserId, null);

      expect(context.type).toBe("personal");
      expect(context.entityId).toBe(testUserId);
      expect(context.balanceUsdCents).toBe(5000);
      expect(context.stripeCustomerId).toBe("cus_test_personal_1");
    });

    it("returns personal context when activeOrganizationId is undefined", async () => {
      const context = await getBillingContext(testUserId, undefined);

      expect(context.type).toBe("personal");
      expect(context.entityId).toBe(testUserId);
    });

    it("returns team context when user has active organization", async () => {
      const context = await getBillingContext(testUserId, testOrgId);

      expect(context.type).toBe("team");
      expect(context.entityId).toBe(testOrgId);
      expect(context.balanceUsdCents).toBe(10000);
      expect(context.stripeCustomerId).toBe("cus_test_team_1");
    });

    it("falls back to personal when user is not a member of active org", async () => {
      const context = await getBillingContext(testUserId2, testOrgId2);

      // testUserId2 is not a member of testOrgId2
      expect(context.type).toBe("personal");
      expect(context.entityId).toBe(testUserId2);
      expect(context.balanceUsdCents).toBe(1000);
    });

    it("falls back to personal when organization does not exist", async () => {
      const context = await getBillingContext(testUserId, "non-existent-org");

      expect(context.type).toBe("personal");
      expect(context.entityId).toBe(testUserId);
    });
  });

  describe("getBalance", () => {
    it("gets personal balance", async () => {
      const balance = await getBalance("personal", testUserId);
      expect(balance).toBe(5000);
    });

    it("gets team balance", async () => {
      const balance = await getBalance("team", testOrgId);
      expect(balance).toBe(10000);
    });

    it("returns 0 for non-existent user", async () => {
      const balance = await getBalance("personal", "non-existent-user");
      expect(balance).toBe(0);
    });

    it("returns 0 for non-existent organization", async () => {
      const balance = await getBalance("team", "non-existent-org");
      expect(balance).toBe(0);
    });
  });

  describe("deductBalance", () => {
    beforeEach(async () => {
      // Reset balances before each test
      await db
        .update(user)
        .set({ balanceUsdCents: 5000 })
        .where(eq(user.id, testUserId));
      await db
        .update(organization)
        .set({ balanceUsdCents: 10000 })
        .where(eq(organization.id, testOrgId));
    });

    it("deducts from personal balance", async () => {
      const context = await getBillingContext(testUserId, null);
      const newBalance = await deductBalance(context, 1500);

      expect(newBalance).toBe(3500);

      // Verify database was updated
      const dbBalance = await getBalance("personal", testUserId);
      expect(dbBalance).toBe(3500);
    });

    it("deducts from team balance", async () => {
      const context = await getBillingContext(testUserId, testOrgId);
      const newBalance = await deductBalance(context, 2500);

      expect(newBalance).toBe(7500);

      // Verify database was updated
      const dbBalance = await getBalance("team", testOrgId);
      expect(dbBalance).toBe(7500);
    });

    it("does not go below zero", async () => {
      const context = await getBillingContext(testUserId, null);
      const newBalance = await deductBalance(context, 99999);

      expect(newBalance).toBe(0);
    });
  });

  describe("addBalance", () => {
    beforeEach(async () => {
      // Reset balances before each test
      await db
        .update(user)
        .set({ balanceUsdCents: 5000 })
        .where(eq(user.id, testUserId));
      await db
        .update(organization)
        .set({ balanceUsdCents: 10000 })
        .where(eq(organization.id, testOrgId));
    });

    it("adds to personal balance", async () => {
      const context = await getBillingContext(testUserId, null);
      const newBalance = await addBalance(context, 2000);

      expect(newBalance).toBe(7000);

      // Verify database was updated
      const dbBalance = await getBalance("personal", testUserId);
      expect(dbBalance).toBe(7000);
    });

    it("adds to team balance", async () => {
      const context = await getBillingContext(testUserId, testOrgId);
      const newBalance = await addBalance(context, 5000);

      expect(newBalance).toBe(15000);

      // Verify database was updated
      const dbBalance = await getBalance("team", testOrgId);
      expect(dbBalance).toBe(15000);
    });
  });

  describe("Teams API - Unauthenticated Access", () => {
    it("GET /api/teams should return 401 when not authenticated", async () => {
      const res = await app.request("/api/teams");
      expect(res.status).toBe(401);

      const data = await res.json();
      expect(data).toHaveProperty("error");
    });

    it("POST /api/teams should return 401 when not authenticated", async () => {
      const res = await app.request("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Team", slug: "new-team" }),
      });
      expect(res.status).toBe(401);
    });

    it("GET /api/teams/:id/members should return 401 when not authenticated", async () => {
      const res = await app.request(`/api/teams/${testOrgId}/members`);
      expect(res.status).toBe(401);
    });

    it("POST /api/teams/:id/invite should return 401 when not authenticated", async () => {
      const res = await app.request(`/api/teams/${testOrgId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "invite@example.com", role: "member" }),
      });
      expect(res.status).toBe(401);
    });
  });
});
