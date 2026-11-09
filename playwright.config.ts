import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 180000,
  workers: 1,
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3001",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"], reducedMotion: "reduce" } },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "npm run start -- --port 3001",
        url: "http://localhost:3001",
        reuseExistingServer: !process.env.CI,
      },
});
