import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: Object.fromEntries(
      ["heic", "avif", "webp"].map((name) => [
        `image-codec-${name}`,
        fileURLToPath(
          new URL(
            `./node_modules/@pbk20191/icodec/lib/${name}.js`,
            import.meta.url,
          ),
        ),
      ]),
    ),
  },
  worker: { format: "es" },
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  preview: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
});
