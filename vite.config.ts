import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vueDevTools from "vite-plugin-vue-devtools";

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  plugins: [vue(), vueDevTools()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // "@mlightcad/cad-html-plugin": "node_modules/@mlightcad/cad-html-plugin",
      // "@mlightcad/cad-agent-plugin": "node_modules/@mlightcad/cad-agent-plugin",
    },
  },
  optimizeDeps: {
    include: [
      "@mlightcad/cad-viewer",
      "@mlightcad/cad-pdf-plugin",
      "@mlightcad/cad-svg-plugin",
      "@mlightcad/cad-html-plugin",
    ],
  },
  build: {
    chunkSizeWarningLimit: 1000,
    cssMinify: "esbuild",
  },
});
