# Roku Remote

> A hand-coded Chrome App from 2017, abandoned when Google killed the platform, resurrected in 2026 with the help of AI.

---

## The Story

In 2017, I wanted to play a video URL on my Roku without fishing the physical remote out from under the couch cushions. There was no app for it. So I built one — a Chrome App that discovered your Roku over SSDP, let you paste an MP4 URL, and hit Play. The remote control was an afterthought. A few SVG buttons wired to Roku's External Control Protocol. One page of JavaScript, hand-typed, no frameworks, no Stack Overflow for the hard parts.

I shipped it. Then I mostly forgot about it.

Thousands of people installed it. It accumulated over a hundred reviews and a 3.1-star average. People used it for things I never imagined — fixing a muted TV without digging up the remote, reconnecting a Roku that had lost Wi-Fi. The remote half, which I'd treated as a feature footnote, turned out to matter more than the URL player I'd actually built it for. The one-star reviews were mostly people trying to stream YouTube, which was never going to work.

I learned three things from that:

1. **Users will surprise you.** The thing they end up using isn't always the thing you built.
2. **Bad UX isn't a docs problem.** When everyone makes the same mistake, the interface is wrong.
3. **Shipping is a long-term commitment.** The app kept running years after I stopped caring about it.

Then Google deprecated Chrome Apps. I walked away. The extension still exists in the store.

*Full story: [The Chrome Extension I Shipped, and Walked Away From](https://abhijeetapsunde.com/blog/the-chrome-extension-i-shipped-and-walked-away-from/)*

---

## The Resurrection

In 2026 I came back to it — not out of guilt, but curiosity. I wanted to see what AI-assisted development actually felt like on a real project with real history. I pulled the source code straight out of the Chrome Web Store `.crx`, dropped it in a repo, and started porting.

The original `ssdp.js` still works. The SSDP discovery logic, the ECP HTTP calls, the channel icon fetching — all of it is structurally sound. Nine years later the code holds up. What changed is everything around it: the platform (Chrome Apps → Electron), the tooling, and the interface.

The remote-control half lives on. The URL player is gone — Roku's ecosystem moved on and I don't want to maintain a companion channel I no longer have. What remains is a clean, fast, multi-device Roku remote that works on your desktop.

---

## What's Here

```
roku-remote/
├── original-chrome-app/    # The original 2017 source, extracted from the .crx
├── electron-app/           # The 2026 Electron port
└── emulator/               # Node.js fake Roku for testing (SSDP + ECP)
```

### Original Chrome App

The source as it shipped. `ssdp.js` is 362 lines of hand-written UDP multicast discovery and ECP remote control. `manifest.json` requires `chrome.socket` for raw UDP — the API that made this impossible to port to a normal web page and eventually made it impossible to maintain when Google killed Chrome Apps.

Notable: the variable names include `amuk` and `tukde` (Marathi for "pieces/fragments"). There's a comment that says `"stop the fucking wheel"`. It was written by a human, alone, before AI could write code.

### Electron App

A clean port of the remote functionality:

- **Multi-device** — discovers all Roku devices on the network simultaneously (SSDP multicast, 5-second scan), shows a device picker, remembers your last device
- **Device switcher** — tap the device name in the header to slide up a sheet and switch between all found devices
- **Channel grid** — full 3-column tile grid of your installed channels, not a scrolling strip
- **Dark UI** — Outfit font, Roku purple accent, cross-shaped d-pad with circular OK button
- **No URL player** — that ship has sailed

### Emulator

A Node.js process that pretends to be a Roku. Responds to SSDP M-SEARCH over UDP multicast and serves ECP HTTP endpoints. Run multiple instances to simulate a multi-device household.

```bash
node emulator/index.js --port 8060 --name "Living Room"
node emulator/index.js --port 8061 --name "Bedroom"
```

---

## Running It

```bash
# Clone
git clone https://github.com/abhiapsunde/roku-remote
cd roku-remote

# Start the emulator(s)
cd emulator && npm install
node index.js --port 8060 --name "Living Room" &
node index.js --port 8061 --name "Bedroom" &

# Start the app
cd ../electron-app && npm install && npm start
```

The app scans for 5 seconds, shows all discovered devices, auto-connects if there's only one. Works with real Roku devices too — just skip the emulator.

---

## How Embedding Works

The Electron app uses `dgram` for UDP (SSDP discovery) in the main process, bridged to the renderer via Electron's IPC. The renderer does all ECP HTTP calls directly with `fetch`. No native modules beyond Electron itself.

```
main process          renderer process
─────────────         ─────────────────
dgram (UDP)    ←IPC→  fetch (HTTP/ECP)
SSDP discover         button clicks
return devices        channel icons
```

---

## On AI-Assisted Development

The port took one session. The original took weeks of evenings in 2017. That's not a knock on the original — the original was figuring things out from scratch: reading the Roku ECP docs, understanding SSDP, writing raw UDP socket code in a Chrome App sandbox with almost no documentation.

The AI session was different. The hard decisions (SSDP → dgram, chrome.storage → localStorage, chrome.app.window → BrowserWindow) were obvious once you understood the original. The AI executed. The understanding came from nine years of context that only a human who shipped the original could have.

The code that holds up is the 2017 code. The UI that looks good is the 2026 code. Make of that what you will.

---

## License

MIT © Abhijeet Apsunde
