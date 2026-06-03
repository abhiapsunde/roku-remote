'use strict';

const { app, BrowserWindow, ipcMain } = require('electron');
const dgram = require('dgram');
const path  = require('path');

const SSDP_ADDR = '239.255.255.250';
const SSDP_PORT = 1900;
const M_SEARCH  =
    'M-SEARCH * HTTP/1.1\r\n' +
    'Host: 239.255.255.250:1900\r\n' +
    'Man: "ssdp:discover"\r\n' +
    'ST: roku:ecp\r\n';

let win;

function createWindow() {
    win = new BrowserWindow({
        width: 370,
        height: 600,
        resizable: false,
        title: 'Roku Remote',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
        },
    });
    win.loadFile('renderer/index.html');
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

// ── SSDP discovery via IPC ─────────────────────────────────────────────────
ipcMain.handle('ssdp-discover', () => {
    return new Promise((resolve) => {
        const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
        let resolved = false;

        socket.bind(0, '0.0.0.0', () => {
            const buf = Buffer.from(M_SEARCH);

            // send twice, as in the original
            for (let i = 0; i < 2; i++) {
                socket.send(buf, 0, buf.length, SSDP_PORT, SSDP_ADDR);
            }
        });

        socket.on('message', (msg) => {
            if (resolved) return;
            const text = msg.toString();
            let location = null;
            let usn = null;

            for (const line of text.split('\r\n')) {
                const key = line.split(':')[0].toUpperCase();
                if (key === 'LOCATION') location = line.slice(line.indexOf(':') + 1).trim();
                if (key === 'USN')      usn      = line.slice(line.indexOf(':') + 1).trim();
            }

            if (location) {
                resolved = true;
                socket.close();
                resolve({ location, usn });
            }
        });

        // timeout after 10s (same as original)
        setTimeout(() => {
            if (!resolved) {
                try { socket.close(); } catch (_) {}
                resolve(null);
            }
        }, 10000);
    });
});
