import test from "node:test";
import assert from "node:assert/strict";
import { supabaseBuildEnv } from "../scripts/supabase-build-env.mjs";

test("Vercel public variables reach both the browser build and server", () => {
  const source = {
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
    SUPABASE_SECRET_KEY: "sb_secret_private",
  };
  const env = supabaseBuildEnv(source);
  assert.equal(env.VITE_SUPABASE_URL, source.SUPABASE_URL);
  assert.equal(env.VITE_SUPABASE_PUBLISHABLE_KEY, source.SUPABASE_PUBLISHABLE_KEY);
  assert.equal(env.VITE_SUPABASE_SECRET_KEY, undefined);
  assert.equal(source.VITE_SUPABASE_URL, undefined);
});

test("Existing Vite settings take precedence and also configure SSR", () => {
  const env = supabaseBuildEnv({
    VITE_SUPABASE_URL: "https://example.supabase.co",
    VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
    SUPABASE_URL: "https://old.supabase.co",
  });
  assert.equal(env.SUPABASE_URL, env.VITE_SUPABASE_URL);
  assert.equal(env.SUPABASE_PUBLISHABLE_KEY, env.VITE_SUPABASE_PUBLISHABLE_KEY);
});

test("Missing configuration and privileged keys stop the build", () => {
  assert.throws(() => supabaseBuildEnv({}), /Missing SUPABASE_URL/);
  assert.throws(
    () => supabaseBuildEnv({ SUPABASE_URL: "https://example.supabase.co" }),
    /Missing SUPABASE_PUBLISHABLE_KEY/,
  );
  assert.throws(
    () =>
      supabaseBuildEnv({
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: "sb_secret_private",
      }),
    /never a Supabase secret key/,
  );
});
