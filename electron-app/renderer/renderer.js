'use strict';

var rokurl   = null;
var devices  = [];   // all devices found in last scan

var maindiv, wheel, connect, scanStatus, deviceList;
var remoteScreen, devicePicker;
var switcherSheet, sheetBackdrop, switcherList, sheetRescan;

window.addEventListener('load', function () {
    ['Back','Home','Power','Up','Down','Left','Right','Select','InstantReplay','Info','Rev','Play','Fwd','VolumeDown','VolumeMute','VolumeUp']
        .forEach(function (id) { document.getElementById(id).onclick = handleKeypress; });

    maindiv      = document.getElementById('main');
    wheel        = document.getElementById('spinnn');
    connect      = document.getElementById('start');
    scanStatus   = document.getElementById('scanStatus');
    deviceList   = document.getElementById('deviceList');
    remoteScreen = document.getElementById('remoteScreen');
    devicePicker = document.getElementById('devicePicker');
    switcherSheet  = document.getElementById('switcherSheet');
    sheetBackdrop  = document.getElementById('sheetBackdrop');
    switcherList   = document.getElementById('switcherList');
    sheetRescan    = document.getElementById('sheetRescan');

    connect.onclick     = startScan;
    document.getElementById('changeDevice').onclick = openSwitcher;
    sheetRescan.onclick = function () { rescanFromSheet(); };
    sheetBackdrop.onclick = closeSheet;

    // restore last used device
    var cached    = localStorage.getItem('rokurl');
    var cachedAge = parseInt(localStorage.getItem('rokurlAge') || '0', 10);
    if (cached && (Date.now() - cachedAge) < 3600000) {
        rokurl = cached;
        document.getElementById('friendly_name').textContent =
            localStorage.getItem('rokuName') || 'Roku Device';
        showRemote();
        thingsTodoAfterGettingRokuUrl();
    } else {
        startScan();
    }
});

// ── Discovery ─────────────────────────────────────────────────────────────────

function showPicker() {
    remoteScreen.style.display = 'none';
    devicePicker.style.display = 'flex';
}

function showRemote() {
    devicePicker.style.display = 'none';
    remoteScreen.style.display = 'flex';
}

function startScan() {
    connect.disabled = true;
    deviceList.innerHTML = '';
    scanStatus.textContent = 'Scanning your network…';
    wheel.classList.remove('idle');

    window.roku.discover().then(function (found) {
        devices = found || [];
        wheel.classList.add('idle');
        connect.disabled = false;

        if (devices.length === 0) {
            scanStatus.textContent = 'No Roku devices found.';
            deviceList.innerHTML = '<p class="no-dev">Make sure your Roku is on the same network.</p>';
            updateDeviceCount();
            return;
        }

        scanStatus.textContent = 'Found ' + devices.length +
            ' device' + (devices.length > 1 ? 's' : '') + '.';
        renderPickerList(devices);
        updateDeviceCount();

        if (devices.length === 1) connectToDevice(devices[0]);
    });
}

function renderPickerList(list) {
    deviceList.innerHTML = '';
    list.forEach(function (device) {
        var card = document.createElement('div');
        card.className = 'device-card';
        card.innerHTML =
            '<div><div class="dc-name">' + esc(device.name) + '</div>' +
            '<div class="dc-meta">' + esc(device.ip) +
                (device.model ? '  ·  ' + esc(device.model) : '') + '</div></div>' +
            '<svg class="dc-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">' +
                '<polyline points="9 18 15 12 9 6"/></svg>';
        card.onclick = function () { connectToDevice(device); };
        deviceList.appendChild(card);
    });
}

function connectToDevice(device) {
    rokurl = device.location.trim();
    localStorage.setItem('rokurl',    rokurl);
    localStorage.setItem('rokurlAge', Date.now().toString());
    localStorage.setItem('rokuName',  device.name || 'Roku Device');
    document.getElementById('friendly_name').textContent = device.name || 'Roku Device';
    showRemote();
    closeSheet();
    thingsTodoAfterGettingRokuUrl();
}

// ── Bottom-sheet switcher ─────────────────────────────────────────────────────

function openSwitcher() {
    renderSwitcherList(devices);
    switcherSheet.classList.add('open');
    sheetBackdrop.classList.add('open');
}

function closeSheet() {
    switcherSheet.classList.remove('open');
    sheetBackdrop.classList.remove('open');
}

