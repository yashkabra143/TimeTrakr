import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,        // avoid race conditions on shared test DB
  retries: 1,
  timeout: 30_000,
  reporter: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: "http://localhost:5000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 5"] },
    },
  ],

  // Start dev server before E2E tests
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5000/api/ping",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
