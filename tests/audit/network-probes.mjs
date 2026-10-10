import { performance } from "node:perf_hooks";
import { writeFile } from "node:fs/promises";
// Five serial, unsigned reads per host; no load test, login, keys or data writes.
const results = {
  scope:
    "Small sequential HTTP diagnostics; gateway/edge latency, not PostgreSQL query or WebRTC latency",
  measurements: [],
};
for (const url of [
  "https://lobbyx-nine.vercel.app/",
  "https://lnupoqtaeawwggbwgbuv.supabase.co/auth/v1/health",
]) {
  const rows = [];
  for (let i = 0; i < 5; i++) {
    const before = performance.now();
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      const headersMs = performance.now() - before;
      const bytes = (await response.arrayBuffer()).byteLength;
      rows.push({
        ms: performance.now() - before,
        headersMs,
        status: response.status,
        bytes,
        edge: response.headers.get("cf-ray")?.split("-").at(-1) ?? null,
      });
    } catch (error) {
      rows.push({ error: error.name, ms: performance.now() - before });
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  results.measurements.push({ url, rows });
}
await writeFile(process.argv[2], JSON.stringify(results, null, 2));
console.log("Sequential read-only probes saved");
