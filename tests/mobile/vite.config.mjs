import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
  plugins: [react(), tailwind()],
  resolve: {
    alias: [
      ...[
        "@/hooks/use-server-admin",
        "@/hooks/use-auth",
        "./SettingsProfile",
        "./SettingsAccess",
        "./SettingsMembers",
        "./SettingsRoles",
        "./SettingsInvites",
        "./SettingsBans",
        "./SettingsAudit",
        "./DeleteServerButton",
      ].map((find) => ({
        find,
        replacement: fileURLToPath(new URL("./server-fixture.tsx", import.meta.url)),
      })),
      { find: "@", replacement: fileURLToPath(new URL("../../src", import.meta.url)) },
    ],
  },
  optimizeDeps: { entries: ["tests/mobile/index.html"] },
});
