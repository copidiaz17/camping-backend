import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// En producción el panel se sirve bajo /panel (monolito en Render).
// En desarrollo queda en / con el proxy hacia el backend.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/panel/" : "/",
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:3002", changeOrigin: true },
    },
  },
}));
