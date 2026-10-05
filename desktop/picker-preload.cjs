const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("screenPicker", {
  sources: () => ipcRenderer.invoke("screen-picker:sources"),
  theme: process.argv.includes("--picker-theme=light") ? "light" : "dark",
  audioAvailable: process.argv.includes("--picker-audio=true"),
  select: (value) =>
    ipcRenderer.send(
      "screen-picker:select",
      value && typeof value.id === "string" ? { id: value.id, audio: value.audio === true } : null,
    ),
});
