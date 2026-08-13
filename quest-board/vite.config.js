import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: { cors: { origin: "https://www.owlbear.rodeo" } },
  build: {
    rollupOptions: {
      input: {
        controls: resolve(import.meta.dirname, "index.html"),
        background: resolve(import.meta.dirname, "background.html"),
        panel: resolve(import.meta.dirname, "panel.html"),
      },
    },
  },
});
