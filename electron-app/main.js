'use strict';

const { app, BrowserWindow, ipcMain } = require('electron');
const dgram = require('dgram');
const path  = require('path');

const SSDP_ADDR    = '239.255.255.250';
const SSDP_PORT    = 1900;
const SCAN_TIMEOUT = 5000;
const M_SEARCH =
    'M-SEARCH * HTTP/1.1\r\n' +
    'Host: 239.255.255.250:1900\r\n' +
    'Man: "ssdp:discover"\r\n' +
    'ST: roku:ecp\r\n';

let win;

function createWindow() {
    win = new BrowserWindow({
        width: 360,
        height: 640,
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

// ── SSDP — collect ALL devices, return array with friendly names ───────────────
ipcMain.handle('ssdp-discover', async () => {
    const found = new Map(); // usn → {location, usn, ip}

    await new Promise((resolve) => {
        const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

        socket.bind(0, '0.0.0.0', () => {
            const buf = Buffer.from(M_SEARCH);
            socket.send(buf, 0, buf.length, SSDP_PORT, SSDP_ADDR);
            socket.send(buf, 0, buf.length, SSDP_PORT, SSDP_ADDR);
        });

        socket.on('message', (msg) => {
            const text = msg.toString();
            let location = null, usn = null;
            for (const line of text.split('\r\n')) {
                const key = line.split(':')[0].toUpperCase();
                if (key === 'LOCATION') location = line.slice(line.indexOf(':') + 1).trim();
                if (key === 'USN')      usn      = line.slice(line.indexOf(':') + 1).trim();
            }
            if (location && usn && !found.has(usn)) {
                try {
                    const url = new URL(location);
                    found.set(usn, { location, usn, ip: url.hostname });
                } catch (_) {}
            }
        });

        setTimeout(() => {
            try { socket.close(); } catch (_) {}
            resolve();
        }, SCAN_TIMEOUT);
    });

    if (found.size === 0) return [];

    // Fetch friendly name + model from each device in parallel
    const devices = await Promise.all(
        Array.from(found.values()).map(async (device) => {
            try {
                const res  = await fetch(device.location, { signal: AbortSignal.timeout(3000) });
                const text = await res.text();
                const name  = xmlVal(text, 'friendlyName') || 'Roku Device';
                const model = xmlVal(text, 'modelName')    || '';
                return { ...device, name, model };
            } catch {
                return { ...device, name: 'Roku Device', model: '' };
            }
        })
    );

    return devices;
});

function xmlVal(text, tag) {
    const m = text.match(new RegExp('<' + tag + '>([^<]+)</' + tag + '>'));
    return m ? m[1].trim() : null;
}
