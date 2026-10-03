import { defineConfig } from "nitro/config";

export default defineConfig({
  // Produce a self-contained Vercel function, including when built on Windows.
  noExternals: process.env["NITRO_PRESET"] === "vercel",
});
