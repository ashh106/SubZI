import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Proxy is used in local dev only (/api → localhost:5000)
// In production (Vercel), API_URL from VITE_API_URL env var is used directly
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
      },
    },
  },

  build: {
    outDir: "dist",
  },

  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
});