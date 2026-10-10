import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { loadVoiceProvider } from "./audio/pipeline-fixture.mjs";
import {
  MetricStore,
  BOUNDS,
  MAX_ROWS,
  RETENTION,
  aggregate,
  AlertEvaluator,
} from "../src/services/performance/core.mjs";
const require = createRequire(import.meta.url);
const { installPerformance } = require("../desktop/performance.cjs");
function load(file, imports, globals = {}) {
  const exports = {};
  const source = fs
    .readFileSync(new URL("../src/" + file, import.meta.url), "utf8")
    .replaceAll("import.meta.env", "({})");
  vm.runInNewContext(
    ts.transpileModule(source, {
      fileName: file,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    {
      exports,
      require: (name) => {
        assert.ok(name in imports, name);
        return imports[name];
      },
      ...globals,
    },
  );
  return exports;
}
test("authorization fails closed for missing RPC, rejected request and non-boolean data", async () => {
  for (const response of [
    { data: true, error: null },
    { data: false, error: null },
    { data: "true", error: null },
    { data: true, error: Error("unavailable") },
  ]) {
    const api = load("services/performance/access.ts", {
      "@/integrations/supabase/client": { supabase: { rpc: async () => response } },
    });
    assert.equal(await api.isPerformanceAdmin(), response.data === true && !response.error);
  }
  const api = load("services/performance/access.ts", {
    "@/integrations/supabase/client": {
      supabase: {
        rpc: async () => {
          throw Error("offline");
        },
      },
    },
  });
  assert.equal(await api.isPerformanceAdmin(), false);
});
test("protected route redirects denied administrators before rendering", async () => {
  for (const allowed of [false, true]) {
    const api = load("routes/_authenticated/performance-monitor.tsx", {
      "@tanstack/react-router": {
        createFileRoute: () => (options) => options,
        redirect: (options) => ({ denied: true, ...options }),
      },
      react: {},
      "react/jsx-runtime": {},
      "@/services/performance/access": { isPerformanceAdmin: async () => allowed },
      "@/services/performance/monitor": {},
      "@/components/performance/PerformanceMonitorPanel": {},
    });
    if (allowed) await api.Route.beforeLoad();
    else
      await assert.rejects(api.Route.beforeLoad(), (error) => error.denied && error.to === "/app");
  }
});
test("Realtime instrumentation preserves callback and chaining; repeated subscribed status is not a reconnect", () => {
  let notify;
  const records = [],
    callbacks = [];
  const channel = {
    subscribe: (callback) => {
      notify = callback;
      return channel;
    },
  };
  const api = load(
    "integrations/supabase/client.ts",
    {
      "@supabase/supabase-js": { createClient: () => ({ channel: () => channel }) },
      "./previewAuthStorage": { brokeredPreviewStorage: () => ({}) },
      "@/lib/supabase-key-policy.mjs": {
        assertPublicSupabaseKey: () => {},
        assertSupabaseUrl: () => {},
      },
      "@/lib/realtime-rollout.mjs": { realtimeChannelOptions: (options) => options },
      "@/services/performance/monitor": {
        monitoredFetch: () => {},
        recordMetric: (...args) => records.push(args),
      },
    },
    {
      process: {
        env: {
          SUPABASE_URL: "https://example.invalid",
          SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
        },
      },
    },
  );
  assert.equal(
    api.supabase.channel("private-room-identity").subscribe((status) => callbacks.push(status)),
    channel,
  );
  for (const status of ["SUBSCRIBED", "SUBSCRIBED", "TIMED_OUT", "SUBSCRIBED"]) notify(status);
  assert.deepEqual(callbacks, ["SUBSCRIBED", "SUBSCRIBED", "TIMED_OUT", "SUBSCRIBED"]);
  assert.equal(records.filter(([name]) => name === "realtime.reconnect").length, 1);
  assert.equal(records.filter(([name]) => name === "realtime.failure").length, 1);
  assert.ok(!JSON.stringify(records).includes("identity"));
});
test("finishing an operation from an earlier collection generation cannot contaminate a new session", async () => {
  const core = await import("../src/services/performance/core.mjs");
  let time = 0;
  const api = load(
    "services/performance/monitor.ts",
    { "./core.mjs": core },
    {
      window: {},
      document: { documentElement: { dataset: {} } },
      performance: { now: () => ++time },
    },
  );
  api.metrics.enabled = true;
  const stale = api.measureOperation("ui.profile");
  api.clearMetrics();
  stale();
  assert.equal(api.metrics.snapshot().length, 0);
  api.measureOperation("ui.profile")();
  assert.equal(api.metrics.snapshot()[0].count, 1);
});
test("frame sampler records a late callback before ending its burst, without scheduling an unbounded loop", async () => {
  const core = await import("../src/services/performance/core.mjs");
  let callback,
    requests = 0;
  const api = load(
    "services/performance/monitor.ts",
    { "./core.mjs": core },
    {
      window: {},
      document: { hidden: false, documentElement: { dataset: {} } },
      performance: { now: () => 0 },
      requestAnimationFrame: (fn) => {
        callback = fn;
        return ++requests;
      },
    },
  );
  api.metrics.enabled = true;
  await api.sampleMonitorNow();
  await api.sampleMonitorNow();
  callback(1500);
  assert.equal(api.metrics.snapshot()[0].max, 1500);
  assert.equal(requests, 1);
});
test("HTTP measurement preserves responses and original errors, never retains sensitive request data", async () => {
  const core = await import("../src/services/performance/core.mjs");
  let now = 0,
    response = { ok: false, status: 403 },
    failure;
  const api = load(
    "services/performance/monitor.ts",
    { "./core.mjs": core },
    {
      window: {},
      document: { documentElement: { dataset: { visualQuality: "normal" } } },
      URL,
      Request,
      performance: { now: () => (now += 5) },
      fetch: async () => {
        if (failure) throw failure;
        return response;
      },
    },
  );
  api.metrics.enabled = true;
  assert.equal(
    await api.monitoredFetch(
      "https://example.invalid/rest/v1/profiles?email=private&token=secret",
      { headers: { Authorization: "Bearer secret" } },
    ),
    response,
  );
  assert.equal(api.metrics.snapshot()[0].errors, 1);
  assert.ok(!JSON.stringify(api.metrics.snapshot()).includes("secret"));
  failure = Error("private token secret");
  await assert.rejects(
    api.monitoredFetch("https://example.invalid/auth/v1/token"),
    (error) => error === failure,
  );
  assert.ok(!JSON.stringify(api.metrics.snapshot()).includes("private"));
  const count = api.metrics.snapshot().reduce((n, r) => n + r.count, 0);
  failure = undefined;
  response = { ok: true };
  await api.monitoredFetch("https://example.invalid/rest/v1/rpc/is_performance_admin");
  assert.equal(
    api.metrics.snapshot().reduce((n, r) => n + r.count, 0),
    count,
  );
});
test("read-only RTC probe extracts timing, delta packet loss and candidate type without identity, SDP or IPs", async () => {
  const samples = [];
  let reads = 0;
  const enabled = { enabled: true };
  const provider = loadVoiceProvider(
    {},
    {
      require: (name) => {
        if (name === "@/services/performance/monitor")
          return {
            metrics: enabled,
            registerProbe: () => () => {},
            collectionGeneration: () => 0,
            recordMetric: (...args) => samples.push(args),
          };
        if (name === "@/integrations/supabase/client") return { supabase: {} };
        return {};
      },
    },
  );
  const pc = {
    connectionState: "connected",
    getStats: async () => {
      reads++;
      return new Map([
        ["candidate", { candidateType: "relay", address: "192.0.2.45", port: 4567 }],
        [
          "pair",
          {
            type: "candidate-pair",
            state: "succeeded",
            nominated: true,
            currentRoundTripTime: 0.02,
            localCandidateId: "candidate",
            remoteCandidateId: "secret-private-identity",
          },
        ],
        [
          "audio",
          {
            type: "inbound-rtp",
            kind: "audio",
            jitter: 0.003,
            packetsReceived: 100 * reads,
            packetsLost: reads,
          },
        ],
        ["video", { type: "outbound-rtp", kind: "video", mid: "2", framesPerSecond: 24 }],
      ]);
    },
  };
  provider.peers.set("private-user-identity", { pc, transceivers: { screen: { mid: "2" } } });
  provider.screenStream = {};
  await provider.samplePerformance();
  await provider.samplePerformance();
  assert.ok(samples.some(([name, value]) => name === "rtc.rtt" && value === 20));
  assert.ok(samples.some(([name, value]) => name === "rtc.jitter" && value === 3));
  assert.ok(
    samples.some(([name, value]) => name === "rtc.loss" && Math.abs(value - 100 / 101) < 0.001),
  );
  assert.ok(samples.some(([name, value]) => name === "rtc.screen_fps" && value === 24));
  assert.ok(samples.some(([name]) => name === "rtc.relay"));
  assert.ok(!JSON.stringify(samples).includes("identity"));
  assert.ok(!JSON.stringify(samples).includes("192.0.2"));
  enabled.enabled = false;
  await provider.samplePerformance();
  assert.equal(reads, 2);
  enabled.enabled = true;
  pc.getStats = async () => {
    throw Error("closed");
  };
  await provider.samplePerformance();
});

test("collector is off by default, accepts only bounded anonymous vocabulary and strips arbitrary labels", () => {
  const store = new MetricStore(() => 120000);
  store.record("ui.frame", 20);
  assert.equal(store.snapshot().length, 0);
  store.enabled = true;
  for (const metric of ["constructor", "__proto__", "secret-token", "https://private"])
    store.record(metric, 20);
  for (const value of [NaN, Infinity, -1, 1000001]) store.record("ui.frame", value);
  store.record("ui.frame", 20, true, {
    platform: "electron",
    mode: "maximum",
    version: "0.1.43",
    email: "private",
    token: "secret",
  });
  const [row] = store.snapshot();
  assert.equal(row.count, 1);
  assert.equal(row.errors, 1);
  assert.equal(row.mode, "maximum");
  assert.ok(!JSON.stringify(row).includes("secret"));
  assert.ok(!JSON.stringify(row).includes("private"));
  row.histogram[0] = 99;
  assert.notEqual(store.snapshot()[0].histogram[0], 99);
});
test("histograms combine sample counts, never average percentiles; retention and capacity remain bounded", () => {
  let now = 60000;
  const store = new MetricStore(() => now);
  store.enabled = true;
  store.record("backend.unread", 10);
  store.record("backend.unread", 1000, true);
  now += 60000;
  store.record("backend.unread", 20);
  const [r] = aggregate(store.snapshot());
  assert.equal(r.count, 3);
  assert.equal(r.p50, 20);
  assert.equal(r.p95, 1000);
  assert.equal(r.errorRate, 1 / 3);
  for (let i = 0; i < MAX_ROWS + 10; i++) {
    now += 60000;
    store.record("ui.frame", 20);
  }
  assert.equal(store.snapshot().length, MAX_ROWS);
  now += RETENTION + 60000;
  assert.equal(store.snapshot().length, 0);
});
test("untrusted persisted rows cannot smuggle unknown keys, invalid counters or oversized histograms", () => {
  const store = new MetricStore(() => 120000);
  store.enabled = true;
  store.record("ui.frame", 10);
  const [valid] = store.snapshot();
  store.clear();
  store.restore([
    { ...valid, count: -1 },
    { ...valid, histogram: [1] },
    { ...valid, metric: "constructor" },
  ]);
  assert.equal(store.snapshot().length, 0);
  store.restore([{ ...valid, token: "secret" }]);
  assert.equal(store.snapshot().length, 1);
  assert.ok(!JSON.stringify(store.snapshot()).includes("secret"));
  assert.equal(store.snapshot()[0].histogram.length, BOUNDS.length);
});
test("alerts need sustained evidence and have five-minute cooldown", () => {
  let now = 60000;
  const store = new MetricStore(() => now);
  store.enabled = true;
  for (let i = 0; i < 5; i++) store.record("ui.frame", 100);
  const evaluator = new AlertEvaluator();
  assert.equal(evaluator.evaluate(store.snapshot(), { "ui.frame": 50 }, now).length, 0);
  now += 60000;
  store.record("ui.frame", 100);
  assert.equal(evaluator.evaluate(store.snapshot(), { "ui.frame": 50 }, now).length, 1);
  assert.equal(evaluator.evaluate(store.snapshot(), { "ui.frame": 50 }, now + 1000).length, 0);
});
test("one slow minute followed by a healthy minute is not sustained; repeated errors do not require a latency threshold", () => {
  let now = 60000;
  const store = new MetricStore(() => now);
  store.enabled = true;
  for (let i = 0; i < 5; i++) store.record("ui.frame", 100);
  now += 60000;
  store.record("ui.frame", 1);
  assert.equal(new AlertEvaluator().evaluate(store.snapshot(), { "ui.frame": 50 }, now).length, 0);
  for (let i = 0; i < 5; i++) store.record("backend.auth", 20, true);
  now += 60000;
  store.record("backend.auth", 20, true);
  const alerts = new AlertEvaluator().evaluate(store.snapshot(), {}, now);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].metric, "backend.auth");
});
test("Electron IPC accepts only trusted main frame, caches samples and returns no process identifiers", () => {
  let handler,
    reads = 0,
    removed;
  const mainFrame = { url: "lobbyx://app/app" };
  const contents = { mainFrame };
  const window = { webContents: contents, isDestroyed: () => false };
  const cleanup = installPerformance({
    app: {
      getVersion: () => "0.1.43",
      getAppMetrics: () => {
        reads++;
        return [
          {
            pid: 123,
            name: "private",
            cpu: { percentCPUUsage: 2 },
            memory: { privateBytes: 1024 },
          },
        ];
      },
    },
    window,
    ipcMain: {
      handle: (name, fn) => {
        handler = fn;
      },
      removeHandler: (name) => {
        removed = name;
      },
    },
    trusted: (url) => url === mainFrame.url,
  });
  assert.throws(() => handler({ sender: {}, senderFrame: mainFrame }), /Forbidden/);
  assert.throws(
    () => handler({ sender: contents, senderFrame: { url: mainFrame.url } }),
    /Forbidden/,
  );
  const event = { sender: contents, senderFrame: mainFrame };
  const result = handler(event);
  assert.deepEqual(result, { version: "0.1.43", sampleId: 1, cpu: null, memory: 1 });
  handler(event);
  assert.equal(reads, 1);
  assert.equal("pid" in result, false);
  cleanup();
  assert.equal(removed, "desktop:performance");
});

