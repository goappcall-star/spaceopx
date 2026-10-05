import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
const fixture = fileURLToPath(new URL("./member-fixture.tsx", import.meta.url));
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      ...[
        "hooks/use-auth",
        "hooks/use-call",
        "hooks/use-voice",
        "hooks/use-social",
        "hooks/use-server-admin",
        "components/gamer/ProfileDialog",
        "components/gamer/QuickProfile",
      ].map((name) => ({ find: "@/" + name, replacement: fixture })),
      { find: "@", replacement: fileURLToPath(new URL("../../src", import.meta.url)) },
    ],
  },
});
