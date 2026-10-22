import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";
const source = fileURLToPath(new URL("../../", import.meta.url));
const fixtures = fileURLToPath(new URL("./fixtures.tsx", import.meta.url));
const mocked = [
  "@/hooks/use-auth",
  "@/hooks/use-voice",
  "@/hooks/use-audio-settings",
  "@/hooks/audio-settings-context",
  "@/hooks/use-global-presence",
  "@/components/gamer/ProfileDialog",
  "@/services/auth",
  "@tanstack/react-router",
  "@tanstack/react-query",
  "@/components/voice/ConnectedVoiceBar",
  "@/components/voice/DeviceSettingsDialog",
];
export default defineConfig({
  root: fileURLToPath(new URL("./", import.meta.url)),
  publicDir: source + "public",
  envPrefix: "SIDEBAR_PREVIEW_",
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
    port: 5220,
    strictPort: true,
    fs: { allow: [source, realpathSync(source + "node_modules")] },
  },
});
