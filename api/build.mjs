import * as esbuild from "esbuild";

// Build the main server bundle
await esbuild.build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  sourcemap: true,
  // Mark native modules and problematic packages as external
  external: ["better-sqlite3", "posthog-node"],
  // Preserve dynamic imports
  splitting: false,
  banner: {
    js: `
import { createRequire as _createRequire } from 'module';
import { fileURLToPath as _fileURLToPath } from 'url';
import { dirname as _dirname } from 'path';
const require = _createRequire(import.meta.url);
const __filename = _fileURLToPath(import.meta.url);
const __dirname = _dirname(__filename);
`,
  },
});

// Build the migration script separately
await esbuild.build({
  entryPoints: ["src/db/migrate.ts"],
  outfile: "dist/db/migrate.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  sourcemap: true,
  external: ["better-sqlite3", "posthog-node"],
  banner: {
    js: `
import { createRequire as _createRequire } from 'module';
import { fileURLToPath as _fileURLToPath } from 'url';
import { dirname as _dirname } from 'path';
const require = _createRequire(import.meta.url);
const __filename = _fileURLToPath(import.meta.url);
const __dirname = _dirname(__filename);
`,
  },
});

console.log("Build complete!");
