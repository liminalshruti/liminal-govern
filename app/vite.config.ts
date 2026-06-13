import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Web app for lane G (Vercel). No Tauri.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
