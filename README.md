# Xtele – Network-Synced Browser Teleprompter

A self-hosted, browser-based teleprompter that keeps every connected device — PC, Fire Tablet, phone, whatever's on your LAN — perfectly in sync. Load a script once and it instantly appears everywhere; scroll on any device (mouse, touch, keyboard, or a Bluetooth/USB remote) and every other screen scrolls along in real time. Built for creators who need to step away from the camera rig and keep controlling the script from their PC, with horizontal/vertical mirroring for beam-splitter glass attachments and flexible remote-control key mapping (keyboard, gamepad, and generic HID) built right in.

## Features

- **Text sync**: Load a `.txt` file → it instantly appears on every connected device.
- **Scroll sync**: Scrolling (mouse, touch, arrow keys) on one device scrolls all others (relative, content-based position – works across different screen sizes and even with vertical mirroring enabled).
- **Auto-scroll**: Adjustable speed (smooth even at very low values), start/pause via button, spacebar, or remote control.
- **Mirroring**: Horizontal (and optionally vertical) mirroring for prompter attachments/beam-splitter glass – **local per device**, not synced (usually only the device in the prompter rig needs mirroring).
- **Remote control**: Freely assignable key/gamepad bindings for Bluetooth/USB remotes – each action can have multiple bindings at once (e.g. spacebar **and** a remote button for Play/Pause). See section below.
- **Rooms**: Multiple independent sync groups via `?room=NAME` in the URL.

## Installation

Requirement: [Node.js](https://nodejs.org/) (version 18+).

```powershell
npm install
npm start
```

The console will then show something like:

```
Teleprompter server running at http://localhost:3000
  -> reachable on the network at: http://192.168.1.42:3000
```

## Usage with PC + Fire Tablet

1. Start the server on the PC (`npm start`). PC and Fire Tablet must be on the **same Wi-Fi**.
2. On the PC, open `http://<PC-IP>:3000` in a browser (the IP is shown in the console).
3. On the Fire Tablet, open the **Silk browser** (or Chrome/Firefox) and go to the same address.
4. Optional: Enter the same name in the "Room / device group" field on both devices and click "Join" (useful when several teleprompter setups run on the same network). By default everyone is in the `default` room.
5. Paste text or load a file → it's sent to all devices automatically.
6. On the tablet, enable "Mirror text" if needed (local only), enable fullscreen, and place the tablet in the prompter rig.
7. Keep scrolling on the PC (mouse, arrow keys, auto-scroll) – the tablet follows automatically. It works the other way around too.

### Firewall

If the tablet can't reach the PC: the Windows Firewall must allow incoming connections on the port used (default `3000`) for Node.js/the private network.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| Spacebar | Start/pause auto-scroll |
| Arrow up/down | Scroll manually |
| Home | Jump to the start |

This default binding can be changed or extended anytime in the "Remote control" section.

## Remote controls (Bluetooth/USB, e.g. Desview)

Many remotes (including Desview's) talk to their official app over a vendor-specific, proprietary Bluetooth profile – the browser can't read that directly. In practice, though, the hardware often still announces itself to the OS as a **standard HID device**, either as a keyboard or – as tested with Desview remotes – as a generic **gamepad**. Xtele detects both:

1. Pair the remote **not** in the manufacturer's app, but in the device's **Bluetooth settings** (Windows/Fire OS/Android).
2. In the "Remote control" section, click **"+ Assign key"** next to an action and press the desired button – keyboard and gamepad keys are detected automatically and shown as a chip (with "×" to remove).
3. Each action can have **multiple** keys/buttons at once (e.g. spacebar on the PC **and** a remote button).

### Diagnostics

If nothing is detected, the "Remote control diagnostics" section helps:

- Every keyboard and gamepad button press is logged live.
- "Connect raw HID device" uses the WebHID API to inspect raw input reports (Chrome/Edge only, requires HTTPS **or** `http://localhost:...` – not the LAN IP).
- If nothing shows up in Notepad/a text field when pressing the remote either, the device isn't sending standard HID reports and can't be integrated without reverse-engineering the manufacturer's protocol.

## Configuration

- Change the port: set the `PORT` environment variable, e.g. `PORT=8080 npm start`.

## Architecture

- `server.js`: Express serves the static files from `public/`; a WebSocket endpoint (`/ws`) relays text and scroll events to all clients in the same room and remembers the latest state for newly joining devices.
- `public/app.js`: Connects via WebSocket, sends text/scroll changes (throttled), applies incoming updates, manages local display settings (font size, mirroring, auto-scroll speed) via `localStorage`, and detects remote controls via keyboard events, the Gamepad API, and optionally WebHID.

## Contributing

Issues and pull requests are welcome. The project has no build pipeline – changes to `public/*` are visible immediately after a browser reload; a server restart is only needed for changes to `server.js`.

