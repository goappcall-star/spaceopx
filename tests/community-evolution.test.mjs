import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
function code(file) {
  return ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}
const progression =
  "data:text/javascript;base64," +
  Buffer.from(code("../src/lib/community-progression.ts")).toString("base64");
const moduleCode = code("../src/lib/community-evolution.ts").replace(
  '"@/lib/community-progression"',
  JSON.stringify(progression),
);
const { parseCommunityCosmetics, parseCommunityStatistics } = await import(
  "data:text/javascript;base64," + Buffer.from(moduleCode).toString("base64")
);
const sid = "d4c00000-0000-0000-0000-000000000001";
const item = {
  id: "lx_foundation_seal",
  name: "Selo",
  description: "Geometria original.",
  slot: "seal",
  render_key: "foundation_seal",
  owned: true,
  available: true,
  requires_mission: false,
};
const cosmetics = {
  server_id: sid,
  revision: 1,
  can_manage: true,
  selection: { seal: item.id },
  equipped: { seal: "foundation_seal" },
  items: [item],
};
const stats = {
  server_id: sid,
  from: "2026-10-01",
  to: "2026-10-22",
  progression: {
    server_id: sid,
    xp: 100,
    level: 1,
    level_floor: 0,
    next_level_xp: 1000,
    curve_version: 1,
    earning_enabled: false,
    daily_cap: 500,
    weekly_cap: 2000,
  },
  xp_received: 100,
  missions_completed: 0,
  achievements_unlocked: 1,
  members_current: 5,
  member_growth: null,
  events_realized: null,
  attendance_verified: null,
  events_created: 1,
  events_scheduled: 1,
  events_cancelled: 0,
  rsvp_going: 2,
  daily: [{ day: "2026-10-21", xp: 100, balance: 100 }],
  history: [
    {
      id: "9223372036854775807",
      awarded_xp: 100,
      requested_xp: 100,
      total_after: 100,
      created_at: "2026-10-21T10:00:00Z",
    },
  ],
};
test("cosmetics only accepts original allowlisted render bindings", () => {
  assert.deepEqual(parseCommunityCosmetics(cosmetics, sid), cosmetics);
  for (const patch of [
    { render_key: "url(javascript:bad)" },
    { slot: "theme" },
    { available: true, owned: false },
  ])
    assert.throws(() =>
      parseCommunityCosmetics({ ...cosmetics, items: [{ ...item, ...patch }] }, sid),
    );
});
test("cosmetic identity, revisions, slots and booleans are validated", () => {
  for (const patch of [
    { server_id: "other" },
    { revision: -1 },
    { can_manage: "true" },
    { equipped: { script: "anything" } },
    { selection: { seal: "unknown" } },
  ])
    assert.throws(() => parseCommunityCosmetics({ ...cosmetics, ...patch }, sid));
});
test("locked mission cosmetic remains a real locked item rather than fake usable reward", () => {
  const r = parseCommunityCosmetics(
    {
      ...cosmetics,
      selection: {},
      equipped: {},
      items: [{ ...item, owned: false, available: false, requires_mission: true }],
    },
    sid,
  );
  assert.equal(r.items[0].available, false);
});
test("statistics preserves unavailable metrics and actual ledger bigint", () => {
  const r = parseCommunityStatistics(stats, sid);
  assert.equal(r.member_growth, null);
  assert.equal(r.events_realized, null);
  assert.equal(r.history[0].id, "9223372036854775807");
});
test("statistics rejects fabricated supported metrics, inconsistent chart totals and outside dates", () => {
  for (const patch of [
    { member_growth: 1 },
    { events_realized: 0 },
    { attendance_verified: 2 },
    { xp_received: 999 },
    { daily: [{ day: "2026-09-01", xp: 100, balance: 100 }] },
    { to: "2027-02-01" },
    { history: [{ ...stats.history[0], awarded_xp: 200 }] },
  ])
    assert.throws(() => parseCommunityStatistics({ ...stats, ...patch }, sid));
});
test("empty period is empty while current XP remains separate", () => {
  const r = parseCommunityStatistics({ ...stats, xp_received: 0, daily: [], history: [] }, sid);
  assert.equal(r.progression.xp, 100);
  assert.equal(r.xp_received, 0);
  assert.deepEqual(r.daily, []);
});
