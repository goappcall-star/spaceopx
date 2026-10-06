import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
function fixture() {
  let now = 1000,
    oldDeps,
    cleanup,
    mutedAt;
  const timers = new Map(),
    moved = [];
  const react = {
    useRef(initial) {
      return (mutedAt ??= { current: initial });
    },
    useEffect(fn, deps) {
      if (!oldDeps || deps.some((v, i) => v !== oldDeps[i])) {
        cleanup?.();
        oldDeps = deps;
        cleanup = fn();
      }
    },
  };
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync("src/hooks/use-voice-afk.ts", "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports,
      require: () => react,
      Date: { now: () => now },
      setTimeout(fn, ms) {
        const id = Symbol();
        timers.set(id, { fn, at: now + ms });
        return id;
      },
      clearTimeout: (id) => timers.delete(id),
    },
  );
  const props = {
    muted: true,
    roomId: "normal",
    afkId: "afk",
    join: async (id) => {
      moved.push(id);
    },
  };
  const render = (next) => exports.useVoiceAfk(Object.assign(props, next));
  const tick = (ms) => {
    now += ms;
    for (const [id, t] of timers)
      if (t.at <= now) {
        timers.delete(id);
        t.fn();
      }
  };
  render();
  return { render, tick, moved, timers };
}
test("AFK moves only after ten continuous minutes muted", () => {
  const f = fixture();
  f.tick(599999);
  assert.equal(f.moved.length, 0);
  f.tick(1);
  assert.deepEqual(f.moved, ["afk"]);
});
test("Unmuting cancels AFK and a later mute starts a fresh timer", () => {
  const f = fixture();
  f.tick(300000);
  f.render({ muted: false });
  f.tick(600000);
  assert.equal(f.moved.length, 0);
  f.render({ muted: true });
  f.tick(599999);
  assert.equal(f.moved.length, 0);
  f.tick(1);
  assert.equal(f.moved.length, 1);
});
test("Changing rooms does not reset continuous mute time", () => {
  const f = fixture();
  f.tick(240000);
  f.render({ roomId: "second" });
  f.tick(360000);
  assert.deepEqual(f.moved, ["afk"]);
});
test("Leaving, a missing AFK room, and already being AFK do not transfer", () => {
  for (const props of [{ roomId: null }, { afkId: null }, { roomId: "afk" }]) {
    const f = fixture();
    f.render(props);
    f.tick(1200000);
    assert.equal(f.moved.length, 0);
    assert.equal(f.timers.size, 0);
  }
});
