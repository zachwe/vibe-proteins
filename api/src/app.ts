import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth } from "./auth";

import challengesRoutes from "./routes/challenges";
import usersRoutes from "./routes/users";
import jobsRoutes from "./routes/jobs";
import submissionsRoutes from "./routes/submissions";
import billingRoutes from "./routes/billing";
import suggestionsRoutes from "./routes/suggestions";
import referenceBindersRoutes from "./routes/reference-binders";
import helpRoutes from "./routes/help";

// CORS origins based on environment
const corsOrigins =
  process.env.NODE_ENV === "production"
    ? [
        "https://proteindojo.com",
        "https://www.proteindojo.com",
        "https://proteindojo.zachocean.com",
        // Legacy domains
        "https://vibe-proteins.zachocean.com",
        "https://vibeproteins.vercel.app",
      ]
    : ["http://localhost:5173"];

export function createApp() {
  const app = new Hono();

  // Middleware
  app.use("*", logger());
  app.use(
    "*",
    cors({
      origin: corsOrigins,
      credentials: true,
    })
  );

  // Health check
  app.get("/", (c) => {
    return c.json({ status: "ok", message: "ProteinDojo API" });
  });

  // BetterAuth routes - note: single asterisk for wildcard
  app.on(["POST", "GET"], "/api/auth/*", (c) => {
    return auth.handler(c.req.raw);
  });

  // API routes
  app.route("/api/challenges", challengesRoutes);
  app.route("/api/users", usersRoutes);
  app.route("/api/jobs", jobsRoutes);
  app.route("/api/submissions", submissionsRoutes);
  app.route("/api/billing", billingRoutes);
  app.route("/api/suggestions", suggestionsRoutes);
  app.route("/api/reference-binders", referenceBindersRoutes);
  app.route("/api/help", helpRoutes);

  return app;
}

export const app = createApp();
