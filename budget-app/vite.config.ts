import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "/budget_app/", // IMPORTANT: repo name is budget_app (underscore)
  plugins: [react(), tailwindcss()],
});