test("native CPU uses its own cumulative interval and rejects unknown/reused-process deltas", () => {
  let handler,
    now = 0,
    total = 10,
    reads = 0,
    creationTime = 1;
  const mainFrame = { url: "lobbyx://app/app" };
  const contents = { mainFrame };
  installPerformance({
    clock: () => now,
    app: {
      getVersion: () => "0.1.43",
      getAppMetrics: () => {
        reads++;
        return [
          {
            pid: 123,
            creationTime,
            cpu: { cumulativeCPUUsage: total, percentCPUUsage: 999 },
            memory: { privateBytes: 1024 },
          },
        ];
      },
    },
    window: { webContents: contents, isDestroyed: () => false },
    ipcMain: {
      handle: (_, fn) => {
        handler = fn;
      },
    },
    trusted: () => true,
  });
  const event = { sender: contents, senderFrame: mainFrame };
  assert.equal(handler(event).cpu, null);
  now = 29000;
  total = 100; // An intervening caller's resettable percentage is irrelevant.
  assert.equal(handler(event).sampleId, 1);
  assert.equal(reads, 1);
  now = 60000;
  total = 11;
  assert.ok(Math.abs(handler(event).cpu - 100 / 60) < 1e-9);
  now = 120000;
  creationTime = 2;
  assert.equal(handler(event).cpu, null); // PID reused: no false delta.
});

