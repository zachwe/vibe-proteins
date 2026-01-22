import "dotenv/config";
import * as Sentry from "@sentry/node";

// Initialize Sentry before other imports
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: 0.1,
    profilesSampleRate: 0.1,
  });
}

import { serve } from "@hono/node-server";
import { app } from "./app";

const port = Number(process.env.PORT) || 3000;
console.log(`Server is running on http://0.0.0.0:${port}`);

serve({
  fetch: app.fetch,
  port,
  hostname: "0.0.0.0",
});
