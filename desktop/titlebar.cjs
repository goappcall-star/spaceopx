const HEIGHT = 32;
exports.titlebarOptions =
  process.platform === "win32"
    ? {
        titleBarStyle: "hidden",
        titleBarOverlay: { color: "#080c14", symbolColor: "#929ba7", height: HEIGHT },
      }
    : {};

exports.installTitlebar = ({ window, ipcMain, trusted }) => {
  const contents = window.webContents;
  const fixedTitle = (event) => {
    event.preventDefault();
    window.setTitle("LobbyX");
  };
  contents.on("page-title-updated", fixedTitle);
  const check = (event) => {
    if (
      window.isDestroyed() ||
      event.sender !== contents ||
      event.senderFrame !== contents.mainFrame ||
      !trusted(event.senderFrame.url)
    )
      throw Error("Forbidden");
  };
  const state = () => ({ fullscreen: window.isFullScreen() });
  // On Windows isFullScreen() can still report the previous value inside the event.
  const entered = () => contents.send("desktop:titlebar-state", { fullscreen: true });
  const left = () => contents.send("desktop:titlebar-state", { fullscreen: false });
  if (process.platform === "win32") {
    ipcMain.handle("desktop:titlebar-state", (event) => {
      check(event);
      return state();
    });
    ipcMain.handle("desktop:titlebar-appearance", (event, colors) => {
      check(event);
      if (
        !colors ||
        !/^#[0-9a-f]{6}$/i.test(colors.background) ||
        !/^#[0-9a-f]{6}$/i.test(colors.foreground)
      )
        throw Error("Invalid titlebar colors");
      window.setTitleBarOverlay({
        color: colors.background,
        symbolColor: colors.foreground,
        height: HEIGHT,
      });
      window.setBackgroundColor(colors.background);
      return true;
    });
    window.on("enter-full-screen", entered);
    window.on("leave-full-screen", left);
  }
  return () => {
    contents.removeListener("page-title-updated", fixedTitle);
    if (process.platform === "win32") {
      ipcMain.removeHandler("desktop:titlebar-state");
      ipcMain.removeHandler("desktop:titlebar-appearance");
      window.removeListener("enter-full-screen", entered);
      window.removeListener("leave-full-screen", left);
    }
  };
};
