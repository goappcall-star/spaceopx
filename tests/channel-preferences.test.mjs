import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const environment = { exports: {}, Date };
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync("src/lib/channel-preferences.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  environment,
);
const { isChannelMuted, shouldNotifyChannel } = environment.exports;
const channel = { id: "text", category_id: "games" };
const preferences = {
  mutedUntil: null,
  notifications: "all",
  mutedChannels: [],
  mutedCategories: {},
  categoryNotifications: {},
  channelNotifications: {},
};
test("Category mute covers existing and newly assigned channels, then expires", () => {
  const p = { ...preferences, mutedCategories: { games: 1500 } };
  assert.equal(isChannelMuted(p, channel, 1000), true);
  assert.equal(shouldNotifyChannel(p, channel, "user", ["user"], 1000), false);
  assert.equal(shouldNotifyChannel(p, channel, "user", [], 1501), true);
  assert.equal(isChannelMuted({ ...p, mutedCategories: { games: -1 } }, channel, 99999), true);
});
test("Channel notification override inherits category and server when cleared; mute always wins", () => {
  const p = { ...preferences, categoryNotifications: { games: "mentions" } };
  assert.equal(shouldNotifyChannel(p, channel, "user", []), false);
  assert.equal(shouldNotifyChannel(p, channel, "user", ["user"]), true);
  assert.equal(
    shouldNotifyChannel({ ...p, channelNotifications: { text: "none" } }, channel, "user", [
      "user",
    ]),
    false,
  );
  assert.equal(
    shouldNotifyChannel({ ...p, channelNotifications: { text: "all" } }, channel, "user", []),
    true,
  );
  assert.equal(
    shouldNotifyChannel(
      { ...p, channelNotifications: { text: "all" }, mutedChannels: ["text"] },
      channel,
      "user",
      ["user"],
    ),
    false,
  );
  assert.equal(shouldNotifyChannel({ ...p, mutedUntil: -1 }, channel, "user", ["user"]), false);
});
test("Previously stored preferences without category fields retain existing behavior", () => {
  const p = { mutedUntil: null, notifications: "mentions", mutedChannels: [] };
  assert.equal(shouldNotifyChannel(p, channel, "user", []), false);
  assert.equal(shouldNotifyChannel(p, channel, "user", ["user"]), true);
});
