/**
 * Frontend analytics for ProteinDojo
 *
 * Uses PostHog for product analytics (client-side).
 */

import posthog from "posthog-js";

let initialized = false;

/**
 * Initialize PostHog analytics
 * Should be called once on app startup
 */
export function initAnalytics() {
  const apiKey = import.meta.env.VITE_POSTHOG_KEY;
  const host = import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com";

  if (!apiKey) {
    console.log("[Analytics] PostHog not configured (no VITE_POSTHOG_KEY)");
    return;
  }

  if (initialized) {
    return;
  }

  posthog.init(apiKey, {
    api_host: host,
    capture_pageviews: true,
    capture_pageleave: true,
    autocapture: false, // We'll track specific events manually
  });

  initialized = true;
  console.log("[Analytics] PostHog initialized");
}

/**
 * Track a custom event
 */
export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (!initialized) return;
  posthog.capture(event, properties);
}

/**
 * Identify the current user (call after login)
 */
export function identifyUser(
  userId: string,
  properties?: Record<string, unknown>
) {
  if (!initialized) return;
  posthog.identify(userId, properties);
}

/**
 * Reset user identity (call on logout)
 */
export function resetUser() {
  if (!initialized) return;
  posthog.reset();
}
