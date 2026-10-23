import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";
const source = fileURLToPath(new URL("../../", import.meta.url)),
  fixtures = fileURLToPath(new URL("./fixtures.tsx", import.meta.url));
const mocked = [
  "@/hooks/use-auth",
  "@/hooks/use-call",
  "@/hooks/use-voice",
  "@/hooks/use-servers",
  "@/hooks/use-global-presence",
  "@/hooks/use-audio-settings",
  "@/hooks/audio-settings-context",
  "@/services/voice",
  "@/services/audio-processing",
  "@/services/social",
  "@/services/auth",
  "@/services/uploads",
  "@/components/chat/MessageItem",
  "@/components/voice/DeviceSettingsDialog",
  "@/components/gamer/ProfileDialog",
  "@tanstack/react-router",
  "@tanstack/react-query",
  "./SessionCommunications",
];
export default defineConfig({
  root: fileURLToPath(new URL("./", import.meta.url)),
  publicDir: source + "public",
  envPrefix: "FIXED_DOCK_PREVIEW_",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      ...mocked.map((find) => ({ find, replacement: fixtures })),
      { find: "@", replacement: source + "src" },
    ],
    dedupe: ["react", "react-dom"],
  },
  server: {
    host: "127.0.0.1",
    port: 5222,
    strictPort: true,
    fs: { allow: [source, realpathSync(source + "node_modules")] },
  },
});
