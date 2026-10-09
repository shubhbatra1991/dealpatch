import { defineConfig, devices } from "@playwright/test";

// Run npm run build first. Keep browser tests away from the user's dev workspace.
export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./scripts/build-browser-test.cjs",
  fullyParallel: true,
  workers: 2,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "firefox", testMatch: "release.spec.ts", use: { ...devices["Desktop Firefox"], viewport: { width: 1440, height: 1000 } } },
    { name: "webkit", testMatch: "release.spec.ts", use: { ...devices["Desktop Safari"], viewport: { width: 1440, height: 1000 } } },
  ],
  webServer: {
    command: "npm run start -- --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
