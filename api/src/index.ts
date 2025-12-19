import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth } from "./auth";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: "http://localhost:5173", // Vite dev server
    credentials: true,
  })
);

// Health check
app.get("/", (c) => {
  return c.json({ status: "ok", message: "VibeProteins API" });
});

// BetterAuth routes
app.on(["POST", "GET"], "/api/auth/**", (c) => {
  return auth.handler(c.req.raw);
});

// Challenges routes (placeholder)
app.get("/api/challenges", (c) => {
  return c.json({ challenges: [] });
});

app.get("/api/challenges/:id", (c) => {
  const id = c.req.param("id");
  return c.json({ id, name: "Placeholder challenge" });
});

// Start server
const port = 3000;
console.log(`Server is running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
