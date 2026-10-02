import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Exercise the actual provider with deterministic hooks, signaling and media.
function fixture() {
  let cursor = 0,
    pending = [],
    dirty = false,
    value,
    props = { serverId: "a", userId: "me" };
  const slots = [],
    channels = [],
    providers = [];
  const memo = (fn, deps) => {
    const index = cursor++,
      old = slots[index];
    if (!old || deps.some((dep, i) => !Object.is(dep, old.deps[i])))
      slots[index] = { deps, value: fn() };
    return slots[index].value;
  };
  const react = {
    createContext: () => ({ Provider: "context" }),
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [
        slots[index],
        (next) => {
          next = typeof next === "function" ? next(slots[index]) : next;
          if (!Object.is(next, slots[index])) {
            slots[index] = next;
            dirty = true;
          }
        },
      ];
    },
    useRef: (initial) => memo(() => ({ current: initial }), []),
    useMemo: memo,
    useCallback: (fn, deps) => memo(() => fn, deps),
    useEffect(fn, deps) {
      const index = cursor++,
        old = slots[index];
      if (!old || deps.some((dep, i) => !Object.is(dep, old.deps[i]))) {
        pending.push(() => {
          old?.cleanup?.();
          slots[index] = { deps, cleanup: fn() };
        });
      }
    },
  };
  const audio = {
    settings: { inputMode: "open", inputVolume: 100 },
    devices: [],
    update() {},
    refreshDevices() {},
  };
  const supabase = {
    channel(topic) {
      const ch = {
        topic,
        tracks: [],
        removed: false,
        on() {
          return this;
        },
        subscribe(fn) {
          this.subscribed = fn;
          return this;
        },
        presenceState: () => ({}),
        async track(payload) {
          this.tracks.push(payload);
        },
        async untrack() {
          this.untracked = true;
        },
      };
      channels.push(ch);
      return ch;
    },
    async removeChannel(ch) {
      ch.removed = true;
    },
  };
  const imports = {
    react,
    "react/jsx-runtime": { jsx: (_type, p) => p, jsxs: (_type, p) => p },
    sonner: { toast: { error() {} } },
    "@/hooks/use-audio-settings": { useAudioSettings: () => audio },
    "@/integrations/supabase/client": { supabase },
    "@/services/voice": {
      createVoiceProvider() {
        const provider = {
          disconnects: 0,
          async connect(_room, _user, callbacks) {
            callbacks.onStateChange("connected");
          },
          async disconnect() {
            this.disconnects++;
          },
          syncPeers() {},
          setInputGain() {},
          setMuted() {},
        };
        providers.push(provider);
        return provider;
      },
    },
  };
  const exports = {};
  const code = ts.transpileModule(
    fs.readFileSync(new URL("../src/hooks/use-voice.tsx", import.meta.url), "utf8"),
    {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    },
  ).outputText;
  vm.runInNewContext(code, {
    exports,
    require: (name) => {
      assert.ok(name in imports, `Unexpected dependency ${name}`);
      return imports[name];
    },
    crypto: { randomUUID: () => Math.random().toString() },
    localStorage: { getItem: () => null },
    window: { addEventListener() {}, removeEventListener() {} },
    setTimeout: () => 1,
    clearTimeout() {},
    setInterval: () => 1,
    clearInterval() {},
  });
  function render(serverId = props.serverId) {
    props = { ...props, serverId };
    let count = 0;
    do {
      dirty = false;
      cursor = 0;
      pending = [];
      value = exports.VoiceProviderRoot(props).value;
      pending.forEach((effect) => effect());
      assert.ok(++count < 20, "render settles");
    } while (dirty);
    return value;
  }
  async function flush() {
    for (let i = 0; i < 12; i++) await Promise.resolve();
    render();
  }
  render();
  return { render, flush, channels, providers };
}

test("Browsing another server or home retains media and original presence; leave still disconnects", async () => {
  const f = fixture();
  f.channels[0].subscribed("SUBSCRIBED");
  await f.render().join("room-a");
  await f.flush();
  assert.equal(f.render().connectionState, "connected");
  f.render("b");
  await f.flush();
  assert.equal(f.render().activeServerId, "a");
  assert.equal(f.render().activeChannelId, "room-a");
  assert.equal(f.providers[0].disconnects, 0);
  assert.equal(f.channels[0].removed, false);
  assert.equal(f.channels[1].topic, "voice:b");
  assert.equal(f.channels[1].tracks.length, 0);
  assert.ok(f.channels[0].tracks.some((p) => p.channel_id === "room-a"));
  f.render(null);
  await f.flush();
  assert.equal(f.providers[0].disconnects, 0);
  await f.render().leave();
  await f.flush();
  assert.equal(f.providers[0].disconnects, 1);
  assert.equal(f.render().activeChannelId, null);
  assert.equal(f.channels[0].removed, true);
});

test("Explicitly joining another server replaces the old call and clears its presence", async () => {
  const f = fixture();
  f.channels[0].subscribed("SUBSCRIBED");
  await f.render().join("room-a");
  await f.flush();
  f.render("b");
  await f.render().join("room-b");
  await f.flush();
  assert.equal(f.providers[0].disconnects, 1);
  assert.equal(f.providers.length, 2);
  assert.equal(f.render().activeServerId, "b");
  assert.equal(f.render().activeChannelId, "room-b");
  assert.equal(f.channels[0].removed, true);
  assert.equal(
    f.channels[0].tracks.some((p) => p.channel_id === "room-b"),
    false,
  );
});
