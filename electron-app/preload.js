'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('roku', {
    discover: () => ipcRenderer.invoke('ssdp-discover'),
    fetch:    (url, method) => ipcRenderer.invoke('roku-fetch', url, method || 'GET'),
});
