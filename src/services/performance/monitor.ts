import { MetricStore, AlertEvaluator } from "./core.mjs";

export const metrics = new MetricStore();
export const alertEvaluator = new AlertEvaluator();
let generation = 0;
let lastRuntimeSample: number | undefined;
export const collectionGeneration = () => generation;
let version = "unknown";
let timer: ReturnType<typeof setInterval> | undefined;
let observer: PerformanceObserver | undefined;
let stopFrames: (() => void) | undefined;
let lastRuntimeAt = -Infinity;
let lastFramesAt = -Infinity;
let samplePending = false;
const probes = new Set<() => Promise<void>>();
const pending = new Set<() => Promise<void>>();
export function recordMetric(name: string, value: number, failed = false) {
  try {
    metrics.record(name, value, failed, {
      platform: typeof window !== "undefined" && "lobbyxDesktop" in window ? "electron" : "web",
      mode:
        typeof document !== "undefined"
          ? (document.documentElement.dataset["visualQuality"] ?? "normal")
          : "normal",
      version,
    });
  } catch {
    /* Diagnostics must never interrupt the application. */
  }
}
export function measureOperation(name: string) {
  if (!metrics.enabled) return () => {};
  const epoch = generation;
  let start: number;
  try {
    start = performance.now();
  } catch {
    return () => {};
  }
  let done = false;
  return (failed = false) => {
    if (!done && epoch === generation) {
      done = true;
      try {
        recordMetric(name, performance.now() - start, failed);
      } catch {
        /* Clock unavailable. */
      }
    }
  };
}
export function registerProbe(probe: () => Promise<void>) {
  probes.add(probe);
  return () => {
    probes.delete(probe);
  };
}
export function clearMetrics() {
  generation++;
  metrics.clear();
  alertEvaluator.recent.clear();
}
function frameBurst() {
  if (stopFrames || document.hidden || !metrics.enabled) return;
  let id = 0,
    previous = performance.now();
  const until = previous + 1000;
  const next = (time: number) => {
    if (!metrics.enabled || document.hidden) {
      stopFrames = undefined;
      return;
    }
    recordMetric("ui.frame", time - previous);
    previous = time;
    if (time >= until) {
      stopFrames = undefined;
      return;
    }
    id = requestAnimationFrame(next);
  };
  stopFrames = () => {
    cancelAnimationFrame(id);
    stopFrames = undefined;
  };
  id = requestAnimationFrame(next);
}
type Runtime = { cpu: number | null; memory: number; version: string; sampleId?: number };
function desktopBridge() {
  return (window as unknown as { lobbyxDesktop?: { performance?: () => Promise<Runtime> } })
    .lobbyxDesktop;
}
async function sample() {
  if (!metrics.enabled || document.hidden || samplePending) return;
  samplePending = true;
  try {
    const epoch = generation;
    const now = performance.now();
    // 1s tolerance for timer jitter at the scheduled 60s boundary.
    if (now - lastRuntimeAt >= 59000) {
      lastRuntimeAt = now;
      const heap = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
      if (heap) recordMetric("runtime.heap", heap.usedJSHeapSize / 1048576);
      const runtime = desktopBridge();
      if (runtime?.performance) {
        try {
          const result = await runtime.performance();
          if (!metrics.enabled || epoch !== generation || document.hidden) return;
          version = result.version;
          if (result.sampleId === undefined || result.sampleId !== lastRuntimeSample) {
            lastRuntimeSample = result.sampleId;
            if (typeof result.cpu === "number") recordMetric("runtime.cpu", result.cpu);
            recordMetric("runtime.memory", result.memory);
          }
        } catch {
          /* Older Desktop builds simply lack runtime metrics. */
        }
      }
    }
    if (!metrics.enabled || epoch !== generation || document.hidden) return;
    for (const probe of probes) {
      if (pending.has(probe)) continue;
      pending.add(probe);
      Promise.resolve()
        .then(probe)
        .catch(() => {})
        .finally(() => pending.delete(probe));
    }
    if (now - lastFramesAt >= 120000) {
      lastFramesAt = now;
      frameBurst();
    }
  } finally {
    samplePending = false;
  }
}
// Also used by the isolated test harness; a disabled collector remains a no-op.
export const sampleMonitorNow = sample;
export function setMonitorEnabled(enabled: boolean) {
  if (typeof window === "undefined" || metrics.enabled === enabled) return;
  generation++;
  metrics.enabled = enabled;
  if (!enabled) {
    clearInterval(timer);
    timer = undefined;
    observer?.disconnect();
    observer = undefined;
    stopFrames?.();
    return;
  }
  version = import.meta.env["VITE_APP_VERSION"] || "unknown";
  try {
    if (PerformanceObserver.supportedEntryTypes.includes("longtask")) {
      observer = new PerformanceObserver((list) => {
        if (!document.hidden)
          for (const entry of list.getEntries()) recordMetric("ui.longtask", entry.duration);
      });
      observer.observe({ type: "longtask" });
    }
  } catch {
    /* Not supported on this platform. */
  }
  const navigation = performance.getEntriesByType("navigation")[0] as
    PerformanceNavigationTiming | undefined;
  if (navigation?.domContentLoadedEventEnd)
    recordMetric("ui.startup", navigation.domContentLoadedEventEnd);
  lastRuntimeAt = -Infinity;
  // Avoid extra RAF work during initial navigation/connection. Long tasks still capture stalls.
  lastFramesAt = performance.now();
  timer = setInterval(() => {
    void sample().catch(() => {});
  }, 30000);
  void sample().catch(() => {});
}
// No URL, headers, body, error message or status text is retained.
export async function monitoredFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  if (!metrics.enabled) return fetch(input, init);
  let metric = "backend.request";
  try {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
    );
    if (url.pathname.includes("performance_")) return fetch(input, init);
    if (url.pathname.includes("/auth/")) metric = "backend.auth";
    else if (url.pathname.endsWith("/rpc/get_server_unread_counts")) metric = "backend.unread_http";
    else if (url.pathname.endsWith("/messages") || url.pathname.endsWith("/direct_messages"))
      metric = "backend.messages";
    else if (url.pathname.endsWith("/profiles")) metric = "backend.profiles";
  } catch {
    /* Generic label only. */
  }
  const finish = measureOperation(metric);
  try {
    const response = await fetch(input, init);
    finish(!response.ok);
    return response;
  } catch (error) {
    finish(true);
    throw error;
  }
}
