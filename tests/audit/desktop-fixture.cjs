const { app, BrowserWindow, session } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const output = process.argv[2];
if (!output) throw Error("Provide output file");
const profile = path.join(path.dirname(output), "audit-fixture-profile-" + Date.now());
fs.mkdirSync(profile, { recursive: true });
app.setPath("userData", profile);
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
const report = {
  scope: "Electron 44 production fixture, hidden window, synthetic media, no real accounts",
  metrics: [],
};
app.whenReady().then(async () => {
  session.defaultSession.webRequest.onBeforeRequest((details, callback) =>
    callback({
      cancel:
        !details.url.startsWith("http://127.0.0.1:5193/") &&
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
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  const before = Date.now();
  await win.loadURL("http://127.0.0.1:5193/tests/audit/index.html?auto=1");
  report.loadMs = Date.now() - before;
  const timer = setInterval(async () => {
    try {
      const page = await win.webContents.executeJavaScript(
        "({text:document.getElementById('results').textContent,mode:document.documentElement.dataset.visualQuality,phase:document.documentElement.dataset.auditPhase,users:document.documentElement.dataset.auditUsers,heading:document.querySelector('header').innerText,hidden:document.hidden})",
      );
      report.metrics.push({
        elapsedMs: Date.now() - before,
        mode: page.mode,
        phase: page.phase,
        users: page.users,
        heading: page.heading,
        hidden: page.hidden,
        processes: app.getAppMetrics().map((p) => ({
          type: p.type,
          cpu: p.cpu.percentCPUUsage,
          workingSetKiB: p.memory.workingSetSize,
        })),
      });
      if (page.text.startsWith("{")) {
        clearInterval(timer);
        report.fixture = JSON.parse(page.text);
        fs.writeFileSync(output, JSON.stringify(report, null, 2));
        app.quit();
      }
    } catch (error) {
      clearInterval(timer);
      report.error = error.message;
      fs.writeFileSync(output, JSON.stringify(report, null, 2));
      app.quit();
    }
  }, 1000);
  setTimeout(() => {
    clearInterval(timer);
    report.timeout = true;
    fs.writeFileSync(output, JSON.stringify(report, null, 2));
    app.quit();
  }, 150000);
});
