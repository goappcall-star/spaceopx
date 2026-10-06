import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Exercise the actual provider with deterministic hooks, signaling and media.
function fixture() {
  const timers = new Map();
  const intervals = new Map(),
    missedRequests = [];
  const restrictionRows = [],
    restrictionChannels = [];
  let restrictionFailure = false;
  let timerId = 0;
  let cursor = 0,
    pending = [],
    dirty = false,
    value,
    props = { serverId: "a", userId: "me" };
  const slots = [],
    channels = [],
    moveChannels = [],
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
        events: {},
        snapshot: {},
        sent: [],
        removed: false,
        on(kind, filter, handler) {
          this.events[filter.event] = handler;
          return this;
        },
        subscribe(fn) {
          this.subscribed = fn;
          return this;
        },
        presenceState() {
          return this.snapshot;
        },
        async send(event) {
          this.sent.push(event);
        },
        async track(payload) {
          this.tracks.push(payload);
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
    fs.readFileSync(new URL("../src/hooks/use-voice.tsx", import.meta.url), "utf8"),
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
  return {
    render,
    flush,
    channels,
    providers,
    timers,
    moveChannels,
    intervals,
    missedRequests,
    restrictionRows,
    restrictionChannels,
    failRestrictions: () => {
      restrictionFailure = true;
    },
  };
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
