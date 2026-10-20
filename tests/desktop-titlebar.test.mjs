import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { EventEmitter } from "node:events";

function fixture(platform = "win32") {
  const context = { exports: {}, process: { platform } };
  vm.runInNewContext(fs.readFileSync("desktop/titlebar.cjs", "utf8"), context);
  const handlers = new Map();
  const contents = Object.assign(new EventEmitter(), {
    mainFrame: { url: "lobbyx://app/app" },
    send: (...args) => {
      contents.sent = args;
    },
  });
  const window = Object.assign(new EventEmitter(), {
    webContents: contents,
    isDestroyed: () => false,
    isFullScreen: () => false,
    setTitle: (title) => {
      window.title = title;
    },
    setTitleBarOverlay: (options) => {
      window.overlay = options;
    },
    setBackgroundColor: (color) => {
      window.background = color;
    },
  });
  const stop = context.exports.installTitlebar({
    window,
    ipcMain: {
      handle: (name, fn) => handlers.set(name, fn),
      removeHandler: (name) => handlers.delete(name),
    },
    trusted: (url) => url.startsWith("lobbyx://app/"),
  });
  return {
    window,
    contents,
    handlers,
    stop,
    options: context.exports.titlebarOptions,
    event: { sender: contents, senderFrame: contents.mainFrame },
  };
}

test("Title stays LobbyX across route titles and Windows keeps native overlay controls", () => {
  const f = fixture();
  let prevented = false;
  f.contents.emit(
    "page-title-updated",
    {
      preventDefault: () => {
        prevented = true;
      },
    },
    "Seus lobbies — LobbyX",
  );
  assert.equal(prevented, true);
  assert.equal(f.window.title, "LobbyX");
  assert.equal(f.options.titleBarStyle, "hidden");
  assert.equal(f.options.titleBarOverlay.height, 32);
  f.stop();
  assert.equal(f.contents.listenerCount("page-title-updated"), 0);
});

test("Only trusted main frame can update titlebar colors, with strict color validation", () => {
  const f = fixture(),
    update = f.handlers.get("desktop:titlebar-appearance");
  const colors = { background: "#090b14", foreground: "#ffffff" };
  assert.equal(update(f.event, colors), true);
  assert.equal(f.window.overlay.color, colors.background);
  assert.equal(f.window.background, colors.background);
  assert.throws(() => update({ ...f.event, sender: {} }, colors), /Forbidden/);
  assert.throws(
    () => update({ ...f.event, senderFrame: { url: "lobbyx://app/app" } }, colors),
    /Forbidden/,
  );
  f.contents.mainFrame.url = "https://untrusted.example";
  assert.throws(() => update(f.event, colors), /Forbidden/);
  f.contents.mainFrame.url = "lobbyx://app/app";
  for (const background of ["red", "#fff", "#00000000", "url(secret)", null])
    assert.throws(() => update(f.event, { ...colors, background }), /Invalid/);
  f.window.isDestroyed = () => true;
  assert.throws(() => update(f.event, colors), /Forbidden/);
});

test("Fullscreen changes propagate and all IPC/listeners are cleaned up", () => {
  const f = fixture();
  assert.equal(f.handlers.get("desktop:titlebar-state")(f.event).fullscreen, false);
  f.window.emit("enter-full-screen");
  assert.equal(f.contents.sent[0], "desktop:titlebar-state");
  assert.equal(f.contents.sent[1].fullscreen, true);
  f.window.isFullScreen = () => true;
  f.window.emit("leave-full-screen");
  assert.equal(f.contents.sent[1].fullscreen, false);
  f.stop();
  assert.equal(f.handlers.size, 0);
  assert.equal(f.window.listenerCount("enter-full-screen"), 0);
  assert.equal(f.window.listenerCount("leave-full-screen"), 0);
  const other = fixture("darwin");
  assert.equal(Object.keys(other.options).length, 0);
  assert.equal(other.handlers.size, 0);
});
