import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      {
        find: "@/components/gamer/QuickProfile",
        replacement: fileURLToPath(new URL("../profile/member-fixture.tsx", import.meta.url)),
      },
      { find: "@", replacement: fileURLToPath(new URL("../../src", import.meta.url)) },
    ],
  },
});
