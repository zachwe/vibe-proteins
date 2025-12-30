import { defineConfig, configDefaults } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./src/__tests__/globalSetup.ts"],
    env: {
      DATABASE_URL: "vibeproteins.test.db",
      OPENAI_API_KEY: "sk-test-dummy-key-for-tests",
    },
    exclude: [...configDefaults.exclude, "dist/**"],
  },
});
