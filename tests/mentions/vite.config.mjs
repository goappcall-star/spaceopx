import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
  plugins: [react(), tailwind()],
  resolve: { alias: { "@": fileURLToPath(new URL("../../src", import.meta.url)) } },
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("https://example.invalid"),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify("local-fixture-only"),
  },
  optimizeDeps: { entries: ["tests/mentions/index.html"] },
});
