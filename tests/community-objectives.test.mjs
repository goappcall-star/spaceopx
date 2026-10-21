import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const code = ts.transpileModule(
  fs.readFileSync(new URL("../src/lib/community-objectives.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
).outputText;
const { parseMission, parseAchievement, parseObjectivePage, parseCommunityObjectives } =
  await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
const sid = "d4b10000-0000-0000-0000-000000000001";
const mission = {
  id: null,
  objective_id: "verified_daily",
  version: 1,
  name: "Diária",
  description: "Somente evidências verificadas.",
  cadence: "daily",
  target: 3,
  progress: 0,
  period_start: "2026-10-21T00:00:00Z",
  expires_at: "2026-10-22T00:00:00Z",
  completed_at: null,
  status: "unavailable",
  reward_xp: 150,
  awarded_xp: null,
  reward_id: null,
};
const achievement = {
  objective_id: "community_foundation",
  version: 1,
  name: "Fundação",
  description: "Primeira ativação.",
  criterion: "first_activation",
  category: "foundation",
  rarity: "common",
  unlocked_at: null,
  reward_id: null,
};
test("future mission is parsed as unavailable without inventing progress", () => {
  assert.deepEqual(parseMission(mission), mission);
});
test("mission supports available, progress, completion and expired projections", () => {
  for (const [status, progress] of [
    ["available", 0],
    ["in_progress", 2],
    ["expired", 1],
  ])
    assert.equal(parseMission({ ...mission, status, progress }).status, status);
  const completed = parseMission({
    ...mission,
    id: "9223372036854775807",
    status: "completed",
    progress: 3,
    completed_at: "2026-10-21T13:00:00Z",
    awarded_xp: 0,
  });
  assert.equal(completed.awarded_xp, 0);
  assert.equal(completed.id, "9223372036854775807");
});
test("mission rejects forged counts, unbounded cursors, invalid completion and reward inflation", () => {
  for (const patch of [
    { progress: 4 },
    { progress: -1 },
    { target: 0 },
    { status: "completed" },
    { status: "completed", progress: 2, completed_at: "2026-10-21T13:00:00Z" },
    { status: "available", progress: 1 },
    { reward_xp: 150, awarded_xp: 151 },
    { id: "9223372036854775808" },
    { status: "claimed" },
    { cadence: "hourly" },
    { expires_at: mission.period_start },
    { version: "1" },
  ])
    assert.throws(() => parseMission({ ...mission, ...patch }));
});
test("achievement is a pinned catalog snapshot; personal metadata is stripped", () => {
  const parsed = parseAchievement({
    ...achievement,
    reporter_id: "private",
    evidence_key: "private",
    unlocked_at: "2026-10-21T12:00:00Z",
  });
  assert.equal(parsed.version, 1);
  assert.equal("reporter_id" in parsed, false);
  assert.equal("evidence_key" in parsed, false);
});
test("achievement parser rejects arbitrary criteria, rarities and malformed dates", () => {
  for (const patch of [
    { criterion: "messages_100" },
    { rarity: "mythical" },
    { category: "admin" },
    { unlocked_at: "bad" },
    { objective_id: "<script>" },
  ])
    assert.throws(() => parseAchievement({ ...achievement, ...patch }));
});
test("snapshot rejects another server and nonboolean verifier authority", () => {
  const snapshot = {
    server_id: sid,
    missions: [mission],
    recent_achievements: [],
    verifier_enabled: false,
  };
  assert.equal(parseCommunityObjectives(snapshot, sid).verifier_enabled, false);
  assert.throws(() => parseCommunityObjectives(snapshot, "different"));
  assert.throws(() => parseCommunityObjectives({ ...snapshot, verifier_enabled: "false" }, sid));
  assert.throws(() =>
    parseCommunityObjectives({ ...snapshot, missions: Array(17).fill(mission) }, sid),
  );
});
test("objective pages are bounded and empty states remain real empty states", () => {
  assert.deepEqual(parseObjectivePage([], parseMission), []);
  assert.throws(() => parseObjectivePage(Array(51).fill(mission), parseMission));
  for (const v of [null, {}, "[]"]) assert.throws(() => parseObjectivePage(v, parseMission));
});
