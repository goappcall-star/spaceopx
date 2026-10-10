const { app, BrowserWindow, session, ipcMain } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const output = process.argv[2] ? path.resolve(process.argv[2]) : null;
const base = process.env.MONITOR_FIXTURE_BASE || "http://127.0.0.1:5194/";
if (!/^http:\/\/127\.0\.0\.1:\d{4,5}\/$/.test(base)) throw Error("Local fixture only");
const sustained = process.env.MONITOR_FIXTURE_SUSTAINED === "1";
if (!output) throw Error("Provide output file");
const profile = path.join(require("node:os").tmpdir(), "lobbyx-monitor-fixture-" + Date.now());
fs.mkdirSync(profile, { recursive: true });
app.setPath("userData", profile);
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
const report = {
  scope: "Electron 44 production fixture, hidden window, synthetic media, no real accounts",
  metrics: [],
};
const watchdog = setTimeout(() => {
  report.timeout = true;
  fs.writeFileSync(output, JSON.stringify(report, null, 2));
  app.exit(1);
}, 150000);
app
  .whenReady()
  .then(async () => {
    report.phase = "ready";
    session.defaultSession.webRequest.onBeforeRequest((details, callback) =>
      callback({
        cancel:
          !details.url.startsWith(base) &&
          !details.url.startsWith("blob:") &&
          !details.url.startsWith("data:"),
      }),
    );
    const win = new BrowserWindow({
      show: false,
      width: 1280,
      height: 720,
      webPreferences: {
        backgroundThrottling: false,
        preload: path.resolve("desktop/preload.cjs"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });
    const { installPerformance } = require(
      process.env.MONITOR_FIXTURE_NATIVE || "../../desktop/performance.cjs",
    );
    const stopMetrics = installPerformance({
      app,
      window: win,
      ipcMain,
      trusted: (url) => url.startsWith(base),
    });
    win.once("closed", stopMetrics);
    const before = Date.now();
    report.phase = "loading";
    await win.loadURL(
      base +
        "tests/monitor/index.html?auto=1&monitor=" +
        (process.argv[3] === "on" ? "on" : "off") +
        (sustained ? "&sustained=1" : ""),
    );
    report.loadMs = Date.now() - before;
    report.phase = "sampling";
    const readings = new Map();
    let readingTime = performance.now();
    let sampling = false;
    const timer = setInterval(async () => {
      if (sampling) return;
      sampling = true;
      try {
        const page = await win.webContents.executeJavaScript(
          "({text:document.getElementById('results').textContent,mode:document.documentElement.dataset.visualQuality,phase:document.documentElement.dataset.auditPhase,users:document.documentElement.dataset.auditUsers,heading:document.querySelector('header').innerText,hidden:document.hidden})",
        );
        const now = performance.now();
        const elapsed = (now - readingTime) / 1000;
        const processes = app.getAppMetrics().map((p) => {
          const key = p.pid + ":" + p.creationTime;
          const previous = readings.get(key);
          const current = p.cpu.cumulativeCPUUsage;
          readings.set(key, current);
          return {
            type: p.type,
            // Cumulative deltas are independent of other getAppMetrics callers.
            cpu:
              Number.isFinite(current) && Number.isFinite(previous) && current >= previous
                ? (100 * (current - previous)) / elapsed
                : null,
            workingSetKiB: p.memory.workingSetSize,
          };
        });
        readingTime = now;
        report.metrics.push({
          elapsedMs: Date.now() - before,
          mode: page.mode,
          phase: page.phase,
          users: page.users,
          heading: page.heading,
          hidden: page.hidden,
          processes,
        });
        if (page.text.startsWith("{")) {
          clearInterval(timer);
          report.fixture = JSON.parse(page.text);
          report.phase = "done";
          fs.writeFileSync(output, JSON.stringify(report, null, 2));
          app.quit();
        }
      } catch (error) {
        clearInterval(timer);
        report.error = error.message;
        fs.writeFileSync(output, JSON.stringify(report, null, 2));
        app.quit();
      } finally {
        sampling = false;
      }
    }, 1000);
    setTimeout(() => {
      clearInterval(timer);
      report.timeout = true;
      fs.writeFileSync(output, JSON.stringify(report, null, 2));
      app.quit();
    }, 150000);
  })
  .catch((error) => {
    report.error = error.message;
    clearTimeout(watchdog);
    fs.writeFileSync(output, JSON.stringify(report, null, 2));
    app.exit(1);
  });
