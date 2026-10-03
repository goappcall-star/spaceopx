const { BrowserWindow, desktopCapturer, ipcMain } = require('electron');
const path = require('node:path');

exports.chooseScreen = async (parent) => {
  const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 480, height: 270 }, fetchWindowIcons: true });
  if (!sources.length || parent.isDestroyed()) return null;
  return new Promise((resolve) => {
    const picker = new BrowserWindow({ parent, modal: true, width: 660, height: 610, resizable: false, minimizable: false, maximizable: false, show: false, autoHideMenuBar: true, title: 'Compartilhar tela', backgroundColor: '#171b24', webPreferences: { preload: path.join(__dirname, 'picker-preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false } });
    let settled = false;
    const finish = (source = null) => {
      if (settled) return;
      settled = true;
      ipcMain.removeHandler('screen-picker:sources');
      ipcMain.removeListener('screen-picker:select', select);
      resolve(source);
      if (!picker.isDestroyed()) picker.close();
    };
    const valid = (event) => !picker.isDestroyed() && event.sender === picker.webContents && event.senderFrame === picker.webContents.mainFrame;
    const select = (event, id) => { if (valid(event)) finish(sources.find(source => source.id === id) ?? null); };
    ipcMain.handle('screen-picker:sources', (event) => valid(event) ? sources.map(source => ({ id: source.id, name: source.name, thumbnail: source.thumbnail.toDataURL(), icon: source.appIcon?.toDataURL() ?? null })) : []);
    ipcMain.on('screen-picker:select', select);
    picker.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    picker.webContents.on('will-navigate', event => event.preventDefault());
    picker.once('closed', () => finish());
    picker.once('ready-to-show', () => picker.show());
    picker.loadFile(path.join(__dirname, 'picker.html')).catch(() => finish());
  });
};
