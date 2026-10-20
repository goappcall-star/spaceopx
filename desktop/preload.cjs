const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("lobbyxDesktop", {
  titleBar:
    process.platform === "win32"
      ? {
          appearance: (colors) => ipcRenderer.invoke("desktop:titlebar-appearance", colors),
          state: () => ipcRenderer.invoke("desktop:titlebar-state"),
          subscribe: (callback) => {
            const listener = (_event, state) => callback(state);
            ipcRenderer.on("desktop:titlebar-state", listener);
            return () => ipcRenderer.removeListener("desktop:titlebar-state", listener);
          },
        }
      : undefined,
  clipboard: { writeText: (text) => ipcRenderer.invoke("desktop:clipboard-write", text) },
  performance: () => ipcRenderer.invoke("desktop:performance"),
  activity: () => ipcRenderer.invoke("desktop:activity"),
  preference: (key, value) => ipcRenderer.invoke("desktop:preferences", { key, value }),
  updates: {
    state: () => ipcRenderer.invoke("desktop:update-state"),
    check: () => ipcRenderer.invoke("desktop:update-check"),
    activity: (busy) => ipcRenderer.invoke("desktop:update-activity", busy),
    install: () => ipcRenderer.invoke("desktop:update-install"),
    subscribe: (callback) => {
      const listener = (_event, state) => callback(state);
      ipcRenderer.on("desktop:update-state", listener);
      return () => ipcRenderer.removeListener("desktop:update-state", listener);
    },
  },
});
