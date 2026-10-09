import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { assertPublicSupabaseKey, assertSupabaseUrl } from "../src/lib/supabase-key-policy.mjs";
import { supabaseBuildEnv } from "../scripts/supabase-build-env.mjs";
import {
  validPassword,
  validEmail,
  validateMessage,
  safeImageUrl,
} from "../src/lib/input-validation.mjs";
import { redactSecrets, redactedJson } from "../src/lib/redact-secrets.mjs";
import { securityHeaders, secureResponse, withSecurityNonce } from "../src/lib/security-headers.ts";
import { validIncomingRing } from "../src/lib/call-security.ts";
import { realtimeChannelOptions } from "../src/lib/realtime-rollout.mjs";

test("Private realtime rollout is explicit and preserves presence/broadcast options", () => {
  const options = { config: { presence: { key: "member" }, broadcast: { ack: true } } };
  for (const flag of [undefined, "false", "TRUE", true]) {
    assert.equal(realtimeChannelOptions(options, flag).config.private, false);
  }
  const result = realtimeChannelOptions(options, "true");
  assert.equal(result.config.private, true);
  assert.deepEqual(result.config.presence, options.config.presence);
  assert.deepEqual(result.config.broadcast, options.config.broadcast);
  assert.equal(options.config.private, undefined);
});
const { trusted, externalHttps, htmlSecurityHeaders } = createRequire(import.meta.url)(
  "../desktop/security.cjs",
);
const jwt = (role) =>
  [
    Buffer.from('{"alg":"HS256"}').toString("base64url"),
    Buffer.from(JSON.stringify({ role })).toString("base64url"),
    "signature",
  ].join(".");

test("Privileged/unknown keys and non-HTTPS backends fail before bundling or creating clients", () => {
  assert.doesNotThrow(() => assertPublicSupabaseKey(jwt("anon")));
  assert.doesNotThrow(() => assertPublicSupabaseKey("sb_publishable_example"));
  for (const key of [
    jwt("service_role"),
    jwt("authenticated"),
    "sb_secret_private",
    "malformed",
    null,
  ])
    assert.throws(() => assertPublicSupabaseKey(key));
  assert.doesNotThrow(() => assertSupabaseUrl("http://127.0.0.1:54321"));
  for (const url of [
    "http://example.supabase.co",
    "https://user:pass@example.supabase.co",
    "javascript:alert(1)",
  ])
    assert.throws(() => assertSupabaseUrl(url));
  assert.throws(
    () =>
      supabaseBuildEnv({
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: jwt("service_role"),
      }),
    /Privileged/,
  );
  assert.throws(() => supabaseBuildEnv({ VITE_SERVICE_ROLE_KEY: "private-value" }), /public VITE_/);
});

test("Inputs reject oversized messages, malformed attachments, active URLs, and invalid account data", () => {
  assert.equal(validPassword("  valid password  "), "  valid password  ");
  assert.equal(validEmail(" user@example.test "), "user@example.test");
  assert.equal(validateMessage(" Hi 👋 "), "Hi 👋");
  for (const url of [
    "javascript:alert(1)",
    "data:image/svg+xml,test",
    "https://secret@example.test/a",
  ])
    assert.throws(() => safeImageUrl(url));
  assert.throws(() => validateMessage("x".repeat(4001)));
  assert.throws(() => validateMessage(""));
  assert.throws(() =>
    validateMessage("Hi", [
      { path: "../secret", name: "file", size: 1, mime: "text/plain", kind: "file" },
    ]),
  );
  assert.throws(() => validateMessage("Hi", [], ["invalid"]));
  assert.throws(() => validPassword("short"));
  assert.throws(() => validEmail("bad@ address"));
});

test("SSR headers authorize only nonce scripts, preserve media/WASM, and prevent shared nonce caches", () => {
  const csp = securityHeaders("request-nonce")["Content-Security-Policy"];
  assert.match(csp, /script-src 'self' 'nonce-request-nonce' 'wasm-unsafe-eval';/);
  assert.doesNotMatch(csp.split(";")[1], /'unsafe-inline'|'unsafe-eval'/);
  assert.match(csp, /wss:\/\/\*\.supabase.co/);
  const response = secureResponse(
    new Response("html", { headers: { "content-type": "text/html" } }),
    "nonce",
  );
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
});

test("Desktop rejects untrusted navigations and hashes inline shell scripts instead of allowing arbitrary inline JS", () => {
  assert.equal(trusted("lobbyx://app/app"), true);
  for (const url of [
    "lobbyx://evil/app",
    "lobbyx://user@app/app",
    "lobbyx://app:999/app",
    "https://app/app",
  ])
    assert.equal(trusted(url), false);
  assert.equal(externalHttps("https://example.test"), true);
  for (const url of [
    "file:///C:/Windows/System32",
    "javascript:alert(1)",
    "https://secret@example.test",
  ])
    assert.equal(externalHttps(url), false);
  const csp = htmlSecurityHeaders("<script>window.boot=1</script>")["Content-Security-Policy"];
  assert.match(csp, /sha256-/);
  assert.doesNotMatch(csp.split(";")[1], /unsafe-inline/);
});

test("Diagnostics redact passwords, bearer tokens, DB URLs and OAuth codes", () => {
  const value = redactedJson({
    password: "sensitive-password",
    authorization: "Bearer sensitive-token",
    nested: { refresh_token: "private-refresh" },
    message: "postgresql://" + "user:private-password@db.test/database?code=private-code",
  });
  for (const secret of [
    "sensitive-password",
    "sensitive-token",
    "private-refresh",
    "private-password",
    "private-code",
  ])
    assert.ok(!value.includes(secret));
  assert.equal(redactSecrets("Error 42501: denied"), "Error 42501: denied");
});

test("A ring cannot direct the recipient into another user's control channel", () => {
  const sender = "10000000-0000-0000-0000-000000000001",
    recipient = "10000000-0000-0000-0000-000000000002";
  const ring = {
    callId: `${sender}-${recipient}-abc123`,
    video: false,
    from: { id: sender, display_name: "Caller", username: "caller", avatar_url: null },
  };
  assert.equal(validIncomingRing(ring, recipient), true);
  assert.equal(
    validIncomingRing({ ...ring, callId: `${recipient}-${sender}-abc123` }, recipient),
    false,
  );
  assert.equal(
    validIncomingRing(
      { ...ring, from: { ...ring.from, avatar_url: "javascript:alert(1)" } },
      recipient,
    ),
    false,
  );
  assert.equal(validIncomingRing(null, recipient), false);
});

test("Nonce forwarding rejects a forged header and preserves streaming POSTs through Nitro proxies", async () => {
  const original = new Request("https://example.test/action", {
    method: "POST",
    body: "request body",
    headers: { "x-lobbyx-csp-nonce": "forged" },
  });
  const proxy = new Proxy(original, { get: (target, key) => Reflect.get(target, key, target) });
  const request = withSecurityNonce(proxy, "server-generated");
  assert.equal(request.headers.get("x-lobbyx-csp-nonce"), "server-generated");
  assert.equal(await request.text(), "request body");
  assert.equal(request.method, "POST");
});