function renderSwitcherList(list) {
    switcherList.innerHTML = '';

    if (!list || list.length === 0) {
        switcherList.innerHTML = '<p class="no-dev" style="padding:8px 0">No devices — use Rescan.</p>';
        return;
    }

    list.forEach(function (device) {
        var isCurrent = device.location.trim() === rokurl;
        var card = document.createElement('div');
        card.className = 'switcher-card' + (isCurrent ? ' current' : '');
        card.innerHTML =
            '<div class="sc-icon">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
                    '<rect x="2" y="5" width="20" height="14" rx="3"/>' +
                    '<circle cx="12" cy="12" r="2"/>' +
                '</svg>' +
            '</div>' +
            '<div class="sc-info">' +
                '<div class="sc-name">' + esc(device.name) + '</div>' +
                '<div class="sc-meta">' + esc(device.ip) +
                    (device.model ? ' · ' + esc(device.model) : '') + '</div>' +
            '</div>' +
            (isCurrent ? '<span class="sc-badge">ACTIVE</span>' : '');

        if (!isCurrent) {
            card.onclick = function () { connectToDevice(device); };
        }
        switcherList.appendChild(card);
    });
}

function updateDeviceCount() {
    var el = document.getElementById('deviceCount');
    if (devices.length > 1) {
        el.textContent = devices.length + ' devices';
        el.style.display = '';
    } else {
        el.style.display = 'none';
    }
}

function rescanFromSheet() {
    sheetRescan.disabled = true;
    switcherList.innerHTML = '<p class="no-dev" style="padding:8px 0">Scanning…</p>';

    window.roku.discover().then(function (found) {
        devices = found || [];
        sheetRescan.disabled = false;
        updateDeviceCount();
        renderSwitcherList(devices);
    });
}

// ── ECP calls ─────────────────────────────────────────────────────────────────

function rokuAPICall(url) {
    if (!rokurl) { showPicker(); return; }
    window.roku.fetch(url, 'POST').catch(function (e) {
        console.error('ECP call failed:', e);
    });
}

function handleKeypress() {
    rokuAPICall(rokurl + 'keypress/' + this.id);
}

// ── After connecting ──────────────────────────────────────────────────────────


function thingsTodoAfterGettingRokuUrl() {
    document.getElementById('channelThing').innerHTML = '';

    window.roku.fetch(rokurl, 'GET')
        .then(function (res) {
            if (!res.ok) throw new Error('failed');
            return res.text;
        })
        .then(function (text) {
            var friendly = xmlVal(text, 'friendlyName') || 'Roku Device';
            var model    = xmlVal(text, 'modelName')    || '';
            var label    = friendly + (model ? ' · ' + model : '');

            document.getElementById('friendly_name').textContent = label;
            localStorage.setItem('rokuName', label);

            populateChannelPad();
        })
        .catch(function () {
            rokurl = null;
            localStorage.removeItem('rokurl');
            showPicker();
            startScan();
        });
}

function populateChannelPad() {
    window.roku.fetch(rokurl + 'query/apps', 'GET')
        .then(function (res) {
            if (!res.ok) {
                document.getElementById('channelThing').innerHTML =
                    '<div class="ecp-warning"><strong>Channel list unavailable</strong>' +
                    'Your Roku is blocking remote control access. To fix:<br>' +
                    '1. On Roku: Settings → System → Advanced system settings<br>' +
                    '2. Select "Control by mobile apps"<br>' +
                    '3. Change from "Limited" to "Enabled"</div>';
                return null;
            }
            return res.text;
        })
        .then(function (text) {
            if (!text) return;
            var parser    = new DOMParser();
            var xml       = parser.parseFromString(text, 'text/xml');
            var apps      = xml.getElementsByTagName('app');
            var container = document.getElementById('channelThing');
            container.innerHTML = '';

            for (var i = 0; i < apps.length; i++) {
                (function (app) {
                    var id    = app.getAttribute('id');
                    var name  = app.textContent.trim() || id;

                    var tile  = document.createElement('div');
                    tile.className = 'channel-tile';

                    var img   = document.createElement('img');
                    img.alt   = name;

                    var label = document.createElement('span');
                    label.textContent = name;

                    window.roku.fetch(rokurl + 'query/icon/' + id, 'GET')
                        .then(function (res) { if (res.dataUrl) img.src = res.dataUrl; })
                        .catch(function () {});

                    var launchUrl = rokurl + 'launch/' + id;
                    tile.addEventListener('click', function () { rokuAPICall(launchUrl); });

                    tile.appendChild(img);
                    tile.appendChild(label);
                    container.appendChild(tile);
                })(apps[i]);
            }
        });
}

// ── Util ──────────────────────────────────────────────────────────────────────

function xmlVal(text, tag) {
    var m = text.match(new RegExp('<' + tag + '>([^<]+)</' + tag + '>'));
    return m ? m[1].trim() : null;
}

function esc(s) {
    return String(s || '')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
