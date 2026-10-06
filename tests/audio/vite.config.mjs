import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@/integrations/supabase/client",
        replacement: fileURLToPath(new URL("./supabase-fixture.ts", import.meta.url)),
      },
      { find: "@", replacement: fileURLToPath(new URL("../../src", import.meta.url)) },
    ],
  },
});
