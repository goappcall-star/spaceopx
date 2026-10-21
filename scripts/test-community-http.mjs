// Optional integration: real GoTrue password login + PostgREST. Never synthesizes JWTs.
// Only isolated loopback instances; creates new example.test identities and retains fixtures.
import assert from "node:assert/strict";
const base = new URL(process.env.COMMUNITY_HTTP_TEST_URL || "http://127.0.0.1:54321");
if (
  !["127.0.0.1", "localhost", "[::1]"].includes(base.hostname) ||
  base.username ||
  base.password ||
  base.pathname !== "/"
)
  throw Error("Only an isolated loopback Supabase origin is allowed");
let health;
try {
  health = await fetch(new URL("/auth/v1/health", base), {
    headers: process.env.COMMUNITY_HTTP_TEST_ANON_KEY
      ? { apikey: process.env.COMMUNITY_HTTP_TEST_ANON_KEY }
      : {},
    signal: AbortSignal.timeout(2000),
    redirect: "error",
  });
} catch {
  console.log(
    "SKIP: isolated GoTrue HTTP service unavailable; SQL results do not validate HTTP authentication.",
  );
  process.exit(0);
}
const anon = process.env.COMMUNITY_HTTP_TEST_ANON_KEY,
  service = process.env.COMMUNITY_HTTP_TEST_SERVICE_KEY;
if (!health.ok || process.env.COMMUNITY_HTTP_TEST_RUN !== "1" || !anon || !service) {
  console.log(
    "SKIP: HTTP suite requires a migrated disposable local Supabase, COMMUNITY_HTTP_TEST_RUN=1 and its two local keys.",
  );
  process.exit(0);
}
const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 12),
  password = crypto.randomUUID() + "Aa1!";
async function request(path, token, body, method = "POST") {
  const r = await fetch(new URL(path, base), {
    method,
    headers: { apikey: anon, Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  const result = await r.text();
  let data;
  try {
    data = JSON.parse(result);
  } catch {
    data = null;
  }
  return { ok: r.ok, status: r.status, data };
}
async function rpc(name, token, args, ok = true) {
  const r = await request("/rest/v1/rpc/" + name, token, args);
  assert.equal(r.ok, ok, `RPC ${name} status ${r.status}, code ${r.data?.code || "none"}`);
  return r.data;
}
async function identity(kind) {
  const email = `communities-${suffix}-${kind}@example.test`;
  const created = await request("/auth/v1/admin/users", service, {
    email,
    password,
    email_confirm: true,
    user_metadata: { username: "ct" + suffix + kind, display_name: "Community HTTP " + kind },
  });
  assert(created.ok, "local synthetic user creation");
  const login = await request("/auth/v1/token?grant_type=password", anon, { email, password });
  assert(login.ok && login.data?.access_token, "real local password login");
  return { id: login.data.user.id, token: login.data.access_token };
}
const owner = await identity("owner"),
  member = await identity("member"),
  outsider = await identity("outsider");
const sid = await rpc("create_server", owner.token, { _name: "HTTP community test " + suffix });
const channels = await request(
  `/rest/v1/channels?server_id=eq.${sid}&select=id,type`,
  owner.token,
  undefined,
  "GET",
);
assert(channels.ok);
const channel = channels.data.find((c) => c.type === "text");
assert(channel);
const payload = {
  rules: [{ id: crypto.randomUUID(), text: "Synthetic test rules" }],
  welcome_channel_id: channel.id,
  category_slug: "gaming",
  interests: ["coop"],
};
const saved = await rpc("save_server_community", owner.token, {
  _server_id: sid,
  _payload: payload,
  _expected_revision: 0,
});
assert.equal(saved.server_id, sid);
assert.equal(saved.enabled, true);
await rpc("get_server_community", outsider.token, { _server_id: sid }, false);
await rpc("get_server_community", anon, { _server_id: sid }, false);
const info = await rpc("get_community_experience", owner.token, { _server_id: sid });
assert.equal(info.server_id, sid);
await rpc("save_community_experience", owner.token, {
  _server_id: sid,
  _payload: { ...info.experience, rules_required: true },
  _expected_revision: info.revision,
});
const code = await rpc("create_server_invite", owner.token, { _server_id: sid });
await rpc("join_server_by_invite", member.token, { _code: code });
const pending = await rpc("get_community_experience", member.token, { _server_id: sid });
assert.equal(pending.screened, true);
assert.equal(pending.can_manage, false);
await rpc(
  "save_server_community",
  member.token,
  { _server_id: sid, _payload: payload, _expected_revision: 1 },
  false,
);
await rpc(
  "save_community_experience",
  member.token,
  { _server_id: sid, _payload: info.experience, _expected_revision: pending.revision },
  false,
);
const denied = await request("/rest/v1/server_community_settings", member.token, {
  server_id: sid,
  enabled: false,
});
assert.equal(denied.ok, false, "direct write denied by grants/RLS");
const blocked = await request("/rest/v1/messages", member.token, {
  channel_id: channel.id,
  author_id: member.id,
  content: "before acceptance",
});
assert.equal(blocked.ok, false, "screening enforced through PostgREST");
const onboarding = {
  _server_id: sid,
  _experience_revision: pending.revision,
  _rules_revision: pending.rules_revision,
  _accept_rules: false,
  _interests: ["coop"],
  _role_ids: [],
  _complete: false,
};
await rpc("save_community_onboarding", member.token, onboarding);
const draft = await rpc("get_community_experience", member.token, { _server_id: sid });
assert.deepEqual(draft.progress.interests, ["coop"]);
assert.equal(draft.progress.completed_revision, null);
await rpc("save_community_onboarding", member.token, { ...onboarding, _complete: true }, false);
await rpc("save_community_onboarding", member.token, {
  ...onboarding,
  _complete: true,
  _accept_rules: true,
});
const sent = await request("/rest/v1/messages", member.token, {
  channel_id: channel.id,
  author_id: member.id,
  content: "after acceptance",
});
assert(sent.ok, "authenticated text after acceptance");
await rpc("disable_server_community", owner.token, { _server_id: sid, _expected_revision: 1 });
assert.equal(await rpc("get_community_experience", member.token, { _server_id: sid }), null);
await rpc("save_server_community", owner.token, {
  _server_id: sid,
  _payload: payload,
  _expected_revision: 2,
});
console.log(
  `PASS: actual local GoTrue login and PostgREST foundation/onboarding contracts. Synthetic server retained: ${sid}. No credentials logged.`,
);
