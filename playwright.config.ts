import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: "npm run preview",
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
