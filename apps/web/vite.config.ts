import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The admin app talks to the API via `/api` which is proxied to apps/api in dev.
// In production, serve the built assets behind a reverse proxy that routes
// /api/* to the API service.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY ?? "http://localhost:4000",
        changeOrigin: true,
      },
      // Uploaded product images served by the API's static mount.
      "/uploads": {
        target: process.env.VITE_API_PROXY ?? "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
