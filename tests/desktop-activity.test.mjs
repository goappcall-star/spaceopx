import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { gameElapsed, readDetectedGames } from "../src/services/desktop-activity.ts";
const require = createRequire(import.meta.url);
const { detectGame, parseTasks } = require("../desktop/game-catalog.cjs");
const { createPermissionStore } = require("../desktop/permissions.cjs");
test("Recognizes requested game executables and ignores launchers", () => {
  for (const [name, id] of [
    ["VALORANT-Win64-Shipping.exe", "valorant"],
    ["csgo.exe", "csgo"],
    ["cs2.exe", "cs2"],
    ["Palworld-Win64-Shipping.exe", "palworld"],
    ["Palworld-WinGDK-Shipping.exe", "palworld"],
    ["Aniimo.exe", "aniimo"],
  ])
    assert.equal(detectGame([{ name, pid: 1 }], null).id, id);
  assert.equal(
    detectGame(
      [
        { name: "LeagueClient.exe", pid: 3 },
        { name: "RiotClientServices.exe", pid: 4 },
      ],
      null,
    ),
    null,
  );
});
test("League shared process does not pretend to distinguish TFT automatically", () => {
  const rows = [{ name: "League of Legends.exe", pid: 1 }];
  assert.equal(detectGame(rows, null).name, "League of Legends / TFT");
  assert.equal(detectGame(rows, null, "tft").name, "Teamfight Tactics");
  assert.equal(detectGame(rows, null, "lol").name, "League of Legends");
});
test("Keeps the current game and start time; resets after process restart", () => {
  const first = detectGame([{ name: "cs2.exe", pid: 1 }], null, "auto", 1000);
  assert.equal(detectGame([{ name: "cs2.exe", pid: 1 }], first, "auto", 5000).startedAt, 1000);
  assert.equal(detectGame([{ name: "cs2.exe", pid: 2 }], first, "auto", 6000).startedAt, 6000);
  assert.equal(detectGame([], first), null);
});
test("Task parser exposes only name and PID", () => {
  assert.deepEqual(parseTasks('"cs2.exe","123","Console","1","500 K"'), [
    { name: "cs2.exe", pid: 123 },
  ]);
});
test("Permissions, including a denial, survive application restart", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "lobbyx-permission-test-"));
  try {
    const file = path.join(dir, "permissions.json"),
      store = await createPermissionStore(file);
    assert.equal(store.get("audio"), undefined);
    await Promise.all([
      store.set("audio", true),
      store.set("video", false),
      store.set("activity", true),
    ]);
    const reopened = await createPermissionStore(file);
    assert.equal(reopened.get("audio"), true);
    assert.equal(reopened.get("video"), false);
    assert.equal(reopened.get("activity"), true);
    await reopened.set("audio", null);
    assert.equal((await createPermissionStore(file)).get("audio"), null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("Elapsed activity is shown in minutes and hours", () => {
  assert.equal(gameElapsed(0, 30000), "agora");
  assert.equal(gameElapsed(0, 120000), "há 2 min");
  assert.equal(gameElapsed(0, 3900000), "há 1 h 5 min");
});
test("Live games vanish when their session leaves; malformed payloads are ignored", () => {
  assert.deepEqual(readDetectedGames({}), {});
  assert.deepEqual(
    readDetectedGames({ a: [{ user_id: "a", game: { id: "cs2", name: "CS2", startedAt: NaN } }] }),
    {},
  );
  assert.equal(
    readDetectedGames({ a: [{ user_id: "a", game: { id: "cs2", name: "CS2", startedAt: 0 } }] }).a
      .name,
    "CS2",
  );
});
