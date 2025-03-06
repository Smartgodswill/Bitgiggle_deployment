const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const multer = require('multer');
const cloudinary = require('./cloudinary');
const pool = require('./connections');
const fs = require('fs');
const path = require('path');
const comicsRoutes = require('./fetchapi.js');
const cors = require('cors'); // Allow Cross-Origin Requests

// Initialize Express
const app = express();

// Enable CORS (Allows API access from other devices)
app.use(cors());

// Middleware to parse JSON bodies
app.use(express.json());

// Set up Multer for file uploads
const upload = multer({ dest: 'uploads/' }); // Temporary storage

// Serve Custom APIs from fetchapi.js
app.use('/api', comicsRoutes);

// Define Homepage Route (Reads `comic.json` and returns API list)
app.get('/', (req, res) => {
  const filePath = path.join(__dirname, 'comic.json');

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading comic.json:', err);
      return res.status(500).json({ error: 'Failed to load API list.' });
    }

    try {
      const apiList = JSON.parse(data);
      res.json(apiList);
    } catch (parseError) {
      console.error('Error parsing comic.json:', parseError);
      res.status(500).json({ error: 'Invalid JSON format in comic.json' });
    }
  });
});

// Define the upload route
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    // Upload file to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      resource_type: 'raw',
    });

    // Get form data
    const { title, description } = req.body;
    const cloudinaryUrl = result.secure_url;

    // Insert into PostgreSQL
    const query = `INSERT INTO comics (title, description, cloudinary_url) VALUES ($1, $2, $3) RETURNING *`;
    const values = [title, description, cloudinaryUrl];

    const newComic = await pool.query(query, values);

    // Delete local file after upload
    fs.unlinkSync(req.file.path);

    // Send response
    res.json({ message: 'Comic uploaded successfully!', comic: newComic.rows[0] });

    // Notify WebSocket clients about the new comic
    notifyClients(newComic.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Create an HTTP server and bind Express app to it
const server = http.createServer(app);

// Initialize WebSocket server instance (Allow external connections)
const wss = new WebSocket.Server({ server });

// Function to notify clients
function notifyClients(newComic) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(newComic));
    }
  });
}

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
  console.log(`New client connected from ${req.socket.remoteAddress}`);

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// Define the port
const PORT = process.env.PORT || 8080;

// Start the server (Allow external connections)
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running on http://0.0.0.0:${PORT}`);
});
