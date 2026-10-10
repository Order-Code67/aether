import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const host = process.env.TAURI_DEV_HOST;
const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src"),
      // Rolldown + package exports: pin Monaco workers to real files
      "monaco-editor/editor/editor.worker.js": path.resolve(
        rootDir,
        "node_modules/monaco-editor/esm/vs/editor/editor.worker.js",
      ),
      "monaco-editor/language/json/json.worker.js": path.resolve(
        rootDir,
        "node_modules/monaco-editor/esm/vs/language/json/json.worker.js",
      ),
      "monaco-editor/language/css/css.worker.js": path.resolve(
        rootDir,
        "node_modules/monaco-editor/esm/vs/language/css/css.worker.js",
      ),
      "monaco-editor/language/html/html.worker.js": path.resolve(
        rootDir,
        "node_modules/monaco-editor/esm/vs/language/html/html.worker.js",
      ),
      "monaco-editor/language/typescript/ts.worker.js": path.resolve(
        rootDir,
        "node_modules/monaco-editor/esm/vs/language/typescript/ts.worker.js",
      ),
    },
  },
  clearScreen: false,
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("monaco-editor") || id.includes("@monaco-editor")) {
            return "monaco";
          }
        },
      },
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
