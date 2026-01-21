import { Hono } from "hono";
import { eq, and, isNull } from "drizzle-orm";
import Stripe from "stripe";
import { db, user, organization, depositPresets, transactions, gpuPricing } from "../db";
import { auth } from "../auth";
import { randomUUID } from "crypto";
import { analytics } from "../services/analytics";
import { getBillingContext, getMembership, hasPermission } from "../lib/team-context";

const app = new Hono();

// Initialize Stripe (will be null if not configured)
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// Minimum and maximum deposit amounts (in cents)
const MIN_DEPOSIT_CENTS = 100; // $1.00
const MAX_DEPOSIT_CENTS = 50000; // $500.00

// Helper to get or create Stripe customer for user
async function getOrCreateStripeCustomerForUser(userId: string): Promise<string> {
  if (!stripe) throw new Error("Stripe not configured");

  const currentUser = await db
    .select({ stripeCustomerId: user.stripeCustomerId, email: user.email, name: user.name })
    .from(user)
    .where(eq(user.id, userId))
    .get();

  if (!currentUser) throw new Error("User not found");

  // Return existing customer ID if we have one
  if (currentUser.stripeCustomerId) {
    return currentUser.stripeCustomerId;
  }

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    email: currentUser.email,
    name: currentUser.name,
    metadata: { userId },
  });

  // Save customer ID to user
  await db
    .update(user)
    .set({ stripeCustomerId: customer.id })
    .where(eq(user.id, userId));

  return customer.id;
}

// Helper to get or create Stripe customer for organization (team)
async function getOrCreateStripeCustomerForOrg(
  organizationId: string,
  userEmail: string
): Promise<string> {
  if (!stripe) throw new Error("Stripe not configured");

  const org = await db
    .select({ stripeCustomerId: organization.stripeCustomerId, name: organization.name })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .get();

  if (!org) throw new Error("Organization not found");

  // Return existing customer ID if we have one
  if (org.stripeCustomerId) {
    return org.stripeCustomerId;
  }

  // Create new Stripe customer for the org
  const customer = await stripe.customers.create({
    email: userEmail, // Use the billing user's email for receipts
    name: `${org.name} (Team)`,
    metadata: { organizationId },
  });

  // Save customer ID to organization
  await db
    .update(organization)
    .set({ stripeCustomerId: customer.id })
    .where(eq(organization.id, organizationId));

  return customer.id;
}

// GET /api/billing/presets - List deposit presets ($5, $10, $25, etc.)
app.get("/presets", async (c) => {
  const presets = await db
    .select()
    .from(depositPresets)
    .where(eq(depositPresets.isActive, true))
    .orderBy(depositPresets.sortOrder)
    .all();

  return c.json({ presets });
});

// GET /api/billing/pricing - List GPU pricing
app.get("/pricing", async (c) => {
  const pricing = await db
    .select()
    .from(gpuPricing)
    .where(eq(gpuPricing.isActive, true))
    .all();

  // Calculate our rate (with markup)
  const pricingWithOurRate = pricing.map((gpu) => ({
    id: gpu.id,
    name: gpu.name,
    modalRatePerSec: gpu.modalRatePerSec,
    markupPercent: gpu.markupPercent,
    ourRatePerSec: gpu.modalRatePerSec * (1 + gpu.markupPercent / 100),
    ourRatePerMin: gpu.modalRatePerSec * (1 + gpu.markupPercent / 100) * 60,
  }));

  return c.json({ pricing: pricingWithOurRate });
});

