import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
export default defineConfig({
  plugins: [react()],
  envPrefix: "ISOLATED_PLAYBACK_",
  resolve: {
    alias: [
      ...[
        "@/hooks/use-voice",
        "@/hooks/use-audio-settings",
        "@/hooks/use-screen-volume",
        "@/components/call/ScreenViewingProvider",
      ].map((find) => ({
        find,
        replacement: fileURLToPath(new URL("./playback-fixture.tsx", import.meta.url)),
      })),
      {
        find: "@/integrations/supabase/client",
        replacement: fileURLToPath(new URL("./supabase-fixture.ts", import.meta.url)),
      },
      { find: "@", replacement: fileURLToPath(new URL("../../src", import.meta.url)) },
    ],
  },
});
