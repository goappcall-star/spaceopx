const { app, BrowserWindow, protocol, net, session, dialog, shell, ipcMain } = require("electron");
const { installUpdater } = require("./updater.cjs");
const path = require("node:path");
const { chooseScreen } = require("./screen-picker.cjs");
const fs = require("node:fs/promises");
const { createPermissionStore } = require("./permissions.cjs");
const { installActivity } = require("./activity.cjs");
const { classifyMediaRequest } = require("./media-permission.cjs");
const { pathToFileURL } = require("node:url");

protocol.registerSchemesAsPrivileged([
  {
    scheme: "lobbyx",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);
const { authCallback } = require("./auth-link.cjs");
let window;
let ready = false;
let pendingAuth = process.argv.map(authCallback).find(Boolean);
function receiveAuth(args) {
  const callback = args.map(authCallback).find(Boolean);
  if (!callback) return;
  pendingAuth = callback;
  if (window && ready) {
    const next = pendingAuth;
    pendingAuth = null;
    void window.loadURL(next);
  }
}
const trusted = (url) => {
  try {
    const value = new URL(url);
    return value.protocol === "lobbyx:" && value.hostname === "app";
  } catch {
    return false;
  }
};
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", (_event, args) => {
    receiveAuth(args);
    if (window) {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });
  app
    .whenReady()
    .then(async () => {
      if (app.isPackaged) app.setAsDefaultProtocolClient("lobbyx");

      const store = await createPermissionStore(
        path.join(app.getPath("userData"), "permissions.json"),
      );
      const root = path.join(__dirname, "web");
      const ses = session.fromPartition("persist:lobbyx");
      ses.protocol.handle("lobbyx", async (request) => {
        if (!trusted(request.url)) return new Response("Forbidden", { status: 403 });
        let relative;
        try {
          relative = decodeURIComponent(new URL(request.url).pathname).replace(/^\/+/, "");
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        let file = path.resolve(root, relative);
        if (!file.startsWith(root + path.sep) && file !== root)
          return new Response("Forbidden", { status: 403 });
        try {
          if (!(await fs.stat(file)).isFile()) throw new Error();
        } catch {
          if (path.extname(relative)) return new Response("Not found", { status: 404 });
          file = path.join(root, "_shell.html");
        }
        return net.fetch(pathToFileURL(file).toString());
      });
      window = new BrowserWindow({
        width: 1280,
        height: 850,
        minWidth: 800,
        minHeight: 600,
        title: "LobbyX",
        icon: path.join(__dirname, "web", "favicon.ico"),
        backgroundColor: "#0b1019",
        autoHideMenuBar: true,
        webPreferences: {
          preload: path.join(__dirname, "preload.cjs"),
          backgroundThrottling: false,
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          webSecurity: true,
          partition: "persist:lobbyx",
        },
      });
      const permissionPrompts = new Map();
      ses.setPermissionCheckHandler((contents, permission, origin, details) => {
        if (contents !== window?.webContents || !trusted(origin)) return false;
        if (permission === "media") return store.get(details.mediaType) === true;
        return permission === "display-capture" || permission === "fullscreen";
      });
      ses.setPermissionRequestHandler(async (contents, permission, callback, details) => {
        if (
          contents !== window?.webContents ||
          !trusted(contents.getURL()) ||
          details.isMainFrame === false
        )
          return callback(false);
        if (permission === "fullscreen") return callback(true);
        const mediaRequest = classifyMediaRequest(permission, details);
        if (mediaRequest === "display") return callback(true);
        if (mediaRequest !== "device") return callback(false);
        const types = details.mediaTypes;
        try {
          for (const type of types) {
            if (store.get(type) === true) continue;
            if (store.get(type) === false) return callback(false);
            if (!permissionPrompts.has(type))
              permissionPrompts.set(
                type,
                (async () => {
                  const label = type === "audio" ? "microfone" : "câmera";
                  const answer = await dialog.showMessageBox(window, {
                    type: "question",
                    title: "Permissão de " + label,
                    message: "Permitir que o LobbyX use seu " + label + " nas chamadas?",
                    detail:
                      "Sua escolha será salva neste computador. Você pode redefinir as permissões nas configurações.",
                    buttons: ["Não permitir", "Permitir"],
                    defaultId: 0,
                    cancelId: 0,
                  });
                  await store.set(type, answer.response === 1);
                })().finally(() => permissionPrompts.delete(type)),
              );
            await permissionPrompts.get(type);
            if (store.get(type) !== true) return callback(false);
          }
          callback(true);
        } catch {
          callback(false);
        }
      });
      const stopActivity = installActivity({ window, store, trusted });
      window.once("closed", stopActivity);
      let picking = false;
      ses.setDisplayMediaRequestHandler(async (request, callback) => {
        if (
          picking ||
          !trusted(request.securityOrigin) ||
          request.frame !== window?.webContents.mainFrame
        )
          return callback({});
        picking = true;
        try {
          const light = await window.webContents.executeJavaScript(
            'document.documentElement.classList.contains("light")',
          );
          const selected = await chooseScreen(window, {
            audioAvailable: process.platform === "win32" && request.audioRequested,
            theme: light ? "light" : "dark",
          });
          callback(
            selected
              ? {
                  video: selected.source,
                  ...(selected.audio && request.audioRequested && process.platform === "win32"
                    ? { audio: "loopback" }
                    : {}),
                }
              : {},
          );
        } catch {
          callback({});
        } finally {
          picking = false;
        }
      });
      window.webContents.setWindowOpenHandler(({ url }) => {
        if (/^https:\/\//i.test(url)) void shell.openExternal(url);
        return { action: "deny" };
      });
      window.webContents.on("will-navigate", (event, url) => {
        if (!trusted(url)) {
          event.preventDefault();
          if (/^https:\/\//i.test(url)) void shell.openExternal(url);
        }
      });
      window.on("closed", () => {
        window = null;
      });
      const initialURL = pendingAuth || "lobbyx://app/app";
      pendingAuth = null;
      await window.loadURL(initialURL);
      ready = true;
      const stopUpdater = installUpdater({ app, window, ipcMain, trusted });
      window.once("closed", stopUpdater);
      if (pendingAuth) receiveAuth([pendingAuth]);
    })
    .catch((error) => {
      dialog.showErrorBox("Não foi possível abrir o LobbyX", error.message);
      app.quit();
    });
  app.on("window-all-closed", () => app.quit());
}
