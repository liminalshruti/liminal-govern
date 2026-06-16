import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Web app for lane G (Vercel). No Tauri.
// Multi-page: the live cockpit (index.html → AgencyShell) + the Brief Gate ratification surface
// (ratify.html → RatifyBrief). The ratify page is additive — it does not touch the cockpit.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        ratify: resolve(__dirname, "ratify.html"),
      },
    },
  },
});
