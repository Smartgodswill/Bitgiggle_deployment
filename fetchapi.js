const express = require('express');
const fs = require('fs');
const path = require('path'); // ✅ Import path module for cross-platform file paths
const pool = require('./connections'); // ✅ Ensure this file correctly sets up PostgreSQL connection

const router = express.Router();
const filePath = path.join(__dirname, 'comic.json'); // ✅ Correct path

// Function to insert/update comics into PostgreSQL
async function updateDatabase() {
  try {
    if (!fs.existsSync(filePath)) {
      console.error('❌ JSON file not found:', filePath);
      return;
    }

    const data = fs.readFileSync(filePath, 'utf8'); // ✅ Read file synchronously
    const comics = JSON.parse(data); // ✅ Convert JSON to JavaScript object

    for (const comic of comics) {
      const query = `
        INSERT INTO comics (title, description, genre, year, cloudinary_url, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (title) 
        DO UPDATE SET 
          description = EXCLUDED.description,
          genre = EXCLUDED.genre,
          year = EXCLUDED.year,
          cloudinary_url = EXCLUDED.cloudinary_url,
          created_at = NOW()
        RETURNING *;
      `;

      const values = [
        comic.title, 
        comic.description || '', // ✅ Ensure default empty string if null
        comic.genre || '', // ✅ Ensure default empty string if null
        comic.year || null, 
        JSON.stringify(Array.isArray(comic.images) ? comic.images : []) // ✅ Store as JSON array
      ];

      const result = await pool.query(query, values);
      console.log('✅ Updated:', result.rows[0]); 
    }

    console.log('✅ JSON data successfully updated in PostgreSQL!');
  } catch (error) {
    console.error('❌ Error inserting/updating data:', error);
  }
}

// **API Route to Manually Trigger Database Update**
router.get('/update-database', async (req, res) => {
  try {
    await updateDatabase();
    res.json({ message: '✅ Database updated successfully!' });
  } catch (error) {
    res.status(500).json({ error: '❌ Failed to update database' });
  }
});

// **API Route to Fetch Comics**
router.get('/comics', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM comics ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: '❌ Failed to fetch comics' });
  }
});

// **Watch for JSON file changes and update DB automatically (ONLY FOR LOCAL USE)**
if (process.env.NODE_ENV !== 'production') {
  fs.watch(filePath, (eventType) => {
    if (eventType === 'change') {
      console.log('🔄 Detected change in JSON file... Updating database...');
      updateDatabase();
    }
  });
}

// **Initial run to load existing data when script starts**
updateDatabase();

// **Export router correctly**
module.exports = router;
