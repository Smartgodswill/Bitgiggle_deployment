const express = require('express');
const http = require('http');
const cors = require('cors');
const comicsRoutes = require('./routes/allcomics');
const upcomingComicsRoutes = require('./routes/upcomingcomics');
const { initializeWebSocket } = require('./websocket');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/comics', comicsRoutes);
app.use('/api/upcoming-comics', upcomingComicsRoutes);

// Start Server
const PORT = process.env.PORT || 50000;
server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));

// Initialize WebSocket
initializeWebSocket(server);
