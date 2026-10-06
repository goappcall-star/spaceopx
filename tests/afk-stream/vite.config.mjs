import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
const fixture = fileURLToPath(new URL("./fixture.tsx", import.meta.url));
export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: { entries: ["tests/afk-stream/index.html"] },
  resolve: {
    alias: [
      ...[
        "@/hooks/use-auth",
        "@/hooks/use-voice",
        "@/integrations/supabase/client",
        "@tanstack/react-router",
      ].map((find) => ({ find, replacement: fixture })),
      { find: "@", replacement: fileURLToPath(new URL("../../src", import.meta.url)) },
    ],
  },
});
