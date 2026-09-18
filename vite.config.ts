import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vueDevTools from "vite-plugin-vue-devtools";

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  plugins: [
    vue(),
    vueDevTools(),
    //     {
    //       name: "inject-csp",
    //       transformIndexHtml(html) {
    //         return html.replace(
    //           "<head>",
    //           `<head>
    // <meta http-equiv="Content-Security-Policy" content="default-src 'self';script-src 'self';style-src 'self' 'unsafe-inline';img-src 'self' data:;connect-src 'self' http://192.168.12.169:1880 http://127.0.0.1:*;">
    // `,
    //         );
    //       },
    //     },
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@mlightcad/cad-html-plugin": "node_modules/@mlightcad/cad-html-plugin",
      "@mlightcad/cad-agent-plugin": "node_modules/@mlightcad/cad-agent-plugin",
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    open: true,
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
