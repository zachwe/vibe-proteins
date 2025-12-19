import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth } from "./auth";

import challengesRoutes from "./routes/challenges";
import usersRoutes from "./routes/users";
import jobsRoutes from "./routes/jobs";
import submissionsRoutes from "./routes/submissions";

export function createApp() {
  const app = new Hono();

  // Middleware
  app.use("*", logger());
  app.use(
    "*",
    cors({
      origin: "http://localhost:5173",
      credentials: true,
    })
  );

  // Health check
  app.get("/", (c) => {
    return c.json({ status: "ok", message: "VibeProteins API" });
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

  return app;
}

export const app = createApp();
