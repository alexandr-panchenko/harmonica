import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  webServer: { command: "bun run dev --host 127.0.0.1 --port 4173", port: 4173, reuseExistingServer: true },
  use: { baseURL: "http://127.0.0.1:4173/harmonica/", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "mobile-landscape", use: { ...devices["Pixel 7 landscape"] } },
  ],
});
