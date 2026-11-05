import { defineConfig, devices } from "@playwright/test";

// Browser tests of the real app. They run against a started stack (`docker compose up`), like the API's e2e tests:
//   npm run test:e2e                       (http://localhost:5173, mail read from Mailpit at http://localhost:8025)
//   E2E_BASE_URL=… E2E_MAILPIT_URL=… npm run test:e2e
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // in CI each failure also becomes an annotation on the run, readable without opening the logs
  reporter: process.env.CI ? [["list"], ["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // E2E_BROWSER_CHANNEL=chrome uses an installed Google Chrome instead of downloading Playwright's Chromium
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], channel: process.env.E2E_BROWSER_CHANNEL || undefined } }],
});
