const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('screenPicker', {
  sources: () => ipcRenderer.invoke('screen-picker:sources'),
  select: (id) => ipcRenderer.send('screen-picker:select', typeof id === 'string' ? id : null),
});
