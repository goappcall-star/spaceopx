import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
  plugins: [react(), tailwind()],
  resolve: {
    alias: [
      {
        find: "@/integrations/supabase/client",
        replacement: fileURLToPath(new URL("../audio/supabase-fixture.ts", import.meta.url)),
      },
      { find: "@", replacement: fileURLToPath(new URL("../../src", import.meta.url)) },
    ],
  },
  build: {
    outDir: "tests/monitor/dist",
    rollupOptions: { input: ["tests/monitor/index.html", "tests/monitor/panel.html"] },
  },
});
