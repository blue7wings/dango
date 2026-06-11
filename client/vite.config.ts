import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Use relative asset paths so the renderer loads correctly when the
  // packaged app serves index.html over file:// (absolute "/assets/..."
  // paths resolve to the filesystem root and cause a white screen).
  base: "./",
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5188,
    strictPort: true
  },
  build: {
    outDir: "dist"
  }
});
