// Closed vocabulary: never accept URLs, error text, user identifiers or arbitrary labels.
export const METRICS = Object.freeze({
  "ui.navigation": "ms",
  "ui.server": "ms",
  "ui.channel": "ms",
  "ui.settings": "ms",
  "ui.profile": "ms",
  "ui.startup": "ms",
  "ui.longtask": "ms",
  "ui.frame": "ms",
  "backend.request": "ms",
  "backend.messages": "ms",
  "backend.profiles": "ms",
  "backend.unread": "ms",
  "backend.unread_http": "ms",
  "backend.auth": "ms",
  "realtime.failure": "events",
  "realtime.reconnect": "events",
  "notification.refresh": "ms",
  "rtc.connect": "ms",
  "rtc.reconnect": "events",
  "rtc.ice_failure": "events",
  "rtc.rtt": "ms",
  "rtc.jitter": "ms",
  "rtc.loss": "%",
  "rtc.screen_fps": "fps",
  "rtc.relay": "events",
  "rtc.direct": "events",
  "runtime.cpu": "%",
  "runtime.memory": "MiB",
  "runtime.heap": "MiB",
});
export const BOUNDS = Object.freeze([
  0, 1, 2, 5, 10, 20, 50, 100, 250, 500, 1000, 2000, 5000, 10000, 30000, 60000, 1000000,
]);
export const MAX_ROWS = 2048;
export const RETENTION = 7 * 86400000;
export function percentile(histogram, percent) {
  const total = histogram.reduce((a, b) => a + b, 0);
  if (!total) return null;
  const rank = Math.max(1, Math.ceil(total * percent));
  let n = 0;
  for (let i = 0; i < BOUNDS.length; i++) {
    n += histogram[i] || 0;
    if (n >= rank) return BOUNDS[i];
  }
  return null;
}
export class MetricStore {
  enabled = false;
  rows = new Map();
  constructor(clock = Date.now) {
    this.clock = clock;
  }
  record(metric, value, failed = false, labels = {}) {
    if (
      !this.enabled ||
      !Object.hasOwn(METRICS, metric) ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > 1000000
    )
      return;
    const minute = Math.floor(this.clock() / 60000) * 60000;
    const platform = labels.platform === "electron" ? "electron" : "web";
    const mode = ["optimized", "maximum"].includes(labels.mode) ? labels.mode : "normal";
    const version = /^\d+\.\d+\.\d+(?:-[a-z0-9.-]{1,24})?$/.test(labels.version || "")
      ? labels.version
      : "unknown";
    const key = [minute, metric, platform, mode, version].join("|");
    let row = this.rows.get(key);
    if (!row) {
      row = {
        minute,
        metric,
        platform,
        mode,
        version,
        count: 0,
        errors: 0,
        sum: 0,
        max: 0,
        histogram: BOUNDS.map(() => 0),
      };
      this.rows.set(key, row);
      this.prune();
    }
    if (row.count >= 1000000) return;
    row.count++;
    row.errors += failed === true ? 1 : 0;
    row.sum += value;
    row.max = Math.max(row.max, value);
    row.histogram[BOUNDS.findIndex((bound) => value <= bound)]++;
  }
  prune() {
    const cutoff = this.clock() - RETENTION;
    for (const [key, row] of this.rows) if (row.minute < cutoff) this.rows.delete(key);
    while (this.rows.size > MAX_ROWS) this.rows.delete(this.rows.keys().next().value);
  }
  snapshot() {
    this.prune();
    return [...this.rows.values()].map((r) => ({ ...r, histogram: [...r.histogram] }));
  }
  clear() {
    this.rows.clear();
  }
  restore(input) {
    if (!Array.isArray(input) || input.length > MAX_ROWS) return;
    // Persisted data is untrusted. Copy only validated fields; never retain extra keys.
    for (const r of input) {
      if (
        !r ||
        !Object.hasOwn(METRICS, r.metric) ||
        !Number.isInteger(r.minute) ||
        r.minute % 60000 ||
        r.minute > this.clock() ||
        r.minute < this.clock() - RETENTION ||
        !["web", "electron"].includes(r.platform) ||
        !["normal", "optimized", "maximum"].includes(r.mode) ||
        !(r.version === "unknown" || /^\d+\.\d+\.\d+(?:-[a-z0-9.-]{1,24})?$/.test(r.version)) ||
        !Number.isInteger(r.count) ||
        r.count < 1 ||
        r.count > 1000000 ||
        !Number.isInteger(r.errors) ||
        r.errors < 0 ||
        r.errors > r.count ||
        !Number.isFinite(r.sum) ||
        r.sum < 0 ||
        r.sum > r.count * 1000000 ||
        !Number.isFinite(r.max) ||
        r.max < 0 ||
        r.max > 1000000 ||
        !Array.isArray(r.histogram) ||
        r.histogram.length !== BOUNDS.length ||
        r.histogram.some((n) => !Number.isInteger(n) || n < 0) ||
        r.histogram.reduce((a, b) => a + b, 0) !== r.count
      )
        continue;
      const { minute, metric, platform, mode, version, count, errors, sum, max, histogram } = r;
      this.rows.set([minute, metric, platform, mode, version].join("|"), {
        minute,
        metric,
        platform,
        mode,
        version,
        count,
        errors,
        sum,
        max,
        histogram: [...histogram],
      });
    }
    this.prune();
  }
}
export function aggregate(rows) {
  const result = new Map();
  for (const row of rows) {
    let r = result.get(row.metric);
    if (!r) {
      r = {
        metric: row.metric,
        count: 0,
        errors: 0,
        sum: 0,
        max: 0,
        histogram: BOUNDS.map(() => 0),
      };
      result.set(row.metric, r);
    }
    r.count += row.count;
    r.errors += row.errors;
    r.sum += row.sum;
    r.max = Math.max(r.max, row.max);
    row.histogram.forEach((n, i) => {
      r.histogram[i] += n;
    });
  }
  return [...result.values()].map((r) => ({
    ...r,
    mean: r.sum / r.count,
    p50: percentile(r.histogram, 0.5),
    p95: percentile(r.histogram, 0.95),
    errorRate: r.errors / r.count,
  }));
}
export class AlertEvaluator {
  recent = new Map();
  evaluate(rows, limits, now = Date.now()) {
    const recent = rows.filter((r) => r.minute >= now - 3 * 60000);
    const alerts = [];
    for (const r of aggregate(recent)) {
      const limit =
        Number.isFinite(limits[r.metric]) && limits[r.metric] > 0 ? limits[r.metric] : Infinity;
      const minuteValues = new Map();
      for (const row of recent.filter((v) => v.metric === r.metric)) {
        const group = minuteValues.get(row.minute) ?? [];
        group.push(row);
        minuteValues.set(row.minute, group);
      }
      const problematicMinutes = [...minuteValues.values()].filter((group) => {
        const summary = aggregate(group)[0];
        return summary.p95 > limit || summary.errorRate >= 0.1;
      }).length;
      if (r.count < 5 || problematicMinutes < 2) continue;
      if (now - (this.recent.get(r.metric) ?? -Infinity) < 5 * 60000) continue;
      this.recent.set(r.metric, now);
      alerts.push({ metric: r.metric, p95: r.p95, errorRate: r.errorRate, time: now });
    }
    return alerts;
  }
}