test("process born inside a measured interval contributes real lifetime CPU without inventing an earlier baseline", () => {
  let handler,
    now = 0;
  const mainFrame = { url: "lobbyx://app/app" },
    contents = { mainFrame };
  installPerformance({
    clock: () => now,
    wallClock: () => 1000000 + now,
    app: {
      getVersion: () => "0.1.43",
      getAppMetrics: () => [
        { pid: 1, creationTime: 900000, cpu: { cumulativeCPUUsage: 10 + now / 60000 }, memory: {} },
        ...(now
          ? [{ pid: 2, creationTime: 1020000, cpu: { cumulativeCPUUsage: 2 }, memory: {} }]
          : []),
      ],
    },
    window: { webContents: contents, isDestroyed: () => false },
    ipcMain: {
      handle: (_, fn) => {
        handler = fn;
      },
    },
    trusted: () => true,
  });
  const event = { sender: contents, senderFrame: mainFrame };
  assert.equal(handler(event).cpu, null);
  now = 60000;
  assert.equal(handler(event).cpu, 5);
});

test("runtime probes use 60s cadence with timer-jitter tolerance; RTC keeps 30s and hidden/paused does no work", async () => {
  let now = 0,
    interval,
    nativeReads = 0,
    probes = 0,
    frames = 0;
  const document = { hidden: false, documentElement: { dataset: {} } };
  const core = await import("../src/services/performance/core.mjs");
  const api = load(
    "services/performance/monitor.ts",
    { "./core.mjs": core },
    {
      window: {
        lobbyxDesktop: {
          performance: async () => ({
            cpu: null,
            memory: 10,
            version: "0.1.43",
            sampleId: ++nativeReads,
          }),
        },
      },
      document,
      performance: { now: () => now, getEntriesByType: () => [] },
      setInterval: (fn, ms) => {
        assert.equal(ms, 30000);
        interval = fn;
        return 1;
      },
      clearInterval: () => {},
      requestAnimationFrame: () => ++frames,
      cancelAnimationFrame: () => {},
    },
  );
  api.registerProbe(async () => {
    probes++;
  });
  assert.equal(api.metrics.enabled, false);
  await api.sampleMonitorNow();
  assert.equal(nativeReads, 0);
  api.setMonitorEnabled(true);
  const flush = () => new Promise(setImmediate);
  await flush();
  for (now of [30000, 59990, 90000]) {
    interval();
    await flush();
  }
  assert.equal(nativeReads, 2);
  assert.equal(probes, 4);
  assert.equal(frames, 0);
  now = 120000;
  interval();
  await flush();
  assert.equal(nativeReads, 3);
  assert.equal(frames, 1);
  assert.ok(!api.metrics.snapshot().some((r) => r.metric === "runtime.cpu"));
  document.hidden = true;
  now = 180000;
  interval();
  await flush();
  assert.equal(nativeReads, 3);
  api.setMonitorEnabled(false);
  document.hidden = false;
  interval();
  await flush();
  assert.equal(nativeReads, 3);
  assert.equal(probes, 5);
});
