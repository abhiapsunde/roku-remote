#!/usr/bin/env node
'use strict';

const dgram  = require('dgram');
const http   = require('http');
const os     = require('os');

// ── Config ────────────────────────────────────────────────────────────────────
const ECP_PORT   = 8060;
const SSDP_ADDR  = '239.255.255.250';
const SSDP_PORT  = 1900;
const DEVICE_ID  = 'X07000125MG';
const DEVICE_USN = `uuid:roku:ecp:${DEVICE_ID}`;

function getLocalIP() {
    for (const iface of Object.values(os.networkInterfaces()).flat()) {
        if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
    return '127.0.0.1';
}
const LOCAL_IP = getLocalIP();
const LOCATION = `http://${LOCAL_IP}:${ECP_PORT}/`;

// ── Fake channel list + icons ─────────────────────────────────────────────────
const CHANNELS = [
    { id: '63126',          name: 'Roku Media Player', version: '5.1.218' },
    { id: 'tvinput.hdmi1',  name: 'HDMI 1',            version: '1.0.0'   },
    { id: '2285',           name: 'Hulu',               version: '4.1.218' },
    { id: '12',             name: 'Netflix',            version: '4.1.218' },
    { id: 'tvinput.hdmi2',  name: 'HDMI 2',            version: '1.0.0'   },
];

// SVG icons keyed by channel id
const ICONS = {
    '63126': `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="64" viewBox="0 0 96 64">
        <rect width="96" height="64" rx="8" fill="#6C2DC7"/>
        <polygon points="36,20 36,44 64,32" fill="white" opacity="0.9"/>
    </svg>`,

    'tvinput.hdmi1': `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="64" viewBox="0 0 96 64">
        <rect width="96" height="64" rx="8" fill="#1a2a4a"/>
        <text x="48" y="28" font-family="monospace" font-size="11" font-weight="bold" fill="#60a5fa" text-anchor="middle">HDMI</text>
        <text x="48" y="46" font-family="monospace" font-size="18" font-weight="bold" fill="white" text-anchor="middle">1</text>
    </svg>`,

    'tvinput.hdmi2': `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="64" viewBox="0 0 96 64">
        <rect width="96" height="64" rx="8" fill="#1a3a2a"/>
        <text x="48" y="28" font-family="monospace" font-size="11" font-weight="bold" fill="#4ade80" text-anchor="middle">HDMI</text>
        <text x="48" y="46" font-family="monospace" font-size="18" font-weight="bold" fill="white" text-anchor="middle">2</text>
    </svg>`,

    '2285': `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="64" viewBox="0 0 96 64">
        <rect width="96" height="64" rx="8" fill="#1ce783"/>
        <text x="48" y="38" font-family="Arial,sans-serif" font-size="20" font-weight="bold" fill="#0a0a0a" text-anchor="middle" dominant-baseline="middle">hulu</text>
    </svg>`,

    '12': `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="64" viewBox="0 0 96 64">
        <rect width="96" height="64" rx="8" fill="#E50914"/>
        <text x="48" y="38" font-family="Arial,sans-serif" font-size="34" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">N</text>
    </svg>`,

    '_default': `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="64" viewBox="0 0 96 64">
        <rect width="96" height="64" rx="8" fill="#1c1c2b"/>
        <rect x="28" y="20" width="40" height="24" rx="3" fill="none" stroke="#555" stroke-width="1.5"/>
        <circle cx="48" cy="32" r="5" fill="#555"/>
    </svg>`,
};

// ── ECP HTTP server ───────────────────────────────────────────────────────────
const ecpServer = http.createServer((req, res) => {
    const url = req.url;
    console.log(`[ECP] ${req.method} ${url}`);

    // Device info
    if (url === '/' || url === '/query/device-info') {
        res.writeHead(200, { 'Content-Type': 'text/xml' });
        return res.end(`<?xml version="1.0" encoding="UTF-8"?>
<root>
  <specVersion><major>1</major><minor>0</minor></specVersion>
  <device>
    <friendlyName>Roku Emulator</friendlyName>
    <modelName>Roku Express</modelName>
    <serialNumber>${DEVICE_ID}</serialNumber>
    <softwareVersion>9.2.0</softwareVersion>
    <udn>${DEVICE_USN}</udn>
  </device>
</root>`);
    }

    // App list
    if (url === '/query/apps') {
        res.writeHead(200, { 'Content-Type': 'text/xml' });
        const apps = CHANNELS.map(c =>
            `  <app id="${c.id}" version="${c.version}">${c.name}</app>`
        ).join('\n');
        return res.end(`<?xml version="1.0" encoding="UTF-8"?>\n<apps>\n${apps}\n</apps>`);
    }

    // Channel icon — return a distinctive SVG per channel
    if (url.startsWith('/query/icon/')) {
        const chanId = url.split('/query/icon/')[1];
        const svg = ICONS[chanId] || ICONS['_default'];
        res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
        return res.end(svg);
    }

    // Keypress
    if (url.startsWith('/keypress/')) {
        const key = url.split('/keypress/')[1];
        console.log(`[ECP] 🎮 keypress: ${key}`);
        res.writeHead(200);
        return res.end();
    }

    // Launch
    if (url.startsWith('/launch/')) {
        const parts  = url.split('/launch/')[1].split('?');
        const chanId = parts[0];
        const params = new URLSearchParams(parts[1] || '');
        const videoUrl = params.get('myurl') ? decodeURIComponent(params.get('myurl')) : null;
        const chan = CHANNELS.find(c => c.id === chanId) || { name: chanId };
        console.log(`[ECP] 🚀 launch channel: ${chan.name}${videoUrl ? ' → ' + videoUrl : ''}`);
        res.writeHead(200);
        return res.end();
    }

    res.writeHead(404);
    res.end();
});

ecpServer.listen(ECP_PORT, () =>
    console.log(`[ECP] Roku emulator HTTP server  →  http://${LOCAL_IP}:${ECP_PORT}/`)
);

// ── SSDP UDP responder ────────────────────────────────────────────────────────
const SSDP_RESPONSE = [
    'HTTP/1.1 200 OK',
    'Cache-Control: max-age=3600',
    `Location: ${LOCATION}`,
    'ST: roku:ecp',
    `USN: ${DEVICE_USN}`,
    '',
    '',
].join('\r\n');

const udp = dgram.createSocket({ type: 'udp4', reuseAddr: true });

udp.on('message', (msg, rinfo) => {
    const text = msg.toString();
    if (text.includes('M-SEARCH') && text.includes('roku:ecp')) {
        console.log(`[SSDP] M-SEARCH from ${rinfo.address}:${rinfo.port} — responding`);
        const buf = Buffer.from(SSDP_RESPONSE);
        udp.send(buf, 0, buf.length, rinfo.port, rinfo.address);
    }
});

udp.on('listening', () => {
    udp.addMembership(SSDP_ADDR, '0.0.0.0');
    console.log(`[SSDP] Listening on ${SSDP_ADDR}:${SSDP_PORT}`);
    console.log(`\nEmulator ready. Device ID: ${DEVICE_ID}  IP: ${LOCAL_IP}\n`);
});

udp.bind(SSDP_PORT, '0.0.0.0');
