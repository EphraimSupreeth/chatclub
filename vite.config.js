import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/chatclub/" : "/",
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    css: true,
    setupFiles: './src/setupTests.js',
  },
})
