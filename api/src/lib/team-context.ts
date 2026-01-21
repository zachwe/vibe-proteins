/**
 * Team context utilities for billing and permissions.
 *
 * When a user has an active organization (team), their jobs and billing
 * are associated with the team. When no team is active, everything
 * is personal.
 */
import { eq, and } from "drizzle-orm";
import { db, user, organization, member } from "../db";

export interface BillingContext {
  type: "personal" | "team";
  entityId: string; // userId for personal, organizationId for team
  balanceUsdCents: number;
  stripeCustomerId: string | null;
}

export interface TeamMembership {
  organizationId: string;
  role: string; // 'owner', 'admin', 'member'
}

/**
 * Get the billing context based on the user's active organization.
 * If the user has an active organization and is a member, use team billing.
 * Otherwise, use personal billing.
 */
export async function getBillingContext(
  userId: string,
  activeOrganizationId: string | null | undefined
): Promise<BillingContext> {
  if (activeOrganizationId) {
    // Verify user is a member of this organization
    const membership = await db
      .select({
        role: member.role,
      })
      .from(member)
      .where(
        and(
          eq(member.userId, userId),
          eq(member.organizationId, activeOrganizationId)
        )
      )
      .get();

    if (membership) {
      const org = await db
        .select({
          balanceUsdCents: organization.balanceUsdCents,
          stripeCustomerId: organization.stripeCustomerId,
        })
        .from(organization)
        .where(eq(organization.id, activeOrganizationId))
        .get();

      if (org) {
        return {
          type: "team",
          entityId: activeOrganizationId,
          balanceUsdCents: org.balanceUsdCents,
          stripeCustomerId: org.stripeCustomerId,
        };
      }
    }
  }

  // Fallback to personal billing
  const personalUser = await db
    .select({
      balanceUsdCents: user.balanceUsdCents,
      stripeCustomerId: user.stripeCustomerId,
    })
    .from(user)
    .where(eq(user.id, userId))
    .get();

  return {
    type: "personal",
    entityId: userId,
    balanceUsdCents: personalUser?.balanceUsdCents ?? 0,
    stripeCustomerId: personalUser?.stripeCustomerId ?? null,
  };
}

/**
 * Get user's membership info for an organization.
 */
export async function getMembership(
  userId: string,
  organizationId: string
): Promise<TeamMembership | null> {
  const membership = await db
    .select({
      organizationId: member.organizationId,
      role: member.role,
    })
    .from(member)
    .where(
      and(eq(member.userId, userId), eq(member.organizationId, organizationId))
    )
    .get();

  return membership || null;
}

/**
 * Check if user has a specific permission level in an organization.
 * Roles hierarchy: owner > admin > member
 */
export function hasPermission(
  role: string,
  requiredLevel: "member" | "admin" | "owner"
): boolean {
  const roleHierarchy: Record<string, number> = {
    owner: 3,
    admin: 2,
    member: 1,
  };

  const userLevel = roleHierarchy[role] ?? 0;
  const requiredRoleLevel = roleHierarchy[requiredLevel];

  return userLevel >= requiredRoleLevel;
}

/**
 * Deduct balance from the appropriate entity (user or organization).
 */
export async function deductBalance(
  context: BillingContext,
  amountCents: number
): Promise<number> {
  const newBalance = Math.max(0, context.balanceUsdCents - amountCents);

  if (context.type === "team") {
    await db
      .update(organization)
      .set({ balanceUsdCents: newBalance })
      .where(eq(organization.id, context.entityId));
  } else {
    await db
      .update(user)
      .set({ balanceUsdCents: newBalance })
      .where(eq(user.id, context.entityId));
  }

  return newBalance;
}

/**
 * Add balance to the appropriate entity (user or organization).
 */
export async function addBalance(
  context: BillingContext,
  amountCents: number
): Promise<number> {
  const newBalance = context.balanceUsdCents + amountCents;

  if (context.type === "team") {
    await db
      .update(organization)
      .set({ balanceUsdCents: newBalance })
      .where(eq(organization.id, context.entityId));
  } else {
    await db
      .update(user)
      .set({ balanceUsdCents: newBalance })
      .where(eq(user.id, context.entityId));
  }

  return newBalance;
}

/**
 * Get the current balance for an entity (refreshed from DB).
 */
export async function getBalance(
  type: "personal" | "team",
  entityId: string
): Promise<number> {
  if (type === "team") {
    const org = await db
      .select({ balanceUsdCents: organization.balanceUsdCents })
      .from(organization)
      .where(eq(organization.id, entityId))
      .get();
    return org?.balanceUsdCents ?? 0;
  }

  const personalUser = await db
    .select({ balanceUsdCents: user.balanceUsdCents })
    .from(user)
    .where(eq(user.id, entityId))
    .get();

  return personalUser?.balanceUsdCents ?? 0;
}
