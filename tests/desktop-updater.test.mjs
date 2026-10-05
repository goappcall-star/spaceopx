import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const require = createRequire(import.meta.url);
const { createUpdateController } = require("../desktop/updater.cjs");
function fixture() {
  const updater = new EventEmitter(),
    states = [];
  let clock = 1000,
    installs = 0;
  updater.checkForUpdates = async () => {
    updater.emit("checking-for-update");
    return {};
  };
  updater.quitAndInstall = (silent, reopen) => {
    assert.equal(silent, true);
    assert.equal(reopen, true);
    installs++;
  };
  const controller = createUpdateController({
    updater,
    version: "0.1.24",
    publish: (s) => states.push(s),
    now: () => clock,
  });
  return { updater, controller, states, installs: () => installs, advance: (n) => (clock += n) };
}
test("Downloads in background, clamps progress and requires explicit safe install", async () => {
  const f = fixture();
  assert.equal(f.updater.autoDownload, true);
  assert.equal(f.updater.autoInstallOnAppQuit, false);
  await f.controller.check();
  f.updater.emit("update-available", { version: "0.1.25" });
  f.updater.emit("download-progress", { percent: 36.8 });
  assert.equal(f.controller.snapshot().percent, 36.8);
  f.updater.emit("download-progress", { percent: 140 });
  assert.equal(f.controller.snapshot().percent, 100);
  f.updater.emit("update-downloaded", { version: "0.1.25" });
  assert.equal(f.installs(), 0);
  assert.equal(f.controller.install().ok, false, "unknown activity blocks install");
  f.controller.activity(true);
  assert.equal(f.controller.install().ok, false, "call/share blocks install");
  f.controller.activity(false);
  assert.equal(f.installs(), 0, "ending call never installs on its own");
  f.advance(10001);
  assert.equal(f.controller.install().ok, false, "lost renderer heartbeat blocks install");
  f.controller.activity(false);
  assert.equal(f.controller.install().ok, true);
  assert.equal(f.installs(), 1);
  assert.equal(f.controller.install().ok, false, "double click cannot start two installers");
});
test("Network/download/install errors are recoverable, sanitized and never escape", async () => {
  const f = fixture();
  f.updater.checkForUpdates = async () => {
    throw Error("SECRET token/path");
  };
  await f.controller.check();
  assert.equal(f.controller.snapshot().status, "error");
  assert.doesNotMatch(f.controller.snapshot().message, /SECRET/);
  f.updater.checkForUpdates = async () => {
    f.updater.emit("update-available", { version: "0.1.25" });
    return { downloadPromise: Promise.reject(Error("download failed")) };
  };
  await f.controller.check();
  assert.equal(f.controller.snapshot().status, "error");
  f.updater.emit("update-downloaded", { version: "0.1.25" });
  f.controller.activity(false);
  f.updater.quitAndInstall = () => f.updater.emit("error", Error("installer failed"));
  assert.equal(f.controller.install().ok, false);
  f.controller.resetActivity();
  assert.equal(f.controller.snapshot().busy, true);
  f.controller.dispose();
  assert.equal(f.updater.listenerCount("download-progress"), 0);
});
test("Server/private calls combine without overwriting each other; restart locks new calls", async () => {
  const exports = {},
    reports = [];
  const api = { activity: async (busy) => reports.push(busy), install: async () => ({ ok: true }) };
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(new URL("../src/services/desktop-updates.ts", import.meta.url), "utf8"),
      { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
    ).outputText,
    { exports, window: { lobbyxDesktop: { updates: api } } },
  );
  exports.beginDesktopCall("voice");
  exports.reportDesktopCall("private", false);
  assert.equal(exports.desktopCallBusy(), true);
  assert.equal((await exports.installDesktopUpdate()).ok, false);
  exports.reportDesktopCall("private", true);
  exports.clearDesktopCall("voice");
  assert.equal(exports.desktopCallBusy(), true);
  exports.clearDesktopCall("private");
  assert.equal(exports.desktopCallBusy(), false);
  assert.equal((await exports.installDesktopUpdate()).ok, true);
  assert.throws(() => exports.beginDesktopCall("voice"), /reiniciando/);
  exports.unlockDesktopUpdate();
  exports.beginDesktopCall("voice");
  assert.equal(reports.at(-1), true);
});
