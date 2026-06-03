'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('roku', {
    discover: () => ipcRenderer.invoke('ssdp-discover'),
});
