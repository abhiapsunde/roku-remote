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

// ── Fake channel list ─────────────────────────────────────────────────────────
const CHANNELS = [
    { id: '63126', name: 'Roku Media Player',  version: '5.1.218' },
    { id: 'tvinput.hdmi1', name: 'HDMI 1',     version: '1.0.0' },
    { id: '2285', name: 'Hulu',                version: '4.1.218' },
    { id: '12', name: 'Netflix',               version: '4.1.218' },
];

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

    // Channel icon — return a tiny transparent PNG
    if (url.startsWith('/query/icon/')) {
        const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
        res.writeHead(200, { 'Content-Type': 'image/png' });
        return res.end(PIXEL);
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
