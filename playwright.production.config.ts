import base from "./playwright.config";
import { defineConfig } from "@playwright/test";

const productionURL = process.env.PRODUCTION_URL;
export default defineConfig({
  ...base,
  webServer: productionURL ? undefined : { command: "bun run preview --host 127.0.0.1 --port 4318", port: 4318, reuseExistingServer: false },
  use: { ...base.use, baseURL: productionURL ?? "http://127.0.0.1:4318/harmonica/" },
  projects: base.projects?.filter((project) => project.name === "desktop"),
});
