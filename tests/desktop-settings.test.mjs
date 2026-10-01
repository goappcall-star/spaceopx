import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { CATALOG, validateCustomGame, detectGame } = require("../desktop/game-catalog.cjs");
test("Custom games validate names, reject paths and duplicate executables", () => {
  assert.throws(() => validateCustomGame({ name: "Test", process: "C:\\Game\\test.exe" }));
  assert.throws(() => validateCustomGame({ name: "Test", process: "cs2.exe" }));
  assert.throws(() => validateCustomGame({ name: " ", process: "game.exe" }));
  const entry = {
    id: "custom-test",
    ...validateCustomGame({ name: "My game", process: "MYGAME.exe" }),
  };
  assert.equal(
    detectGame([{ name: "MyGame.exe", pid: 99 }], null, "auto", 100, [...CATALOG, entry]).id,
    "custom-test",
  );
});
test("Desktop visibility filters public activity, keeps local detection and persists preferences", async () => {
  const handlers = new Map(),
    values = { activity: true };
  const window = { webContents: { mainFrame: { url: "lobbyx://app" } } };
  const source = fs.readFileSync(new URL("../desktop/activity.cjs", import.meta.url), "utf8");
  const context = {
    exports: {},
    process: { env: {} },
    setInterval: () => 0,
    clearInterval: () => {},
    require: (name) => {
      if (name === "electron")
        return {
          ipcMain: {
            handle: (key, fn) => handlers.set(key, fn),
            removeHandler: (key) => handlers.delete(key),
          },
          dialog: {},
        };
      if (name === "node:child_process") return { execFile() {} };
      if (name === "node:util")
        return { promisify: () => async () => ({ stdout: '"cs2.exe","123","Console"' }) };
      if (name === "./game-catalog.cjs") return require("../desktop/game-catalog.cjs");
      return require(name);
    },
  };
  vm.runInNewContext(source, context);
  const dispose = context.exports.installActivity({
    window,
    store: {
      get: (key) => values[key],
      set: async (key, value) => {
        values[key] = value;
      },
    },
    trusted: () => true,
  });
  const event = { sender: window.webContents, senderFrame: window.webContents.mainFrame };
  const read = () => handlers.get("desktop:activity")(event);
  const change = (key, value) => handlers.get("desktop:preferences")(event, { key, value });
  assert.equal((await read()).game.id, "cs2");
  let state = await change("gameVisibility", { id: "cs2", enabled: false });
  assert.equal(state.game, null);
  assert.equal(state.detectedGame.id, "cs2");
  assert.equal(values.hiddenGames[0], "cs2");
  assert.equal((await change("gameVisibility", { id: "cs2", enabled: true })).game.id, "cs2");
  state = await change("addGame", { name: "Other", process: "other.exe" });
  const added = state.catalog.find((item) => item.name === "Other");
  assert.ok(added.custom);
  assert.ok(!(await change("removeGame", added.id)).catalog.some((item) => item.id === added.id));
  await change("clearHistory");
  assert.equal(Object.keys(values.gameHistory).length, 0);
  state = await change("activity", false);
  assert.equal(state.game, null);
  assert.equal(state.detectedGame, null);
  await assert.rejects(() => handlers.get("desktop:activity")({ sender: {} }));
  dispose();
  assert.equal(handlers.size, 0);
});
