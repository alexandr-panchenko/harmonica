import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  base: "/harmonica/",
  build: {
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        "lab/staff-design": resolve(import.meta.dirname, "lab/staff-design/index.html"),
        "lab/harmonica-design": resolve(import.meta.dirname, "lab/harmonica-design/index.html"),
      },
    },
  },
});
