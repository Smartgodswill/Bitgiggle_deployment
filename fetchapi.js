const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const filePath = path.join(__dirname, 'comic.json');

/**
 * Sync JSON file with Supabase
 */
async function syncDatabaseWithJSON() {
  try {
    if (!fs.existsSync(filePath)) {
      console.error('❌ JSON file not found:', filePath);
      return;
    }

    const data = fs.readFileSync(filePath, 'utf8');
    const comics = JSON.parse(data);

    // Ensure each comic has a title
    const formattedComics = comics.map((comic) => ({
      title: comic.title,
      description: comic.description || '',
      genre: comic.genre || '',
      year: comic.year || null,
      cloudinary_url: comic.images ? JSON.stringify(comic.images) : '[]',
    }));

    // Get current comics from Supabase
    const { data: currentComics, error: fetchError } = await supabase.from('comics').select('title');

    if (fetchError) {
      console.error('❌ Error fetching existing comics:', fetchError.message);
      return;
    }

    const existingTitles = currentComics.map((comic) => comic.title);
    const newTitles = formattedComics.map((comic) => comic.title);

    // Delete comics that are no longer in the JSON file
    const titlesToDelete = existingTitles.filter((title) => !newTitles.includes(title));

    if (titlesToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('comics')
        .delete()
        .in('title', titlesToDelete).limit(10);

      if (deleteError) {
        console.error('❌ Error deleting removed comics:', deleteError.message);
      } else {
        console.log(`✅ Deleted comics: ${titlesToDelete.join(', ')}`);
      }
    }

    // Insert or update comics from JSON file
    const { error: upsertError } = await supabase
      .from('comics')
      .upsert(formattedComics, { onConflict: ['title'] });

    if (upsertError) {
      console.error('❌ Supabase error:', upsertError.message);
    } else {
      console.log('✅ Database successfully synced with JSON!');
    }
  } catch (error) {
    console.error('❌ Error syncing database:', error);
  }
}

/**
 * Watch for file changes and sync automatically
 */
fs.watch(filePath, (eventType) => {
  if (eventType === 'change') {
    console.log('🔄 Detected change in comic.json, syncing...');
    syncDatabaseWithJSON();
  }
});

// Export function for manual execution if needed
module.exports = syncDatabaseWithJSON;
