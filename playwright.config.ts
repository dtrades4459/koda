import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for Kōda smoke tests.
 *
 * Runs against http://localhost:5173 by default. The webServer block starts
 * `npm run dev` for you so a fresh `npm run test:e2e` Just Works on a dev
 * machine.
 *
 * Point at a deployed environment by setting BASE_URL:
 *   BASE_URL=https://kodatrade.co.uk npx playwright test
 *   BASE_URL=https://koda-pr-123-vercel.app  npx playwright test
 *
 * The auth flow tests require a dedicated test Supabase account:
 *   TEST_EMAIL — email on file
 *   TEST_PASSWORD — password
 * The auth tests are skipped automatically when these are not set.
 */
const isCI = !!process.env.CI;
const baseURL = process.env.BASE_URL ?? "http://localhost:5173";
const isLocalhost = /localhost|127\.0\.0\.1/.test(baseURL);

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  retries: isCI ? 1 : 0,
  reporter: isCI ? "github" : "list",

  // Auto-start `npm run dev` only when targeting localhost. Reuse a running
  // server outside CI so iterating in the dev loop is fast.
  webServer: isLocalhost ? {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 60_000,
  } : undefined,

  use: {
    baseURL,
    headless: true,
    viewport: { width: 390, height: 844 }, // iPhone 14 — Kōda is mobile-first
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      // Chromium with a mobile viewport. CI installs only chromium so we
      // can't use devices["iPhone 14"] here (that's WebKit-backed).
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
