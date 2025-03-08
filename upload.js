const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const multer = require('multer');
const cloudinary = require('./cloudinary'); // Ensure this file exists
const pool = require('./connections'); // Ensure this file exists
const fs = require('fs');
const path = require('path');
const comicsRoutes = require('./fetchapi.js'); // Ensure it exports a router
const cors = require('cors');

// Initialize Express
const app = express();

// Enable CORS (Allows API access from other devices)
app.use(cors());

// Middleware to parse JSON bodies
app.use(express.json());

// Set up Multer for file uploads
const upload = multer({ dest: 'uploads/' }); // Temporary storage

// **Fix: Ensure fetchapi.js exports a valid router**
app.use('/api', comicsRoutes);


const updateComicsJSON = async () => {
  try {
    const result = await pool.query('SELECT * FROM comics'); // Fetch latest comics
    const comics = result.rows;

    // Save updated comics to `comic.json`
    fs.writeFileSync('comic.json', JSON.stringify(comics, null, 2), 'utf8');

    // Notify all WebSocket clients about the update
    notifyClients({ type: 'update', comics });

    console.log('✅ comic.json updated successfully!');
  } catch (err) {
    console.error('❌ Error updating comic.json:', err);
  }
};


// Define Homepage Route (Reads `comic.json` and returns API list)
app.get('/', (req, res) => {
  const filePath = path.join(__dirname, 'comic.json');

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('❌ Error reading comic.json:', err);
      return res.status(500).json({ error: 'Failed to load API list.' });
    }

    try {
      const apiList = JSON.parse(data);
      res.json(apiList);
    } catch (parseError) {
      console.error('❌ Error parsing comic.json:', parseError);
      res.status(500).json({ error: 'Invalid JSON format in comic.json' });
    }
  });
});

// Define the upload route
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const result = await cloudinary.uploader.upload(req.file.path, {
      resource_type: 'raw',
    });

    const { title, description } = req.body;
    const cloudinaryUrl = result.secure_url;

    const query = `INSERT INTO comics (title, description, cloudinary_url) VALUES ($1, $2, $3) RETURNING *`;
    const values = [title, description, cloudinaryUrl];

    const newComic = await pool.query(query, values);
    fs.unlinkSync(req.file.path); // Remove local file

    // Update comic.json
    await updateComicsJSON();

    res.json({ message: 'Comic uploaded successfully!', comic: newComic.rows[0] });

    notifyClients({ type: 'add', comic: newComic.rows[0] });
  } catch (err) {
    console.error('❌ Error uploading comic:', err);
    res.status(500).json({ error: err.message });
  }
});
app.delete('/delete/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = 'DELETE FROM comics WHERE id = $1 RETURNING *';
    const values = [id];

    const deletedComic = await pool.query(query, values);
    if (deletedComic.rowCount === 0) {
      return res.status(404).json({ error: 'Comic not found' });
    }

    // Update comic.json
    await updateComicsJSON();

    res.json({ message: 'Comic deleted successfully!', comic: deletedComic.rows[0] });

    notifyClients({ type: 'delete', id });
  } catch (err) {
    console.error('❌ Error deleting comic:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/update/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;

    const query = `UPDATE comics SET title = $1, description = $2 WHERE id = $3 RETURNING *`;
    const values = [title, description, id];

    const updatedComic = await pool.query(query, values);
    if (updatedComic.rowCount === 0) {
      return res.status(404).json({ error: 'Comic not found' });
    }

    // Update comic.json
    await updateComicsJSON();

    res.json({ message: 'Comic updated successfully!', comic: updatedComic.rows[0] });

    notifyClients({ type: 'update', comic: updatedComic.rows[0] });
  } catch (err) {
    console.error('❌ Error updating comic:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create an HTTP server and bind Express app to it
const server = http.createServer(app);

// Initialize WebSocket server instance (Allow external connections)
const wss = new WebSocket.Server({ server });

// Function to notify clients
function notifyClients(update) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(update));
    }
  });
}


// Handle WebSocket connections
wss.on('connection', (ws, req) => {
  console.log(`✅ New client connected from ${req.socket.remoteAddress}`);

  ws.on('close', () => {
    console.log('❌ Client disconnected');
  });
});

// Define the port
const PORT = process.env.PORT || 8080;

// Start the server
server.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
