const express = require('express'); // ✅ Import express before using it
const fs = require('fs');
const pool = require('./connections'); // ✅ Ensure the path is correct

const router = express.Router();
const filePath = 'C:/apis/comic.json';

// Function to insert/update comics into PostgreSQL
async function updateDatabase() {
  try {
    const data = fs.readFileSync(filePath, 'utf8'); // ✅ Use readFileSync for synchronous reading
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
        comic.description || '', // Ensure it's not null
        comic.genre || '', // Ensure it's not null
        comic.year || null, 
        Array.isArray(comic.images) ? comic.images: [] // Store only the first image
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

// **Watch for JSON file changes and update DB automatically**
fs.watch(filePath, (eventType) => {
  if (eventType === 'change') {
    console.log('🔄 Detected change in JSON file... Updating database...');
    updateDatabase();
  }
});

// **Initial run to load existing data when script starts**
updateDatabase();

// **Export router correctly**
module.exports = router;
