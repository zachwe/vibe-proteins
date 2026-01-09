/**
 * Analytics service for ProteinDojo
 *
 * Uses PostHog for product analytics and Resend for signup alerts.
 */

import { PostHog } from "posthog-node";
import { Resend } from "resend";

// Initialize PostHog client (server-side)
const posthog = process.env.POSTHOG_API_KEY
  ? new PostHog(process.env.POSTHOG_API_KEY, {
      host: process.env.POSTHOG_HOST || "https://us.i.posthog.com",
    })
  : null;

// Initialize Resend client (for alerts)
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// Email to receive signup alerts
const ALERT_EMAIL = process.env.ALERT_EMAIL;

export const analytics = {
  /**
   * Track an event for a user
   */
  track(userId: string, event: string, properties?: Record<string, unknown>) {
    if (!posthog) return;

    posthog.capture({
      distinctId: userId,
      event,
      properties,
    });
  },

  /**
   * Identify a user with their properties
   */
  identify(userId: string, properties: Record<string, unknown>) {
    if (!posthog) return;

    posthog.identify({
      distinctId: userId,
      properties,
    });
  },

  /**
   * Send an email alert for new signups
   */
  async alertSignup(user: { id: string; email: string; name: string }) {
    if (!resend || !ALERT_EMAIL) {
      console.log("[Analytics] Signup alert (Resend or ALERT_EMAIL not configured):", user.email);
      return;
    }

    try {
      await resend.emails.send({
        from: "ProteinDojo <alerts@proteindojo.com>",
        to: ALERT_EMAIL,
        subject: `New ProteinDojo Signup: ${user.name}`,
        text: `New user signed up!\n\nName: ${user.name}\nEmail: ${user.email}\nUser ID: ${user.id}\n\nTime: ${new Date().toISOString()}`,
      });
      console.log("[Analytics] Signup alert sent for:", user.email);
    } catch (error) {
      console.error("[Analytics] Failed to send signup alert:", error);
    }
  },

  /**
   * Flush pending events and shutdown
   */
  async shutdown() {
    if (posthog) {
      await posthog.shutdown();
    }
  },
};
