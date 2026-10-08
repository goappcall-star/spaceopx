import { spawnSync } from "node:child_process";
import { loadEnv } from "vite";
import { supabaseBuildEnv } from "./supabase-build-env.mjs";

const env = supabaseBuildEnv({ ...loadEnv("production", process.cwd(), ""), ...process.env });

// Keep the web deployment target separate from the desktop's static shell.
const result = spawnSync(process.execPath, ["node_modules/vite/bin/vite.js", "build"], {
  stdio: "inherit",
  env: { ...env, NITRO_PRESET: "vercel", LOBBYX_DESKTOP: "0" },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
