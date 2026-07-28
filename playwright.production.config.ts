import base from "./playwright.config";
import { defineConfig } from "@playwright/test";

export default defineConfig({
  ...base,
  webServer: { command: "bun run preview --host 127.0.0.1 --port 4174", port: 4174, reuseExistingServer: false },
  use: { ...base.use, baseURL: "http://127.0.0.1:4174/harmonica/" },
  projects: base.projects?.filter((project) => project.name === "desktop"),
});
