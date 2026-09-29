// Simple sync server: static files + WebSocket relay per "room".
// Each room remembers the latest state (text + scroll position) so that
// newly connected devices immediately receive the current state.

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

  // send current state to the newly connected client
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
      return; // ignore unknown message type
    }

    // relay to all other clients in the same room
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
  console.log(`Teleprompter server running at http://localhost:${PORT}`);
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`  -> reachable on the network at: http://${net.address}:${PORT}`);
      }
    }
  }
});
