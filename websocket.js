const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
  console.log('New client connected');

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// Function to notify clients
function notifyClients(newComic) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(newComic));
    }
  });
}

module.exports = { notifyClients };
