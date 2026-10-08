import test from "node:test";
import assert from "node:assert/strict";
import { maintainPresence } from "../src/services/presence-connection.ts";
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
function fixture() {
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
        async track() {
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
  t.mock.timers.tick(2000);
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
  t.mock.timers.tick(2000);
  await flush();
  assert.equal(f.channels.length, 2);
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
