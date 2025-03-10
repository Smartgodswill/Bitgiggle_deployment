const WebSocket = require('ws');

let wss;
const initializeWebSocket = (server) => {
  wss = new WebSocket.Server({ server });

  wss.on('connection', (ws, req) => {
    console.log(`✅ New client connected from ${req.socket.remoteAddress}`);

    ws.on('close', () => console.log('❌ Client disconnected'));
  });
};

const notifyClients = (update) => {
  if (!wss) return;

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(update));
    }
  });
};

module.exports = { initializeWebSocket, notifyClients };
