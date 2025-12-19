import { execSync } from "child_process";
import { unlinkSync, existsSync } from "fs";

const TEST_DB = "vibeproteins.test.db";

export default function setup() {
  // Remove existing test database for a clean slate
  if (existsSync(TEST_DB)) {
    unlinkSync(TEST_DB);
  }

  // Run migrations on the test database
  execSync(`DATABASE_URL=${TEST_DB} pnpm db:migrate`, {
    stdio: "inherit",
    cwd: process.cwd(),
  });
}
