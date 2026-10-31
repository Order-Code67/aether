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
    },
  },
  clearScreen: false,
  optimizeDeps: {
    exclude: ["maplibre-gl"],
  },
  worker: {
    format: "es",
  },
  server: {
    port: 1424,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 1425 }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});

