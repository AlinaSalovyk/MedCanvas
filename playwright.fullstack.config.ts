import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e-fullstack",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://127.0.0.1:4175",
    timezoneId: "Europe/Kyiv",
    trace: "retain-on-failure",
    actionTimeout: 15_000,
    ...devices["Desktop Chrome"],
    viewport: { width: 1600, height: 1000 },
  },
  projects: [
    { name: "clinic-browser", use: { timezoneId: "Europe/Kyiv" } },
    { name: "remote-browser", use: { timezoneId: "America/New_York" } },
  ],
  webServer: [
    {
      command: "dotnet run --project backend/tools/MedCanvas.E2EHost -c Release --no-launch-profile",
      url: "http://127.0.0.1:5188/api/v1/auth/me",
      timeout: 180_000,
      reuseExistingServer: false,
      gracefulShutdown: { signal: "SIGTERM", timeout: 15_000 },
    },
    {
      command: "npm run build && npx vite preview --config vite.fullstack.config.ts --port 4175 --strictPort",
      url: "http://127.0.0.1:4175/app.html",
      timeout: 180_000,
      reuseExistingServer: false,
    },
  ],
});
