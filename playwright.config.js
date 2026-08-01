import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test/e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npx http-server -p 4173 -s",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
});