// POST /api/billing/deposit - Create Stripe checkout session for deposit
// Supports both personal and team deposits
app.post("/deposit", async (c) => {
  if (!stripe) {
    return c.json({ error: "Payments not configured" }, 503);
  }

  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const { amountCents, organizationId: explicitOrgId } = body;

  // Validate amount
  const amount = Number(amountCents);
  if (!amount || isNaN(amount) || amount < MIN_DEPOSIT_CENTS || amount > MAX_DEPOSIT_CENTS) {
    return c.json({
      error: "Invalid amount",
      message: `Amount must be between $${(MIN_DEPOSIT_CENTS / 100).toFixed(2)} and $${(MAX_DEPOSIT_CENTS / 100).toFixed(2)}`,
    }, 400);
  }

  // Determine if this is a team or personal deposit
  // Use explicit organizationId if provided, otherwise use active organization from session
  const activeOrganizationId =
    explicitOrgId ?? (session.session as { activeOrganizationId?: string })?.activeOrganizationId ?? null;

  let customerId: string;
  let isTeamDeposit = false;
  let teamName: string | null = null;

  if (activeOrganizationId) {
    // Verify user is a member with deposit permission (admin or owner)
    const membership = await getMembership(session.user.id, activeOrganizationId);
    if (!membership || !hasPermission(membership.role, "admin")) {
      return c.json({ error: "Only admins and owners can add funds to team accounts" }, 403);
    }

    // Get the org name for the description
    const org = await db
      .select({ name: organization.name })
      .from(organization)
      .where(eq(organization.id, activeOrganizationId))
      .get();
    teamName = org?.name ?? "Team";

    // Get or create Stripe customer for org
    const currentUser = await db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, session.user.id))
      .get();

    customerId = await getOrCreateStripeCustomerForOrg(
      activeOrganizationId,
      currentUser?.email ?? session.user.email
    );
    isTeamDeposit = true;
  } else {
    // Personal deposit
    customerId = await getOrCreateStripeCustomerForUser(session.user.id);
  }

  // Format amount for display
  const amountDollars = (amount / 100).toFixed(2);
  const description = isTeamDeposit
    ? `Add $${amountDollars} to ${teamName} team account`
    : `Add $${amountDollars} to your account`;

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: amount,
          product_data: {
            name: isTeamDeposit ? `${teamName} Team Balance` : "ProteinDojo Balance",
            description,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId: session.user.id,
      amountCents: amount.toString(),
      type: "deposit",
      ...(isTeamDeposit ? { organizationId: activeOrganizationId } : {}),
    },
    success_url: `${FRONTEND_URL}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${FRONTEND_URL}/billing?canceled=true`,
  });

  return c.json({ url: checkoutSession.url });
});

