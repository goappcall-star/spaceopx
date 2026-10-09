import test from "node:test";
import assert from "node:assert/strict";
import { maintainPresence } from "../src/services/presence-connection.ts";
import { createClient } from "@supabase/supabase-js";

test("The installed Supabase SDK caches a topic until its pending removal completes", async () => {
  const client = createClient("https://example.invalid", "public-test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { timeout: 10 },
  });
  const old = client.channel("voice:test");
  const unsubscribe = old.unsubscribe.bind(old);
  let release;
  old.unsubscribe = async () => {
    await new Promise((resolve) => {
      release = resolve;
    });
    return unsubscribe(1);
  };
  const removing = client.removeChannel(old);
  assert.equal(client.channel("voice:test"), old);
  release();
  await removing;
  assert.notEqual(client.channel("voice:test"), old);
  await client.removeAllChannels();
});
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
function fixture(options = {}) {
  const channels = [];
  const removed = [];
  let online = 0,
    offline = 0;
  const manager = maintainPresence({
    create: () => {
      const ch = {
        result: "ok",
        on() {
          return this;
        },
        subscribe(fn) {
          this.event = fn;
          return this;
        },
        tracks: [],
        async track(payload) {
          this.tracks.push(payload);
          return this.result;
        },
        async untrack() {},
      };
      channels.push(ch);
      return ch;
    },
    remove: async (ch) => {
      removed.push(ch);
    },
    payload: () => ({}),
    available: () => true,
    connected: () => online++,
    disconnected: () => offline++,
    sync: () => {},
    ...options,
  });
  return { manager, channels, removed, online: () => online, offline: () => offline };
}
test("A closed channel is replaced and can confirm presence again", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture();
  await f.manager.start();
  f.channels[0].event("SUBSCRIBED");
  await flush();
  assert.equal(f.online(), 1);
  f.channels[0].event("CLOSED");
  t.mock.timers.tick(30000);
  await flush();
  assert.equal(f.channels.length, 2);
  assert.equal(f.removed[0], f.channels[0]);
  f.channels[0].event("SUBSCRIBED");
  await flush();
  assert.equal(f.online(), 1);
  f.channels[1].event("SUBSCRIBED");
  await flush();
  assert.equal(f.online(), 2);
  await f.manager.stop();
});
test("A failed presence announcement does not falsely report online", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture();
  await f.manager.start();
  f.channels[0].result = "timed out";
  f.channels[0].event("SUBSCRIBED");
  await flush();
  assert.equal(f.online(), 0);
  assert.ok(f.offline() > 0);
  t.mock.timers.tick(30000);
  await flush();
  assert.equal(f.channels.length, 1);
  await f.manager.stop();
});
test("Leaving cancels retries and ignores late connection events", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture();
  await f.manager.start();
  f.channels[0].event("CHANNEL_ERROR");
  await f.manager.stop();
  t.mock.timers.tick(60000);
  await flush();
  f.channels[0].event("SUBSCRIBED");
  await flush();
  assert.equal(f.channels.length, 1);
  assert.equal(f.online(), 0);
});

test("Unchanged status/game polls do not create Presence traffic, real changes and reconnect still publish", async () => {
  let status = "online",
    clock = 0;
  const f = fixture({ payload: () => ({ status, at: ++clock }), payloadKey: () => status });
  await f.manager.start();
  f.channels[0].event("SUBSCRIBED");
  await flush();
  for (let i = 0; i < 100; i++) {
    f.manager.track();
    await flush();
  }
  assert.equal(f.channels[0].tracks.length, 1);
  status = "dnd";
  f.manager.track();
  await flush();
  assert.equal(f.channels[0].tracks.length, 2);
  f.channels[0].event("SUBSCRIBED");
  await flush();
  assert.equal(f.channels[0].tracks.length, 3);
  await f.manager.stop();
});

test("A status change during an in-flight publication is coalesced and not lost", async () => {
  let status = "online",
    release;
  const f = fixture({ payload: () => ({ status }), payloadKey: () => status });
  await f.manager.start();
  f.channels[0].track = async (payload) => {
    f.channels[0].tracks.push(payload);
    if (payload.status === "online")
      await new Promise((resolve) => {
        release = resolve;
      });
    return "ok";
  };
  f.channels[0].event("SUBSCRIBED");
  await flush();
  status = "dnd";
  f.manager.track();
  release();
  await flush();
  assert.deepEqual(
    f.channels[0].tracks.map((p) => p.status),
    ["online", "dnd"],
  );
  await f.manager.stop();
});

test("Returning online republishes unchanged presence and ignores an offline stale acknowledgement", async () => {
  let available = true,
    release;
  const f = fixture({ available: () => available, payloadKey: () => "online" });
  await f.manager.start();
  f.channels[0].track = async (payload) => {
    f.channels[0].tracks.push(payload);
    if (f.channels[0].tracks.length === 1)
      await new Promise((resolve) => {
        release = resolve;
      });
    return "ok";
  };
  f.channels[0].event("SUBSCRIBED");
  await flush();
  available = false;
  f.manager.offline();
  release();
  await flush();
  assert.equal(f.online(), 0);
  available = true;
  f.manager.track();
  await flush();
  assert.equal(f.channels[0].tracks.length, 2);
  available = false;
  f.manager.offline();
  available = true;
  f.manager.track();
  await flush();
  assert.equal(f.channels[0].tracks.length, 3);
  await f.manager.stop();
});
