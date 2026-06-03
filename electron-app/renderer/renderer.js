'use strict';

var rokurl         = null;
var isAgentPresent = false;
var ROKU_AGENT_ID  = 63126;

var maindiv, wheel, connect, rokuNotice, scanStatus, deviceList, remoteScreen, devicePicker;

window.addEventListener('load', function () {
    ['Back','Home','Up','Down','Left','Right','Select','InstantReplay','Info','Rev','Play','Fwd']
        .forEach(function (id) { document.getElementById(id).onclick = handleKeypress; });

    rokuNotice   = document.getElementById('rokuAppNotice');
    maindiv      = document.getElementById('main');          // remote body (hidden until connected)
    wheel        = document.getElementById('spinnn');        // scan animation
    connect      = document.getElementById('start');         // "Scan Again" button
    scanStatus   = document.getElementById('scanStatus');
    deviceList   = document.getElementById('deviceList');
    remoteScreen = document.getElementById('remoteScreen');
    devicePicker = document.getElementById('devicePicker');

    document.getElementById('sendToRoku').onclick = playOnRoku;
    document.getElementById('changeDevice').onclick = showPicker;

    // restore last device from localStorage on startup
    var cached    = localStorage.getItem('rokurl');
    var cachedAge = parseInt(localStorage.getItem('rokurlAge') || '0', 10);
    if (cached && (Date.now() - cachedAge) < 3600000) {
        rokurl = cached;
        var cachedName = localStorage.getItem('rokuName') || 'Roku Device';
        document.getElementById('friendly_name').textContent = cachedName;
        showRemote();
        thingsTodoAfterGettingRokuUrl();
    } else {
        startScan();
    }

    connect.onclick = startScan;
});

// ── Discovery ─────────────────────────────────────────────────────────────────

function showPicker() {
    remoteScreen.style.display = 'none';
    devicePicker.style.display = 'flex';
    rokurl = null;
    startScan();
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

    window.roku.discover().then(function (devices) {
        wheel.classList.add('idle');
        connect.disabled = false;

        if (!devices || devices.length === 0) {
            scanStatus.textContent = 'No Roku devices found.';
            deviceList.innerHTML = '<p class="no-dev">Make sure your Roku is on the same network.</p>';
            return;
        }

        scanStatus.textContent = 'Found ' + devices.length + ' device' + (devices.length > 1 ? 's' : '') + '.';
        deviceList.innerHTML = '';

        devices.forEach(function (device) {
            var card = document.createElement('div');
            card.className = 'device-card';
            card.innerHTML =
                '<div class="dc-info">' +
                    '<div class="dc-name">' + esc(device.name) + '</div>' +
                    '<div class="dc-meta">' + esc(device.ip) + (device.model ? '  ·  ' + esc(device.model) : '') + '</div>' +
                '</div>' +
                '<svg class="dc-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>';
            card.onclick = function () { connectToDevice(device); };
            deviceList.appendChild(card);
        });

        // auto-connect if only one device
        if (devices.length === 1) connectToDevice(devices[0]);
    });
}

function connectToDevice(device) {
    rokurl = device.location.trim();
    localStorage.setItem('rokurl',    rokurl);
    localStorage.setItem('rokurlAge', Date.now().toString());
    localStorage.setItem('rokuName',  device.name || 'Roku Device');

    document.getElementById('friendly_name').textContent = device.name || 'Roku Device';
    showRemote();
    thingsTodoAfterGettingRokuUrl();
}

// ── ECP calls ─────────────────────────────────────────────────────────────────

function rokuAPICall(url) {
    if (!rokurl) { showPicker(); return; }
    fetch(url, { method: 'POST' }).catch(function (e) {
        console.error('ECP call failed:', e);
    });
}

function handleKeypress() {
    rokuAPICall(rokurl + 'keypress/' + this.id);
}

function playOnRoku() {
    if (isAgentPresent) {
        var encoded = encodeURIComponent(document.getElementById('urlinpu').value);
        rokuAPICall(rokurl + 'launch/' + ROKU_AGENT_ID + '?myurl=' + encoded);
    } else {
        rokuNotice.style.display = 'block';
    }
}

// ── After connecting ──────────────────────────────────────────────────────────

function thingsTodoAfterGettingRokuUrl() {
    isAgentPresent = false;
    document.getElementById('channelThing').innerHTML = '';

    fetch(rokurl)
        .then(function (r) { return r.text(); })
        .then(function (text) {
            var parser   = new DOMParser();
            var xml      = parser.parseFromString(text, 'text/xml');
            var friendly = val(xml, 'friendlyName') || 'Roku Device';
            var model    = val(xml, 'modelName')    || '';

            document.getElementById('friendly_name').textContent =
                friendly + (model ? ' · ' + model : '');
            localStorage.setItem('rokuName', friendly + (model ? ' · ' + model : ''));

            populateChannelPad();
        })
        .catch(function (e) {
            console.error('Could not reach Roku at', rokurl, e);
            rokurl = null;
            localStorage.removeItem('rokurl');
            showPicker();
        });
}

function populateChannelPad() {
    fetch(rokurl + 'query/apps')
        .then(function (r) { return r.text(); })
        .then(function (text) {
            var parser    = new DOMParser();
            var xml       = parser.parseFromString(text, 'text/xml');
            var apps      = xml.getElementsByTagName('app');
            var container = document.getElementById('channelThing');
            container.innerHTML = '';

            for (var i = 0; i < apps.length; i++) {
                (function (app) {
                    var id = app.getAttribute('id');
                    if (parseInt(id, 10) === ROKU_AGENT_ID) {
                        isAgentPresent = true;
                        rokuNotice.style.display = 'none';
                    }

                    var img = document.createElement('img');
                    img.title  = app.textContent || id;
                    img.width  = 72;
                    img.height = 48;

                    fetch(rokurl + 'query/icon/' + id)
                        .then(function (r) { return r.blob(); })
                        .then(function (blob) { img.src = URL.createObjectURL(blob); })
                        .catch(function () {});

                    var launchUrl = rokurl + 'launch/' + id;
                    img.addEventListener('click', function () { rokuAPICall(launchUrl); });
                    container.appendChild(img);
                })(apps[i]);
            }
        });
}

// ── Util ──────────────────────────────────────────────────────────────────────

function val(xml, tag) {
    var el = xml.getElementsByTagName(tag)[0];
    return el && el.childNodes[0] ? el.childNodes[0].nodeValue : null;
}

function esc(s) {
    return String(s || '')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
