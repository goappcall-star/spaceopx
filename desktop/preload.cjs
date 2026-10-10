const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("lobbyxDesktop", {
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
