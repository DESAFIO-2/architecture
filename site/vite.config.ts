import { defineConfig } from "vitest/config";

// Caminhos relativos: o mesmo build serve no GitHub Pages e localmente.
export default defineConfig({
  base: "./",
  server: { fs: { allow: [".."] } },
  build: { chunkSizeWarningLimit: 5000 },
  test: { environment: "node" },
});
