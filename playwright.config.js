import { defineConfig } from "@playwright/test";

// reuseExistingServer will attach to ANY server already on this port - it does
// not check that the server is serving THIS repo. A dev server from another
// project (or another git worktree of this one) silently takes over, and the
// suite then runs against 404s and an empty bundle. That has happened here.
// Override the port to get an isolated run:
//
//     NAVIO_TEST_PORT=4180 npx playwright test
const PORT = process.env.NAVIO_TEST_PORT || "4173";
const URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./test/e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: URL,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npx http-server -p ${PORT} -s`,
    url: URL,
    reuseExistingServer: !process.env.CI,
  },
});
