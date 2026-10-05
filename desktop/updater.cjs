// The controller is independent of Electron so installation safety can be tested.
exports.createUpdateController = ({ updater, version, publish, now = Date.now }) => {
  let activity = null,
    activityAt = 0,
    checking = false,
    disposed = false;
  let state = {
    status: "idle",
    currentVersion: version,
    version: null,
    percent: 0,
    busy: true,
    message: null,
  };
  const listeners = [];
  const blocked = () => activity === null || now() - activityAt > 10000 || activity;
  const send = (patch = {}) => {
    state = { ...state, ...patch, busy: blocked() };
    if (!disposed) publish({ ...state });
    return { ...state };
  };
  const on = (name, handler) => {
    updater.on(name, handler);
    listeners.push([name, handler]);
  };
  updater.autoDownload = true;
  // Never install on ordinary quit, logout, Windows shutdown, or call end.
  updater.autoInstallOnAppQuit = false;
  updater.autoRunAppAfterInstall = true;
  updater.allowPrerelease = false;
  updater.allowDowngrade = false;
  updater.logger = null;
  on("checking-for-update", () => send({ status: "checking", message: null }));
  on("update-available", (info) =>
    send({ status: "downloading", version: info.version, percent: 0 }),
  );
  on("update-not-available", () => send({ status: "idle", message: null }));
  on("download-progress", (progress) =>
    send({
      status: "downloading",
      percent: Number.isFinite(progress.percent) ? Math.min(100, Math.max(0, progress.percent)) : 0,
    }),
  );
  on("update-downloaded", (info) =>
    send({ status: "ready", version: info.version, percent: 100, message: null }),
  );
  const failed = () =>
    send({
      status: "error",
      message:
        "Não foi possível atualizar. Você pode continuar usando o LobbyX e tentar novamente.",
    });
  on("error", failed);
  return {
    snapshot: () => ({ ...state, busy: blocked() }),
    activity(busy) {
      if (typeof busy !== "boolean") throw Error("Invalid activity");
      activity = busy;
      activityAt = now();
      return send();
    },
    resetActivity() {
      activity = null;
      return send();
    },
    async check() {
      if (checking || ["ready", "installing", "downloading"].includes(state.status) || disposed)
        return this.snapshot();
      checking = true;
      try {
        const result = await updater.checkForUpdates();
        if (result?.downloadPromise) await result.downloadPromise;
      } catch {
        failed();
      } finally {
        checking = false;
      }
      return this.snapshot();
    },
    install() {
      if (state.status !== "ready" || blocked() || disposed)
        return {
          ok: false,
          message: "Encerre a chamada ou o compartilhamento antes de atualizar.",
        };
      send({ status: "installing" });
      try {
        updater.quitAndInstall(true, true);
        return { ok: state.status === "installing" };
      } catch {
        failed();
        return { ok: false, message: state.message };
      }
    },
    dispose() {
      disposed = true;
      for (const [name, handler] of listeners) updater.removeListener(name, handler);
    },
  };
};

exports.installUpdater = ({ app, window, ipcMain, trusted }) => {
  if (!app.isPackaged || process.platform !== "win32") return () => {};
  let controller;
  const valid = (event) =>
    event.sender === window.webContents &&
    event.senderFrame === window.webContents.mainFrame &&
    trusted(event.senderFrame.url);
  const handlers = [];
  try {
    const { autoUpdater } = require("electron-updater");
    controller = exports.createUpdateController({
      updater: autoUpdater,
      version: app.getVersion(),
      publish: (state) => {
        if (!window.isDestroyed()) window.webContents.send("desktop:update-state", state);
      },
    });
    for (const [channel, handler] of [
      ["desktop:update-state", () => controller.snapshot()],
      ["desktop:update-check", () => controller.check()],
      ["desktop:update-activity", (_event, busy) => controller.activity(busy)],
      ["desktop:update-install", () => controller.install()],
    ]) {
      ipcMain.handle(channel, (event, ...args) => {
        if (!valid(event)) throw Error("Forbidden");
        return handler(event, ...args);
      });
      handlers.push(channel);
    }
    window.webContents.on("did-start-loading", controller.resetActivity);
    // Non-blocking: update failures never flow into the application's startup catch.
    void controller.check();
  } catch {
    console.warn("Atualizações indisponíveis; LobbyX continuará normalmente.");
  }
  return () => {
    controller?.dispose();
    if (controller)
      window.webContents.removeListener("did-start-loading", controller.resetActivity);
    for (const channel of handlers) ipcMain.removeHandler(channel);
  };
};
