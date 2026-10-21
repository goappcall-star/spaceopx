import test from "node:test";
import { memberHasPermission } from "../src/services/permissions.ts";
import assert from "node:assert/strict";
import {
  validateCommunityPayload,
  parseCommunitySettings,
} from "../src/lib/community-validation.ts";
const id = "10000000-0000-0000-0000-000000000001";
const payload = () => ({
  rules: [{ id, text: " Respeite o squad. " }],
  welcome_channel_id: id,
  category_slug: "gaming",
  interests: [" Jogos ", "jogos", "Coop"],
});
test("Community payload preserves rule/channel IDs and normalizes interests without mutation", () => {
  const source = payload(),
    result = validateCommunityPayload(source);
  assert.deepEqual(result.rules, [{ id, text: "Respeite o squad." }]);
  assert.deepEqual(result.interests, ["jogos", "coop"]);
  assert.equal(result.welcome_channel_id, id);
  assert.equal(source.rules[0].text, " Respeite o squad. ");
});
test("Community rules enforce boundaries, unique IDs, control characters and Unicode length", () => {
  for (const rules of [
    [],
    Array(21).fill({ id, text: "a" }),
    [{ id, text: " " }],
    [{ id: "forged", text: "a" }],
    [{ id, text: "a\u0001b" }],
    [
      { id, text: "a" },
      { id, text: "b" },
    ],
    [{ id, text: "a".repeat(1001) }],
  ]) {
    assert.throws(() => validateCommunityPayload({ ...payload(), rules }));
  }
  assert.equal(
    validateCommunityPayload({ ...payload(), rules: [{ id, text: "🎮".repeat(1000) }] }).rules[0]
      .text.length,
    2000,
  );
});
test("Community channel, category and interests reject invalid or excessive inputs", () => {
  for (const patch of [
    { welcome_channel_id: "foreign text" },
    { category_slug: "unknown" },
    { interests: Array(11).fill("jogos") },
    { interests: ["a"] },
    { interests: ["a".repeat(31)] },
    { interests: ["ab\ncd"] },
  ]) {
    assert.throws(() => validateCommunityPayload({ ...payload(), ...patch }));
  }
});
const row = () => ({
  ...validateCommunityPayload(payload()),
  server_id: id,
  enabled: true,
  revision: 1,
  rules_revision: 1,
  activated_at: "2026-10-21T05:00:00Z",
  disabled_at: null,
  created_at: "2026-10-21T05:00:00Z",
  updated_at: "2026-10-21T05:00:00Z",
  activated_by: "private actor",
  arbitrary: "not cached",
});
test("Community response projects only member fields and safely handles a removed welcome channel", () => {
  const result = parseCommunitySettings(row());
  assert.equal(result.enabled, true);
  assert.equal("activated_by" in result, false);
  assert.equal("arbitrary" in result, false);
  assert.equal(
    parseCommunitySettings({ ...row(), welcome_channel_id: null }).welcome_channel_id,
    null,
  );
});
test("Malformed community response cannot masquerade as a successful operation", () => {
  for (const patch of [
    { enabled: "true" },
    { revision: 0 },
    { rules_revision: -1 },
    { updated_at: "invalid date" },
    { server_id: "invalid" },
  ]) {
    assert.throws(() => parseCommunitySettings({ ...row(), ...patch }));
  }
});

test("Community UI permission requires an explicit grant without changing other admin abilities", () => {
  const admin = { user_id: "member", roles: [{ permissions: { administrator: true } }] };
  assert.equal(memberHasPermission(admin, "owner", "manage_server"), true);
  assert.equal(memberHasPermission(admin, "owner", "manage_community"), false);
  const delegated = { user_id: "member", roles: [{ permissions: { manage_community: true } }] };
  assert.equal(memberHasPermission(delegated, "owner", "manage_community"), true);
  assert.equal(memberHasPermission(delegated, "owner", "manage_roles"), false);
  assert.equal(
    memberHasPermission({ ...admin, user_id: "owner" }, "owner", "manage_community"),
    true,
  );
});
