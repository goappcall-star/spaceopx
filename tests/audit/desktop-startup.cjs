// Measurement wrapper only: original packaged main/assets, isolated profile,
// hidden window and blocked remote requests. Never loads a user's session.
const { app } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const start = Number(process.argv[4]) || Date.now();
const mainFile = process.argv[2];
const output = process.argv[3];
if (!mainFile || !output) throw Error("Provide packaged main.cjs and output file");
const profile = path.join(path.dirname(output), "audit-profile-" + Date.now());
fs.mkdirSync(profile, { recursive: true });
app.setPath("userData", profile);
const result = {
  scope:
    "Packaged 0.1.43 assets/main under Electron runtime; hidden signed-out window; remote network blocked; excludes installer/auto-update and real call",
  version: JSON.parse(fs.readFileSync(path.join(path.dirname(mainFile), "package.json"))).version,
  samples: [],
  loadErrors: [],
};
let done = false;
function finish() {
  if (done) return;
  done = true;
  fs.writeFileSync(output, JSON.stringify(result, null, 2));
  app.quit();
}
app.on("browser-window-created", (_event, win) => {
  win.webContents.session.webRequest.onBeforeRequest((details, callback) =>
    callback({
      cancel:
        !details.url.startsWith("lobbyx://") &&
        !details.url.startsWith("file://") &&
        !details.url.startsWith("data:"),
    }),
  );
  win.webContents.on("dom-ready", () => {
    result.domReadyMs = Date.now() - start;
  });
  win.webContents.on("did-fail-load", (_event, code) => result.loadErrors.push(code));
  win.webContents.on("did-finish-load", async () => {
    result.loadMs = Date.now() - start;
    try {
      result.page = await win.webContents.executeJavaScript(
        "({loginRendered:document.body.innerText.includes('Entrar'),navigation:performance.getEntriesByType('navigation').map(n=>({domContentLoaded:n.domContentLoadedEventEnd,load:n.loadEventEnd})),paint:performance.getEntriesByType('paint').map(p=>({name:p.name,time:p.startTime})),visibility:document.visibilityState})",
      );
      result.gpuFeatures = app.getGPUFeatureStatus();
      let samples = 0;
      const timer = setInterval(async () => {
        result.samples.push({
          atMs: Date.now() - start,
          processes: app.getAppMetrics().map((p) => ({
            type: p.type,
            cpu: p.cpu.percentCPUUsage,
            workingSetKiB: p.memory.workingSetSize,
            privateKiB: p.memory.privateBytes,
          })),
        });
        if (++samples === 6) {
          clearInterval(timer);
          result.finalPage = await win.webContents.executeJavaScript(
            "({path:location.pathname,bodyCharacters:document.body.innerText.length,hasEmailField:!!document.querySelector('input[type=email]'),publicText:document.body.innerText.slice(0,250)})",
          );
          finish();
        }
      }, 1000);
    } catch (error) {
      result.error = error.message;
      finish();
    }
  });
});
const source = fs
  .readFileSync(mainFile, "utf8")
  .replace("width: 1280,", "show: false, width: 1280,");
const main = new Module(mainFile, module);
main.filename = mainFile;
main.paths = Module._nodeModulePaths(path.dirname(mainFile));
main._compile(source, mainFile);
setTimeout(() => {
  result.timeout = true;
  finish();
}, 22000);
