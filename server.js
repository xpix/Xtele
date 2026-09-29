// Einfacher Sync-Server: Statische Dateien + WebSocket-Relay pro "Raum".
// Jeder Raum merkt sich den letzten Stand (Text + Scroll-Position), damit
// neu verbundene Geräte sofort den aktuellen Zustand bekommen.

const express = require('express');
const http = require('http');
const os = require('os');
const path = require('path');
const { WebSocketServer } = require('ws');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

/** @type {Map<string, { text: string, scrollRatio: number, clients: Set<import('ws').WebSocket> }>} */
const rooms = new Map();

function getRoom(name) {
  if (!rooms.has(name)) {
    rooms.set(name, { text: '', scrollRatio: 0, clients: new Set() });
  }
  return rooms.get(name);
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const roomName = (url.searchParams.get('room') || 'default').slice(0, 64);
  const room = getRoom(roomName);
  room.clients.add(ws);
  ws.roomName = roomName;

  // Aktuellen Stand an neu verbundenen Client senden
  ws.send(JSON.stringify({ type: 'init', text: room.text, scrollRatio: room.scrollRatio }));

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    const currentRoom = getRoom(ws.roomName);

    if (msg.type === 'text' && typeof msg.content === 'string') {
      currentRoom.text = msg.content;
    } else if (msg.type === 'scroll' && typeof msg.ratio === 'number') {
      currentRoom.scrollRatio = Math.min(1, Math.max(0, msg.ratio));
    } else {
      return; // unbekannter Nachrichtentyp ignorieren
    }

    // an alle anderen Clients im selben Raum weiterleiten
    for (const client of currentRoom.clients) {
      if (client !== ws && client.readyState === client.OPEN) {
        client.send(JSON.stringify(msg));
      }
    }
  });

  ws.on('close', () => {
    room.clients.delete(ws);
    if (room.clients.size === 0) {
      rooms.delete(roomName);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Teleprompter-Server läuft auf http://localhost:${PORT}`);
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`  -> im Netzwerk erreichbar unter: http://${net.address}:${PORT}`);
      }
    }
  }
});