// POST /api/billing/webhook - Handle Stripe webhooks
app.post("/webhook", async (c) => {
  if (!stripe) {
    return c.json({ error: "Payments not configured" }, 503);
  }

  const sig = c.req.header("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return c.json({ error: "Missing signature or webhook secret" }, 400);
  }

  let event: Stripe.Event;

  try {
    const body = await c.req.text();
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return c.json({ error: "Invalid signature" }, 400);
  }

  // Handle the event
  if (event.type === "checkout.session.completed") {
    const checkoutSession = event.data.object as Stripe.Checkout.Session;

    // Only process if payment was successful
    if (checkoutSession.payment_status === "paid") {
      const { userId, amountCents, type, organizationId } = checkoutSession.metadata || {};

      if (!userId || !amountCents || type !== "deposit") {
        console.error("Missing or invalid metadata in checkout session:", checkoutSession.id);
        return c.json({ received: true });
      }

      const depositCents = parseInt(amountCents, 10);
      const depositDollars = (depositCents / 100).toFixed(2);

      if (organizationId) {
        // Team deposit
        const org = await db
          .select({ balanceUsdCents: organization.balanceUsdCents, name: organization.name })
          .from(organization)
          .where(eq(organization.id, organizationId))
          .get();

        if (!org) {
          console.error("Organization not found for deposit:", organizationId);
          return c.json({ received: true });
        }

        const newBalance = org.balanceUsdCents + depositCents;

        // Update organization balance
        await db
          .update(organization)
          .set({ balanceUsdCents: newBalance })
          .where(eq(organization.id, organizationId));

        // Record transaction
        await db.insert(transactions).values({
          id: randomUUID(),
          userId,
          organizationId,
          amountCents: depositCents,
          type: "deposit",
          stripeSessionId: checkoutSession.id,
          description: `Added $${depositDollars} to ${org.name} team balance`,
          balanceAfterCents: newBalance,
          createdAt: new Date(),
        });

        console.log(`Added $${depositDollars} to team ${org.name} (new balance: $${(newBalance / 100).toFixed(2)})`);

        // Track deposit completed
        analytics.track(userId, "team_deposit_completed", {
          amountCents: depositCents,
          newBalanceCents: newBalance,
          organizationId,
          organizationName: org.name,
          stripeSessionId: checkoutSession.id,
        });
      } else {
        // Personal deposit
        const currentUser = await db
          .select({ balanceUsdCents: user.balanceUsdCents })
          .from(user)
          .where(eq(user.id, userId))
          .get();

        if (!currentUser) {
          console.error("User not found for deposit:", userId);
          return c.json({ received: true });
        }

        const newBalance = currentUser.balanceUsdCents + depositCents;

        // Update user balance
        await db
          .update(user)
          .set({ balanceUsdCents: newBalance })
          .where(eq(user.id, userId));

        // Record transaction
        await db.insert(transactions).values({
          id: randomUUID(),
          userId,
          amountCents: depositCents,
          type: "deposit",
          stripeSessionId: checkoutSession.id,
          description: `Added $${depositDollars} to balance`,
          balanceAfterCents: newBalance,
          createdAt: new Date(),
        });

        console.log(`Added $${depositDollars} to user ${userId} (new balance: $${(newBalance / 100).toFixed(2)})`);

        // Track deposit completed
        analytics.track(userId, "deposit_completed", {
          amountCents: depositCents,
          newBalanceCents: newBalance,
          stripeSessionId: checkoutSession.id,
        });
      }
    }
  }

  return c.json({ received: true });
});

// GET /api/billing/transactions - Get transaction history
// Returns personal transactions OR team transactions based on active organization
app.get("/transactions", async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Get active organization from session (if any)
  const activeOrganizationId = (session.session as { activeOrganizationId?: string })?.activeOrganizationId ?? null;

  let userTransactions;
  if (activeOrganizationId) {
    // Verify user is a member of this organization
    const membership = await getMembership(session.user.id, activeOrganizationId);
    if (membership) {
      // Show team transactions
      userTransactions = await db
        .select()
        .from(transactions)
        .where(eq(transactions.organizationId, activeOrganizationId))
        .orderBy(transactions.createdAt)
        .all();
    } else {
      // User not a member, fall back to personal transactions
      userTransactions = await db
        .select()
        .from(transactions)
        .where(
          and(eq(transactions.userId, session.user.id), isNull(transactions.organizationId))
        )
        .orderBy(transactions.createdAt)
        .all();
    }
  } else {
    // No active team - show only personal transactions
    userTransactions = await db
      .select()
      .from(transactions)
      .where(
        and(eq(transactions.userId, session.user.id), isNull(transactions.organizationId))
      )
      .orderBy(transactions.createdAt)
      .all();
  }

  // Reverse to show newest first
  return c.json({ transactions: userTransactions.reverse() });
});

// GET /api/billing/portal - Create Stripe customer portal session
app.get("/portal", async (c) => {
  if (!stripe) {
    return c.json({ error: "Payments not configured" }, 503);
  }

  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const currentUser = await db
    .select({ stripeCustomerId: user.stripeCustomerId })
    .from(user)
    .where(eq(user.id, session.user.id))
    .get();

  if (!currentUser?.stripeCustomerId) {
    return c.json({ error: "No billing history" }, 404);
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: currentUser.stripeCustomerId,
    return_url: `${FRONTEND_URL}/billing`,
  });

  return c.json({ url: portalSession.url });
});

export default app;
