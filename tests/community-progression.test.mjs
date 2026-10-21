import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const code = ts.transpileModule(
  fs.readFileSync(new URL("../src/lib/community-progression.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
).outputText;
const { parseCommunityProgression, parseCommunityXpHistory, communityProgressPercent } =
  await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
const id = "d4000000-0000-0000-0000-000000000001";
const summary = {
  server_id: id,
  xp: 1350,
  level: 2,
  level_floor: 1000,
  next_level_xp: 2500,
  curve_version: 1,
  earning_enabled: false,
  daily_cap: 500,
  weekly_cap: 2000,
};
const entry = {
  id: "100",
  awarded_xp: 100,
  requested_xp: 100,
  outcome: "granted",
  total_after: 1350,
  policy_revision: 1,
  created_at: "2026-10-21T12:00:00Z",
};
test("progression consumes backend thresholds; no client scoring formula", () => {
  assert.deepEqual(parseCommunityProgression(summary, id), summary);
  assert.equal(Math.round(communityProgressPercent(summary)), 23);
  assert.equal(communityProgressPercent({ ...summary, xp: 1000 }), 0);
});
test("progression rejects other server and malformed or inconsistent snapshots", () => {
  for (const patch of [
    { server_id: "other" },
    { xp: "1350" },
    { level: 0 },
    { level_floor: 1400 },
    { next_level_xp: 1350 },
    { earning_enabled: "false" },
    { daily_cap: 3000 },
    { xp: Number.MAX_SAFE_INTEGER + 1 },
  ])
    assert.throws(() => parseCommunityProgression({ ...summary, ...patch }, id));
  for (const value of [null, [], true]) assert.throws(() => parseCommunityProgression(value, id));
});
test("history preserves bigint cursor and strips private evidence", () => {
  const parsed = parseCommunityXpHistory([
    { ...entry, id: "9223372036854775807", activity_id: "private", reporter: "private" },
  ]);
  assert.equal(parsed[0].id, "9223372036854775807");
  assert.equal("activity_id" in parsed[0], false);
  assert.equal("reporter" in parsed[0], false);
});
test("history validates terminal capped and partial awards", () => {
  assert.equal(
    parseCommunityXpHistory([{ ...entry, awarded_xp: 0, outcome: "capped" }])[0].awarded_xp,
    0,
  );
  assert.equal(parseCommunityXpHistory([{ ...entry, awarded_xp: 50 }])[0].awarded_xp, 50);
});
test("history rejects unbounded, unordered and forged entries", () => {
  for (const value of [
    Array(51).fill(entry),
    [entry, entry],
    [{ ...entry, id: "9223372036854775808" }],
    [{ ...entry, id: "1e3" }],
    [{ ...entry, awarded_xp: 200 }],
    [{ ...entry, awarded_xp: 0 }],
    [{ ...entry, outcome: "capped" }],
    [{ ...entry, created_at: "no" }],
    [{ ...entry, total_after: 1 }],
  ])
    assert.throws(() => parseCommunityXpHistory(value));
  assert.deepEqual(parseCommunityXpHistory([]), []);
});
