import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Exercise the actual provider with deterministic hooks, signaling and media.
function fixture({ cacheTopics = false, delayedRemoval = false } = {}) {
  const timers = new Map();
  const timerDelays = new Map();
  const intervals = new Map(),
    missedRequests = [];
  const restrictionRows = [],
    restrictionChannels = [];
  let restrictionFailure = false;
  let timerId = 0;
  let now = Date.now();
  let cursor = 0,
    pending = [],
    dirty = false,
    value,
    props = { serverId: "a", userId: "me" };
  const slots = [],
    channels = [],
    moveChannels = [],
    providers = [];
  const removals = [];
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
        pending.push({
          cleanup: () => old?.cleanup?.(),
          start: () => {
            slots[index] = { deps, cleanup: fn() };
          },
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
      if (cacheTopics) {
        const existing = channels.find((ch) => ch.topic === topic && !ch.removed);
        if (existing) return existing;
      }
      const ch = {
        topic,
        tracks: [],
        events: {},
        snapshot: {},
        sent: [],
        removed: false,
        on(kind, filter, handler) {
          this.events[filter.event] = handler;
          return this;
        },
        subscribe(fn) {
          this.subscribeCalls = (this.subscribeCalls ?? 0) + 1;
          this.subscribed = fn;
          return this;
        },
        presenceState() {
          return this.snapshot;
        },
        async send(event) {
          this.sent.push(event);
        },
        async track(payload, options) {
          this.tracks.push(payload);
          this.trackOptions = options;
          return this.trackResult ?? "ok";
        },
        async untrack() {
          this.untracked = true;
        },
      };
      (topic.startsWith("voice-restrictions:")
        ? restrictionChannels
        : topic.startsWith("voice-moves:")
          ? moveChannels
          : channels
      ).push(ch);
      return ch;
    },
    from(table) {
      let serverIds;
      return {
        select() {
          return this;
        },
        eq(key, value) {
          if (key === "server_id") serverIds = [value];
          return this;
        },
        in(_key, values) {
          serverIds = values;
          return this;
        },
        gte() {
          return this;
        },
        order() {
          return this;
        },
        maybeSingle: async () => ({
          data:
            restrictionRows.find(
              (row) => serverIds.includes(row.server_id) && row.user_id === "me",
            ) ?? null,
          error: restrictionFailure ? Error("offline") : null,
        }),
        then(resolve) {
          return Promise.resolve({
            data:
              table === "voice_restrictions"
                ? restrictionRows.filter((row) => serverIds.includes(row.server_id))
                : missedRequests,
            error: null,
          }).then(resolve);
        },
      };
    },
    async removeChannel(ch) {
      if (delayedRemoval && ch.topic.startsWith("voice:"))
        await new Promise((resolve) => removals.push(resolve));
      ch.removed = true;
    },
  };
  const imports = {
    "@/services/desktop-updates": {
      reportDesktopCall() {},
      clearDesktopCall() {},
      beginDesktopCall() {},
    },
    react,
    "react/jsx-runtime": { jsx: (_type, p) => p, jsxs: (_type, p) => p },
    sonner: { toast: { error() {}, info() {} } },
    "@/services/voice-moderation": {
      shouldApplyVoiceMove: (r, u, s, c, session) =>
        r.recipient_id === u &&
        r.server_id === s &&
        r.source_channel_id === c &&
        r.voice_session_id === session,
    },
    "@/hooks/use-audio-settings": { useAudioSettings: () => audio },
    "@/integrations/supabase/client": { supabase },
    "@/services/voice": {
      createVoiceProvider() {
        const provider = {
          disconnects: 0,
          async connect(_room, _user, callbacks) {
            this.mutedAtConnect = this.muted;
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
          setMuted(value) {
            this.muted = value;
          },
          setDeafened(value) {
            this.deafened = value;
          },
        };
        providers.push(provider);
        return provider;
      },
    },
  };
  const exports = {};
  const code = ts.transpileModule(
    fs.readFileSync(
      process.env.LOBBYX_VOICE_HOOK_FIXTURE ??
        new URL("../src/hooks/use-voice.tsx", import.meta.url),
      "utf8",
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  vm.runInNewContext(code, {
    exports,
    require: (name) => {
      if (name === "@/services/voice-diagnostics")
        return { voiceDiagnostic: () => {}, voiceStage: () => () => {} };
      assert.ok(name in imports, `Unexpected dependency ${name}`);
      return imports[name];
    },
    Date: class extends Date {
      static now() {
        return now;
      }
    },
    crypto: { randomUUID: () => Math.random().toString() },
    localStorage: { getItem: () => null },
    window: { addEventListener() {}, removeEventListener() {} },
    setTimeout: (callback, delay) => {
      timers.set(++timerId, callback);
      timerDelays.set(timerId, delay);
      return timerId;
    },
    clearTimeout: (id) => timers.delete(id),
    setInterval: (fn) => {
      const id = intervals.size + 1;
      intervals.set(id, fn);
      return id;
    },
    clearInterval: (id) => intervals.delete(id),
  });
  function render(serverId = props.serverId) {
    props = { ...props, serverId };
    let count = 0;
    do {
      dirty = false;
      cursor = 0;
      pending = [];
      value = exports.VoiceProviderRoot(props).value;
      pending.forEach((effect) => effect.cleanup());
      pending.forEach((effect) => effect.start());
      assert.ok(++count < 20, "render settles");
    } while (dirty);
    return value;
  }
  async function flush() {
    // Effects can initiate asynchronous release and then another effect render.
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < 12; i++) await Promise.resolve();
      render();
    }
  }
  render();
  return {
    render,
    advanceTime: (ms) => {
      now += ms;
    },
    flush,
    channels,
    providers,
    timers,
    timerDelays,
    moveChannels,
    intervals,
    missedRequests,
    restrictionRows,
    restrictionChannels,
    removals,
    failRestrictions: () => {
      restrictionFailure = true;
    },
  };
}

test("Sidebar keeps participant positions across reordered presence, speech and room moves", async () => {
  const f = fixture();
  const ch = f.channels[0];
  ch.subscribed("SUBSCRIBED");
  const member = (id, channel = "room-a") => ({
    user_id: id,
    channel_id: channel,
    voice_session_id: id + "-session",
    updated_at: 1,
    muted: false,
    speaking: false,
  });
  ch.snapshot = { nico: [member("nico")], ruan: [member("ruan")] };
  ch.events.sync();
  await f.flush();
  const ids = (room = "room-a") =>
    Array.from(f.render().participantsByChannel[room] ?? [], (p) => p.user_id);
  assert.deepEqual(ids(), ["nico", "ruan"]);
  for (let i = 0; i < 20; i++) {
    const nico = { ...member("nico"), updated_at: i + 2, speaking: i % 2 === 0 };
    const ruan = { ...member("ruan"), updated_at: i + 2, muted: i % 2 === 1 };
    ch.snapshot = i % 2 ? { nico: [nico], ruan: [ruan] } : { ruan: [ruan], nico: [nico] };
    ch.events.sync();
    await f.flush();
    assert.deepEqual(ids(), ["nico", "ruan"]);
    assert.equal(f.render().participantsByChannel["room-a"][0].speaking, nico.speaking);
  }
  ch.snapshot = { extra: [member("extra")], ruan: [member("ruan")], nico: [member("nico")] };
  ch.events.sync();
  await f.flush();
  assert.deepEqual(
    ids(),
    ["nico", "ruan", "extra"],
    "new users append without moving existing users",
  );
  ch.snapshot = {
    extra: [member("extra")],
    ruan: [member("ruan", "room-b")],
    nico: [member("nico")],
  };
  ch.events.sync();
  await f.flush();
  assert.deepEqual(ids(), ["nico", "extra"]);
  assert.deepEqual(ids("room-b"), ["ruan"]);
  ch.snapshot = { extra: [member("extra")], ruan: [member("ruan", null)], nico: [member("nico")] };
  ch.events.sync();
  await f.flush();
  assert.deepEqual(ids("room-b"), []);
});

test("Active call keeps local and remote positions through presence resync and speech", async () => {
  const f = fixture();
  const ch = f.channels[0];
  ch.subscribed("SUBSCRIBED");
  await f.render().join("room-a");
  await f.flush();
  const self = f.render().participantsByChannel["room-a"][0];
  const peer = {
    user_id: "peer",
    channel_id: "room-a",
    voice_session_id: "peer-session",
    updated_at: 1,
    speaking: false,
  };
  ch.snapshot = { peer: [peer], me: [{ ...self, channel_id: "room-a", updated_at: 1 }] };
  ch.events.sync();
  await f.flush();
  for (let i = 0; i < 20; i++) {
    ch.snapshot =
      i % 2
        ? { me: [{ ...self, channel_id: "room-a", updated_at: i + 2 }], peer: [peer] }
        : { peer: [peer] };
    ch.events.sync();
    f.providers[0].callbacks.onSpeakingChange(i % 2 === 0);
    await f.flush();
    assert.deepEqual(
      Array.from(f.render().participantsByChannel["room-a"], (p) => p.user_id),
      ["me", "peer"],
    );
  }
});

test("Speech bursts update indicators without sending Presence events", async () => {
  const f = fixture();
  f.channels[0].subscribed("SUBSCRIBED");
  await f.render().join("room-a");
  await f.flush();
  const before = f.channels[0].tracks.length;
  for (let i = 0; i < 100; i++) {
    f.providers[0].callbacks.onSpeakingChange(i % 2 === 0);
    f.render();
    await f.flush();
  }
  assert.equal(f.channels[0].tracks.length, before);
  assert.equal(f.timers.size, 0);
});

test("Recovery waits for cached topic removal before resubscribing, so old cleanup cannot close the new Presence", async () => {
  const f = fixture({ cacheTopics: true, delayedRemoval: true });
  const old = f.channels[0];
  old.subscribed("SUBSCRIBED");
  await f.render().join("room-a");
  await f.flush();
  old.subscribed("CLOSED");
  await f.flush();
  for (const callback of [...f.timers.values()]) callback();
  f.timers.clear();
  await f.flush();
  assert.equal(f.channels.length, 1, "must not reuse the channel awaiting removal");
  assert.equal(old.subscribeCalls, 1, "must not subscribe the cached old object again");
  assert.equal(f.removals.length, 1);
  assert.equal(f.providers[0].disconnects, 0);
  f.removals.shift()();
  await f.flush();
  const replacement = f.channels.at(-1);
  assert.notEqual(replacement, old);
  assert.equal(old.removed, true);
  replacement.subscribed("SUBSCRIBED");
  await f.flush();
  old.subscribed("CLOSED");
  await f.flush();
  assert.equal(replacement.removed, false);
  assert.equal(f.timers.size, 0, "old events cannot start a new recovery loop");
  assert.equal(f.render().connectionState, "connected");
});

test("Observer to active room handoff also waits for the cached topic to be released", async () => {
  const f = fixture({ cacheTopics: true, delayedRemoval: true });
  await f.render().join("room-a");
  f.render("b");
  const observer = f.channels.find((ch) => ch.topic === "voice:b");
  await f.render().join("room-b", "b");
  await f.flush();
  assert.equal(f.channels.filter((ch) => ch.topic === "voice:b").length, 1);
  for (const release of f.removals.splice(0)) release();
  await f.flush();
  const active = f.channels.filter((ch) => ch.topic === "voice:b").at(-1);
  assert.notEqual(active, observer);
  active.subscribed("SUBSCRIBED");
  await f.flush();
  assert.equal(active.tracks.at(-1).channel_id, "room-b");
  assert.equal(active.removed, false);
});

test("A successful publication cancels a recovery scheduled by a temporary failure", async () => {
  const f = fixture();
  const ch = f.channels[0];
  ch.subscribed("SUBSCRIBED");
  await f.render().join("room-a");
  await f.flush();
  ch.trackResult = "timed out";
  f.render().toggleMute();
  await f.flush();
  assert.equal(f.timers.size, 1);
  ch.trackResult = "ok";
  f.render().toggleMute();
  await f.flush();
  assert.equal(f.timers.size, 0);
  assert.equal(f.channels.length, 1);
  assert.equal(ch.removed, false);
});

test("Repeated publication failures back off instead of rebuilding every two seconds", async () => {
  const f = fixture();
  f.channels[0].trackResult = "timed out";
  f.channels[0].subscribed("SUBSCRIBED");
  await f.render().join("room-a");
  await f.flush();
  let [id, retry] = [...f.timers.entries()][0];
  assert.equal(f.timerDelays.get(id), 2000);
  f.timers.delete(id);
  retry();
  await f.flush();
  const next = f.channels.at(-1);
  assert.equal(f.channels.length, 1);
  [id] = [...f.timers.entries()][0];
  assert.equal(f.timerDelays.get(id), 4000);
  next.trackResult = "ok";
  // The normal heartbeat confirms recovery without opening another channel.
  for (const heartbeat of f.intervals.values()) heartbeat();
  await f.flush();
  assert.equal(f.timers.size, 0);
});

test("A direct room move shows the destination immediately while old media teardown is pending", async () => {
  const f = fixture();
  await f.render().join("room-a");
  await f.flush();
  let release;
  f.providers[0].disconnect = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  const moving = f.render().join("room-b");
  const value = f.render();
  assert.equal(value.activeChannelId, "room-b");
  assert.equal(value.connectionState, "connecting");
  assert.equal(value.participantsByChannel["room-b"].filter((p) => p.user_id === "me").length, 1);
  assert.equal(
    value.participantsByChannel["room-a"]?.some((p) => p.user_id === "me") ?? false,
    false,
  );
  release();
  await moving;
  await f.flush();
  assert.equal(f.render().connectionState, "connected");
});

test("A stalled Presence publication cannot block connecting to the next room", async () => {
  const f = fixture();
  const ch = f.channels[0];
  ch.subscribed("SUBSCRIBED");
  await f.render().join("room-a");
  await f.flush();
  let release;
  const originalTrack = ch.track.bind(ch);
  ch.track = async (payload, options) => {
    await originalTrack(payload, options);
    return new Promise((resolve) => {
      release = resolve;
    });
  };
  f.render().toggleMute();
  await f.flush();
  assert.ok(release);
  const moving = f.render().join("room-b");
  const finished = await Promise.race([
    moving.then(() => true),
    new Promise((resolve) => setImmediate(() => resolve(false))),
  ]);
  release("ok");
  ch.track = originalTrack;
  assert.equal(finished, true);
  assert.equal(f.render().activeChannelId, "room-b");
  assert.equal(f.render().connectionState, "connected");
  assert.equal(ch.trackOptions.timeout, 10000);
});

test("A delayed snapshot of the old room cannot duplicate or move the local participant back", async () => {
  const f = fixture();
  const ch = f.channels[0];
  ch.subscribed("SUBSCRIBED");
  await f.render().join("room-a");
  await f.flush();
  const oldSession = f.render().participantsByChannel["room-a"][0].voice_session_id;
  await f.render().join("room-b");
  ch.snapshot = {
    me: [
      { user_id: "me", channel_id: "room-a", voice_session_id: oldSession, updated_at: Date.now() },
    ],
  };
  ch.events.sync();
  await f.flush();
  const rooms = f.render().participantsByChannel;
  assert.equal(rooms["room-b"].filter((p) => p.user_id === "me").length, 1);
  assert.equal(rooms["room-a"]?.some((p) => p.user_id === "me") ?? false, false);
});

test("Rapid A to B to A discards the superseded join and keeps only the final local slot", async () => {
  const f = fixture();
  await f.render().join("room-a");
  await f.flush();
  let release;
  f.providers[0].disconnect = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  const first = f.render().join("room-b");
  f.render();
  const last = f.render().join("room-a");
  assert.equal(f.render().activeChannelId, "room-a");
  release();
  await Promise.all([first, last]);
  await f.flush();
  assert.equal(f.providers.length, 2);
  assert.equal(
    f.render().participantsByChannel["room-a"].filter((p) => p.user_id === "me").length,
    1,
  );
  assert.equal(
    f.render().participantsByChannel["room-b"]?.some((p) => p.user_id === "me") ?? false,
    false,
  );
  await f.render().leave();
  await f.render().join("room-b");
  assert.equal(f.render().activeChannelId, "room-b");
});

test("An idle observer stays registered without becoming a voice participant and sees room moves", async () => {
  const f = fixture();
  const channel = f.channels[0];
  channel.subscribed("SUBSCRIBED");
  await f.flush();
  assert.equal(channel.tracks.at(-1).channel_id, null);
  assert.equal(f.providers.length, 0);
  const remote = {
    user_id: "other",
    voice_session_id: "live",
    channel_id: "room-a",
    updated_at: 10,
  };
  channel.snapshot = { other: [remote, { user_id: "other", channel_id: null, updated_at: 30 }] };
  channel.events.sync();
  await f.flush();
  assert.equal(f.render().participantsByChannel["room-a"][0].user_id, "other");
  channel.snapshot = {
    other: [{ ...remote, channel_id: "room-b", updated_at: 40 }],
    oldSocket: [{ ...remote, updated_at: 10 }],
  };
  channel.events.sync();
  await f.flush();
  assert.equal(f.render().participantsByChannel["room-a"], undefined);
  assert.equal(f.render().participantsByChannel["room-b"].length, 1);
  assert.equal(f.providers.length, 0);
});

test("A closed observer subscription is recreated without joining a call", async () => {
  const f = fixture();
  const old = f.channels[0];
  old.subscribed("SUBSCRIBED");
  await f.flush();
  old.subscribed("CLOSED");
  for (const callback of [...f.timers.values()]) callback();
  await f.flush();
  const replacement = f.channels.at(-1);
  assert.notEqual(replacement, old);
  assert.equal(old.removed, true);
  replacement.subscribed("SUBSCRIBED");
  replacement.snapshot = { remote: [{ user_id: "other", channel_id: "room-b" }] };
  replacement.events.sync();
  await f.flush();
  assert.equal(f.render().participantsByChannel["room-b"][0].user_id, "other");
  old.subscribed("CLOSED");
  assert.equal(f.providers.length, 0);
});

test("A failed occupancy publication retries the same subscription, keeping the call alive", async () => {
  const f = fixture();
  f.channels[0].subscribed("SUBSCRIBED");
  await f.render().join("room-a");
  await f.flush();
  f.channels[0].trackResult = "timed out";
  f.render().toggleMute();
  await f.flush();
  for (const callback of [...f.timers.values()]) callback();
  await f.flush();
  assert.equal(f.providers[0].disconnects, 0);
  assert.equal(f.channels.length, 1);
  assert.equal(f.channels[0].removed, false);
  f.channels[0].trackResult = "ok";
  for (const callback of [...f.timers.values()]) callback();
  await f.flush();
  assert.equal(f.channels[0].tracks.at(-1).channel_id, "room-a");
});

test("Browsing a second server recovers its observer without moving the active call", async () => {
  const f = fixture();
  f.channels[0].subscribed("SUBSCRIBED");
  await f.render().join("room-a");
  await f.flush();
  f.render("b");
  await f.flush();
  const observer = f.channels.at(-1);
  observer.subscribed("SUBSCRIBED");
  observer.snapshot = { other: [{ user_id: "other", channel_id: "room-b" }] };
  observer.events.sync();
  await f.flush();
  assert.equal(observer.tracks.at(-1).channel_id, null);
  observer.subscribed("TIMED_OUT");
  for (const callback of [...f.timers.values()]) callback();
  await f.flush();
  const replacement = f.channels.at(-1);
  assert.notEqual(replacement, observer);
  assert.equal(f.render().participantsByChannel["room-b"][0].user_id, "other");
  replacement.subscribed("SUBSCRIBED");
  replacement.snapshot = { other: [{ user_id: "other", channel_id: "room-b" }] };
  replacement.events.sync();
  await f.flush();
  assert.equal(f.render().participantsByChannel["room-b"][0].user_id, "other");
  assert.equal(f.render().activeChannelId, "room-a");
  assert.equal(f.providers[0].disconnects, 0);
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

test("A server observer receives occupied rooms without capturing a microphone", async () => {
  const f = fixture();
  const ch = f.channels[0];
  ch.snapshot = {
    peer: [
      {
        user_id: "peer",
        channel_id: "room-a",
        voice_session_id: "peer-session",
        speaking: false,
        muted: false,
        deafened: false,
      },
    ],
  };
  ch.subscribed("SUBSCRIBED");
  await f.flush();
  assert.equal(f.render().participantsByChannel["room-a"][0].user_id, "peer");
  assert.equal(f.providers.length, 0);
  assert.ok(ch.sent.some((e) => e.event === "occupancy-refresh"));
  ch.snapshot = {};
  ch.events.sync();
  await f.flush();
  assert.equal(f.render().participantsByChannel["room-a"].length, 1);
  f.advanceTime(31000);
  ch.events.sync();
  await f.flush();
  assert.equal(f.render().participantsByChannel["room-a"], undefined);
});

test("Moving a live participant replaces media and keeps the original server while browsing", async () => {
  const f = fixture();
  f.channels[0].subscribed("SUBSCRIBED");
  await f.render().join("room-a");
  await f.flush();
  const session = f
    .render()
    .participantsByChannel["room-a"].find((p) => p.user_id === "me").voice_session_id;
  f.render("b");
  f.moveChannels[0].events.INSERT({
    new: {
      id: "move",
      recipient_id: "me",
      server_id: "a",
      source_channel_id: "room-a",
      destination_channel_id: "room-new",
      voice_session_id: session,
    },
  });
  await f.flush();
  assert.equal(f.render().activeServerId, "a");
  assert.equal(f.render().activeChannelId, "room-new");
  assert.equal(f.providers.length, 2);
  assert.equal(f.providers[0].disconnects, 1);
});

test("A capture stopped before startup completes does not resurrect screen sharing", async () => {
  const f = fixture();
  await f.render().join("room-a");
  await f.flush();
  f.providers[0].startScreenShare = async () => {
    f.providers[0].callbacks.onLocalMedia({ camera: null, screen: null });
  };
  await f.render().toggleScreenShare();
  await f.flush();
  assert.equal(f.render().screenOn, false);
});

test("A stopped remote capture clears a stale sharing presence badge", async () => {
  const f = fixture();
  await f.render().join("room-a");
  await f.flush();
  const ch = f.channels[0];
  ch.snapshot = { peer: [{ user_id: "peer", channel_id: "room-a", screen: true }] };
  ch.events.sync();
  await f.flush();
  f.providers[0].callbacks.onRemoteMedia({ peer: { audio: {}, camera: null, screen: null } });
  assert.equal(
    f.render().participantsByChannel["room-a"].find((p) => p.user_id === "peer").screen,
    false,
  );
});

test("Watching in a specific server joins with microphone muted even while browsing another", async () => {
  const f = fixture();
  f.render("b");
  await f.render().join("room-a", "a", true);
  await f.flush();
  assert.equal(f.render().activeServerId, "a");
  assert.equal(f.render().muted, true);
  assert.equal(
    f.render().participantsByChannel["room-a"].find((p) => p.user_id === "me").muted,
    true,
  );
});

test("Server mute is enforced before capture, survives room changes, and cannot be removed by the member", async () => {
  const f = fixture();
  f.restrictionRows.push({ server_id: "a", user_id: "me", muted: true, deafened: false });
  await f.render().join("voice-a");
  await f.flush();
  assert.equal(f.providers[0].mutedAtConnect, true);
  assert.equal(f.render().muted, true);
  f.render().toggleMute();
  await f.flush();
  assert.equal(f.render().muted, true);
  await f.render().join("voice-b");
  await f.flush();
  assert.equal(f.providers.at(-1).mutedAtConnect, true);
  f.restrictionRows[0].muted = false;
  f.restrictionChannels.at(-1).events["*"]({});
  await f.flush();
  assert.equal(f.render().muted, false);
  assert.equal(f.providers.at(-1).muted, false);
});
test("Server deafen blocks member audio and microphone until an administrator clears it", async () => {
  const f = fixture();
  await f.render().join("voice-a");
  await f.flush();
  f.restrictionRows.push({ server_id: "a", user_id: "me", muted: false, deafened: true });
  f.restrictionChannels.at(-1).events["*"]({});
  await f.flush();
  assert.equal(f.render().deafened, true);
  assert.equal(f.render().muted, true);
  f.render().toggleDeafen();
  f.render().toggleMute();
  await f.flush();
  assert.equal(f.render().deafened, true);
  f.restrictionRows[0].deafened = false;
  f.restrictionChannels.at(-1).events["*"]({});
  await f.flush();
  assert.equal(f.render().deafened, false);
  assert.equal(f.render().muted, false);
});
test("Disconnect targets only the live session and tears down media and presence", async () => {
  const f = fixture();
  await f.render().join("voice-a");
  await f.flush();
  const session = f.render().participantsByChannel["voice-a"][0].voice_session_id;
  const request = {
    id: "disconnect",
    recipient_id: "me",
    server_id: "a",
    source_channel_id: "voice-a",
    voice_session_id: session,
    action: "disconnect",
    destination_channel_id: null,
  };
  f.moveChannels[0].events.INSERT({ new: { ...request, voice_session_id: "old" } });
  await f.flush();
  assert.equal(f.render().activeChannelId, "voice-a");
  f.moveChannels[0].events.INSERT({ new: request });
  await f.flush();
  assert.equal(f.render().activeChannelId, null);
  assert.equal(f.providers[0].disconnects, 1);
});
test("A failed moderation lookup cleans up and never publishes an unprotected microphone", async () => {
  const f = fixture();
  f.failRestrictions();
  await f.render().join("voice-a");
  await f.flush();
  assert.equal(f.render().activeChannelId, null);
  assert.equal(f.providers[0].callbacks, undefined);
  assert.equal(f.providers[0].disconnects, 1);
  assert.equal(f.render().connectionState, "error");
});

test("A missed realtime command is recovered while in call and applied without a confirmation", async () => {
  const f = fixture();
  await f.render().join("room-a");
  await f.flush();
  const session = f.render().participantsByChannel["room-a"][0].voice_session_id;
  f.missedRequests.push({
    id: "missed",
    recipient_id: "me",
    server_id: "a",
    source_channel_id: "room-a",
    destination_channel_id: "room-b",
    voice_session_id: session,
  });
  for (const fn of f.intervals.values()) fn();
  await f.flush();
  await f.flush();
  assert.equal(f.render().activeChannelId, "room-b");
});

test("Idle heartbeats and refresh requests do not repeatedly track an unchanged occupied room", async () => {
  const f = fixture();
  const ch = f.channels[0];
  ch.subscribed("SUBSCRIBED");
  await f.render().join("room-a");
  await f.flush();
  ch.snapshot = { me: [ch.tracks.at(-1)] };
  ch.events.sync();
  await f.flush();
  const before = ch.tracks.length;
  const beforeOccupancy = f.render().participantsByChannel;
  for (let i = 0; i < 60; i++) {
    for (const fn of f.intervals.values()) fn();
    ch.events["occupancy-refresh"]();
    await f.flush();
  }
  assert.equal(ch.tracks.length, before);
  assert.equal(f.channels.length, 1);
  assert.equal(
    f.render().participantsByChannel,
    beforeOccupancy,
    "Unchanged sweeps retain context identity",
  );
});

test("Missing occupancy is retained across recovery but room moves and session departure apply immediately", async () => {
  const f = fixture();
  const ch = f.channels[0];
  ch.subscribed("SUBSCRIBED");
  await f.flush();
  const peer = {
    user_id: "peer",
    voice_session_id: "peer-session",
    channel_id: "room-a",
    updated_at: 10,
  };
  ch.snapshot = { peer: [peer] };
  ch.events.sync();
  await f.flush();
  ch.snapshot = {};
  ch.events.sync();
  await f.flush();
  f.advanceTime(15000);
  ch.events.sync();
  await f.flush();
  assert.equal(f.render().participantsByChannel["room-a"][0].user_id, "peer");
  ch.snapshot = { peer: [{ ...peer, channel_id: "room-b", updated_at: 20 }] };
  ch.events.sync();
  await f.flush();
  assert.equal(f.render().participantsByChannel["room-a"], undefined);
  assert.equal(f.render().participantsByChannel["room-b"].length, 1);
  ch.snapshot = { peer: [{ ...peer, channel_id: null, updated_at: 30 }] };
  ch.events.sync();
  await f.flush();
  assert.equal(f.render().participantsByChannel["room-b"], undefined);
});
