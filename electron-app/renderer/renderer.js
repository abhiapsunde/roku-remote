'use strict';

// ── State ─────────────────────────────────────────────────────────────────────
var rokurl        = null;
var isAgentPresent = false;
var ROKU_AGENT_ID  = 63126;

// ── DOM refs (populated on load) ──────────────────────────────────────────────
var output, maindiv, wheel, connect, rokuNotice;

window.addEventListener('load', function () {
    var remoteButtons = ['Home','Rev','Fwd','Play','Select','Left','Right','Down','Up','Back','InstantReplay','Info'];
    remoteButtons.forEach(function (id) {
        document.getElementById(id).onclick = handleKeypress;
    });

    rokuNotice = document.getElementById('rokuAppNotice');
    output     = document.getElementById('output');
    maindiv    = document.getElementById('main');
    wheel      = document.getElementById('spinnn');
    connect    = document.getElementById('start');

    var spinner = new Spinner(opts).spin(document.getElementById('spinnn'));

    connect.onclick = ssdpCheckAndRun;
    document.getElementById('sendToRoku').onclick = playOnRoku;

    ssdpCheckAndRun();
});

// ── SSDP — delegates UDP to main process via preload bridge ───────────────────
function ssdpCheckAndRun() {
    connect.disabled = true;

    // Use cached URL if fresher than 1 hour
    var cached = localStorage.getItem('rokurl');
    var cachedAge = parseInt(localStorage.getItem('rokurlAge') || '0', 10);
    if (cached && (Date.now() - cachedAge) < 3600000) {
        rokurl = cached;
        thingsTodoAfterGettingRokuUrl();
        return;
    }

    wheel.style.display = 'block';

    window.roku.discover().then(function (result) {
        wheel.style.display = 'none';
        connect.disabled = false;

        if (!result) {
            console.log('No Roku found — check network or use Find Roku button');
            return;
        }

        rokurl = result.location.trim();
        localStorage.setItem('rokurl',    rokurl);
        localStorage.setItem('rokurlAge', Date.now().toString());

        thingsTodoAfterGettingRokuUrl();
    });
}

// ── ECP HTTP calls (plain fetch — works fine in Electron renderer) ────────────
function rokuAPICall(url) {
    if (!rokurl) { ssdpCheckAndRun(); return; }
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

// ── After Roku URL is known: fetch device info + channel list ─────────────────
function thingsTodoAfterGettingRokuUrl() {
    fetch(rokurl)
        .then(function (r) { return r.text(); })
        .then(function (text) {
            var parser  = new DOMParser();
            var xmlDoc  = parser.parseFromString(text, 'text/xml');
            var friendly = xmlDoc.getElementsByTagName('friendlyName')[0].childNodes[0].nodeValue;
            var model    = xmlDoc.getElementsByTagName('modelName')[0].childNodes[0].nodeValue;

            document.getElementById('friendly_name').innerHTML = '<h2>' + friendly + ' / ' + model + '</h2>';
            maindiv.style.display = 'block';
            output.style.display  = 'block';

            populateChannelPad();
        })
        .catch(function (e) {
            console.error('Could not reach Roku at', rokurl, e);
            rokurl = null;
            localStorage.removeItem('rokurl');
            connect.disabled = false;
        });
}

function populateChannelPad() {
    fetch(rokurl + 'query/apps')
        .then(function (r) { return r.text(); })
        .then(function (text) {
            var parser   = new DOMParser();
            var xmlDoc   = parser.parseFromString(text, 'text/xml');
            var apps     = xmlDoc.getElementsByTagName('app');
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
                    img.style.width  = '96px';
                    img.style.height = '72px';
                    img.style.cursor = 'pointer';

                    fetch(rokurl + 'query/icon/' + id)
                        .then(function (r) { return r.blob(); })
                        .then(function (blob) { img.src = URL.createObjectURL(blob); })
                        .catch(function () {});

                    img.addEventListener('click', function () {
                        rokuAPICall(rokurl + 'launch/' + id);
                    });

                    container.appendChild(img);
                })(apps[i]);
            }
        });
}

// ── Spinner config (unchanged from original) ──────────────────────────────────
var opts = {
    lines: 15, length: 29, width: 15, radius: 18,
    corners: 1, rotate: 48, direction: 1,
    color: '#FF6600', speed: 1.5, trail: 79,
    shadow: true, hwaccel: true,
    className: 'spinner', zIndex: 2e9,
    top: '50%', left: '50%'
};
