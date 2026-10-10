import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { loadVoiceProvider } from "./audio/pipeline-fixture.mjs";
function fixture() {
  const timers = new Map();
  let next = 0;
  const clock = {
    setTimeout: (f) => {
      timers.set(++next, f);
      return next;
    },
    clearTimeout: (id) => timers.delete(id),
  };
  const env = { exports: {}, Promise, DOMException, ...clock };
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(new URL("../src/services/microphone-request.ts", import.meta.url), "utf8"),
      { compilerOptions: { module: ts.ModuleKind.CommonJS } },
    ).outputText,
    env,
  );
  return { ...clock, timers, request: env.exports.requestMicrophone };
}
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
test("Cancellation before acquisition is scheduled never opens a new permission prompt", async () => {
  const f = fixture();
  let requests = 0;
  const r = f.request(() => {
    requests++;
    return new Promise(() => {});
  });
  const rejected = assert.rejects(r.promise, (e) => e.name === "AbortError");
  r.cancel();
  await rejected;
  await flush();
  assert.equal(requests, 0);
});
test("Unanswered microphone permission rejects with TimeoutError and late grant releases all tracks", async () => {
  const f = fixture();
  let grant;
  const r = f.request(
    () =>
      new Promise((resolve) => {
        grant = resolve;
      }),
  );
  const rejected = assert.rejects(r.promise, (e) => e.name === "TimeoutError");
  await flush();
  [...f.timers.values()][0]();
  await rejected;
  let stops = 0;
  grant({
    getTracks: () => [
      {
        stop() {
          stops++;
        },
      },
      {
        stop() {
          stops++;
        },
      },
    ],
  });
  await flush();
  assert.equal(stops, 2);
});
test("Leaving while permission is pending cancels without waiting for the native prompt", async () => {
  const f = fixture();
  const r = f.request(() => new Promise(() => {}));
  const rejected = assert.rejects(r.promise, (e) => e.name === "AbortError");
  r.cancel();
  r.cancel();
  await rejected;
  assert.equal(f.timers.size, 0);
});
test("A grant after cancellation is stopped rather than published into the next call", async () => {
  const f = fixture();
  let grant;
  const r = f.request(
    () =>
      new Promise((resolve) => {
        grant = resolve;
      }),
  );
  const rejected = assert.rejects(r.promise, (e) => e.name === "AbortError");
  await flush();
  r.cancel();
  await rejected;
  let stopped = false;
  grant({
    getTracks: () => [
      {
        stop() {
          stopped = true;
        },
      },
    ],
  });
  await flush();
  assert.equal(stopped, true);
});
test("Permission denial preserves its error and clears the watchdog", async () => {
  const f = fixture();
  const error = new DOMException("private browser message", "NotAllowedError");
  const r = f.request(() => Promise.reject(error));
  await assert.rejects(r.promise, (e) => e === error);
  assert.equal(f.timers.size, 0);
});
test("Successful grant clears watchdog and cancellation cannot stop the active stream", async () => {
  const f = fixture();
  let stopped = false;
  const stream = {
    getTracks: () => [
      {
        stop() {
          stopped = true;
        },
      },
    ],
  };
  const r = f.request(async () => stream);
  assert.equal(await r.promise, stream);
  assert.equal(f.timers.size, 0);
  r.cancel();
  assert.equal(stopped, false);
});
test("Provider disconnect unblocks its pending connect, without publishing signaling or media", async () => {
  let grant;
  const states = [];
  const provider = loadVoiceProvider(
    {},
    {
      navigator: {
        mediaDevices: {
          getUserMedia: () =>
            new Promise((resolve) => {
              grant = resolve;
            }),
        },
      },
    },
  );
  const connected = provider.connect("technical-room", "technical-user", {
    onStateChange: (s) => states.push(s),
  });
  const rejected = assert.rejects(connected, (e) => e.name === "AbortError");
  await flush();
  await provider.disconnect();
  await rejected;
  assert.equal(provider.peers.size, 0);
  assert.equal(provider.signaling, null);
  assert.deepEqual(states, ["connecting"]);
  let stopped = false;
  grant({
    getTracks: () => [
      {
        stop() {
          stopped = true;
        },
      },
    ],
  });
  await flush();
  assert.equal(stopped, true);
  assert.equal(provider.micStream, null);
});
