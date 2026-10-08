import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { safeRedirect } from "../src/lib/redirect.ts";
const require = createRequire(import.meta.url);
const { authCallback } = require("../desktop/auth-link.cjs");

test("Desktop accepts a PKCE code but rejects other destinations", () => {
  assert.equal(
    authCallback("lobbyx://app/auth-callback?code=12345678-abcd&extra=ignored"),
    "lobbyx://app/auth-callback?code=12345678-abcd",
  );
  assert.equal(
    authCallback("lobbyx://app/auth-callback?error=access_denied"),
    "lobbyx://app/auth-callback?error=access_denied",
  );
  for (const value of [
    "https://app/auth-callback?code=12345678",
    "lobbyx://evil/auth-callback?code=12345678",
    "lobbyx://app/app?code=12345678",
    "lobbyx://app/auth-callback#unexpected",
    "lobbyx://app/auth-callback?code=a",
    "lobbyx://user@app/auth-callback?code=12345678",
  ])
    assert.equal(authCallback(value), null);
});
test("Post-auth redirect preserves invitations and rejects external links and loops", () => {
  assert.equal(safeRedirect("/invite/abc?join=1", "/app"), "/invite/abc?join=1");
  for (const value of [
    "https://evil.test",
    "//evil.test",
    "/" + String.fromCharCode(92) + "evil.test",
    "/auth-callback",
    "/complete-registration?redirect=/app",
  ])
    assert.equal(safeRedirect(value, "/app"), "/app");
});
function service(supabase, protocol = "https:") {
  const saved = new Map();
  let assigned;
  const code = ts.transpileModule(
    fs.readFileSync(new URL("../src/services/auth.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText;
  const context = {
    exports: {},
    require: () => ({ supabase }),
    localStorage: { setItem: (k, v) => saved.set(k, v) },
    window: {
      location: { protocol, origin: "https://lobbyx.example", assign: (url) => (assigned = url) },
    },
  };
  vm.runInNewContext(code, context);
  return { auth: context.exports.authService, saved, url: () => assigned };
}
test("An older backend cannot start Google signup and auto-generate a username", async () => {
  let started = false;
  const mock = {
    rpc: async () => ({ error: { message: "missing" }, data: null }),
    auth: {
      signInWithOAuth: async () => {
        started = true;
      },
    },
  };
  await assert.rejects(
    service(mock).auth.signInWithGoogle("/app"),
    /google_registration_not_configured/,
  );
  assert.equal(started, false);
});
test("Desktop Google flow uses browser authorization and a desktop callback", async () => {
  let input;
  const mock = {
    rpc: async () => ({ data: true, error: null }),
    auth: {
      signInWithOAuth: async (args) => {
        input = args;
        return { data: { url: "https://auth.example/authorize" }, error: null };
      },
    },
  };
  const fixture = service(mock, "lobbyx:");
  await fixture.auth.signInWithGoogle("/invite/friends");
  assert.equal(input.provider, "google");
  assert.equal(input.options.redirectTo, "lobbyx://app/auth-callback");
  assert.equal(input.options.skipBrowserRedirect, true);
  assert.equal(fixture.url(), "https://auth.example/authorize");
  assert.equal(fixture.saved.get("lobbyx:auth-destination"), "/invite/friends");
});
test("A duplicate username error is preserved for the signup form", async () => {
  const duplicate = { code: "23505" };
  const fixture = service({ rpc: async () => ({ error: duplicate }) });
  await assert.rejects(
    fixture.auth.completeRegistration("already_used"),
    (error) => error === duplicate,
  );
});
