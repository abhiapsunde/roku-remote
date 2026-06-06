#!/usr/bin/env node
'use strict';

const dgram = require('dgram');
const http  = require('http');
const os    = require('os');

// ── CLI args  (--port 8060 --name "Living Room" --id X07000125MG) ─────────────
const args = {};
process.argv.slice(2).forEach((v, i, a) => {
    if (v.startsWith('--')) args[v.slice(2)] = a[i + 1];
});

const ECP_PORT   = parseInt(args.port  || '8060', 10);
const DEVICE_NAME = args.name || 'Roku Emulator';
const DEVICE_ID   = args.id   || ('EMU' + ECP_PORT);
const DEVICE_USN  = `uuid:roku:ecp:${DEVICE_ID}`;

const SSDP_ADDR  = '239.255.255.250';
const SSDP_PORT  = 1900;

function getLocalIP() {
    for (const iface of Object.values(os.networkInterfaces()).flat()) {
        if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
    return '127.0.0.1';
}
const LOCAL_IP = getLocalIP();
const LOCATION = `http://${LOCAL_IP}:${ECP_PORT}/`;

// ── Channel list ──────────────────────────────────────────────────────────────
const CHANNELS = [
    { id: '63126',         name: 'Roku Media Player', version: '5.1.218' },
    { id: 'tvinput.hdmi1', name: 'HDMI 1',            version: '1.0.0'   },
    { id: 'tvinput.hdmi2', name: 'HDMI 2',            version: '1.0.0'   },
    { id: '2285',          name: 'Hulu',               version: '4.1.218' },
    { id: '12',            name: 'Netflix',            version: '4.1.218' },
];

const ICONS = {
    '63126': svgIcon('#6C2DC7', `<polygon points="36,20 36,44 64,32" fill="white" opacity="0.9"/>`),
    'tvinput.hdmi1': svgIcon('#1a2a4a',
        `<text x="48" y="27" font-family="monospace" font-size="11" font-weight="bold" fill="#60a5fa" text-anchor="middle">HDMI</text>
         <text x="48" y="46" font-family="monospace" font-size="18" font-weight="bold" fill="white" text-anchor="middle">1</text>`),
    'tvinput.hdmi2': svgIcon('#1a3a2a',
        `<text x="48" y="27" font-family="monospace" font-size="11" font-weight="bold" fill="#4ade80" text-anchor="middle">HDMI</text>
         <text x="48" y="46" font-family="monospace" font-size="18" font-weight="bold" fill="white" text-anchor="middle">2</text>`),
    '2285': svgIcon('#1ce783',
        `<text x="48" y="38" font-family="Arial,sans-serif" font-size="20" font-weight="bold" fill="#0a0a0a" text-anchor="middle" dominant-baseline="middle">hulu</text>`),
    '12': svgIcon('#E50914',
        `<text x="48" y="38" font-family="Arial,sans-serif" font-size="34" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">N</text>`),
    _default: svgIcon('#1c1c2b',
        `<rect x="28" y="20" width="40" height="24" rx="3" fill="none" stroke="#555" stroke-width="1.5"/>
         <circle cx="48" cy="32" r="5" fill="#555"/>`),
};

function svgIcon(bg, content) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="64" viewBox="0 0 96 64">
        <rect width="96" height="64" rx="8" fill="${bg}"/>${content}</svg>`;
}

// ── ECP HTTP server ───────────────────────────────────────────────────────────
const ecpServer = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    console.log(`[${DEVICE_NAME}] ${req.method} ${req.url}`);

    if (url === '/' || url === '/query/device-info') {
        res.writeHead(200, { 'Content-Type': 'text/xml' });
        return res.end(`<?xml version="1.0" encoding="UTF-8"?>
<root>
  <specVersion><major>1</major><minor>0</minor></specVersion>
  <device>
    <friendlyName>${DEVICE_NAME}</friendlyName>
    <modelName>Roku Express</modelName>
    <serialNumber>${DEVICE_ID}</serialNumber>
    <softwareVersion>9.2.0</softwareVersion>
    <udn>${DEVICE_USN}</udn>
    <is-tv>false</is-tv>
  </device>
</root>`);
    }

    if (url === '/query/apps') {
        res.writeHead(200, { 'Content-Type': 'text/xml' });
        return res.end(`<?xml version="1.0" encoding="UTF-8"?>\n<apps>\n${
            CHANNELS.map(c => `  <app id="${c.id}" version="${c.version}">${c.name}</app>`).join('\n')
        }\n</apps>`);
    }

    if (url.startsWith('/query/icon/')) {
        const id  = url.split('/query/icon/')[1];
        const svg = ICONS[id] || ICONS._default;
        res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
        return res.end(svg);
    }

    if (url.startsWith('/keypress/')) {
        const key = url.split('/keypress/')[1];
        console.log(`[${DEVICE_NAME}] 🎮  ${key}`);
        res.writeHead(200); return res.end();
    }

    if (url.startsWith('/launch/')) {
        const parts  = url.split('/launch/')[1].split('?');
        const chanId = parts[0];
        const chan    = CHANNELS.find(c => c.id === chanId) || { name: chanId };
        console.log(`[${DEVICE_NAME}] 🚀  ${chan.name}`);
        res.writeHead(200); return res.end();
    }

    res.writeHead(404); res.end();
});

ecpServer.listen(ECP_PORT, () =>
    console.log(`[${DEVICE_NAME}]  ECP  →  http://${LOCAL_IP}:${ECP_PORT}/`)
);

// ── SSDP responder ────────────────────────────────────────────────────────────
const RESPONSE = [
    'HTTP/1.1 200 OK',
    'Cache-Control: max-age=3600',
    `Location: ${LOCATION}`,
    'ST: roku:ecp',
    `USN: ${DEVICE_USN}`,
    '', '',
].join('\r\n');

const udp = dgram.createSocket({ type: 'udp4', reuseAddr: true });

udp.on('message', (msg, rinfo) => {
    const text = msg.toString();
    if (text.includes('M-SEARCH') && (text.includes('roku:ecp') || text.includes('ssdp:all'))) {
        console.log(`[${DEVICE_NAME}]  SSDP ← ${rinfo.address} — responding`);
        const buf = Buffer.from(RESPONSE);
        udp.send(buf, 0, buf.length, rinfo.port, rinfo.address);
    }
});

udp.on('listening', () => {
    try { udp.addMembership(SSDP_ADDR, '0.0.0.0'); } catch (_) {}
    console.log(`[${DEVICE_NAME}]  SSDP  →  ${SSDP_ADDR}:${SSDP_PORT}`);
    console.log(`\n  Device: ${DEVICE_NAME}  (${DEVICE_ID})  at ${LOCAL_IP}:${ECP_PORT}\n`);
});

udp.bind(SSDP_PORT, '0.0.0.0');
