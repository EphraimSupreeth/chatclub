import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev
export default defineConfig({
  base: "/chatclub/",
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
  },
})
