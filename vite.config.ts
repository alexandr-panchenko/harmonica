import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execFileSync } from "node:child_process";
import packageJson from "./package.json";

const sourceCommit = process.env.SOURCE_COMMIT ?? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const builtAt = process.env.BUILD_TIME ?? new Date().toISOString();
const buildMeta = { sourceCommit, builtAt, version: packageJson.version };

export default defineConfig({
  base: "/harmonica/",
  define: { __BUILD_META__: JSON.stringify(buildMeta) },
  build: {
    sourcemap: true,
    rollupOptions: { output: { assetFileNames: "assets/[name]-[hash][extname]" } },
  },
  // Generated alongside the exact bundle, never hand-maintained.
  publicDir: false,
  plugins: [react(), { name: "build-identity", generateBundle() { this.emitFile({ type: "asset", fileName: "build-meta.json", source: JSON.stringify(buildMeta, null, 2) + "\n" }); } }],
});
