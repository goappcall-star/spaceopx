import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
function fixture() {
  const timers = new Map();
  let id = 0;
  const environment = {
    exports: {},
    DOMException,
    Date,
    document: { hidden: false },
    setTimeout(fn, delay) {
      const key = ++id;
      timers.set(key, { fn, delay });
      return key;
    },
    clearTimeout(key) {
      timers.delete(key);
    },
  };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync("src/services/screen-share.ts", "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    environment,
  );
  const api = environment.exports,
    controller = new api.ScreenShareController();
  const track = {
    readyState: "live",
    contentHint: "",
    getSettings: () => ({ width: 1920, height: 1080, frameRate: 30 }),
    applyConstraints: async () => {},
  };
  const changes = [];
  let stats = new Map();
  const sender = {
    track,
    getParameters: () => ({ transactionId: "preserve", encodings: [{ rid: "original" }] }),
    setParameters: async (value) => {
      changes.push(value);
    },
    getStats: async () => stats,
  };
  return {
    ...api,
    environment,
    controller,
    timers,
    track,
    sender,
    changes,
    setStats: (value) => {
      stats = new Map(value.map((x) => [x.id, x]));
    },
  };
}
const options = { resolution: 1440, fps: 60, mode: "auto", audio: true };
test("All 9 resolution/FPS combinations use valid display constraints without exact/min or upscaling", () => {
  const f = fixture();
  for (const resolution of [720, 1080, 1440])
    for (const fps of [15, 30, 60]) {
      const c = f.screenConstraints({ ...options, resolution, fps });
      assert.equal(c.frameRate.ideal, fps);
      assert.equal(c.frameRate.max, fps);
      assert.equal(c.height.max, resolution);
      assert.equal(c.width.max, Math.round((resolution * 16) / 9));
      assert.ok(!JSON.stringify(c).includes("exact"));
      assert.ok(f.screenBitrate({ ...options, resolution, fps }) > 0);
    }
});
test("Requested 60 FPS is distinct from reported capture and encoded FPS; counters compute actual bitrate/loss", async () => {
  const f = fixture();
  f.controller.start(f.track, options, true);
  f.controller.attach(f.sender);
  assert.equal(f.controller.getSnapshot().capture.fps, 30);
  assert.equal(f.controller.getSnapshot().requested.fps, 60);
  const report = (time, bytes, frames, lost, received) => [
    {
      id: "out",
      type: "outbound-rtp",
      kind: "video",
      timestamp: time,
      bytesSent: bytes,
      framesEncoded: frames,
      frameWidth: 1280,
      frameHeight: 720,
      remoteId: "remote",
      codecId: "codec",
    },
    {
      id: "remote",
      type: "remote-inbound-rtp",
      packetsLost: lost,
      packetsReceived: received,
      roundTripTime: 0.1,
    },
    { id: "codec", type: "codec", mimeType: "video/VP8" },
  ];
  f.setStats(report(1000, 1000, 10, 0, 100));
  await f.controller.sample();
  f.setStats(report(5000, 501000, 90, 2, 198));
  await f.controller.sample();
  const stats = f.controller.getSnapshot().peers[0];
  assert.equal(stats.fps, 20);
  assert.equal(stats.bitrate, 1_000_000);
  assert.equal(stats.loss, 0.02);
  assert.equal(stats.codec, "video/VP8");
  assert.equal(f.changes[0].transactionId, "preserve");
  assert.equal(f.changes[0].encodings[0].rid, "original");
  f.controller.stop();
});
test("Quality changes serialize without replacing tracks and preserve capture audio choice", async () => {
  const f = fixture();
  const applied = [];
  f.track.applyConstraints = async (c) => applied.push(c);
  f.controller.start(f.track, options, true);
  f.controller.attach(f.sender);
  await Promise.all([
    f.controller.update({ ...options, resolution: 720, fps: 15, audio: false }),
    f.controller.update({ ...options, resolution: 1080, fps: 30 }),
  ]);
  assert.equal(applied.length, 2);
  assert.equal(f.sender.track, f.track);
  assert.equal(f.track.readyState, "live");
  assert.equal(f.controller.getSnapshot().requested.audio, true);
  assert.equal(f.controller.getSnapshot().requested.fps, 30);
  f.controller.stop();
});
test("Rejected live constraints leave previous quality, active track and audio intact", async () => {
  const f = fixture();
  f.controller.start(f.track, options, true);
  f.track.applyConstraints = async () => {
    throw new DOMException("unsupported", "OverconstrainedError");
  };
  await assert.rejects(f.controller.update({ ...options, fps: 15 }));
  assert.equal(f.controller.getSnapshot().requested.fps, 60);
  assert.equal(f.controller.getSnapshot().active, true);
  assert.equal(f.controller.getSnapshot().capture.audio, true);
  f.controller.stop();
});
test("Adaptation has hysteresis, cooldown and independent peer factors; missing data never upgrades", () => {
  const f = fixture();
  const a = { factor: 1, bad: 0, good: 0, changed: 0 },
    b = { ...a };
  const bad = { status: "sending", loss: 0.1, rtt: 0.4, limitation: "bandwidth" };
  f.adaptScreenLink(a, bad, "auto", 20000);
  assert.equal(a.factor, 1);
  f.adaptScreenLink(a, bad, "auto", 24000);
  assert.equal(a.factor, 0.75);
  assert.equal(b.factor, 1);
  f.adaptScreenLink(a, bad, "auto", 28000);
  assert.equal(a.factor, 0.75);
  f.adaptScreenLink(
    b,
    { status: "sending", loss: null, rtt: null, limitation: null },
    "auto",
    30000,
  );
  assert.equal(b.good, 0);
  for (let i = 0; i < 3; i++)
    f.adaptScreenLink(
      a,
      { status: "sending", loss: 0, rtt: 0.05, limitation: "none" },
      "auto",
      40000 + i * 4000,
    );
  assert.ok(a.factor > 0.75 && a.factor <= 1);
});
test("Sampling is absent while idle, spaced during transmission and stopped on teardown", async () => {
  const f = fixture();
  assert.equal(f.timers.size, 0);
  f.controller.start(f.track, { ...options, mode: "performance" }, false);
  assert.equal(f.timers.size, 0);
  f.controller.attach(f.sender);
  assert.equal(f.timers.size, 1);
  assert.equal([...f.timers.values()][0].delay, 8000);
  f.controller.stop();
  assert.equal(f.timers.size, 0);
  assert.equal(f.controller.getSnapshot().peers.length, 0);
  assert.equal(f.controller.getSnapshot().active, false);
});
test("Unsupported sender parameters and stats failures never stop capture", async () => {
  const f = fixture();
  f.sender.setParameters = async () => {
    throw Error("unsupported");
  };
  f.sender.getStats = async () => {
    throw Error("closed");
  };
  f.controller.start(f.track, options, false);
  f.controller.attach(f.sender);
  await f.controller.sample();
  assert.equal(f.controller.getSnapshot().active, true);
  assert.equal(f.controller.getSnapshot().peers[0].status, "unavailable");
  f.controller.stop();
});
test("Pending constraints cannot resurrect an ended share", async () => {
  const f = fixture();
  let done;
  f.track.applyConstraints = () => new Promise((r) => (done = r));
  f.controller.start(f.track, options, true);
  const pending = f.controller.update({ ...options, fps: 15 });
  await Promise.resolve();
  f.controller.stop();
  done();
  await pending;
  assert.equal(f.controller.getSnapshot().active, false);
  assert.equal(f.timers.size, 0);
});

test("Optional encoding hints retry with fresh transaction and portable controls", async () => {
  const f = fixture();
  let transaction = 0,
    calls = 0;
  f.sender.getParameters = () => ({
    transactionId: String(++transaction),
    encodings: [{ rid: "preserved" }],
  });
  f.sender.setParameters = async (params) => {
    calls++;
    if (params.degradationPreference) throw Error("unsupported hint");
    assert.equal(params.transactionId, "2");
    assert.equal(params.encodings[0].rid, "preserved");
    assert.equal(params.encodings[0].maxFramerate, 60);
  };
  f.controller.start(f.track, options, false);
  f.controller.attach(f.sender);
  await f.controller.sample();
  assert.equal(calls, 2);
  assert.equal(f.controller.getSnapshot().warning, null);
  f.controller.stop();
});
