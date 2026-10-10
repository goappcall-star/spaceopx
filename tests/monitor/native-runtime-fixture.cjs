// Availability check, not an overhead benchmark. No accounts, network or media.
const { app, BrowserWindow, ipcMain, session } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const output = path.resolve("docs/performance-monitor-v1.1/native-runtime.json");
if (fs.existsSync(output)) throw Error("Refusing to overwrite evidence");
app.setPath(
  "userData",
  path.join(require("node:os").tmpdir(), "lobbyx-native-check-" + Date.now()),
);
const report = {
  scope: "Real sandboxed Electron IPC availability; not a CPU comparison",
  samples: [],
};
const save = (code = 0) => {
  fs.writeFileSync(output, JSON.stringify(report, null, 2));
  app.exit(code);
};
setTimeout(() => {
  report.timeout = true;
  save(1);
}, 140000);
app
  .whenReady()
  .then(async () => {
    const base = "http://127.0.0.1:5194/";
    session.defaultSession.webRequest.onBeforeRequest((details, callback) =>
      callback({ cancel: !details.url.startsWith(base) }),
    );
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: path.resolve("desktop/preload.cjs"),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
      },
    });
    const stop = require("../../desktop/performance.cjs").installPerformance({
      app,
      window: win,
      ipcMain,
      trusted: (url) => url.startsWith(base),
    });
    win.once("closed", stop);
    await win.loadURL(base + "tests/monitor/panel.html");
    const start = performance.now();
    for (const offset of [0, 61000, 122000]) {
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, offset - (performance.now() - start))),
      );
      const reading = await win.webContents.executeJavaScript("window.lobbyxDesktop.performance()");
      report.samples.push({ elapsedMs: performance.now() - start, ...reading });
    }
    report.cpuAvailable = report.samples.slice(1).some((reading) => Number.isFinite(reading.cpu));
    save(report.cpuAvailable ? 0 : 1);
  })
  .catch(() => {
    report.failed = true;
    save(1);
  });
