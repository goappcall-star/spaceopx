import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Exercise the actual provider with deterministic hooks, signaling and media.
function fixture() {
  const timers = new Map();
  let timerId = 0;
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
    reportNoiseProcessing() {},
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
            this.callbacks = callbacks;
            callbacks.onStateChange("connected");
          },
          async disconnect() {
            this.disconnects++;
          },
          syncPeers() {},
          setInputGain() {},
          async setDevices() {},
          async setNoiseSuppression() {},
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
    setTimeout: (callback) => {
      timers.set(++timerId, callback);
      return timerId;
    },
    clearTimeout: (id) => timers.delete(id),
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
  return { render, flush, channels, providers, timers };
}

test("Speech bursts publish without continually restarting the pending update", async () => {
  const f = fixture();
  f.channels[0].subscribed("SUBSCRIBED");
  await f.render().join("room-a");
  await f.flush();
  f.providers[0].callbacks.onSpeakingChange(true);
  f.render();
  const firstTimer = [...f.timers.keys()][0];
  assert.ok(firstTimer);
  f.providers[0].callbacks.onSpeakingChange(false);
  f.render();
  f.providers[0].callbacks.onSpeakingChange(true);
  f.render();
  assert.equal([...f.timers.keys()][0], firstTimer);
  f.timers.get(firstTimer)();
  f.timers.delete(firstTimer);
  await f.flush();
  assert.equal(f.channels[0].tracks.at(-1).speaking, true);
});

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

test("Local participant survives repeated leave and re-entry without a presence sync", async () => {
  const f = fixture();
  f.channels[0].subscribed("SUBSCRIBED");
  for (let attempt = 0; attempt < 3; attempt++) {
    await f.render().join("room-a");
    await f.flush();
    const joined = f.render();
    assert.equal(joined.connectionState, "connected");
    assert.equal(
      joined.participantsByChannel["room-a"].filter((p) => p.user_id === "me").length,
      1,
    );
    f.providers.at(-1).callbacks.onSpeakingChange(true);
    assert.equal(
      f.render().participantsByChannel["room-a"].find((p) => p.user_id === "me").speaking,
      true,
    );
    await f.render().leave();
    await f.flush();
    assert.equal(
      f.render().participantsByChannel["room-a"]?.some((p) => p.user_id === "me") ?? false,
      false,
    );
  }
});

test("Received speaking updates reach remote participant tiles and clear on departure", async () => {
  const f = fixture();
  f.channels[0].subscribed("SUBSCRIBED");
  await f.render().join("room-a");
  await f.flush();
  const events = f.providers[0].callbacks;
  events.onRemoteMedia({
    other: { audio: { getTracks: () => [{ readyState: "live" }] }, camera: null, screen: null },
  });
  events.onRemoteSpeakingChange({ other: true });
  assert.equal(
    f.render().participantsByChannel["room-a"].find((p) => p.user_id === "other").speaking,
    true,
  );
  events.onRemoteSpeakingChange({ other: false });
  assert.equal(
    f.render().participantsByChannel["room-a"].find((p) => p.user_id === "other").speaking,
    false,
  );
  events.onRemoteMedia({});
  events.onRemoteSpeakingChange({});
  assert.equal(
    f.render().participantsByChannel["room-a"].some((p) => p.user_id === "other"),
    false,
  );
});
