const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const filePath = path.join(__dirname, 'upcoming_books.json');

async function syncUpcomingBooks() {
  try {
    if (!fs.existsSync(filePath)) {
      console.error('❌ JSON file not found:', filePath);
      return;
    }

    const data = fs.readFileSync(filePath, 'utf8');
    const books = JSON.parse(data);

    const formattedBooks = books.map((book) => ({
      title: book.title,
      description: book.description || '',
      genre: book.genre || '',
      release_date: book.release_date || null,
      cover_image_url: book.cover_image_url || '',
    }));

    const { data: currentBooks, error: fetchError } = await supabase
      .from('upcoming_books')
      .select('title');

    if (fetchError) {
      console.error('❌ Error fetching existing books:', fetchError.message);
      return;
    }

    const existingTitles = currentBooks.map((book) => book.title);
    const newTitles = formattedBooks.map((book) => book.title);

    const titlesToDelete = existingTitles.filter((title) => !newTitles.includes(title));

    if (titlesToDelete.length > 0) {
      await supabase.from('upcoming_books').delete().in('title', titlesToDelete);
      console.log(`✅ Deleted books: ${titlesToDelete.join(', ')}`);
    }

    const { error: upsertError } = await supabase
      .from('upcoming_books')
      .upsert(formattedBooks, { onConflict: ['title'] });

    if (upsertError) {
      console.error('❌ Supabase error:', upsertError.message);
    } else {
      console.log('✅ Upcoming books successfully synced!');
    }
  } catch (error) {
    console.error('❌ Error syncing database:', error);
  }
}

fs.watch(filePath, (eventType) => {
  if (eventType === 'change') {
    console.log('🔄 Detected change in upcoming_books.json, syncing...');
    syncUpcomingBooks();
  }
});

module.exports = syncUpcomingBooks;
