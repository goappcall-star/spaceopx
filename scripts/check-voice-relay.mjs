import { loadEnv } from "vite";
import { readFileSync, readdirSync } from "node:fs";
const env = { ...loadEnv("production", process.cwd(), ""), ...process.env };
console.log(
  JSON.stringify({
    turnUrlConfigured: Boolean(env.VITE_TURN_URL),
    turnUsernameConfigured: Boolean(env.VITE_TURN_USERNAME),
    turnCredentialConfigured: Boolean(env.VITE_TURN_CREDENTIAL),
  }),
);
const path = "desktop/web/assets";
console.log(
  JSON.stringify({
    desktopHasRelayUrls: readdirSync(path)
      .filter((file) => file.endsWith(".js"))
      .some((file) => /["'`]turns?:/.test(readFileSync(`${path}/${file}`, "utf8"))),
  }),
);
