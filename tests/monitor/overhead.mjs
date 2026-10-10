import fs from "node:fs";
import { performance } from "node:perf_hooks";
import { MetricStore } from "../../src/services/performance/core.mjs";
const results = [];
for (let run = 0; run < 12; run++) {
  const on = run % 2 === 1;
  const store = new MetricStore();
  store.enabled = on;
  for (let i = 0; i < 5000; i++)
    store.record("ui.frame", 16.7, false, { platform: "web", version: "0.1.43" });
  const start = performance.now();
  for (let i = 0; i < 50000; i++)
    store.record("ui.frame", 16.7, false, { platform: "web", version: "0.1.43" });
  results.push({
    run,
    on,
    records: 50000,
    elapsedMs: performance.now() - start,
    rows: store.snapshot().length,
  });
}
const output = {
  scope: "Node collector microbenchmark; not whole-app CPU or real call latency",
  results,
};
fs.mkdirSync("docs/performance-monitor-v1", { recursive: true });
fs.writeFileSync(
  "docs/performance-monitor-v1/collector-overhead.json",
  JSON.stringify(output, null, 2),
);
console.log(JSON.stringify(output, null, 2));
