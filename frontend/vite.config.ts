import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// `npm run dev` serves the page on :5173 and passes /api to the FastAPI server.
// `npm run build` writes the page into ../app/web, which FastAPI serves.
export default defineConfig({
  plugins: [vue()],
  build: { outDir: "../app/web", emptyOutDir: true },
  server: {
    proxy: { "/api": process.env.API_TARGET ?? "http://127.0.0.1:8000" },
  },
});
