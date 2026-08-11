import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import packageJson from "./package.json";

function repositoryHead(): string {
  const head = readFileSync(resolve(import.meta.dirname, ".git/HEAD"), "utf8").trim();
  if (!head.startsWith("ref: ")) return head;
  return readFileSync(resolve(import.meta.dirname, ".git", head.slice(5)), "utf8").trim();
}

const sourceCommit = process.env.SOURCE_COMMIT ?? process.env.GITHUB_SHA ?? repositoryHead();
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
