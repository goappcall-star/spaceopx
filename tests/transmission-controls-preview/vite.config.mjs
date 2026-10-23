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
  "@/hooks/use-audio-settings",
  "@/hooks/audio-settings-context",
  "@/services/voice",
  "@/services/audio-processing",
  "@/services/social",
  "@/components/voice/DeviceSettingsDialog",
];
export default defineConfig({
  root: fileURLToPath(new URL("./", import.meta.url)),
  publicDir: source + "public",
  envPrefix: "TRANSMISSION_PREVIEW_",
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
    port: 5221,
    strictPort: true,
    fs: { allow: [source, realpathSync(source + "node_modules")] },
  },
});
