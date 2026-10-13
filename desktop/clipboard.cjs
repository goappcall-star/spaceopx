exports.installClipboard = ({ window, ipcMain, clipboard, trusted }) => {
  ipcMain.handle("desktop:clipboard-write", (event, text) => {
    if (window.isDestroyed() || event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame || !trusted(event.senderFrame.url))
      throw Error("Forbidden");
    if (typeof text !== "string" || text.length > 65536) throw Error("Invalid clipboard text");
    clipboard.writeText(text);
    return true;
  });
  return () => ipcMain.removeHandler("desktop:clipboard-write");
};
