// import { defineConfig } from "vite";
// import react from "@vitejs/plugin-react";
// import path from "node:path";

// // https://vitejs.dev/config/
// export default defineConfig(({ mode }) => ({
//   server: {
//     host: "::",
//     port: 8080,
//     proxy: {
//       '/api': {
//         target: 'http://127.0.0.1:5000',
//         changeOrigin: true
//       }
//     },
//     fs: {
//       allow: ["./client", "./shared", "index.html"],
//       deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**"],
//     },
//   },
//   build: {
//     outDir: "dist/spa",
//   },
//   plugins: [react()],
//   resolve: {
//     alias: {
//       "@": path.resolve(__dirname, "./client"),
//       "@shared": path.resolve(__dirname, "./shared"),
//     },
//   },
// }));

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

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
    outDir: "dist", // ✅ IMPORTANT (matches Vercel)
  },

  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
});