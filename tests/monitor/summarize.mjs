import fs from "node:fs";
const dir = "docs/performance-monitor-v1/";
const read = (name) => JSON.parse(fs.readFileSync(dir + name + ".json", "utf8"));
const stats = (values) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return { n: 0 };
  return {
    n: sorted.length,
    mean: sorted.reduce((a, b) => a + b, 0) / sorted.length,
    p50: sorted[Math.ceil(sorted.length * 0.5) - 1],
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
    max: sorted.at(-1),
  };
};
const fixture = (data) => ({
  finishedAt: data.finishedAt,
  monitorOn: data.monitorOn,
  visual: data.samples.map((s) => ({
    users: s.users,
    mode: s.mode,
    renderMs: stats(s.renderMs),
    frameIntervalsMs: stats(s.frameIntervalsMs),
    heapDeltaMiB: (s.heapAfter - s.heapBefore) / 1048576,
    runningAnimations: s.runningAnimations,
    visible: s.visible,
  })),
  rtc: data.rtc.map((s) => ({
    mode: s.mode,
    connectedMs: s.connectedMs,
    screenMs: s.screenMs,
    captureStates: s.captureStates,
  })),
  rtcError: data.rtcError ?? null,
  openPeersAfterCleanup: data["openPeersAfterCleanup-normal"],
  collectorCounts: Object.fromEntries(
    [...new Set(data.monitorRows.map((r) => r.metric))].map((metric) => [
      metric,
      data.monitorRows.filter((r) => r.metric === metric).reduce((n, r) => n + r.count, 0),
    ]),
  ),
});
const electron = (data) => ({
  phase: data.phase,
  timeout: data.timeout ?? false,
  error: data.error ?? null,
  loadMs: data.loadMs,
  phases: Object.fromEntries(
    [...new Set(data.metrics.map((s) => s.phase))].map((phase) => {
      const samples = data.metrics.filter((s) => s.phase === phase);
      return [
        phase,
        {
          cpuPercent: stats(samples.map((s) => s.processes.reduce((n, p) => n + p.cpu, 0))),
          workingSetMiB: stats(
            samples.map((s) => s.processes.reduce((n, p) => n + p.workingSetKiB / 1024, 0)),
          ),
        },
      ];
    }),
  ),
  fixture: fixture(data.fixture),
});
const result = {
  scope:
    "Sequential local fixtures. One pair per platform; no causal or WAN conclusion. Exact nearest-rank benchmark percentiles differ from the panel's histogram bounds.",
  web: { off: fixture(read("web-off")), on: fixture(read("web-on")) },
  electron: { off: electron(read("electron-off")), on: electron(read("electron-on")) },
  collector: Object.fromEntries(
    [false, true].map((on) => [
      on ? "on" : "off",
      stats(
        read("collector-overhead")
          .results.filter((r) => r.on === on)
          .map((r) => r.elapsedMs),
      ),
    ]),
  ),
};
fs.writeFileSync(dir + "summary.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
