import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const stage = process.argv[2];
if (!["baseline", "refined"].includes(stage)) throw Error("baseline or refined required");
const directory = "docs/performance-monitor-v1.1";
fs.mkdirSync(directory, { recursive: true });
const order = ["off", "on", "on", "off"];
const manifest = { stage, order, runs: [], startedAt: new Date().toISOString() };
for (let index = 0; index < order.length; index++) {
  const output = path.resolve(directory, `${stage}-${index + 1}-${order[index]}.json`);
  if (fs.existsSync(output)) throw Error("Refusing to overwrite a measured run");
  const env = { ...process.env, MONITOR_FIXTURE_SUSTAINED: "1" };
  if (stage === "baseline") {
    env.MONITOR_FIXTURE_BASE = "http://127.0.0.1:5195/";
    env.MONITOR_FIXTURE_NATIVE = path.resolve(
      "C:/Users/nicol/Documents/Codex/2026-10-03/vo/work/monitor-v11-baseline/performance.cjs",
    );
  }
  const start = new Date().toISOString();
  console.log(`${stage} ${index + 1}/4 ${order[index]} started ${start}`);
  const code = await new Promise((resolve, reject) => {
    const child = spawn(
      path.resolve("node_modules/electron/dist/electron.exe"),
      ["tests/monitor/desktop-fixture.cjs", output, order[index]],
      { env, stdio: "ignore", windowsHide: true },
    );
    child.once("error", reject);
    child.once("exit", resolve);
  });
  if (!fs.existsSync(output)) throw Error("No benchmark output, exit " + code);
  const result = JSON.parse(fs.readFileSync(output, "utf8"));
  if (code || result.timeout || result.error || result.fixture?.rtcError || result.phase !== "done")
    throw Error("Benchmark failed; inspect " + output);
  manifest.runs.push({
    index: index + 1,
    state: order[index],
    start,
    end: new Date().toISOString(),
    file: path.basename(output),
    samples: result.metrics.length,
  });
  fs.writeFileSync(
    path.join(directory, stage + "-manifest.json"),
    JSON.stringify(manifest, null, 2),
  );
  console.log(`${stage} ${index + 1}/4 completed; ${result.metrics.length} native samples`);
}
