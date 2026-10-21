import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";
const source = fileURLToPath(new URL("../../", import.meta.url));
export default defineConfig({
  root: fileURLToPath(new URL("./", import.meta.url)),
  publicDir: source + "public",
  envPrefix: "COMMUNITY_PREVIEW_",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": source + "src" }, dedupe: ["react", "react-dom"] },
  server: {
    host: "127.0.0.1",
    port: 5209,
    strictPort: true,
    fs: { allow: [source, realpathSync(source + "node_modules")] },
  },
});
