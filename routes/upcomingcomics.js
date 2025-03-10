const express = require('express');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const router = express.Router();
const filePath = path.join(__dirname, '../upcomingcomics.json');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * Sync JSON file with Supabase upcoming_books table
 */
async function syncUpcomingComics() {
  try {
    if (!fs.existsSync(filePath)) {
      console.error('❌ JSON file not found:', filePath);
      return;
    }

    const data = fs.readFileSync(filePath, 'utf8');
    const comics = JSON.parse(data);

    const formattedComics = comics.map((book) => ({
      title: book.title,
      author: book.author || '',
      description: book.description || '',
      genre: book.genre || '',
      release_date: book.release_date || null,
      status: book.status || 'upcoming',
      pre_order: book.pre_order || false,
      cloudinary_url: Array.isArray(book.images) ? book.images : [], // Ensuring it's an array
    }));

    // Fetch current titles from Supabase
    const { data: currentComics, error: fetchError } = await supabase.from('upcoming_books').select('title');

    if (fetchError) {
      console.error('❌ Error fetching existing comics:', fetchError.message);
      return;
    }

    const existingTitles = currentComics.map((comic) => comic.title);
    const newTitles = formattedComics.map((comic) => comic.title);

    // Delete comics that no longer exist in the JSON file
    const titlesToDelete = existingTitles.filter((title) => !newTitles.includes(title));

    if (titlesToDelete.length > 0) {
      const { error: deleteError } = await supabase.from('upcoming_books').delete().in('title', titlesToDelete);
      if (deleteError) console.error('❌ Error deleting removed comics:', deleteError.message);
      else console.log(`✅ Deleted comics: ${titlesToDelete.join(', ')}`);
    }

    // Upsert new comics
    const { error: upsertError } = await supabase.from('upcoming_books').upsert(formattedComics, { onConflict: ['title'] });

    if (upsertError) {
      console.error('❌ Supabase error:', upsertError.message);
    } else {
      console.log('✅ Upcoming comics successfully synced!');
    }
  } catch (error) {
    console.error('❌ Error syncing database:', error);
  }
}

// ✅ Automatically sync when JSON file changes
fs.watch(filePath, (eventType) => {
  if (eventType === 'change') {
    console.log('🔄 Detected change in upcomingcomics.json, syncing...');
    syncUpcomingComics();
  }
});

/**
 * Fetch all upcoming comics from Supabase
 */
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase.from('upcoming_books').select('*');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load upcoming comics' });
  }
});

/**
 * Add a new upcoming comic
 */
router.post('/add', async (req, res) => {
  try {
    const { title, author, description, genre, release_date, pre_order, images } = req.body;

    const { data, error } = await supabase.from('upcoming_books').insert([
      {
        title,
        author,
        description,
        genre,
        release_date,
        pre_order,
        cloudinary_url: Array.isArray(images) ? images : [], // Ensuring it's an array
      },
    ]);

    if (error) throw error;

    await syncUpcomingComics();
    res.json({ message: 'Upcoming comic added!', comic: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Update an existing upcoming comic
 */
router.put('/update/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, author, description, genre, release_date, pre_order, images } = req.body;

    const { data, error } = await supabase
      .from('upcoming_books')
      .update({
        title,
        author,
        description,
        genre,
        release_date,
        pre_order,
        cloudinary_url: Array.isArray(images) ? images : [], // Ensuring it's an array
      })
      .eq('id', id)
      .select('*'); // Fetch updated record

    if (error) throw error;

    await syncUpcomingComics();
    res.json({ message: 'Upcoming comic updated!', comic: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Delete an upcoming comic
 */
router.delete('/delete/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase.from('upcoming_books').delete().eq('id', id);

    if (error) throw error;

    await syncUpcomingComics();
    res.json({ message: 'Upcoming comic deleted!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
