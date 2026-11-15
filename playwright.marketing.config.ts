import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/marketing",
  outputDir: "test-results/marketing",
  fullyParallel: true,
  timeout: 45000,
  use: { baseURL: "http://127.0.0.1:5175", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "iphone",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: [
    {
      command: "npm run dev:marketing",
      url: "http://127.0.0.1:5175",
      reuseExistingServer: false,
      env: {
        VITE_MARKETING_INTAKE_ENABLED: "true",
        VITE_MARKETING_TURNSTILE_SITE_KEY: "test-only",
      },
      timeout: 30000,
    },
    {
      command: "npm run dev:marketing -- --port 5176",
      url: "http://127.0.0.1:5176",
      reuseExistingServer: false,
      env: { VITE_MARKETING_INTAKE_ENABLED: "false" },
      timeout: 30000,
    },
  ],
  reporter: "list",
});
