import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { Resend } from "resend";
import * as authSchema from "./db/auth-schema";
import { analytics } from "./services/analytics";

const DATABASE_PATH = process.env.DATABASE_URL || "vibeproteins.db";

// Email sending via Resend
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// Create a separate connection for BetterAuth
const sqlite = new Database(DATABASE_PATH);
const db = drizzle(sqlite, { schema: authSchema });

const isProduction = process.env.NODE_ENV === "production";

// Frontend URL for redirects
const frontendUrl = isProduction
  ? "https://proteindojo.com"
  : "http://localhost:5173";

// Trusted origins based on environment
const trustedOrigins = isProduction
  ? [
      "https://proteindojo.com",
      "https://www.proteindojo.com",
      "https://proteindojo.zachocean.com",
      // Legacy domains
      "https://vibe-proteins.zachocean.com",
      "https://vibeproteins.vercel.app",
    ]
  : ["http://localhost:5173"];

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: authSchema,
  }),
  basePath: "/api/auth",
  user: {
    additionalFields: {
      username: {
        type: "string",
        required: false,
        input: true, // Allow during signup
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: isProduction, // Only require in production
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      // Set callbackURL to redirect to frontend after verification
      const urlObj = new URL(url);
      urlObj.searchParams.set("callbackURL", frontendUrl + "/verified");
      const verifyUrl = urlObj.toString();

      if (!resend) {
        console.log(
          `[DEV] Email verification link for ${user.email}: ${verifyUrl}`
        );
        return;
      }
      // Don't await to prevent timing attacks
      void resend.emails.send({
        from: "ProteinDojo <noreply@proteindojo.com>",
        to: user.email,
        subject: "Verify your email - ProteinDojo",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #1e293b;">Welcome to ProteinDojo!</h1>
            <p>Click the button below to verify your email address:</p>
            <a href="${verifyUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
              Verify Email
            </a>
            <p style="color: #64748b; font-size: 14px;">
              If you didn't create an account, you can ignore this email.
            </p>
            <p style="color: #64748b; font-size: 14px;">
              Or copy this link: ${verifyUrl}
            </p>
          </div>
        `,
      });
    },
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24, // 24 hours
  },
  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },
  // Cookie settings for cross-domain auth
  advanced: {
    crossSubDomainCookies: {
      enabled: false, // Different domains, not subdomains
    },
    defaultCookieAttributes: {
      secure: isProduction,
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax", // "none" required for cross-site cookies
      partitioned: isProduction, // CHIPS for cross-site cookies
    },
  },
  trustedOrigins,
  // Secret is read from BETTER_AUTH_SECRET env var automatically
  // You can add more providers here later (Google, GitHub, etc.)

  // Database hooks for analytics
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Track new signups and send alert email
          analytics.track(user.id, "user_signed_up", {
            email: user.email,
            name: user.name,
          });
          analytics.identify(user.id, {
            email: user.email,
            name: user.name,
            createdAt: new Date().toISOString(),
          });
          // Send email alert
          await analytics.alertSignup({ id: user.id, email: user.email, name: user.name || "" });
        },
      },
    },
  },
});
