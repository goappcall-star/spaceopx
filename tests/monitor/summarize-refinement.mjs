import fs from "node:fs";
const dir = "docs/performance-monitor-v1.1/";
const stats = (values) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return { n: 0 };
  return {
    n: sorted.length,
    mean: sorted.reduce((a, b) => a + b, 0) / sorted.length,
    p50: sorted[Math.ceil(sorted.length * 0.5) - 1],
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
  };
};
const runs = fs
  .readdirSync(dir)
  .filter((s) => /^(baseline|refined)-\d-(on|off)\.json$/.test(s))
  .map((file) => {
    const data = JSON.parse(fs.readFileSync(dir + file, "utf8"));
    if (!data.fixture || data.timeout || data.error || data.fixture.rtcError)
      throw Error(file + " failed");
    const f = data.fixture;
    const phases = {};
    for (const phase of ["visual", "voice", "screen-audio"]) {
      const raw = data.metrics.filter((s) => s.phase === phase);
      // Native cumulative CPU delta excludes the first sample of a new process.
      // Steady call windows exclude capture/negotiation startup; no trimming of visuals.
      const steady = raw.filter(
        (s) => phase === "visual" || s.elapsedMs - raw[0].elapsedMs >= 5000,
      );
      phases[phase] = {
        cpu: stats(
          steady
            .filter((s) => s.processes.every((p) => Number.isFinite(p.cpu)))
            .map((s) => s.processes.reduce((sum, p) => sum + p.cpu, 0)),
        ),
        memory: stats(
          steady.map((s) => s.processes.reduce((sum, p) => sum + p.workingSetKiB / 1024, 0)),
        ),
      };
    }
    return {
      file,
      stage: file.startsWith("baseline") ? "baseline" : "refined",
      on: f.monitorOn,
      samples: data.metrics.length,
      phases,
      visual: f.samples.map((s) => ({
        users: s.users,
        render: stats(s.renderMs),
        raf: stats(s.frameIntervalsMs),
        pathWrites: s.pathWrites,
      })),
      rtc: f.rtc.map((s) => ({
        mode: s.mode,
        connectedMs: s.connectedMs,
        screenMs: s.screenMs,
        captureStates: s.captureStates,
        transitions: s.transitions,
        incoming: s.stats
          .flat()
          .filter((v) => v.type === "inbound-rtp")
          .map((v) => ({
            kind: v.kind,
            packetsReceived: v.packetsReceived,
            packetsLost: v.packetsLost,
            jitter: v.jitter,
            framesDecoded: v.framesDecoded,
          })),
      })),
      openPeers: f["openPeersAfterCleanup-normal"],
      collector: Object.fromEntries(
        [...new Set(f.monitorRows.map((r) => r.metric))].map((metric) => [
          metric,
          f.monitorRows.filter((r) => r.metric === metric).reduce((sum, r) => sum + r.count, 0),
        ]),
      ),
    };
  });
const groups = [];
for (const stage of ["baseline", "refined"])
  for (const on of [false, true]) {
    const selected = runs.filter((r) => r.stage === stage && r.on === on);
    groups.push({
      stage,
      on,
      runs: selected.length,
      phases: Object.fromEntries(
        ["visual", "voice", "screen-audio"].map((phase) => [
          phase,
          {
            // Each run has equal weight, rather than letting a longer run dominate.
            cpuRunMeans: stats(selected.map((r) => r.phases[phase].cpu.mean)),
            memoryRunMeans: stats(selected.map((r) => r.phases[phase].memory.mean)),
          },
        ]),
      ),
      visual: [10, 50, 100].map((users) => ({
        users,
        renderRunP95: stats(
          selected.map((r) => r.visual.find((s) => s.users === users)?.render.p95),
        ),
        rafRunP95: stats(selected.map((r) => r.visual.find((s) => s.users === users)?.raf.p95)),
      })),
    });
  }
const webRuns = fs
  .readdirSync(dir)
  .filter((file) => /^web-(baseline|refined)-\d-(on|off)\.json$/.test(file))
  .map((file) => {
    const fixture = JSON.parse(fs.readFileSync(dir + file, "utf8"));
    if (fixture.rtcError) throw Error(file + " failed");
    return {
      file,
      stage: file.includes("baseline") ? "baseline" : "refined",
      on: fixture.monitorOn,
      openPeers: fixture["openPeersAfterCleanup-normal"],
      captureStates: fixture.rtc.flatMap((run) => run.captureStates),
      visual: fixture.samples.map((sample) => ({
        users: sample.users,
        visible: sample.visible,
        render: stats(sample.renderMs),
        raf: stats(sample.frameIntervalsMs),
      })),
    };
  });
const webGroups = [];
for (const stage of ["baseline", "refined"])
  for (const on of [false, true]) {
    const selected = webRuns.filter((run) => run.stage === stage && run.on === on);
    webGroups.push({
      stage,
      on,
      runs: selected.length,
      visual: [10, 50, 100].map((users) => ({
        users,
        renderRunP95: stats(
          selected.map((run) => run.visual.find((sample) => sample.users === users)?.render.p95),
        ),
        rafRunP95: stats(
          selected.map((run) => run.visual.find((sample) => sample.users === users)?.raf.p95),
        ),
      })),
    });
  }
fs.writeFileSync(
  dir + "summary.json",
  JSON.stringify(
    {
      method:
        "Two pairs per stage, ABBA order, cumulative CPU deltas on 1s intervals. Voice steady window excludes first 5s. Each run equally weighted. CPU is percentage of one logical core, sum of own processes; RAM is working set MiB. Synthetic local media with 100 animated profiles; not a WAN or real-installation test.",
      groups,
      runs,
      webGroups,
      webRuns,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify(groups, null, 2));
