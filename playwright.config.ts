import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e", fullyParallel: false, workers: 1, timeout: 60_000,
  expect: { timeout: 15_000 }, outputDir: ".playwright-results",
  use: { baseURL: "http://127.0.0.1:3101", browserName: "chromium", channel: process.platform === "win32" ? "msedge" : undefined,
    headless: true, trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: { command: "npm run test:serve", url: "http://127.0.0.1:3101/login", reuseExistingServer: false, timeout: 120_000 }
});
