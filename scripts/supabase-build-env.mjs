import { assertPublicSupabaseKey, assertSupabaseUrl } from "../src/lib/supabase-key-policy.mjs";

export function supabaseBuildEnv(source) {
  const env = { ...source };
  for (const name of Object.keys(source)) {
    if (
      name.startsWith("VITE_") &&
      /SECRET|PASSWORD|PRIVATE_KEY|SERVICE_ROLE|TOKEN|CREDENTIAL|API_KEY/i.test(name) &&
      source[name]
    )
      throw new Error(
        `Privileged environment variable ${name} must not use the public VITE_ prefix.`,
      );
  }
  for (const name of ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"]) {
    const value = (source[`VITE_${name}`] || source[name] || "").trim();
    if (!value)
      throw new Error(
        `Missing ${name}. Configure it in the Vercel deployment environment and rebuild.`,
      );
    if (name === "SUPABASE_PUBLISHABLE_KEY") assertPublicSupabaseKey(value);
    else assertSupabaseUrl(value);
    env[`VITE_${name}`] = value;
    env[name] = value;
  }
  return env;
}
