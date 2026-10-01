const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('lobbyxDesktop',{
 activity:()=>ipcRenderer.invoke('desktop:activity'),
 preference:(key,value)=>ipcRenderer.invoke('desktop:preferences',{key,value}),
});
