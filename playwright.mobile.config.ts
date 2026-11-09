import { defineConfig } from "@playwright/test";

/**
 * iPhone viewport checks against the static Capacitor bundle (dist-mobile).
 * Kept out of playwright.config.ts so `npm run test:e2e` stays on the Next app.
 */
export default defineConfig({
  testDir: "./e2e/mobile",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  timeout: 180_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run mobile:build && node e2e/mobile/static-server.mjs",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
